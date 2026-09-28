// ═══════════════════════════════════════════════════════════════════════════
//  LA FICHA DEL CONDUCTOR NO SE REESCRIBE ENTERA · gemelo G02, 27-sep-2026
//
//  El GPS del conductor guardaba su ficha (`conductores/{uid}`) con `setDoc` SIN merge en cada
//  lectura, y eso la REEMPLAZA entera: borraba `enViajeId` y `ocupado` —que pone el servidor al
//  confirmarlo, y con los que `confirmarConductor` decide si ya va en otro viaje— y el token de
//  avisos si esa vez no se pudo pedir. Al apagarse pasaba lo mismo.
//
//  No se mira solo ese renglón: se miran TODOS los sitios de la app que nombran la ficha, y cada
//  escritura tiene que llevar `{ merge: true }`. Uno nuevo que la reescriba entera, o una forma de
//  escribirla que esta prueba no sepa leer, la pone roja.
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, soloCodigo, sinTextos } = require('./cargar.cjs');
const { medir } = require('../scripts/medir-ficha-conductor.cjs');

const ARCHIVOS = ['AppConductor.js', 'Notificaciones.js', 'Solicitar.js', 'App.js', 'MiPerfil.js', 'Configuracion.js', 'MenuLateral.js'];

/** Cada sitio de un código donde aparece la ficha del conductor, con la llamada que la envuelve. */
function sitiosDeLaFicha(codigo) {
  const limpio = sinTextos(codigo);
  const sitios = [];
  const re = /doc\(db,\s*'conductores'/g;
  let m;
  while ((m = re.exec(codigo))) {
    const antes = codigo.slice(Math.max(0, m.index - 12), m.index);
    const llamada = (antes.match(/(\w+)\($/) || [])[1] || '(suelta)';
    let args = '';
    if (llamada === 'setDoc') {
      const abre = m.index - 1;
      let nivel = 0, i = abre;
      for (; i < limpio.length; i++) {
        if (limpio[i] === '(') nivel++;
        else if (limpio[i] === ')' && --nivel === 0) break;
      }
      args = codigo.slice(abre + 1, i);
    }
    sitios.push({ llamada, args, renglon: codigo.slice(0, m.index).split('\n').length });
  }
  return sitios;
}

const conMerge = (args) => /,\s*\{\s*merge:\s*true\s*\}\s*$/.test(args);

describe('LA FICHA DEL CONDUCTOR · nadie la reescribe entera', () => {
  const todos = ARCHIVOS.flatMap((a) => sitiosDeLaFicha(soloCodigo(leer('guajirago/src/' + a))).map((s) => ({ ...s, archivo: a })));

  it('encuentra las escrituras que tiene que encontrar (si no, la prueba no mira nada)', () => {
    const escrituras = todos.filter((s) => s.llamada === 'setDoc');
    assert.ok(escrituras.length >= 6, 'solo encontré ' + escrituras.length + ' escrituras de la ficha');
    assert.ok(escrituras.some((s) => /ubicacion: nueva/.test(s.args)), 'no encuentro la del GPS');
    assert.ok(escrituras.some((s) => /activo: false, nombre/.test(s.args)), 'no encuentro la de apagarse');
  });

  it('cada escritura lleva { merge: true }: sin él se borran enViajeId, ocupado y el token', () => {
    const sinMerge = todos.filter((s) => s.llamada === 'setDoc' && !conMerge(s.args));
    assert.deepStrictEqual(sinMerge.map((s) => s.archivo + ':' + s.renglon), [], '⛔ escritura que reescribe la ficha entera');
  });

  it('la ficha solo se toca por caminos que esta prueba sabe leer', () => {
    const raros = todos.filter((s) => !['setDoc', 'onSnapshot', 'getDoc', 'updateDoc'].includes(s.llamada));
    assert.deepStrictEqual(raros.map((s) => s.archivo + ':' + s.renglon + ' (' + s.llamada + ')'), [],
      '⛔ la ficha se usa de una forma que esta prueba no vigila: añádela aquí con su comprobación');
  });

  it('al apagarse sigue quitando la ubicación: fuera de turno no se guarda dónde está', () => {
    const apagar = todos.find((s) => s.llamada === 'setDoc' && /activo: false, nombre/.test(s.args));
    assert.match(apagar.args, /ubicacion: deleteField\(\)/, '⛔ al apagarse la última ubicación se queda guardada');
  });

  it('la app nunca PONE un viaje en curso: eso lo hace solo el servidor al confirmar', () => {
    const pone = todos.filter((s) => /enViajeId:\s*(?!\s|null\b)/.test(s.args));
    assert.deepStrictEqual(pone.map((s) => s.archivo + ':' + s.renglon), []);
  });
});

describe('EL TOKEN DE AVISOS · un solo camino (27-sep-2026)', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const SRC = path.join(__dirname, '..', 'guajirago', 'src');

  it('solo Notificaciones.js le pide el token a Firebase: ninguna pantalla lleva su copia', () => {
    const conCopia = fs.readdirSync(SRC).filter((f) => f.endsWith('.js') && f !== 'Notificaciones.js')
      // El NOMBRE, no la llamada: `import { getToken as gt }` y luego `gt()` se escapaba (sabotaje del 27-sep-2026).
      .filter((f) => /\bgetToken\b/.test(soloCodigo(leer('guajirago/src/' + f))));
    assert.deepStrictEqual(conCopia, [], '⛔ una pantalla pide el token por su cuenta');
  });

  it('el GPS no lleva el token: reintenta con registrarTokenFCM, solo si falta y el permiso está dado', () => {
    const t = soloCodigo(leer('guajirago/src/AppConductor.js'));
    const i = t.indexOf('const guardarUbicacion');
    const cuerpo = t.slice(i, t.indexOf('\n    };', i));
    assert.ok(i > 0 && cuerpo.length > 100, 'no encuentro guardarUbicacion');
    assert.ok(!/fcmToken/.test(cuerpo), '⛔ el GPS vuelve a escribir el token por su cuenta');
    assert.match(cuerpo, /if \(!tokenListo && !pidiendoToken && typeof Notification !== 'undefined' && Notification\.permission === 'granted'\) \{\s*pidiendoToken = true;\s*registrarTokenFCM\(\)\.then\(\(ok\) => \{ tokenListo = ok; pidiendoToken = false; \}\);/,
      '⛔ el GPS no reintenta por la pieza única, o la llama sin mirar el permiso (repetiría la pregunta)');
  });

  it('registrarTokenFCM dice si quedó guardado: true tras guardarlo, false si no', () => {
    const t = soloCodigo(leer('guajirago/src/Notificaciones.js')).replace(/\r\n/g, '\n');
    const i = t.indexOf('export const registrarTokenFCM');
    const cuerpo = t.slice(i, t.indexOf('\n};', i) + 3);
    assert.match(cuerpo, /\{ fcmToken: token \}, \{ merge: true \}\);\s*log\('FCM: guardado OK'\);\s*return true;/, '⛔ no avisa que lo guardó');
    assert.match(cuerpo, /\n  return false;\n\};$/, '⛔ si no lo guarda, no lo dice');
  });
});

describe('LA FICHA DEL CONDUCTOR · el medidor', () => {
  it('cuenta los viajes vivos sin marca y las marcas que apuntan a un viaje terminado', () => {
    const r = medir(
      [
        { id: 'c1', activo: true, fcmToken: 't', enViajeId: 'v1', ocupado: true },
        { id: 'c2', activo: true },
        { id: 'c3', activo: false, enViajeId: 'v3' },
        { id: 'c4', activo: true, fcmToken: 't', enViajeId: 'v9' },
      ],
      [
        { id: 'v1', estado: 'aceptado', conductorId: 'c1' },
        { id: 'v2', estado: 'aceptado', conductorId: 'c2' },
        { id: 'v3', estado: 'finalizado', conductorId: 'c3' },
      ],
    );
    assert.strictEqual(r.fichas, 4);
    assert.strictEqual(r.activos, 3);
    assert.strictEqual(r.conViaje, 3);
    assert.strictEqual(r.ocupados, 1);
    assert.strictEqual(r.conToken, 2);
    assert.deepStrictEqual(r.activosSinToken, ['c2']);
    assert.deepStrictEqual(r.vivosSinMarca, ['v2']);
    assert.deepStrictEqual(r.marcasViejas, ['c3 → v3 (finalizado)', 'c4 → v9 (no existe)']);
  });
});
