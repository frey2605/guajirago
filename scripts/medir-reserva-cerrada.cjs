#!/usr/bin/env node
/**
 * P16 · LA RESERVA DE TURISMO QUE MANDA EL CLIENTE — SOLO LECTURA
 *
 *   node scripts/medir-reserva-cerrada.cjs                   el código de hoy (sin red)
 *   node scripts/medir-reserva-cerrada.cjs --commit 9f0be79  el código de antes de P16
 *   node scripts/medir-reserva-cerrada.cjs --nube            además, las reservas y los tours de PRODUCCIÓN
 *   node scripts/medir-reserva-cerrada.cjs --publicado       además, los paquetes PUBLICADOS de la app y de aliados
 *
 * Los dos pendientes (hijos de P13 y P15):
 *   · la app (enviarReserva, guajirago/src/Turismo.js) manda `nombreTour` y `tourId` tal cual vienen del tour; si al
 *     tour le falta uno, va un `undefined` y Firestore rechaza la reserva en el propio teléfono, siempre.
 *   · las reglas de `reservasTurismo` no tenían lista cerrada de campos ni topes: el cliente podía crear su reserva con
 *     cualquier campo y de casi 1 MiB, y después cambiarle cualquier cosa (hasta confirmarla él mismo).
 *
 * Mide, sin escribir nada en ningún sitio:
 *   1. LA APP EJECUTADA: se saca de Turismo.js (el de hoy o el de un commit) el bloque del total y del envío —desde
 *      `totalReserva` hasta el final de `enviarReserva`— y se corre como la pantalla, con tours a los que les falta un
 *      dato. Lo que la app le pasa a `addDoc` se le da a la librería de verdad de Firestore (la de la app, sin
 *      escribir: medir-pedido-sin-indefinidos.cjs, loQueDiceFirestore). Dice si la reserva salió, con qué ventanita,
 *      dónde iba el `undefined`, y si lo que mandó cabe en la lista cerrada de las reglas.
 *   2. QUIÉN ESCRIBE: los campos que escriben en `reservasTurismo` la app y aliados (el código, o el paquete publicado
 *      con --publicado), contra las listas de las reglas. Una lista cerrada a la que le falte uno rompe la app sin ruido.
 *   3. Con --nube: las reservas y los tours de producción (campos, tamaños, tours sin nombre o sin id).
 *   4. EL PRECIO: quién decide el `total` de la reserva (se anota; P16 no lo arregla).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { cargarDeLaApp, cuerpoDeLaFuncion } = require('../pruebas/cargar.cjs');
const { clavesDelObjeto } = require('./medir-pedido-cerrado.cjs');
const { loQueDiceFirestore, dondeHayIndefinidos } = require('./medir-pedido-sin-indefinidos.cjs');

const RAIZ = path.resolve(__dirname, '..');
const PANTALLA = 'guajirago/src/Turismo.js';
const ALIADOS = 'guajirago-aliados/src/ReservasTurismo.js';
const sinCR = (t) => t.replace(/\r\n/g, '\n');

function leerRaiz(commit, rel) {
  if (!commit) return fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  return execFileSync('git', ['show', commit + ':' + rel], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

// ── 1. LA APP EJECUTADA ──

const AGENCIA = { id: 'ag1', nombre: 'Wayuu Tours', tipoNegocio: 'turismo' };
const TOUR = { id: 'tour_1', tipo: 'tour', nombre: 'Cabo De La Vela 2 Días', precio: 250000, unidadPrecio: 'persona', imagen: 'https://firebasestorage.googleapis.com/x.jpg', disponible: true };
const sinCampo = (o, k) => { const r = { ...o }; delete r[k]; return r; };

/** Los casos: el tour y la agencia que tiene la pantalla abiertos cuando el cliente toca «Enviar reserva». */
const CASOS = [
  { caso: 'honrado · tour por persona, 2 personas', tour: TOUR, honrado: true },
  { caso: 'honrado · alquiler por día', tour: { ...TOUR, id: 'tour_2', tipo: 'alquiler', nombre: 'Alquiler De Lancha', precio: 400000, unidadPrecio: 'dia' }, honrado: true },
  { caso: 'FALTA · el tour no tiene nombre', tour: sinCampo(TOUR, 'nombre'), falta: true },
  { caso: 'FALTA · el nombre del tour no es texto (un número)', tour: { ...TOUR, nombre: 123 }, falta: true },
  { caso: 'FALTA · el tour no tiene id', tour: sinCampo(TOUR, 'id'), falta: true },
  { caso: 'FALTA · el tour no tiene nombre ni id', tour: sinCampo(sinCampo(TOUR, 'id'), 'nombre'), falta: true },
  { caso: 'FALTA · la agencia no tiene nombre', tour: TOUR, agencia: sinCampo(AGENCIA, 'nombre'), falta: true },
  { caso: 'FALTA · el tour no tiene tipo, ni foto, ni unidad, ni precio', tour: { id: 'tour_3', nombre: 'Tour Sin Datos' }, falta: true },
];

/** La pantalla sacada de Turismo.js y ejecutada: devuelve un «aparato» con su estado y su envío. */
function pantallaDe(fuente) {
  const f = sinCR(fuente);
  const a = f.indexOf('  const totalReserva = () => {');
  const b = f.indexOf('  const cargarMisReservas = ');
  if (a < 0 || b < a) throw new Error('no está el bloque del total y del envío en ' + PANTALLA);
  const bloque = f.slice(a, b);
  // eslint-disable-next-line no-new-func
  const hacer = new Function('ambito', 'with (ambito) {' + bloque + '\nreturn { totalReserva, enviarReserva }; }');
  const tel = cargarDeLaApp('guajirago/src/telefonoValido.js');
  const pieza = cargarDeLaApp('guajirago/src/precioPedido.js');

  return function aparato({ tour, agencia = AGENCIA }) {
    const estado = { tourReserva: tour, agenciaActiva: agencia, fecha: '2026-10-05', personas: '2', telefono: '300 140 0140', cliente: 'Ana', notas: 'somos 2 adultos', enviando: false, aviso: '', exito: null };
    const mandados = [];
    const poner = (k) => (v) => { estado[k] = typeof v === 'function' ? v(estado[k]) : v; };
    const ambito = {
      ...pieza, ...tel,
      setAviso: poner('aviso'), setEnviando: poner('enviando'), setExito: poner('exito'), setTourReserva: poner('tourReserva'),
      db: {}, auth: { currentUser: { uid: 'cliente-ana' } },
      collection: (_db, nombre) => ({ coleccion: nombre }),
      addDoc: async (_col, datos) => {
        mandados.push(datos);
        const no = loQueDiceFirestore(datos);
        if (no) { const e = new Error(no.message); e.code = no.code; throw e; }
        return { id: 'reserva' + mandados.length };
      },
      prepararTokenDeAvisos: () => () => {}, recordar: () => {}, MIS_RESERVAS: 'misReservas',
      apuntarRechazo: () => {}, motivoDeRechazo: (e) => ({ titulo: 'No se pudo enviar la reserva', texto: (e && e.message) || '' }),
    };
    const render = () => hacer({ ...ambito, ...estado });
    return { estado, mandados, enviar: () => render().enviarReserva(), total: () => render().totalReserva() };
  };
}

async function medirApp(commit, reglas) {
  const aparatoDe = pantallaDe(leerRaiz(commit, PANTALLA));
  const filas = [];
  for (const c of CASOS) {
    const ap = aparatoDe(c);
    const totalEnPantalla = ap.total();
    // eslint-disable-next-line no-await-in-loop
    await ap.enviar();
    const ultimo = ap.mandados[ap.mandados.length - 1] || null;
    const entro = !!ap.estado.exito;
    filas.push({
      caso: c.caso, honrado: !!c.honrado, falta: !!c.falta, entro,
      aviso: ap.estado.aviso ? (typeof ap.estado.aviso === 'string' ? ap.estado.aviso : ap.estado.aviso.titulo + ' · ' + ap.estado.aviso.texto) : '',
      indefinidos: ultimo ? dondeHayIndefinidos(ultimo) : [],
      fueraDeLaLista: ultimo && reglas.crear ? Object.keys(ultimo).filter((k) => !reglas.crear.includes(k)) : [],
      reserva: entro ? ultimo : null, totalEnPantalla,
    });
  }
  return filas;
}

// ── 2. QUIÉN ESCRIBE EN reservasTurismo ──

/**
 * Las escrituras a `reservasTurismo` de un archivo (fuente o paquete minificado): { crear: [...], cambiar: [[...]],
 * token: [...] }. `…'reservasTurismo'), {` es crear (collection) y `…'reservasTurismo', id), {` es cambiar (doc).
 */
function escriturasDe(t) {
  const r = { crear: [], cambiar: [], token: [] };
  const re = /(['"])reservasTurismo\1(\s*,\s*[\w$.]+)?\s*\)\s*,\s*\{/g;
  let m;
  while ((m = re.exec(t))) {
    const llave = m.index + m[0].length - 1;
    const { claves } = clavesDelObjeto(t, llave);
    // Un campo que va solo a veces, `...(x != null ? { tourId: x } : {})`, también lo escribe la app.
    const cuerpo = (cuerpoDeLaFuncion(t, llave) || { texto: '' }).texto;
    for (const x of cuerpo.matchAll(/\.\.\.\s*\([^?]*\?\s*\{\s*([\w$]+)\s*:/g)) claves.push(x[1]);
    if (m[2]) r.cambiar.push(claves); else r.crear.push(...claves);
    const antes = t.slice(Math.max(0, m.index - 800), m.index);
    for (const x of antes.matchAll(/[\w$]+\(\s*['"](\w*FcmToken)['"]\s*\)/g)) r.token.push(x[1]);
  }
  return r;
}

/** Las listas cerradas de las reglas de `reservasTurismo`: { crear, cambiar } (null si no hay). */
function listasDeLasReglas(reglas) {
  const t = sinCR(reglas);
  const lista = (funcion, desde) => {
    const i = t.indexOf('function ' + funcion + '(');
    if (i < 0) return null;
    const j = t.indexOf(desde, i);
    const fin = t.indexOf('])', j);
    if (j < 0 || fin < 0) return null;
    return [...t.slice(j + desde.length, fin).matchAll(/'([^']+)'/g)].map((x) => x[1]);
  };
  return {
    crear: lista('laReservaDelClienteNaceCerrada', 'keys().hasOnly(['),
    cambiar: lista('elClienteDeLaReservaSoloPegaSuToken', 'cambia.hasOnly(['),
  };
}

/** Lo que la app escribe y las reglas no dejan (al crear y al cambiar). */
function loQueLaAppEscribeYLasReglasNo(app, reglas) {
  const fuera = (lista, permitidas) => (permitidas ? [...new Set(lista)].filter((k) => !permitidas.includes(k)) : ['(las reglas no tienen lista)']);
  return { crear: fuera(app.crear, reglas.crear), cambiar: fuera([...app.cambiar.flat(), ...app.token], reglas.cambiar) };
}

// ── 3. PRODUCCIÓN ──

const TOPES = { agenciaNombre: 300, tourId: 200, tipo: 30, nombreTour: 300, imagen: 2000, cliente: 200, fecha: 40, unidadPrecio: 30, notas: 1000, creado: 40, clienteFcmToken: 500 };
const DE_LA_AGENCIA = ['codigo', 'fechaConfirmada', 'fechaRealizada', 'canceladoPor', 'motivoCancelacion', 'fechaCancelada'];

function contarNube(reservas, negocios, reglas) {
  const r = { reservas: reservas.length, campos: {}, mayor: 0, fueraDeLaLista: [], pasanDelTope: [], telefonosRaros: [], agencias: 0, tours: 0, toursSinNombre: [], toursSinId: [], toursRaros: [] };
  const permitidas = [...(reglas.crear || []), ...(reglas.cambiar || []), ...DE_LA_AGENCIA];
  for (const x of reservas) {
    const { id, ...campos } = x;
    r.mayor = Math.max(r.mayor, JSON.stringify(campos).length);
    for (const k of Object.keys(campos)) r.campos[k] = (r.campos[k] || 0) + 1;
    const fuera = Object.keys(campos).filter((k) => !permitidas.includes(k));
    if (fuera.length) r.fueraDeLaLista.push(id + ': ' + fuera.join(', '));
    for (const [k, tope] of Object.entries(TOPES)) if (typeof x[k] === 'string' && x[k].length > tope) r.pasanDelTope.push(id + ': ' + k + ' (' + x[k].length + ')');
    if (!/^[0-9]{10}$/.test(String(x.telefono || ''))) r.telefonosRaros.push(id + ': ' + JSON.stringify(x.telefono));
  }
  for (const n of negocios) {
    if (n.tipoNegocio !== 'turismo' && !Array.isArray(n.tours)) continue;
    r.agencias += 1;
    for (const t of n.tours || []) {
      r.tours += 1;
      if (typeof t.nombre !== 'string' || !t.nombre.trim()) r.toursSinNombre.push(n.id + '/' + t.id);
      if (t.id == null) r.toursSinId.push(n.id + '/' + t.nombre);
      for (const k of ['tipo', 'imagen', 'unidadPrecio']) if (t[k] != null && typeof t[k] !== 'string') r.toursRaros.push(n.id + '/' + t.id + ': ' + k);
    }
  }
  return r;
}

async function paquete(sitio) {
  const html = await (await fetch('https://' + sitio + '.web.app/')).text();
  const m = /static\/js\/main\.[0-9a-f]+\.js/.exec(html);
  if (!m) throw new Error('no encontré el paquete en ' + sitio + '.web.app');
  return { nombre: m[0], texto: await (await fetch('https://' + sitio + '.web.app/' + m[0])).text() };
}

function imprimirEscrituras(titulo, app, reglas) {
  const fuera = loQueLaAppEscribeYLasReglasNo(app, reglas);
  console.log((titulo.startsWith('\n') ? '\n── ' + titulo.slice(1) : '── ' + titulo) + ' ──');
  if (app.crear.length) console.log('  crea con:  ' + [...new Set(app.crear)].join(', '));
  if (app.cambiar.length || app.token.length) console.log('  cambia:    ' + app.cambiar.map((c) => '{' + c.join(', ') + '}').join(' · ') + (app.token.length ? ' {' + app.token.join(', ') + '} (token de avisos)' : ''));
  return fuera;
}

function imprimirApp(titulo, filas) {
  console.log('\n── ' + titulo + ' ──');
  for (const f of filas) {
    console.log('  · ' + f.caso);
    console.log('      ' + (f.entro ? '✓ la reserva SALIÓ' : '✗ la reserva NO salió')
      + (f.aviso ? ' · ventanita: «' + f.aviso.slice(0, 120) + '»' : '')
      + (f.indefinidos.length ? ' · 🔴 mandó undefined en ' + f.indefinidos.join(', ') : '')
      + (f.fueraDeLaLista.length ? ' · 🔴 fuera de la lista de las reglas: ' + f.fueraDeLaLista.join(', ') : ''));
    if (f.entro) console.log('      nombreTour ' + JSON.stringify(f.reserva.nombreTour) + ' · tourId ' + JSON.stringify(f.reserva.tourId) + ' · agencia ' + JSON.stringify(f.reserva.agenciaNombre) + ' · total ' + f.reserva.total + ' (en pantalla ' + f.totalEnPantalla + ')');
  }
  const trancadas = filas.filter((f) => f.falta && !f.entro).length;
  console.log('\n  casos con un dato faltante que NO dejan reservar: ' + trancadas + ' de ' + filas.filter((f) => f.falta).length
    + ' · honrados que salen: ' + filas.filter((f) => f.honrado && f.entro).length + ' de ' + filas.filter((f) => f.honrado).length);
  return trancadas;
}

async function main() {
  const i = process.argv.indexOf('--commit');
  const commit = i >= 0 ? process.argv[i + 1] : null;
  const reglas = listasDeLasReglas(leerRaiz(commit, 'firestore.rules'));
  console.log('── LAS REGLAS DE reservasTurismo ' + (commit || 'de hoy') + ' ──');
  console.log('  al crear (cliente):   ' + (reglas.crear ? reglas.crear.length + ' campos: ' + reglas.crear.join(', ') : 'SIN LISTA: entra cualquier campo de cualquier tamaño'));
  console.log('  al cambiar (cliente): ' + (reglas.cambiar ? reglas.cambiar.join(', ') : 'SIN LISTA: el cliente le cambia cualquier campo (menos agencia y dueño), hasta el estado'));
  const reglasHoy = listasDeLasReglas(leerRaiz(null, 'firestore.rules'));

  imprimirApp('LA APP EJECUTADA · Turismo.js ' + (commit || 'de hoy') + ' (contra la lista de las reglas de hoy)', await medirApp(commit, reglasHoy));

  const app = escriturasDe(leerRaiz(commit, PANTALLA));
  let fuera = imprimirEscrituras('\nLA APP · ' + PANTALLA, app, reglasHoy);
  console.log('  ' + (fuera.crear.length + fuera.cambiar.length ? '🔴 escribe y las reglas de hoy NO lo dejan: ' + JSON.stringify(fuera) : '✓ las reglas de hoy dejan todo lo que escribe'));
  imprimirEscrituras('ALIADOS · ' + ALIADOS + ' (la agencia: su permiso no cambia)', escriturasDe(leerRaiz(null, ALIADOS)), reglasHoy);
  console.log('  el panel (guajirago-admin) solo LEE reservasTurismo; las funciones (notificarNuevaReserva, notificarClienteReserva) solo leen y avisan.');

  console.log('\n── EL PRECIO DE LA RESERVA ──');
  console.log('  `total` lo calcula el TELÉFONO (totalReserva: precio del tour × personas) y nadie lo revisa en el servidor:');
  console.log('  notificarNuevaReserva le avisa a la agencia «Ana reservó … — $ <el total del teléfono>». (Pendiente aparte; P16 no lo toca.)');

  if (process.argv.includes('--publicado')) {
    for (const [sitio, nombre] of [['guajirago', 'LA APP PUBLICADA'], ['guajirago-aliados', 'ALIADOS PUBLICADO']]) {
      // eslint-disable-next-line no-await-in-loop
      const pq = await paquete(sitio);
      fuera = imprimirEscrituras('\n' + nombre + ' · ' + pq.nombre, escriturasDe(pq.texto), reglasHoy);
      if (sitio === 'guajirago') console.log('  ' + (fuera.crear.length + fuera.cambiar.length ? '🔴 escribe y las reglas de hoy NO lo dejan: ' + JSON.stringify(fuera) : '✓ las reglas de hoy dejan todo lo que escribe'));
    }
  }
  if (process.argv.includes('--nube')) {
    const { traer, doc } = require('./nube.cjs');
    const r = contarNube((await traer('reservasTurismo')).map(doc), (await traer('negocios')).map(doc), reglasHoy);
    console.log('\n── PRODUCCIÓN (solo lectura) ──');
    console.log('  reservas: ' + r.reservas + ' · la más grande: ' + r.mayor + ' bytes (aprox.) · campos: ' + (Object.entries(r.campos).sort().map(([k, n]) => k + '×' + n).join(', ') || 'ninguno'));
    console.log('  fuera de la lista de hoy: ' + r.fueraDeLaLista.length + ' · pasan un tope: ' + r.pasanDelTope.length + ' · teléfono que no son 10 cifras: ' + r.telefonosRaros.length
      + [...r.fueraDeLaLista, ...r.pasanDelTope, ...r.telefonosRaros].map((x) => '\n     ' + x).join(''));
    console.log('  agencias: ' + r.agencias + ' · tours: ' + r.tours + ' · sin nombre: ' + r.toursSinNombre.length + ' · sin id: ' + r.toursSinId.length + ' · con tipo/foto/unidad que no es texto: ' + r.toursRaros.length);
  }
  process.exit(0);
}

if (require.main === module) {
  main().catch((e) => { console.error('✋ ' + e.message); process.exit(1); });
}

module.exports = { medirApp, pantallaDe, escriturasDe, listasDeLasReglas, loQueLaAppEscribeYLasReglasNo, contarNube, CASOS, TOUR, AGENCIA };
