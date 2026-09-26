#!/usr/bin/env node
/**
 * MEDIR LOS DOBLES DE LA PANTALLA DE CRÉDITOS — solo lee producción.
 *
 *   node scripts/medir-recargas-dobles.cjs
 *
 * La pantalla de Créditos (guajirago/src/Creditos.js) tenía tres caminos que guardan sin el candado de LA LEY DEL
 * BOTÓN: el canje del código, el comprobante y el chat de recargas (con el botón y con la tecla Enter). Un doble toque
 * deja rastro en los datos, y esto lo busca:
 *   · mensajes del chat de recargas repetidos: mismo autor, mismo texto (o misma foto), a menos de 3 segundos;
 *   · códigos de recarga canjeados, y cuántos por conductor (un canje doble lo frena el servidor con su transacción:
 *     aquí se cuenta cuántos hay, para el careo del antes y el después).
 * Se corre antes del arreglo (paso 1) y después (paso 12) con el mismo contador.
 */
const N = require('./nube.cjs');

const VENTANA_MS = 3000;

// Los pares seguidos que son el mismo mensaje mandado dos veces. Función pura: la prueba le da listas de mentira.
function dobles(mensajes) {
  const out = [];
  const lista = (mensajes || []).filter((m) => m && m.fecha).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  for (let i = 1; i < lista.length; i++) {
    const a = lista[i - 1];
    const b = lista[i];
    const igual = a.autor === b.autor && (a.texto || a.url || '') === (b.texto || b.url || '');
    if (igual && Date.parse(b.fecha) - Date.parse(a.fecha) < VENTANA_MS) out.push({ texto: String(a.texto || '(foto)').slice(0, 40), fecha: b.fecha });
  }
  return out;
}

module.exports = { dobles, VENTANA_MS };

if (require.main === module) {
  (async () => {
    const { permiso } = await N.token();
    const usuarios = (await N.traer('usuarios', { permiso })).map(N.doc);
    const codigos = (await N.traer('codigos', { permiso })).map(N.doc);
    let conChat = 0;
    let mensajes = 0;
    const encontrados = [];
    for (const u of usuarios) {
      const m = u.mensajesRecarga || [];
      if (!m.length) continue;
      conChat++;
      mensajes += m.length;
      for (const d of dobles(m)) encontrados.push({ uid: u.id.slice(0, 8), ...d });
    }
    const usados = codigos.filter((c) => c.usado === true);
    console.log(`Chat de recargas: ${mensajes} mensaje(s) de ${conChat} conductor(es) · repetidos a menos de ${VENTANA_MS / 1000} s: ${encontrados.length}`);
    for (const e of encontrados) console.log(`   ${e.uid}… «${e.texto}» ${e.fecha}`);
    console.log(`Códigos de recarga: ${codigos.length} · canjeados: ${usados.length}`);
    const tipos = N.tiposQueNoSupe();
    if (tipos.length) console.log('⚠ tipos de campo que no supe leer: ' + tipos.join(', '));
  })().catch((e) => { console.log('No se pudo medir: ' + e.message); process.exit(1); });
}
