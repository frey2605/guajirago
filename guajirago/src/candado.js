// ─────────────────────────────────────────────────────────────────────────────
// LA LEY DEL BOTÓN — la pieza. Viene de Talaria (Jhon, 25-sep-2026: «cada botón debe tener bloqueo de doble
// toque, mostrar la acción GUARDANDO, ENVIANDO, AJUSTANDO, y al final el resultado con la verdad»), y el 26-sep-2026
// se trajo a GuajiraGo mejorada en lo que las trampas enseñaron que se escapaba.
//
// Todo botón que guarda, envía o cambia algo pasa por aquí (con el gancho useAccion):
//   1. NO deja hacer dos veces lo mismo: el candado se cierra en el mismo instante del primer toque.
//   2. MUESTRA que está trabajando: la pantalla sabe CUÁL acción corre y ese botón dice su palabra.
//   3. DICE cómo terminó, y lo dice el candado, no cada pantalla (así ninguna se olvida): verde si se hizo,
//      rojo con el motivo en cristiano si no.
//   4. NUNCA queda trabado: si en TOPE_MS no hay respuesta (sin señal, la base guarda y no contesta), el candado se
//      abre y dice que NO SE PUDO CONFIRMAR — no que falló, porque eso no se sabe, y con plata de por medio decir
//      «falló» cuando sí entró invita a hacerlo dos veces. Si la respuesta llega tarde, el aviso se corrige solo.
//
// Sin React y sin importar nada: así las pruebas la cargan y la EJECUTAN tal cual (pruebas/leyBoton.test.js).
// El panel y aliados llevan una copia byte a byte, atada por esa misma prueba.
// ─────────────────────────────────────────────────────────────────────────────
export const TOPE_MS = 20000;
export const MENSAJE_FALLA = 'No se pudo completar. Revisa la señal y vuelve a intentar.';
export const NO_CONFIRMADO = 'No se pudo confirmar. Revisa si quedó hecho antes de volver a intentar.';

// Los errores de Firebase llegan como «firestore/permission-denied» o «functions/unavailable»: se dicen en cristiano.
export const ERRORES = {
  'permission-denied': 'No tienes permiso para hacer esto.',
  unauthenticated: 'Tu sesión se cerró. Vuelve a entrar.',
  unavailable: 'No hay señal con el servidor. Vuelve a intentar.',
  'deadline-exceeded': NO_CONFIRMADO,
  'not-found': 'Eso ya no existe. Refresca la pantalla.',
  'already-exists': 'Eso ya estaba hecho.',
  'failed-precondition': 'No se puede hacer en este momento: algo cambió. Refresca la pantalla.',
  aborted: 'Otra persona lo cambió al mismo tiempo. Vuelve a intentar.',
  'resource-exhausted': 'Demasiados intentos seguidos. Espera un momento.',
  'invalid-argument': 'Algún dato no es válido. Revisa lo que escribiste.',
};

// El motivo que ve la gente. Un mensaje propio de la app (sin código de Firebase) se respeta tal cual.
export function enCristiano(e) {
  const codigo = String((e && e.code) || '').split('/').pop();
  if (ERRORES[codigo]) return ERRORES[codigo];
  if (e && !e.code && typeof e.message === 'string' && e.message) return e.message;
  return MENSAJE_FALLA;
}

// alCambiar(cual | false): cuál acción está corriendo. alAviso({ ok, texto, cual }): la verdad del final.
// reloj: se cambia en las pruebas para no esperar 20 segundos de verdad.
export function crearCandado({ alCambiar = () => {}, alAviso = () => {}, tope = TOPE_MS, reloj = { poner: setTimeout, quitar: clearTimeout } } = {}) {
  let cerrado = false;
  let vuelta = 0; // cuál fue la última acción: un aviso tardío solo corrige el suyo
  return {
    get ocupado() { return cerrado; },
    // correr(fn, cual, exito): fn es lo que guarda; cual, el nombre de la acción (el mismo que usa texto());
    // exito, lo que se dice si sale bien. Devuelve { ok: true, valor } | { ok: false, error, sinConfirmar? },
    // o null si fue un segundo toque mientras el primero trabajaba.
    async correr(fn, cual, exito) {
      if (typeof cual !== 'string' || !cual) throw new Error('La ley del botón: correr(fn, cual, exito) necesita el nombre de la acción.');
      if (typeof exito !== 'string' || !exito) throw new Error('La ley del botón: correr(fn, cual, exito) necesita el texto de «se hizo».');
      if (cerrado) return null;
      cerrado = true;
      const mia = ++vuelta;
      alCambiar(cual);
      const decir = (r) => { if (mia === vuelta) alAviso(r.ok ? { ok: true, texto: exito, cual } : { ok: false, texto: r.error, cual }); };
      const trabajo = Promise.resolve().then(fn).then(
        (v) => (v && v.ok === false ? { ok: false, error: v.error || MENSAJE_FALLA } : { ok: true, valor: v }),
        (e) => ({ ok: false, error: enCristiano(e) }),
      );
      let timer;
      const vencido = new Promise((ok) => { timer = reloj.poner(() => ok({ ok: false, error: NO_CONFIRMADO, sinConfirmar: true }), tope); });
      try {
        const r = await Promise.race([trabajo, vencido]);
        decir(r);
        if (r.sinConfirmar) trabajo.then((tarde) => decir(tarde)); // llegó tarde: se corrige el aviso con la verdad
        return r;
      } finally {
        reloj.quitar(timer);
        cerrado = false;
        alCambiar(false);
      }
    },
  };
}
