/**
 * ¿ESTE CELULAR ES EL MISMO? — la regla del teléfono, en el servidor (gemelo G42, 28-sep-2026).
 *
 * COPIA de `celularDiezCifras` de guajirago/src/telefonoValido.js, porque la nube no puede importar la de la app
 * (`functions/` es otro paquete que se sube solo, y la app está escrita con import/export).
 * pruebas/telefonoUnico.test.js EJECUTA las dos con los mismos textos y se pone roja si dicen distinto
 * (SEGUNDA LEY: una copia que no se puede evitar, se ata).
 *
 * La usa `celularDisponible` (el crédito de bienvenida): antes comparaba el celular LETRA POR LETRA, así que
 * «300 123 4567» y «3001234567» eran «distintos» y el mismo número podía registrarse dos veces. Ahora compara por
 * las 10 cifras.
 *
 * `formasGuardadas(diez)` son las maneras en que ese mismo número puede estar escrito en una ficha VIEJA (antes de
 * que las apps lo guardaran en 10 cifras limpias). Firestore no sabe limpiar lo guardado al buscar, así que se le
 * pregunta por todas a la vez (`in`, máximo 30). Lo guardado desde el 28-sep-2026 ya va en 10 cifras limpias.
 * Cuántas fichas hay en cada forma lo cuenta scripts/medir-telefono-guardado.cjs.
 */
function celularDiezCifras(texto) {
  const crudo = String(texto == null ? '' : texto).trim();
  if (!/^\+?[\d\s().-]+$/.test(crudo)) return '';
  const cifras = crudo.replace(/\D/g, '');
  if (cifras.length === 10) return cifras;
  if (cifras.length === 12 && cifras.startsWith('57')) return cifras.slice(2);
  return '';
}

function formasGuardadas(diez) {
  const d = celularDiezCifras(diez);
  if (!d) return [];
  const a = d.slice(0, 3), b = d.slice(3, 6), c = d.slice(6);
  const tresPartes = [a + ' ' + b + ' ' + c, a + '-' + b + '-' + c, a + '.' + b + '.' + c, '(' + a + ') ' + b + ' ' + c, '(' + a + ') ' + b + '-' + c];
  const formas = [d, ...tresPartes];
  for (const p of ['+57', '+57 ', '57', '57 ']) { formas.push(p + d); formas.push(p + a + ' ' + b + ' ' + c); }
  return [...new Set(formas)];
}

/**
 * P06 (30-sep-2026): la pregunta «¿otra ficha se registró con este celular?» vive UNA vez y la hacen dos funciones:
 * `celularDisponible` (la pantalla de registro, antes de crear la ficha) y `descuentoDeBienvenida` (el servidor, que ya
 * no se fía de que la pantalla haya preguntado). Se busca en `celular` (el número del registro), no en `telefono` (el de
 * Mi perfil): un número puesto en Mi perfil no le quita el regalo a su dueño cuando se registre.
 * `db` es el Firestore del servidor; la consulta se corre con `.get()` o dentro de una transacción con `t.get()`.
 */
function fichasConEsteCelular(db, diez) {
  return db.collection('usuarios').where('celular', 'in', formasGuardadas(diez)).limit(2);
}

/** Su propia ficha no cuenta: si vuelve a intentarlo, no se bloquea a sí mismo. */
function esDeOtraFicha(snap, uid) {
  return snap.docs.some((d) => d.id !== uid);
}

module.exports = { celularDiezCifras, formasGuardadas, fichasConEsteCelular, esDeOtraFicha };
