import { initializeApp } from "firebase/app";
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
const llaveAppCheck = llaveAppCheckDe(process.env);
if (llaveAppCheck) initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(llaveAppCheck), isTokenAutoRefreshEnabled: true });
export const db = getFirestore(app);
export const auth = initializeAuth(app, { persistence: browserLocalPersistence });
auth.settings.appVerificationDisabledForTesting = false;
export const messaging = getMessaging(app);
export const storage = getStorage(app);

enableIndexedDbPersistence(db).catch(() => {});