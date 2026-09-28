#!/usr/bin/env node
/**
 * ⭐ ¿CUÁNTOS LUGARES FAVORITOS DEJA GUARDAR LA APP, Y CUÁNTOS DICE QUE DEJA? — gemelo G35, SOLO LECTURA, contra producción.
 *
 * El pasajero guarda sus lugares en `usuarios/{uid}.favoritos`. El tope lo pone el dueño en el panel
 * (`config/global.maximoFavoritos`). Hasta el G35 había TRES sitios que hablaban de ese tope:
 *   · la comprobación de `guardarFavorito` (Solicitar.js), que SÍ leía el número del panel;
 *   · la ventanita «Llegaste al límite» (Solicitar.js), que decía siempre «Solo puedes guardar 3 lugares»;
 *   · la pregunta frecuente de Ayuda (AyudaSoporte.js), que decía siempre «hasta 3 lugares favoritos».
 *
 * Este guion:
 *   · lee `config/global` de PRODUCCIÓN y dice cuánto vale hoy `maximoFavoritos`;
 *   · cuenta cuántos favoritos tiene guardados cada usuario (y cuántos ya están por encima del tope);
 *   · y EJECUTA, con esa config y con configs de mentira (vacía, 0, texto), cuántos deja guardar la comprobación y qué
 *     número dicen los dos textos, para ver si los tres dicen lo mismo.
 *
 * Dos modos, para carear el paso 1 con el 12:
 *   node scripts/medir-favoritos-g35.cjs --antes   → las tres piezas como estaban antes del arreglo (copiadas aquí)
 *   node scripts/medir-favoritos-g35.cjs           → las de HOY, SACADAS de los archivos y ejecutadas (no copiadas)
 *   --sin-nube                                     → no lee producción (solo el careo con configs de mentira)
 */
const { leer, cargarDeLaApp, cuerpoDeLaFuncion } = require('../pruebas/cargar.cjs');

// ── Lo de ANTES del arreglo (commit b43c944), copiado tal cual para poder carear ──
const ANTES = {
  condicion: 'favoritos.length >= configApp.maximoFavoritos',                         // Solicitar.js, guardarFavorito
  ventanita: '`Solo puedes guardar 3 lugares. Borra uno para poder agregar otro.`',    // Solicitar.js, avisoLimite
  ayuda: '`hasta 3 lugares favoritos`',                                                // AyudaSoporte.js, pregunta de favoritos
};

/** Pasa un trozo de JSX de texto (`Hola {x} mundo`) a una plantilla de JS (`Hola ${x} mundo`) que se puede ejecutar. */
function jsxAPlantilla(t) {
  return '`' + t.replace(/`/g, '\\`').replace(/\{/g, '${') + '`';
}

/**
 * Las tres piezas de HOY, sacadas de los archivos:
 *   · condicion: lo que va dentro del `if (...)` de `guardarFavorito` que abre `setAvisoLimite(true)`;
 *   · ventanita: el texto del `<p>` que sigue a «Llegaste al límite»;
 *   · ayuda: el trozo «hasta … favoritos» de la respuesta de la pregunta de favoritos, tal como está escrito.
 */
function piezasDeHoy(fuenteSolicitar, fuenteAyuda) {
  const fs = (fuenteSolicitar !== undefined ? fuenteSolicitar : leer('guajirago/src/Solicitar.js')).replace(/\r\n/g, '\n');
  const fa = (fuenteAyuda !== undefined ? fuenteAyuda : leer('guajirago/src/AyudaSoporte.js')).replace(/\r\n/g, '\n');

  const iG = fs.indexOf('const guardarFavorito = ');
  if (iG < 0) throw new Error('Solicitar.js: no encuentro `const guardarFavorito =`');
  const cuerpo = (cuerpoDeLaFuncion(fs, iG) || {}).texto;
  if (!cuerpo) throw new Error('Solicitar.js: no pude sacar el cuerpo de guardarFavorito');
  const iAviso = cuerpo.indexOf('setAvisoLimite(true)');
  if (iAviso < 0) throw new Error('Solicitar.js: guardarFavorito ya no abre la ventanita del límite');
  const iIf = cuerpo.lastIndexOf('if (', iAviso);
  if (iIf < 0) throw new Error('Solicitar.js: no encuentro el `if (` que abre la ventanita del límite');
  let prof = 0; let condicion = null;
  for (let j = iIf + 3; j < cuerpo.length; j += 1) {
    if (cuerpo[j] === '(') prof += 1;
    else if (cuerpo[j] === ')') { prof -= 1; if (prof === 0) { condicion = cuerpo.slice(iIf + 4, j).trim(); break; } }
  }
  if (!condicion) throw new Error('Solicitar.js: no pude sacar la condición del límite');

  const iTit = fs.indexOf('Llegaste al límite');
  if (iTit < 0) throw new Error('Solicitar.js: no encuentro la ventanita «Llegaste al límite»');
  const iP = fs.indexOf('<p ', iTit);
  const iAbre = iP < 0 ? -1 : fs.indexOf('>', iP);
  const iCierra = iAbre < 0 ? -1 : fs.indexOf('</p>', iAbre);
  if (iCierra < 0) throw new Error('Solicitar.js: la ventanita del límite ya no tiene su <p>');
  const ventanita = jsxAPlantilla(fs.slice(iAbre + 1, iCierra));

  const iPreg = fa.indexOf('¿Puedo guardar mis direcciones favoritas?');
  if (iPreg < 0) throw new Error('AyudaSoporte.js: no encuentro la pregunta de los favoritos');
  const finRenglon = fa.indexOf('\n', iPreg);
  const renglon = fa.slice(iPreg, finRenglon < 0 ? fa.length : finRenglon);
  const m = renglon.match(/hasta [^.]*?favoritos/);
  if (!m) throw new Error('AyudaSoporte.js: la respuesta de favoritos ya no dice «hasta … favoritos»');
  // Si la respuesta es una plantilla (`...${x}...`) se ejecuta tal cual; si es texto fijo, también.
  const ayuda = '`' + m[0].replace(/`/g, '\\`') + '`';
  // Y si la lista se arma con `preguntasCon(<algo>)`, lo que la pantalla le pasa SE SACA del archivo y se ejecuta
  // (no se inventa aquí): es el eslabón que une la respuesta con config/global.
  let argAyuda = null;
  const iDef = fa.indexOf('const preguntasCon = (');
  if (iDef >= 0) {
    const nombreParam = fa.slice(iDef + 'const preguntasCon = ('.length, fa.indexOf(')', iDef)).trim();
    const iLlamada = fa.indexOf('preguntasCon(', iDef + 1);
    if (iLlamada < 0) throw new Error('AyudaSoporte.js: nadie llama a preguntasCon(...)');
    let p = 0;
    for (let j = iLlamada + 'preguntasCon'.length; j < fa.length; j += 1) {
      if (fa[j] === '(') p += 1;
      else if (fa[j] === ')') { p -= 1; if (p === 0) { argAyuda = fa.slice(iLlamada + 'preguntasCon('.length, j).trim(); break; } }
    }
    if (!argAyuda) throw new Error('AyudaSoporte.js: no pude sacar lo que se le pasa a preguntasCon(...)');
    return { condicion, ventanita, ayuda, argAyuda, nombreParam };
  }
  return { condicion, ventanita, ayuda };
}

/**
 * Ejecuta una pieza con la config que la pantalla tendría (`{ ...respaldo, ...loDelServidor }`, como hacen Solicitar
 * y Ayuda).
 */
function evaluar(expresion, delServidor, piezas, extra) {
  const configApp = { ...piezas.CONFIG_COMPARTIDA, ...(delServidor || {}) };
  const nombres = { configApp, ...piezas, ...(extra || {}) };
  // eslint-disable-next-line no-new-func
  return new Function(...Object.keys(nombres), 'return (' + expresion + ');')(...Object.values(nombres));
}

/** Cuántos lugares deja guardar la condición: prueba con 0, 1, 2… favoritos hasta que diga «llegaste al límite». */
function cuantosDeja(condicion, delServidor, piezas) {
  for (let n = 0; n <= 50; n += 1) {
    const favoritos = Array.from({ length: n }, (_, i) => ({ direccion: 'lugar ' + i }));
    if (evaluar(condicion, delServidor, piezas, { favoritos })) return n;
  }
  return Infinity;
}

/** El primer número que aparece en un texto (o null). */
function numeroDelTexto(t) {
  const m = String(t).match(/\d+/);
  return m ? Number(m[0]) : null;
}

/** Los casos del careo: la config de producción (si se leyó) y cinco de mentira. */
function casos(produccion) {
  const l = [];
  if (produccion !== undefined) l.push(['PRODUCCIÓN (config/global de hoy)', produccion]);
  l.push(['el dueño puso 5', { maximoFavoritos: 5 }]);
  l.push(['el dueño puso 1', { maximoFavoritos: 1 }]);
  l.push(['config/global no cargó', {}]);
  l.push(['el panel guardó 0 (casilla vacía)', { maximoFavoritos: 0 }]);
  l.push(['llegó como texto "4"', { maximoFavoritos: '4' }]);
  return l;
}

/** Función pura: con las tres piezas y los casos, cuántos deja guardar y qué dicen los textos, y si coinciden. */
function medir(piezasTexto, listaCasos, piezas) {
  const filas = listaCasos.map(([nombre, cfg]) => {
    const deja = cuantosDeja(piezasTexto.condicion, cfg, piezas);
    const ventanita = evaluar(piezasTexto.ventanita, cfg, piezas);
    const extraAyuda = piezasTexto.argAyuda
      ? { [piezasTexto.nombreParam]: evaluar(piezasTexto.argAyuda, cfg, piezas) } : {};
    const ayuda = evaluar(piezasTexto.ayuda, cfg, piezas, extraAyuda);
    const nV = numeroDelTexto(ventanita);
    const nA = numeroDelTexto(ayuda);
    const iguales = Number.isFinite(deja) && deja > 0 && nV === deja && nA === deja;
    return { nombre, deja, ventanita, ayuda, nV, nA, iguales };
  });
  return { filas, distintos: filas.filter((f) => !f.iguales).length };
}

async function main() {
  const antes = process.argv.includes('--antes');
  const sinNube = process.argv.includes('--sin-nube');
  const piezas = cargarDeLaApp('guajirago/src/configApp.js');
  const piezasTexto = antes ? ANTES : piezasDeHoy();

  let produccion;
  if (!sinNube) {
    const { traer, doc } = require('./nube.cjs');
    const config = (await traer('config')).map(doc);
    const global = config.find((d) => d.id === 'global');
    if (!global) console.log('⚠ config/global NO existe en producción');
    produccion = global && 'maximoFavoritos' in global ? { maximoFavoritos: global.maximoFavoritos } : {};
    console.log('config/global.maximoFavoritos en PRODUCCIÓN = '
      + (global && 'maximoFavoritos' in global ? JSON.stringify(global.maximoFavoritos) + ' (' + typeof global.maximoFavoritos + ')' : '(no está)'));
    const usuarios = (await traer('usuarios')).map(doc);
    const conLista = usuarios.filter((u) => Array.isArray(u.favoritos));
    const porCuantos = {};
    for (const u of conLista) porCuantos[u.favoritos.length] = (porCuantos[u.favoritos.length] || 0) + 1;
    console.log('usuarios: ' + usuarios.length + ' · con lista de favoritos: ' + conLista.length
      + ' · sin el campo: ' + (usuarios.length - conLista.length));
    console.log('  cuántos favoritos tiene cada uno → ' + Object.keys(porCuantos).sort((a, b) => a - b)
      .map((k) => k + ' favoritos: ' + porCuantos[k] + ' usuario(s)').join(' · '));
    const tope = Number(global && global.maximoFavoritos);
    if (Number.isFinite(tope) && tope > 0) {
      const lleno = conLista.filter((u) => u.favoritos.length === tope);
      const encima = conLista.filter((u) => u.favoritos.length > tope);
      console.log('  justo en el tope de producción (' + tope + '): ' + lleno.length + ' · por ENCIMA: ' + encima.length
        + (encima.length ? ' → ' + encima.map((u) => u.id.slice(0, 8) + '… (' + u.favoritos.length + ')').join(', ') : ''));
    }
  }

  console.log('\nModo: ' + (antes ? 'ANTES del arreglo (copiado)' : 'HOY (sacado de los archivos y ejecutado)'));
  console.log('  comprobación → if (' + piezasTexto.condicion + ')');
  console.log('  ventanita    → ' + piezasTexto.ventanita);
  console.log('  ayuda        → ' + piezasTexto.ayuda + '\n');
  const r = medir(piezasTexto, casos(produccion), piezas);
  for (const f of r.filas) {
    console.log((f.iguales ? '  ✓ ' : '  🔴 ') + f.nombre.padEnd(38) + ' deja guardar ' + String(f.deja).padEnd(3)
      + ' ventanita dice ' + String(f.nV).padEnd(5) + ' ayuda dice ' + f.nA);
  }
  console.log('\n' + (r.distintos === 0
    ? '✓ la comprobación y los dos textos dicen el mismo número en los ' + r.filas.length + ' casos'
    : '🔴 en ' + r.distintos + ' de ' + r.filas.length + ' casos lo que se deja guardar y lo que se dice no coinciden'));
}

if (require.main === module) {
  main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
}

module.exports = { ANTES, piezasDeHoy, evaluar, cuantosDeja, numeroDelTexto, casos, medir, jsxAPlantilla };
