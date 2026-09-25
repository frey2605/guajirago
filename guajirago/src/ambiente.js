// ─────────────────────────────────────────────────────────────────────────────
// AMBIENTE — ¿esta copia de GuajiraGo es la de PRUEBAS o la de PRODUCCIÓN?
//
// Fase 0 del plan (plan/05-AMBIENTE-DE-PRUEBAS.md): dos proyectos Firebase
// separados, `guajirago-pruebas` y `guajirago`. El ambiente NO se elige a mano:
// lo fija cómo se compiló (`npm run build:pruebas` / `build:produccion`), y la
// app lo dice en pantalla. Es el patrón que Talaria ya usa (25-sep-2026), con
// REACT_APP_ en vez de VITE_, que es lo que Create React App mete en la app.
//
// Sin imports a propósito: así las pruebas lo cargan tal cual (pruebas/cargar.cjs).
// ─────────────────────────────────────────────────────────────────────────────

export const AMBIENTES = Object.freeze({
  pruebas: Object.freeze({ nombre: 'PRUEBAS', esProduccion: false, color: '#F97316' }),
  produccion: Object.freeze({ nombre: 'PRODUCCIÓN', esProduccion: true, color: '#1C8EF9' }),
});

// Recibe el modo con el que se compiló (REACT_APP_AMBIENTE). Si llega cualquier
// otra cosa —o nada, que es lo que trae un `react-scripts build` a secas— NO se
// adivina: se para. Un ambiente mal escogido es justo el error que no se debe
// poder cometer en silencio.
export function ambienteDe(modo) {
  const a = AMBIENTES[modo];
  if (!a) throw new Error('Ambiente desconocido: «' + modo + '». Solo existen «pruebas» y «produccion».');
  return a;
}

// Las llaves públicas de Firebase de cada ambiente. Si falta una, se para
// diciendo CUÁL falta, en vez de conectarse a medias.
const CAMPOS = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];

export function configFirebaseDe(env) {
  const cfg = {};
  const faltan = [];
  for (const c of CAMPOS) {
    const clave = 'REACT_APP_FIREBASE_' + c.replace(/[A-Z]/g, (m) => '_' + m).toUpperCase();
    const v = env[clave];
    if (!v) faltan.push(clave);
    else cfg[c] = v;
  }
  if (faltan.length) throw new Error('Faltan llaves de Firebase: ' + faltan.join(', '));
  return cfg;
}

// El proyecto tiene que corresponder al ambiente: una copia de PRUEBAS jamás
// apunta a la base de PRODUCCIÓN, ni al revés.
export function verificarPareja(modo, projectId) {
  const esPruebas = /pruebas/.test(projectId);
  if (modo === 'pruebas' && !esPruebas) {
    throw new Error('La copia de PRUEBAS apunta a «' + projectId + '», que no es un proyecto de pruebas.');
  }
  if (modo === 'produccion' && esPruebas) {
    throw new Error('La copia de PRODUCCIÓN apunta a «' + projectId + '», que es un proyecto de pruebas.');
  }
  return true;
}
