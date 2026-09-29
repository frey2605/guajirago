// 🔔 LA ALARMA DE UN AVISO NUEVO — UNA pieza para transporte y aliados (G63, 29-sep-2026).
//
// guajirago/src/alerta.js es la fuente; guajirago-aliados/src/alerta.js es su copia IDÉNTICA, porque aliados es otro
// repo y no puede importarla. Las ata pruebas/alerta.test.js, byte a byte y ejecutando las dos. Hasta ese día cada
// app llevaba la suya y ya no se portaban igual: en transporte el toque solo despertaba el motor de respaldo, no el
// tono, así que en el iPhone el tono no sonaba; y en las dos el respaldo nacía en un motor NUEVO, fuera del toque,
// que el iPhone deja callado. Lo mide scripts/medir-alarma.cjs.
//
// Suena UNA vez por llamada. Repetirla es cosa de quien llama, y es a propósito: al negocio se le repite cada 5 s hasta
// que abren los pedidos (App.js de aliados, `alertaEnBucle`); al conductor y al pasajero, una vez por aviso.
import { apuntarRechazo } from './avisoRechazo';

const TONO = '/gogo.mp3';
const VIBRACION = [300, 100, 300, 100, 600];
// Cuánto se espera a que el navegador despierte el motor del respaldo antes de darlo por callado.
const ESPERA_MOTOR_MS = 1000;

let _audio = null;
let _motor = null;
let _tonoDesbloqueado = false;

// Deja el tono cargado, para que suene rápido aunque la conexión esté lenta.
export const precargarAudio = () => {
  try {
    if (!_audio) {
      _audio = new Audio(TONO);
      _audio.load();
    }
  } catch (e) { apuntarRechazo('alerta · cargar el tono', e); }
};

// El motor de sonido del respaldo: UNO para toda la app. El que se despierta con el toque es el mismo que suena después
// (en el iPhone, un motor que nace fuera de un toque nace callado; y cada motor nuevo cuenta contra el tope del navegador).
const motor = () => {
  if (!_motor) {
    const Motor = window.AudioContext || window.webkitAudioContext;
    if (Motor) _motor = new Motor();
  }
  return _motor;
};

// Se llama DENTRO de un toque de la persona (activarse, pedir el viaje, el primer toque en aliados): el celular solo deja
// sonar después lo que arrancó con un toque. Despierta el tono (lo toca en silencio y lo para, UNA vez por sesión; el
// iPhone no deja bajar el volumen, y ahí se puede oír un pedacito) y el motor del respaldo.
export const desbloquearAudio = () => {
  precargarAudio();
  if (_audio && !_tonoDesbloqueado) {
    try {
      const audio = _audio;
      audio.volume = 0;
      Promise.resolve(audio.play())
        .then(() => { audio.pause(); audio.currentTime = 0; audio.volume = 1.0; _tonoDesbloqueado = true; })
        .catch((e) => { audio.volume = 1.0; apuntarRechazo('alerta · despertar el tono', e); });
    } catch (e) { apuntarRechazo('alerta · despertar el tono', e); }
  }
  try {
    const m = motor();
    if (!m) return;
    if (m.state === 'suspended') Promise.resolve(m.resume()).catch((e) => apuntarRechazo('alerta · despertar el motor', e));
    const o = m.createOscillator();
    const g = m.createGain();
    o.connect(g); g.connect(m.destination);
    g.gain.setValueAtTime(0, m.currentTime);
    o.start(); o.stop(m.currentTime + 0.001);
  } catch (e) { apuntarRechazo('alerta · despertar el motor', e); }
};

// Las seis notas del respaldo (las de siempre). Contesta con una promesa: true si sonaron, false si no.
const tonoRespaldo = () => new Promise((listo) => {
  let m = null;
  try { m = motor(); } catch (e) { listo(false); return; }
  if (!m) { listo(false); return; }
  let vencido = false;
  const tocar = () => {
    try {
      const nota = (freq, start, duration) => {
        const o = m.createOscillator();
        const g = m.createGain();
        o.connect(g); g.connect(m.destination);
        o.frequency.value = freq; o.type = 'sine';
        g.gain.setValueAtTime(0.4, m.currentTime + start);
        g.gain.exponentialRampToValueAtTime(0.001, m.currentTime + start + duration);
        o.start(m.currentTime + start);
        o.stop(m.currentTime + start + duration + 0.05);
      };
      nota(523, 0.0, 0.15); nota(659, 0.18, 0.15); nota(784, 0.36, 0.25);
      nota(659, 0.75, 0.15); nota(784, 0.93, 0.15); nota(1047, 1.11, 0.35);
      listo(true);
    } catch (e) { listo(false); }
  };
  if (m.state === 'running') { tocar(); return; }
  // Dormido: se le pide que despierte. Si no contesta a tiempo, no suena (y una alarma vieja no suena tarde).
  const tope = setTimeout(() => { vencido = true; listo(false); }, ESPERA_MOTOR_MS);
  Promise.resolve().then(() => m.resume()).then(
    () => { clearTimeout(tope); if (vencido) return; if (m.state === 'running') tocar(); else listo(false); },
    () => { clearTimeout(tope); if (!vencido) listo(false); },
  );
});

// Suena la alarma: vibra, toca el tono desde el principio a todo volumen y, si el navegador no lo deja, las notas del
// respaldo. Contesta con una promesa que nunca falla: 'tono', 'respaldo', o false si no sonó nada; y si no sonó nada
// lo deja escrito con el motivo (REGLA 9), para que nadie crea que sonó.
export const sonarAlerta = () => {
  if (navigator.vibrate) navigator.vibrate(VIBRACION);
  let intento;
  try {
    if (!_audio) _audio = new Audio(TONO);
    _audio.currentTime = 0;
    _audio.volume = 1.0;
    intento = Promise.resolve(_audio.play()).then(() => 'tono');
  } catch (e) {
    intento = Promise.reject(e);
  }
  return intento.catch((motivo) => tonoRespaldo().then((sono) => {
    if (sono) return 'respaldo';
    apuntarRechazo('alerta · el navegador no dejó sonar la alarma', motivo);
    return false;
  }));
};
