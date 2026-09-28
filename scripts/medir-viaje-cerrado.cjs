#!/usr/bin/env node
/**
 * ¿EL VIAJE YA SE ACABÓ? — gemelo G20 (28-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-viaje-cerrado.cjs            (datos de producción + las pantallas)
 *   node scripts/medir-viaje-cerrado.cjs --sin-red  (solo las pantallas)
 *
 * La rutina del servidor `expirarViajesColgados` cierra los viajes que nadie cerró: los pone en `vencido` (nadie lo
 * tomó) o en `expirado` (lo tomaron y se quedó a medias), y escribe el porqué en `motivoExpiracion`. Hasta el
 * 28-sep-2026 NINGUNA de las dos pantallas que tienen el viaje abierto se enteraba: el conductor seguía en «voy a
 * recoger» o «en viaje» y el pasajero seguía viendo a su conductor en camino, de un viaje que ya no existía.
 *
 * Este guion mide DOS cosas:
 *   1. DATOS (producción): cuántos viajes cerró el servidor, y cuántos de ésos tenían a alguien dentro (un conductor
 *      ya asignado), o sea a quién le pudo pasar.
 *   2. CÓDIGO: saca de los archivos los vigilantes del viaje de las dos pantallas y los CORRE con un viaje de mentira
 *      en cada estado final, para ver qué hace cada pantalla. No copia nada: lee lo que hay hoy. Por eso sirve para
 *      carear el código de antes con el de ahora (el paso 1 y el paso 12 con el mismo contador).
 * No escribe nada.
 */
const { leer, soloCodigo, cuerpoDeLaFuncion, cargarDeLaApp } = require('../pruebas/cargar.cjs');

// ── EL ÁMBITO DE MENTIRA ───────────────────────────────────────────────────────
//  El cuerpo del vigilante se corre dentro de un `with`: lo que se le da a mano sale de `fijos`; cualquier otro nombre
//  que el código nombre y no sea de JavaScript (un `setFase`, un `doc`, un ref) se vuelve un ESPÍA que apunta con qué
//  se le llamó. Así el guion no tiene que saber de antemano qué funciones usa la pantalla: si mañana la pantalla
//  llama a otra, se apunta igual.
function ambitoDeMentira(fijos) {
  const llamadas = [];
  const base = { ...fijos };
  const espias = {};
  const ambito = new Proxy(base, {
    has: (o, k) => typeof k === 'string' && (k in o || !(k in globalThis)),
    get: (o, k) => {
      if (k === Symbol.unscopables) return undefined;
      if (k in o) return o[k];
      if (!espias[k]) espias[k] = (...a) => { llamadas.push([k, ...a]); return undefined; };
      return espias[k];
    },
    set: (o, k, v) => { o[k] = v; return true; },
  });
  return { ambito, llamadas };
}

const espia = (llamadas, nombre) => (...a) => { llamadas.push([nombre, ...a]); return undefined; };

/** El cuerpo de la función que abre en el ancla, que tiene que estar UNA sola vez en el archivo. */
function cuerpoEn(codigo, ancla, archivo) {
  const i = codigo.indexOf(ancla);
  if (i < 0) throw new Error(archivo + ': no encuentro «' + ancla + '». Si se escribió de otra forma, hay que '
    + 'enseñarle al medidor dónde está el vigilante del viaje; sin él no se puede decir nada.');
  if (codigo.indexOf(ancla, i + 1) >= 0) throw new Error(archivo + ': «' + ancla + '» aparece más de una vez.');
  const c = cuerpoDeLaFuncion(codigo, i);
  if (!c) throw new Error(archivo + ': no pude sacar el cuerpo de «' + ancla + '».');
  return c.texto;
}

// Los vigilantes del viaje, sacados del archivo. El ancla es el renglón que ABRE cada uno.
const VIGILANTES = {
  conductorEnCurso: {
    archivo: 'guajirago/src/AppConductor.js',
    ancla: "const unsub = onSnapshot(doc(db, 'viajes', viajeActual.id), (snap) => {",
    asincrono: false,
  },
  conductorOfertas: {
    archivo: 'guajirago/src/AppConductor.js',
    ancla: "const unsub = onSnapshot(doc(db, 'viajes', idViaje), (snap) => {",
    asincrono: false,
  },
  pasajeroEnVivo: {
    archivo: 'guajirago/src/Solicitar.js',
    ancla: "const unsub = onSnapshot(doc(db, 'viajes', viajeId), (snap) => {",
    asincrono: false,
    // G22: desde el 28-sep-2026 los dos vigilantes del pasajero llaman a UNA reacción, `reaccionarAlViaje`.
    ayudantes: ['const elServidorCerroElViaje = (data) => {', 'const reaccionarAlViaje = (data) => {'],
  },
  pasajeroRespaldo: {
    archivo: 'guajirago/src/Solicitar.js',
    ancla: 'intervaloRespaldoRef.current = setInterval(async () => {',
    asincrono: true,
    ayudantes: ['const elServidorCerroElViaje = (data) => {', 'const reaccionarAlViaje = (data) => {'],
  },
};

/**
 * Corre UN vigilante con un viaje de mentira y devuelve las llamadas que hizo.
 * @param nombre   uno de VIGILANTES
 * @param viaje    el documento del viaje (lo que devolvería Firestore)
 * @param pantalla la pantalla en la que está la persona ('fase1', 'fase2', 'recogiendo', 'en_viaje'...)
 * @param fuentes  { archivo: código } para correr OTRO código que el del disco (el careo y la prueba lo usan)
 * @param extras   valores del ámbito que se le dan a mano además de los de siempre (G22: un ref compartido entre dos
 *                 corridas, para ver qué hace el respaldo con un viaje que el vigilante en vivo ya vio)
 */
async function correrVigilante(nombre, viaje, pantalla, fuentes = {}, extras = {}) {
  const v = VIGILANTES[nombre];
  const codigo = soloCodigo(fuentes[v.archivo] != null ? fuentes[v.archivo] : leer(v.archivo));
  const cuerpo = cuerpoEn(codigo, v.ancla, v.archivo);
  // Las funciones de la misma pantalla que el vigilante llama: se sacan del archivo y se definen al lado, para que
  // se CORRA la de verdad y no un espía. Si el archivo no la tiene (el código de antes), no se define y queda espía.
  const ayudantes = (v.ayudantes || []).filter((a) => codigo.includes(a))
    .map((a) => a + cuerpoEn(codigo, a, v.archivo) + '};\n').join('');
  const snap = { exists: () => true, data: () => ({ ...viaje }) };
  const llamadas = [];
  const fijos = {
    snap,
    getDoc: async () => snap,
    // La pieza de verdad de estadosViaje.js (con lo que tenga hoy): la pantalla la importa, y aquí se le da la misma.
    ...cargarDeLaApp('guajirago/src/estadosViaje.js'),
    // El estado de la pantalla.
    fase: pantalla, faseRef: { current: pantalla }, pantallaRef: { current: pantalla },
    viajeActual: { id: 'v1', pasajeroNombre: 'Ana' },
    viajeId: 'v1', idViaje: 'v1', miId: 'yo',
    celebrando: false, celebrandoRef: { current: false }, conductorEnPunto: false, descuentoPendiente: null,
    confirmacionMostradaRef: { current: false }, contaofertasIdsRef: { current: new Set() },
    descartadosRef: { current: {} }, contadorRef: { current: 7 }, contadorBusquedaRef: { current: 8 },
    radioRef: { current: null }, intervaloRespaldoRef: { current: 9 },
    // Lo que tiene efecto fuera: se espía, nunca se corre de verdad.
    setTimeout: espia(llamadas, 'setTimeout'), clearTimeout: espia(llamadas, 'clearTimeout'),
    clearInterval: espia(llamadas, 'clearInterval'), setInterval: espia(llamadas, 'setInterval'),
    console: { log: () => {}, error: () => {} },
    ...extras,
  };
  const { ambito, llamadas: otras } = ambitoDeMentira(fijos);
  // eslint-disable-next-line no-new-func
  const f = new Function('ambito', 'with (ambito) { ' + ayudantes + 'return (' + (v.asincrono ? 'async ' : '') + '() => {'
    + cuerpo + '\n})(); }');
  await f(ambito);
  return [...llamadas, ...otras];
}

/**
 * ¿QUÉ HIZO LA PANTALLA? `seEntera` dice si la persona SALE del viaje (o ve su final); `aviso` es la ventanita que le
 * quedó para leer, si hay alguna.
 */
function queHizo(nombre, llamadas) {
  const con = (n) => llamadas.filter((l) => l[0] === n);
  // La ventanita que de verdad se PINTA es la de `setAviso` (las dos pantallas la llevan en todas sus vistas). Lo que
  // se guarda en `viajeCerrado` es el texto de la pantalla de debajo: no cuenta como ventanita. (Contarlo dejó
  // escapar un sabotaje que quitaba la ventanita del pasajero.)
  const avisos = con('setAviso').map((l) => l[1]).filter((a) => a && a.texto);
  if (nombre === 'conductorOfertas') {
    return { seEntera: con('cerrarEsteVigilante').length > 0, aviso: null };
  }
  if (nombre === 'conductorEnCurso') {
    const fases = con('setFase').map((l) => l[1]);
    return { seEntera: fases.includes(null) || fases.includes('cancelado_pasajero'), aviso: avisos[0] || null };
  }
  // El pasajero: sale si cambia de pantalla, si le sale la calificación o si le queda la ventanita del cierre.
  const sale = con('setPantalla').length > 0 || con('setMostrarCalificacion').some((l) => l[1] === true)
    || con('setViajeCerrado').some((l) => l[1]);
  return { seEntera: sale, aviso: avisos[0] || null };
}

// Los casos: cada final, en cada pantalla donde la persona tiene el viaje abierto. `loHizoEl` marca los finales que
// escribe la PROPIA persona de esa pantalla: ahí la pantalla ya sabe lo que pasó y no tiene que avisarle nada.
function losCasos(ESTADOS_TERMINADOS) {
  const casos = [];
  const motivo = 'lleva 200 min en «en_viaje» y nadie lo cerró';
  // La FASE guardada va con la pantalla, como en la calle: mientras el conductor va a recoger no hay fase (así se
  // quedaron 4 de los 8 que cerró el servidor), al llegar es `en_punto`, y con el pasajero montado `en_viaje`.
  const FASE_DE = { recogiendo: undefined, en_punto: 'en_punto', en_viaje: 'en_viaje', fase1: undefined, fase2: 'en_viaje' };
  for (const estado of ESTADOS_TERMINADOS) {
    const base = { estado, conductorId: 'yo', motivoExpiracion: motivo };
    if (estado === 'cancelado') { base.canceladoPor = 'pasajero'; base.razonCancelacion = 'Ya no lo necesito'; }
    const conFase = (p) => (FASE_DE[p] ? { ...base, fase: FASE_DE[p] } : { ...base });
    for (const pantalla of ['recogiendo', 'en_punto', 'en_viaje']) {
      casos.push({ vigilante: 'conductorEnCurso', estado, pantalla, viaje: conFase(pantalla),
        loHizoEl: ['finalizado', 'cancelado_conductor'].includes(estado) });
    }
    casos.push({ vigilante: 'conductorOfertas', estado, pantalla: null, viaje: { ...base, conductorId: null }, loHizoEl: false });
    for (const pantalla of ['fase1', 'fase2']) {
      for (const vig of ['pasajeroEnVivo', 'pasajeroRespaldo']) {
        casos.push({ vigilante: vig, estado, pantalla, viaje: conFase(pantalla),
          // `cancelado` lo escribe el pasajero; `finalizado` en fase1 no pasa (el conductor finaliza en marcha).
          loHizoEl: estado === 'cancelado' || (estado === 'finalizado' && pantalla === 'fase1') });
      }
    }
  }
  return casos;
}

/** Corre todos los casos contra el código (el del disco, o el que se le pase) y dice cuáles se quedan ciegos. */
async function medirPantallas(fuentes = {}) {
  const { ESTADOS_TERMINADOS } = cargarDeLaApp('guajirago/src/estadosViaje.js');
  const filas = [];
  for (const c of losCasos(ESTADOS_TERMINADOS)) {
    const r = queHizo(c.vigilante, await correrVigilante(c.vigilante, c.viaje, c.pantalla, fuentes));
    filas.push({ ...c, ...r, ciego: !c.loHizoEl && !r.seEntera });
  }
  return filas;
}

async function medirDatos() {
  const { traer, doc } = require('./nube.cjs');
  const viajes = (await traer('viajes')).map(doc);
  const porEstado = {};
  for (const v of viajes) porEstado[v.estado || '(sin estado)'] = (porEstado[v.estado || '(sin estado)'] || 0) + 1;
  const delServidor = viajes.filter((v) => v.expiradoPor === 'sistema');
  const conAlguienDentro = delServidor.filter((v) => v.conductorId);
  const porFase = {};
  for (const v of conAlguienDentro) porFase[v.fase || '(sin fase)'] = (porFase[v.fase || '(sin fase)'] || 0) + 1;
  const sinMotivo = delServidor.filter((v) => !v.motivoExpiracion).length;
  return { total: viajes.length, porEstado, delServidor: delServidor.length, conAlguienDentro: conAlguienDentro.length,
    porFase, sinMotivo };
}

async function main() {
  if (!process.argv.includes('--sin-red')) {
    const d = await medirDatos();
    console.log('🚕 viajes en producción: ' + d.total);
    console.log('   por estado: ' + Object.entries(d.porEstado).map(([k, n]) => k + '=' + n).join(' · '));
    console.log('   cerrados por el servidor (expiradoPor=sistema): ' + d.delServidor
      + ' · con conductor ya asignado: ' + d.conAlguienDentro
      + ' (' + Object.entries(d.porFase).map(([k, n]) => k + '=' + n).join(', ') + ')'
      + ' · sin motivoExpiracion: ' + d.sinMotivo);
  }
  const filas = await medirPantallas();
  const ciegos = filas.filter((f) => f.ciego);
  console.log('\n📱 las pantallas, corridas con un viaje de mentira en cada final (' + filas.length + ' casos):');
  for (const f of filas) {
    const marca = f.loHizoEl ? '·' : (f.seEntera ? '✓' : '🔴');
    console.log('   ' + marca + ' ' + f.vigilante.padEnd(17) + ' ' + String(f.pantalla || '-').padEnd(10) + ' '
      + f.estado.padEnd(20) + (f.loHizoEl ? 'lo escribió esa misma persona' : (f.seEntera ? 'se entera' : 'NO SE ENTERA'))
      + (f.aviso ? ' · ventanita: «' + f.aviso.texto + '»' : ''));
  }
  console.log('\n' + (ciegos.length ? '🔴 ' + ciegos.length + ' casos en que la pantalla NO se entera de que el viaje se acabó'
    : '✓ en todos los casos la pantalla se entera de que el viaje se acabó'));
  const sinVentanita = filas.filter((f) => ['vencido', 'expirado'].includes(f.estado) && f.vigilante !== 'conductorOfertas'
    && f.seEntera && !f.aviso);
  if (sinVentanita.length) console.log('🔴 ' + sinVentanita.length + ' casos del servidor en que la pantalla sale SIN decir por qué');
}

if (require.main === module) main().catch((e) => { console.error('⛔ ' + e.message); process.exit(1); });

module.exports = { VIGILANTES, correrVigilante, queHizo, medirPantallas, losCasos, ambitoDeMentira };
