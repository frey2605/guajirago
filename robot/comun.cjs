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

module.exports = {
  SITIOS,
  MOTOR,
  abrir: (sitio, opciones = {}) => motor().abrir(sitio, { ...opciones, sitios: SITIOS, proyecto: 'guajirago' }),
  esDePruebas: (url) => motor().esPermitido(url, SITIOS),
  claveDePruebas: () => motor().leerClave(ARCHIVO_CLAVE),
  fotoDeMentira: (nombre) => motor().fotoDeMentira(nombre),
  inventario: (pagina) => motor().inventario(pagina),
};
