// ─────────────────────────────────────────────────────────────────────────────
// 🤖 EL ROBOT PROBADOR — lo de GuajiraGo.
//
// Orden del dueño (27-sep-2026): un robot que prueba las apps como una persona y va aprendiendo,
// «no solo en GuajiraGo, sino en todos los proyectos que yo vaya desarrollando». Por eso el
// MOTOR (el que maneja el navegador) y el AGENTE viven en la cuenta del dueño, uno solo para
// todos los proyectos, en la carpeta `.claude` de su cuenta (el motor en `robot`, el agente
// «probador» en `agents`; no son de este repo, por eso se describen y no se citan).
// Aquí queda solo lo de GuajiraGo: cuáles son sus sitios de PRUEBA, dónde está su clave, sus
// recorridos (robot/*.cjs) y lo que aprendió de sus pantallas (robot/APRENDIDO.md).
//
// 🔴 SOLO PRUEBAS: SITIOS son los tres de guajirago-pruebas y el motor se niega a abrir otro.
// Lo vigila pruebas/elRobot.test.js. 🔴 La clave de las cuentas de prueba vive FUERA del repo
// (el repo es público), en el archivo que dejó scripts/sembrar-pruebas.cjs.
// ─────────────────────────────────────────────────────────────────────────────
const os = require('os');
const path = require('path');

const MOTOR = path.join(os.homedir(), '.claude', 'robot', 'motor.cjs');
const SITIOS = Object.freeze({
  transporte: 'https://guajirago-pruebas.web.app/',
  panel: 'https://guajirago-pruebas-admin.web.app/',
  aliados: 'https://guajirago-pruebas-aliados.web.app/',
});
const ARCHIVO_CLAVE = path.join(__dirname, '..', '..', 'cuentas-de-pruebas.txt');

function motor() {
  try { return require(MOTOR); } catch (e) {
    throw new Error('No encuentro el motor del robot en ' + MOTOR + ' (vive en la cuenta del dueño, no en el repo).');
  }
}

/**
 * Entra a aliados de pruebas como el dueño del restaurante de prueba (restaurante@gg.test).
 * Una sola vez aquí: la usan todos los recorridos que necesitan estar dentro de aliados.
 * 🪤 La portada pregunta el tipo de negocio; para entrar se toca «Ya tengo cuenta · Ingresar».
 * Con otro `correo` entra con esa cuenta de aliados (p. ej. agencia@gg.test, la agencia de turismo).
 */
async function entrarComoRestaurante(pagina, correo = 'restaurante@gg.test') {
  await pagina.getByText(/Ya tengo cuenta/).first().click();
  await pagina.waitForTimeout(1000);
  await pagina.locator('input[placeholder="Correo"]').first().fill(correo);
  await pagina.locator('input[placeholder="Contrasena"]').first().fill(motor().leerClave(ARCHIVO_CLAVE));
  await pagina.getByRole('button', { name: 'Entrar', exact: true }).click();
  await pagina.waitForTimeout(7000);
}

/**
 * El proyecto y la llave de la BASE de pruebas, sacados de guajirago/.env.pruebas (la misma fuente con que se
 * compila la app de pruebas). 🔴 Si el archivo no dice guajirago-pruebas, se niega: el robot jamás toca producción.
 */
function baseDePruebas(textoEnv) {
  const { leerEnv } = require('../scripts/medir-ambientes.cjs');
  const env = leerEnv(textoEnv);
  const proyecto = env.REACT_APP_FIREBASE_PROJECT_ID;
  if (proyecto !== 'guajirago-pruebas') throw new Error('El robot solo entra a la base de PRUEBAS, y esto es «' + proyecto + '».');
  if (!env.REACT_APP_FIREBASE_API_KEY) throw new Error('Falta la llave de la base de pruebas en .env.pruebas.');
  return { proyecto, llave: env.REACT_APP_FIREBASE_API_KEY };
}

/**
 * Entra a la base de PRUEBAS como una cuenta de prueba (con su clave, como la app) y deja leer y cambiar
 * documentos con los mismos permisos que tendría esa persona: las reglas de la base deciden, no el robot.
 * Los valores se leen y se escriben con las piezas de scripts/nube.cjs (una sola forma de hacerlo).
 */
// El CUADERNO de llamadas directas: cada llamada que el robot hace a la base sin pasar por la app (y por eso
// sin sello de App Check) se anota aquí, con su hora y su servicio. robot/portero.cjs lo lee para no confundir
// al robot con alguien que habla con la base a escondidas (27-sep-2026).
const CUADERNO = path.join(os.tmpdir(), 'robot-guajirago', 'llamadas-directas.log');
function anotarLlamada(servicio) {
  const fs = require('fs');
  fs.mkdirSync(path.dirname(CUADERNO), { recursive: true });
  fs.appendFileSync(CUADERNO, new Date().toISOString() + ' ' + servicio + '\n');
}

async function entrarALaBase(correo) {
  const fs = require('fs');
  const N = require('../scripts/nube.cjs');
  const { proyecto, llave } = baseDePruebas(fs.readFileSync(path.join(__dirname, '..', 'guajirago', '.env.pruebas'), 'utf8'));
  anotarLlamada('identitytoolkit');
  const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + llave, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: correo, password: motor().leerClave(ARCHIVO_CLAVE), returnSecureToken: true }),
  });
  const s = await r.json();
  if (!s.idToken) throw new Error('No pude entrar a la base de pruebas como ' + correo + ': ' + ((s.error || {}).message || r.status));
  const base = 'https://firestore.googleapis.com/v1/projects/' + proyecto + '/databases/(default)/documents/';
  const pedir = async (ruta, opciones = {}) => {
    anotarLlamada('firestore');
    const x = await fetch(base + ruta, { ...opciones, headers: { Authorization: 'Bearer ' + s.idToken, 'Content-Type': 'application/json' } });
    const j = await x.json();
    if (!x.ok) throw new Error('La base de pruebas rechazó ' + ruta + ': ' + ((j.error || {}).message || x.status));
    return j;
  };
  return {
    uid: s.localId,
    leer: async (ruta) => N.doc(await pedir(ruta)),
    // Cambia SOLO los campos dados (como un merge): nunca reescribe el documento entero.
    cambiar: (ruta, campos) => pedir(ruta + '?' + Object.keys(campos).map((k) => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&'),
      { method: 'PATCH', body: JSON.stringify({ fields: N.aCampos(campos) }) }),
    // Llama a una función del servidor (onCall) de la base de PRUEBAS como esta persona, igual que la app con
    // httpsCallable. G24: un viaje aceptado solo lo escribe `confirmarConductor`, y la llama el pasajero.
    llamar: async (nombre, datos) => {
      anotarLlamada('cloudfunctions');
      const x = await fetch('https://us-central1-' + proyecto + '.cloudfunctions.net/' + nombre, {
        method: 'POST', headers: { Authorization: 'Bearer ' + s.idToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: datos }),
      });
      const j = await x.json().catch(() => ({}));
      if (!x.ok || j.error) throw new Error('El servidor de pruebas rechazó ' + nombre + ': ' + ((j.error || {}).message || x.status));
      return j.result;
    },
  };
}

/**
 * P04 (30-sep-2026): desde que las reglas no dejan ofertar sin saldo para la comisión, el conductor de prueba necesita
 * créditos para dejar una oferta. Como superadmin de prueba, se los sube a `minimo` si tiene menos, y `devolver()` los
 * deja EXACTAMENTE como estaban (lo que cobró el servidor en el recorrido también se deshace). `poner(n)` los cambia.
 * Es la única forma en que un recorrido toca los créditos (las reglas no dejan al propio conductor).
 */
async function saldoDePrueba(uid, minimo = 10000) {
  const adm = await entrarALaBase('admin@gg.test');
  const ruta = 'usuarios/' + uid;
  const antes = (await adm.leer(ruta)).creditos;
  if (!(antes >= minimo)) await adm.cambiar(ruta, { creditos: minimo });
  return {
    antes,
    poner: (n) => adm.cambiar(ruta, { creditos: n }),
    leer: async () => (await adm.leer(ruta)).creditos,
    devolver: async () => { await adm.cambiar(ruta, { creditos: antes ?? 0 }); return (await adm.leer(ruta)).creditos; },
  };
}

module.exports = {
  SITIOS,
  saldoDePrueba,
  MOTOR,
  entrarComoRestaurante,
  baseDePruebas,
  entrarALaBase,
  CUADERNO,
  abrir: (sitio, opciones = {}) => motor().abrir(sitio, { ...opciones, sitios: SITIOS, proyecto: 'guajirago' }),
  esDePruebas: (url) => motor().esPermitido(url, SITIOS),
  claveDePruebas: () => motor().leerClave(ARCHIVO_CLAVE),
  fotoDeMentira: (nombre) => motor().fotoDeMentira(nombre),
  inventario: (pagina) => motor().inventario(pagina),
};
