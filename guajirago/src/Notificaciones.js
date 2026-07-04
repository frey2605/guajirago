import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';
import { getMessaging, getToken } from 'firebase/messaging';
import { auth } from './firebase';
const VAPID_KEY = 'BLcxcBCOZVLKO-qblckhRh0vcuAZjrXmMLZIQNxI0T6x9Viw0XxbpKoZJmNhvTb173FLjuaBIiRum8fSsZGljY0';
// Audio precargado una sola vez, para que suene rápido aunque la conexión esté lenta
let _audioAlerta = null;
export const precargarAudio = () => {
  try {
    if (!_audioAlerta) {
      _audioAlerta = new Audio('/gogo.mp3');
      _audioAlerta.load();
    }
  } catch (e) {}
};

// Callback para mostrar el resultado en pantalla
let _onDebug = null;
export const setDebugCallback = (fn) => { _onDebug = fn; };

export const registrarTokenFCM = async () => {
  const log = (msg) => { console.log(msg); if (_onDebug) _onDebug(msg); };
  try {
    const user = auth.currentUser;
    if (!user) { log('FCM: sin usuario'); return; }
    const permiso = await Notification.requestPermission();
    log('FCM: permiso=' + permiso);
    if (permiso !== 'granted') return;
    if ('serviceWorker' in navigator) await navigator.serviceWorker.ready;
    log('FCM: SW listo');
    const messaging = getMessaging();
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    log('FCM: token=' + (token ? 'OK' : 'VACIO'));
    if (token) {
      await setDoc(doc(db, 'conductores', user.uid), { fcmToken: token }, { merge: true });
      log('FCM: guardado OK');
    }
  } catch(e) {
    if (_onDebug) _onDebug('FCM ERROR: ' + (e.message || e));
    console.log('Error FCM:', e);
  }
};

export const alertarNuevoViaje = () => {
  if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 600]);
  try {
    if (!_audioAlerta) { _audioAlerta = new Audio('/gogo.mp3'); }
    const audio = _audioAlerta;
    audio.currentTime = 0;
    audio.volume = 1.0;
    audio.play().catch(() => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const nota = (freq, start, duration) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.frequency.value = freq; o.type = 'sine';
          g.gain.setValueAtTime(0.4, ctx.currentTime + start);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
          o.start(ctx.currentTime + start);
          o.stop(ctx.currentTime + start + duration + 0.05);
        };
        nota(523, 0.0, 0.15); nota(659, 0.18, 0.15); nota(784, 0.36, 0.25);
        nota(659, 0.75, 0.15); nota(784, 0.93, 0.15); nota(1047, 1.11, 0.35);
      } catch(e) {}
    });
  } catch(e) {}
};

export const activarAudioiOS = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0, ctx.currentTime);
    o.start(); o.stop(ctx.currentTime + 0.001);
  } catch(e) {}
};