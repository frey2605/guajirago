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

// EL MOTIVO DEL FALLO NO SE CALCULA AQUÍ (SEGUNDA LEY). Lo calcula `motivoDeRechazo` de avisoRechazo.js, la única pieza
// que convierte un fallo en un aviso para la gente, con copia atada en las tres apps. El 26-sep-2026 este archivo trajo
// su propia tabla de errores y ya decía cosas distintas que aquélla: se quitó el mismo día. El gancho useAccion se la
// pasa como `traducir(e, accion)` → { clave, titulo, texto }.
const TRADUCIR_POR_DEFECTO = (e, accion) => ({ clave: 'otro', titulo: 'No se pudo ' + (accion || 'completar'), texto: MENSAJE_FALLA });

// alCambiar(cual | false): cuál acción está corriendo. alAviso({ ok, titulo, texto, icono, cual }): la verdad del
// final, lista para la ventanita. reloj: se cambia en las pruebas para no esperar 20 segundos de verdad.
export function crearCandado({ alCambiar = () => {}, alAviso = () => {}, tope = TOPE_MS, reloj = { poner: setTimeout, quitar: clearTimeout }, traducir = TRADUCIR_POR_DEFECTO } = {}) {
  let cerrado = false;
  let vuelta = 0; // cuál fue la última acción: un aviso tardío solo corrige el suyo
  return {
    get ocupado() { return cerrado; },
    // correr(fn, cual, exito, accion): fn es lo que guarda; cual, el nombre de la acción (el mismo que usa texto());
    // exito, lo que se dice si sale bien: un texto, o una función que recibe lo que fn devolvió («¡Recargaste $20.000!»);
    // accion, lo que se intentaba en infinitivo («cancelar el viaje»), para el título del fallo: «No se pudo cancelar
    // el viaje». Devuelve { ok: true, valor } | { ok: false, titulo, error, clave, sinConfirmar?, avisado? }, o null si
    // fue un segundo toque mientras el primero trabajaba. Si fn devuelve { ok: false, avisado: true }, la pantalla ya
    // dijo el motivo con su propia ventanita y el candado no saca otra.
    async correr(fn, cual, exito, accion) {
      if (typeof cual !== 'string' || !cual) throw new Error('La ley del botón: correr(fn, cual, exito) necesita el nombre de la acción.');
      if (typeof exito !== 'function' && (typeof exito !== 'string' || !exito)) throw new Error('La ley del botón: correr(fn, cual, exito) necesita el texto de «se hizo».');
      if (cerrado) return null;
      cerrado = true;
      const mia = ++vuelta;
      alCambiar(cual);
      const dicho = (v) => (typeof exito === 'function' ? String(exito(v)) : exito);
      const decir = (r) => {
        // «Ya avisé yo»: la pantalla sacó su propia ventanita, más completa (el pedido sin punto de recogida nombra
        // las dos salidas). El candado no le pone otra encima.
        if (mia !== vuelta || r.avisado) return;
        alAviso(r.ok ? { ok: true, titulo: '¡Listo!', texto: dicho(r.valor), icono: '✅', cual } : { ok: false, titulo: r.titulo, texto: r.error, icono: '⚠️', cual });
      };
      const fallo = (m) => ({ ok: false, titulo: m.titulo, error: m.texto, clave: m.clave });
      const trabajo = Promise.resolve().then(fn).then(
        (v) => (v && v.ok === false
          ? { ok: false, titulo: 'No se pudo ' + (accion || 'completar'), error: v.error || MENSAJE_FALLA, clave: 'otro', ...(v.avisado ? { avisado: true } : {}) }
          : { ok: true, valor: v }),
        (e) => fallo(traducir(e, accion)),
      );
      let timer;
      const vencido = new Promise((ok) => { timer = reloj.poner(() => ok({ ok: false, titulo: 'Sin confirmar', error: NO_CONFIRMADO, clave: 'sinRed', sinConfirmar: true }), tope); });
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
