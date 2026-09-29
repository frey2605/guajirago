// ─────────────────────────────────────────────────────────────────────────────
// LA CONEXIÓN A FIREBASE — UNA sola pieza para las tres apps (G65, 29-sep-2026).
// Este archivo es IDÉNTICO en guajirago/src, guajirago-admin/src y guajirago-aliados/src: se cambia en los
// tres a la vez. Lo ata pruebas/conexionFirebase.test.js (repo raíz): exige los tres iguales byte a byte y los
// CORRE con un Firebase de mentira (scripts/medir-conexion-firebase.cjs).
// Lo que no todas usan se queda aquí y no estorba: `sellarConAppCheck` lo necesita aliados para su segunda
// conexión (firebaseSecundario.js), `trabajoSinSenal` hoy solo lo pinta aliados (AvisoSinSenal.js), y
// `messaging` solo lo importa aliados.
// ─────────────────────────────────────────────────────────────────────────────
import { initializeApp, onLog } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { initializeAuth, browserLocalPersistence } from "firebase/auth";
import { getMessaging } from "firebase/messaging";
import { getStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { ambienteDe, configFirebaseDe, verificarPareja, llaveAppCheckDe } from "./ambiente";

// Fase 0 (25-sep-2026): las llaves ya no van escritas aquí. Salen de .env.pruebas o
// .env.produccion según cómo se compiló (REACT_APP_AMBIENTE), y la pareja se comprueba:
// una copia de PRUEBAS jamás apunta a producción, ni al revés. Un build sin ambiente se para.
export const ambiente = ambienteDe(process.env.REACT_APP_AMBIENTE);
const firebaseConfig = configFirebaseDe(process.env);
verificarPareja(process.env.REACT_APP_AMBIENTE, firebaseConfig.projectId);
export const proyecto = firebaseConfig.projectId;

const app = initializeApp(firebaseConfig);
// App Check: va justo después de arrancar y ANTES de la base, para que la primera llamada ya lleve su sello.
// Aliados tiene DOS conexiones (esta y la de crear empleados, firebaseSecundario.js) y las dos
// sellan con ESTA pieza (27-sep-2026): una conexión sin sello dejaría de funcionar el día que la
// puerta se cierre de verdad.
export function sellarConAppCheck(unaApp) {
  const llaveAppCheck = llaveAppCheckDe(process.env);
  if (llaveAppCheck) initializeAppCheck(unaApp, { provider: new ReCaptchaEnterpriseProvider(llaveAppCheck), isTokenAutoRefreshEnabled: true });
}
sellarConAppCheck(app);
export const db = getFirestore(app);
export const auth = initializeAuth(app, { persistence: browserLocalPersistence });
auth.settings.appVerificationDisabledForTesting = false;
export const messaging = getMessaging(app);
export const storage = getStorage(app);

// Trabajar sin señal: se le pide al navegador guardar los datos en el aparato. Hasta el
// 27-sep-2026, si no podía, la app se callaba. Y hay una trampa, medida con el robot ese día:
// esta versión de Firebase YA NO FALLA cuando no puede — escribe en su registro «Falling back to
// memory cache» y sigue trabajando solo en memoria. Por eso se ESCUCHA su registro (onLog, la vía
// oficial) además de la respuesta. `trabajoSinSenal` solo se cumple si hay un problema, con
// { ok: false, codigo }; si todo va bien no se cumple nunca, y no sale ninguna ventanita.
// AvisoSinSenal.js la convierte en ventanita.
let avisarSinSenal = () => {};
export const trabajoSinSenal = new Promise((cumplir) => { avisarSinSenal = cumplir; });
onLog(({ message }) => {
  if (/Falling back to memory cache|offline persistence/i.test(String(message))) {
    avisarSinSenal({ ok: false, codigo: (String(message).match(/code=([\w-]+)/) || [])[1] || 'desconocido' });
  }
}, { level: 'warn' });
enableIndexedDbPersistence(db).catch((e) => avisarSinSenal({ ok: false, codigo: (e && e.code) || 'desconocido' }));
