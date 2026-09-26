#!/usr/bin/env node
/**
 * SEMBRAR DATOS DE MENTIRA EN guajirago-pruebas — la regla 2 del ambiente de pruebas (plan/05).
 *
 *   node scripts/sembrar-pruebas.cjs              <- SIMULACRO: dice qué crearía y qué ya existe. No escribe nada.
 *   node scripts/sembrar-pruebas.cjs --de-verdad  <- crea lo que falta. Lo que ya existe NO se toca.
 *   node scripts/sembrar-pruebas.cjs --comprobar  <- solo lee: ¿está todo, y dice lo que tiene que decir?
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 * «Nunca se copian datos reales al ambiente de pruebas. Se siembran datos falsos con un guion que vive en el repo»
 * (plan/05, regla 2). El 26-sep-2026 `guajirago-pruebas` tenía cero cuentas y ningún dato: las apps abrían vacías y no
 * había a quién pedirle un viaje ni restaurante al que pedirle. Jhon: «Vamos con el 1».
 *
 * ── QUÉ SIEMBRA (lo mínimo para que cada app se pueda usar de punta a punta) ──
 *   · 7 cuentas de acceso, todas con correo @gg.test (un dominio que no existe: a nadie le llega un correo):
 *     dos pasajeros (hacen falta dos: las reglas no dejan ofertar en tu propio viaje), un conductor de taxi, uno de
 *     mototaxi, el dueño de un restaurante, el de una agencia de turismo, y un superadministrador para el panel.
 *   · sus documentos en `usuarios`, `conductores`, `negocios` y `negociosPrivado`, y `config/global`.
 *   · NO siembra viajes, pedidos ni reservas: los crea quien prueba, y la rutina del servidor cierra cada 30 minutos
 *     los viajes que se quedan esperando.
 *   · NO guarda ningún código de avisos (fcmToken): con uno de verdad, las funciones le mandarían avisos a un teléfono
 *     real. Tampoco toca `suscripciones`, que es lo único que mira la rutina de cobros.
 *
 * ── LAS DOS GUARDIAS ────────────────────────────────────────────────────────
 *   · El proyecto se comprueba con `verificarPareja` de `guajirago/src/ambiente.js` —la MISMA con la que las apps se
 *     niegan a arrancar mal emparejadas—, al cargar el guion y antes de cada llamada. Aquí no hay forma de escribir en
 *     `guajirago` (producción): no es una bandera, es que la guardia revienta.
 *   · Lo que ya existe no se pisa: cada documento se crea con la condición «que no exista», en UN solo lote. Si alguien
 *     creó uno entre la mirada y la escritura, el servidor rechaza el lote entero en vez de pisarle el trabajo.
 *
 * ── LAS CLAVES ──────────────────────────────────────────────────────────────
 * Una sola clave para las siete cuentas, al azar, guardada FUERA del repo (el repo es público) en
 * `PROYECTOS/guajirago/cuentas-de-pruebas.txt`. Si ya existe, se reusa; si no, se inventa al sembrar de verdad.
 *
 * Entra por la sesión del `firebase login` del PC (la puerta de `scripts/nube.cjs`). La llave de servicio de hoy
 * no tiene permiso para crear cuentas.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { RAIZ, leer, cargarDeLaApp } = require('../pruebas/cargar.cjs');
const N = require('./nube.cjs');

const PROYECTO = 'guajirago-pruebas';
const AMBIENTE = cargarDeLaApp('guajirago/src/ambiente.js');
AMBIENTE.verificarPareja('pruebas', PROYECTO); // si alguien cambia PROYECTO a producción, el guion no carga
const { centroRiohacha } = cargarDeLaApp('guajirago/src/riohacha.js');
const ARCHIVO_CLAVE = path.join(RAIZ, '..', 'cuentas-de-pruebas.txt');

// Cada URL sale de aquí, y aquí se vuelve a comprobar el proyecto.
function urls(proyecto) {
  AMBIENTE.verificarPareja('pruebas', proyecto);
  const docs = `https://firestore.googleapis.com/v1/projects/${proyecto}/databases/(default)/documents`;
  const auth = `https://identitytoolkit.googleapis.com/v1/projects/${proyecto}`;
  return { docs, commit: docs + ':commit', batchGet: docs + ':batchGet', cuentas: auth + '/accounts', buscar: auth + '/accounts:lookup' };
}

// La configuración por defecto la dice el panel (`CONFIG_POR_DEFECTO` en Superadmin.js), no una copia de aquí
// (SEGUNDA LEY). Lo único que se cambia: restaurantes y turismo ENCENDIDOS, o esas pantallas no salen y no se prueban.
function configPorDefecto() {
  const t = leer('guajirago-admin/src/Superadmin.js');
  const i = t.indexOf('const CONFIG_POR_DEFECTO = {');
  if (i < 0) throw new Error('No encontré CONFIG_POR_DEFECTO en guajirago-admin/src/Superadmin.js');
  const abre = t.indexOf('{', i);
  const cierra = t.indexOf('\n};', abre);
  // eslint-disable-next-line no-new-func
  return new Function('return ' + t.slice(abre, cierra + 2))();
}

const cerca = (dLat, dLng) => ({ lat: Number((centroRiohacha.lat + dLat).toFixed(5)), lng: Number((centroRiohacha.lng + dLng).toFixed(5)) });

/** El plan entero, sin red: { cuentas: [{ uid, email, nombre }], docs: [{ ruta, datos }] }. */
function elPlan({ config = configPorDefecto(), hoy = '2026-09-26T12:00:00.000Z' } = {}) {
  const cuentas = [];
  const docs = [];
  const cuenta = (uid, email, nombre) => { cuentas.push({ uid, email, nombre }); return uid; };
  const persona = (uid, email, nombre, extra) => {
    cuenta(uid, email, nombre);
    docs.push({ ruta: 'usuarios/' + uid, datos: {
      nombre, email, celular: '3000000000', fechaNacimiento: '01/01/1990',
      contactoConfianzaNombre: 'Contacto de Prueba', contactoConfianzaNumero: '3000000001',
      tipo: 'pasajero', placa: '', vehiculo: '', fechaRegistro: hoy, favoritos: [], ...extra,
    } });
  };

  docs.push({ ruta: 'config/global', datos: { ...config, moduloRestaurantes: true, moduloTurismo: true } });

  persona('prueba-pasajero', 'pasajero@gg.test', 'Pasajero de Prueba', {});
  persona('prueba-pasajera', 'pasajera@gg.test', 'Pasajera de Prueba', { celular: '3000000002' });

  for (const [uid, email, nombre, tipoVehiculo, placa, vehiculo, color, d] of [
    ['prueba-conductor-taxi', 'taxi@gg.test', 'Taxista de Prueba', 'Taxi', 'PRU001', 'Chevrolet Spark (de prueba)', 'Amarillo', [0.004, 0.003]],
    ['prueba-conductor-moto', 'moto@gg.test', 'Mototaxista de Prueba', 'Mototaxi', 'PRU02A', 'Honda CB110 (de prueba)', 'Rojo', [-0.003, 0.004]],
  ]) {
    persona(uid, email, nombre, { tipo: 'conductor', placa, vehiculo, tipoVehiculo, telefono: '3000000010', color, fotoConductor: null, creditos: 50000 });
    // Apagado hasta que el conductor abra la app: al conectarse, la app escribe su ubicación y lo enciende ella sola.
    docs.push({ ruta: 'conductores/' + uid, datos: {
      nombre, telefono: '3000000010', placa, vehiculo, ubicacion: { ...cerca(...d), timestamp: hoy }, activo: false, ocupado: false, enViajeId: null,
    } });
  }

  const negocio = (uid, email, nombre, dueno, datos) => {
    cuenta(uid, email, dueno);
    docs.push({ ruta: 'negocios/' + uid, datos: {
      nombre, rol: 'dueno', fechaCreacion: hoy, activo: true, aprobado: true, estadoAprobacion: 'aprobado',
      visibleEnEscaparate: true, abierto: true, perfilCompleto: true, estadoComercial: 'alDia',
      horarioApertura: 0, horarioCierre: 0, logo: '', ...datos,
    } });
    docs.push({ ruta: 'negociosPrivado/' + uid, datos: { duenoNombre: dueno, duenoTelefono: '+573000000020', email, creditos: 0 } });
  };
  const plato = (n, nombre, precio, categoria) => ({
    id: 'plato_' + n, nombre, descripcion: 'Plato de prueba', precio, categoria, disponible: true, imagen: '', destacado: n === 1, ingredientes: [], adiciones: [],
  });
  negocio('prueba-restaurante', 'restaurante@gg.test', 'Restaurante de Prueba', 'Dueño del Restaurante de Prueba', {
    tipoNegocio: 'restaurante', descripcion: 'Restaurante de mentira para probar pedidos', direccion: 'Calle de Prueba #1-23',
    ubicacion: cerca(0.002, -0.002), categoria: 'Comida típica', pedidoMinimo: 10000, costoDomicilio: 4000, tiempoEntrega: '30-45 min', demoraMin: 30,
    menu: [plato(1, 'Arepa de huevo', 6000, 'Entradas'), plato(2, 'Friche', 25000, 'Platos fuertes'),
      plato(3, 'Arroz con camarón', 28000, 'Platos fuertes'), plato(4, 'Jugo de corozo', 5000, 'Bebidas')],
  });
  const tour = (n, nombre, precio, duracion) => ({
    id: 'tour_' + n, tipo: 'tour', nombre, descripcion: 'Tour de prueba', precio, unidadPrecio: 'persona', duracion, categoria: 'Cabo de la Vela',
    cupoMax: 10, puntoEncuentro: 'Muelle de Riohacha', incluye: 'Transporte y guía (de prueba)', imagen: '', destacado: n === 1, disponible: true, vecesReservado: 0,
  });
  negocio('prueba-agencia', 'agencia@gg.test', 'Agencia de Turismo de Prueba', 'Dueña de la Agencia de Prueba', {
    tipoNegocio: 'turismo', descripcion: 'Agencia de mentira para probar reservas', direccion: 'Malecón de Prueba #4-56',
    ubicacion: cerca(-0.002, 0.002), telefono: '3000000030', categorias: ['Cabo de la Vela'],
    tours: [tour(1, 'Cabo de la Vela en un día', 250000, '1 día'), tour(2, 'Punta Gallinas', 450000, '2 días')],
  });

  cuenta('prueba-admin', 'admin@gg.test', 'Administrador de Prueba');
  docs.push({ ruta: 'usuarios/prueba-admin', datos: { nombre: 'Administrador de Prueba', email: 'admin@gg.test', rol: 'superadmin', fechaRegistro: hoy } });

  return { cuentas, docs };
}

async function pedirJson(pedir, url, permiso, cuerpo) {
  const r = await pedir(url, {
    method: cuerpo ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + permiso, 'Content-Type': 'application/json', 'x-goog-user-project': PROYECTO },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('el servidor dijo ' + r.status + ': ' + JSON.stringify(j).slice(0, 300));
  return j;
}

/** Qué hay hoy: { cuentas: Set(uid), docs: Map(ruta → campos leídos) }. Solo lee. */
async function loQueHay(plan, { pedir, permiso }) {
  const u = urls(PROYECTO);
  const c = await pedirJson(pedir, u.buscar, permiso, { localId: plan.cuentas.map((x) => x.uid) });
  const cuentas = new Set((c.users || []).map((x) => x.localId));
  const nombre = (ruta) => `projects/${PROYECTO}/databases/(default)/documents/${ruta}`;
  const g = await pedirJson(pedir, u.batchGet, permiso, { documents: plan.docs.map((d) => nombre(d.ruta)) });
  const docs = new Map();
  for (const x of Array.isArray(g) ? g : []) {
    if (x.found) docs.set(x.found.name.split('/documents/')[1], N.doc(x.found));
  }
  return { cuentas, docs };
}

// Lo que el documento guardado tiene que decir: cada campo del plan, igual. (Campos de más no importan: la app
// escribe los suyos, por ejemplo la ubicación del conductor al conectarse.)
function diferencias(esperado, leido) {
  const orden = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort()) : x));
  return Object.keys(esperado).filter((k) => orden(esperado[k]) !== orden(leido[k]));
}

function laClave(crear) {
  if (fs.existsSync(ARCHIVO_CLAVE)) {
    const m = fs.readFileSync(ARCHIVO_CLAVE, 'utf8').match(/^Clave:\s*(\S+)/m);
    if (m) return m[1];
  }
  if (!crear) return null;
  const letras = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(10), (b) => letras[b % letras.length]).join('');
}

function guardarClave(clave, cuentas) {
  const t = ['CUENTAS DE PRUEBA DE GUAJIRAGO — solo sirven en las apps de PRUEBAS (guajirago-pruebas*.web.app)',
    'Las creó scripts/sembrar-pruebas.cjs. No son de nadie; los datos son de mentira.', '', 'Clave: ' + clave, '',
    ...cuentas.map((c) => c.email.padEnd(24) + c.nombre), ''].join('\n');
  fs.writeFileSync(ARCHIVO_CLAVE, t);
}

async function principal({ argv = process.argv.slice(2), pedir = fetch, permiso, log = console.log, clave = laClave, guardar = guardarClave } = {}) {
  const deVerdad = argv.includes('--de-verdad');
  const comprobar = argv.includes('--comprobar');
  const plan = elPlan();
  const acceso = { pedir, permiso: permiso || (await N.token()).permiso };
  const hay = await loQueHay(plan, acceso);

  const cuentasNuevas = plan.cuentas.filter((c) => !hay.cuentas.has(c.uid));
  const docsNuevos = plan.docs.filter((d) => !hay.docs.has(d.ruta));
  const distintos = plan.docs.filter((d) => hay.docs.has(d.ruta)).map((d) => ({ ruta: d.ruta, campos: diferencias(d.datos, hay.docs.get(d.ruta)) })).filter((x) => x.campos.length);

  log(`Proyecto: ${PROYECTO} (pruebas). Producción no se toca: la guardia no deja armar una dirección suya.`);
  for (const c of plan.cuentas) log(`  cuenta ${c.email.padEnd(22)} ${hay.cuentas.has(c.uid) ? '· ya existe' : '+ NUEVA'}`);
  for (const d of plan.docs) log(`  ${d.ruta.padEnd(36)} ${hay.docs.has(d.ruta) ? '· ya existe' : '+ NUEVO'}`);
  for (const x of distintos) log(`  ⚠ ${x.ruta} ya existe y NO dice lo del plan en: ${x.campos.join(', ')} (no se toca)`);

  if (comprobar || !deVerdad) {
    const falta = cuentasNuevas.length + docsNuevos.length;
    if (comprobar) log(falta || distintos.length ? `🔴 faltan ${falta} y ${distintos.length} no dicen lo del plan` : '✓ está todo sembrado y dice lo que tiene que decir');
    else log(falta ? `SIMULACRO · crearía ${cuentasNuevas.length} cuenta(s) y ${docsNuevos.length} documento(s). Nada se escribió. Para sembrar: node scripts/sembrar-pruebas.cjs --de-verdad` : '✓ no falta nada: no hay qué sembrar');
    return { plan, cuentasNuevas, docsNuevos, distintos, escrito: false };
  }

  const u = urls(PROYECTO);
  const k = clave(true);
  if (cuentasNuevas.length) guardar(k, plan.cuentas);
  for (const c of cuentasNuevas) {
    await pedirJson(pedir, u.cuentas, acceso.permiso, { localId: c.uid, email: c.email, password: k, displayName: c.nombre, emailVerified: true });
    log(`✓ cuenta ${c.email}`);
  }
  if (docsNuevos.length) {
    await pedirJson(pedir, u.commit, acceso.permiso, { writes: docsNuevos.map((d) => ({
      update: { name: `projects/${PROYECTO}/databases/(default)/documents/${d.ruta}`, fields: N.aCampos(d.datos) },
      currentDocument: { exists: false },
    })) });
    log(`✓ ${docsNuevos.length} documento(s) en un solo lote`);
  }
  // Paso 11: se vuelve a LEER, no se cree al «listo».
  const despues = await loQueHay(plan, acceso);
  const faltan = plan.cuentas.filter((c) => !despues.cuentas.has(c.uid)).length + plan.docs.filter((d) => !despues.docs.has(d.ruta)).length;
  log(faltan ? `🔴 releído: faltan ${faltan}` : `✓ releído del servidor: las ${plan.cuentas.length} cuentas y los ${plan.docs.length} documentos están. Clave en ${ARCHIVO_CLAVE}`);
  return { plan, cuentasNuevas, docsNuevos, distintos, escrito: true, faltan };
}

module.exports = { PROYECTO, urls, elPlan, configPorDefecto, diferencias, principal, ARCHIVO_CLAVE };

if (require.main === module) {
  principal().then((r) => process.exit(r.faltan ? 1 : 0)).catch((e) => { console.log('No se pudo: ' + e.message); process.exit(1); });
}
