// ═══════════════════════════════════════════════════════════════════════════
//  BUSCAR A UNA PERSONA POR SU DOCUMENTO EN EL PANEL — gemelo G79 (29-sep-2026)
//
//  Cuatro pantallas del panel (Códigos, Asignar promoción, Créditos y Administradores) buscaban por
//  documento con su propia consulta `documento == lo escrito`: con puntos o espacios no encontraban a
//  nadie, y una ficha guardada sucia (el registro guarda lo que se escribió) tampoco. Ahora las cuatro
//  usan guajirago-admin/src/documentoUsuario.js.
//
//  Esta prueba NO lee textos para dar por bueno el arreglo: saca las cuatro búsquedas de su archivo y
//  las CORRE con una Firestore de mentira (el mismo recorrido de scripts/medir-documento-panel.cjs),
//  y carea con el panel de antes (7b595ed).
// ═══════════════════════════════════════════════════════════════════════════
const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const M = require('../scripts/medir-documento-panel.cjs');
const { soloCodigo } = require('./cargar.cjs');

const ANTES = '7b595ed';
const PANEL = path.resolve(__dirname, '..', 'guajirago-admin');
const hayCommit = (() => {
  try { execFileSync('git', ['-C', PANEL, 'cat-file', '-e', ANTES + '^{commit}'], { stdio: 'ignore' }); return true; } catch (e) { return false; }
})();

const pieza = () => M.cargarPieza(M.textoDelPanel(M.PIEZA), M.firestoreDeMentira({}));

test('la pieza limpia lo escrito y pregunta por las formas en que puede estar guardado', () => {
  const p = pieza();
  assert.ok(p, 'no está guajirago-admin/src/documentoUsuario.js');
  assert.deepStrictEqual(p.formasDelDocumento(''), []);
  assert.deepStrictEqual(p.formasDelDocumento('   '), []);
  assert.deepStrictEqual(p.formasDelDocumento(null), []);
  assert.deepStrictEqual(p.formasDelDocumento(' .-, '), []);
  assert.strictEqual(p.limpiarDocumento(' 1.122 334-455, '), '1122334455');
  const f = p.formasDelDocumento(' 1.122.334.455 ');
  for (const x of ['1122334455', '1.122.334.455', '1 122 334 455', '1,122,334,455', '1122334455 ']) assert.ok(f.includes(x), 'falta la forma «' + x + '»: ' + JSON.stringify(f));
  assert.strictEqual(new Set(f).size, f.length, 'formas repetidas');
  assert.ok(f.length >= 1 && f.length <= 30, 'una consulta «in» admite de 1 a 30 valores');
  // Un documento con letras (pasaporte) se queda con sus letras, sin inventarle puntos de miles.
  assert.deepStrictEqual(p.formasDelDocumento('ab-123'), ['ab123', 'ab-123', 'ab123 ']);
});

test('las cuatro búsquedas encuentran a la persona, se escriba como se escriba (fichas de mentira)', async () => {
  const r = await M.careo(M.FICHAS_DE_MENTIRA);
  for (const [nombre, fila] of Object.entries(r)) {
    assert.ok(fila.total >= 8, nombre + ': casi no corrió casos (' + fila.total + ')');
    assert.strictEqual(fila.encontrados, fila.total, nombre + ' no encontró: ' + JSON.stringify(fila.fallos));
  }
});

test('y también si el documento está GUARDADO sucio (con puntos, espacios o un espacio al final)', async () => {
  const r = await M.careo(M.FICHAS_DE_MENTIRA, null, null, { suciosEnMemoria: true });
  for (const [nombre, fila] of Object.entries(r)) {
    assert.ok(fila.total >= 6, nombre + ': casi no corrió casos');
    assert.strictEqual(fila.encontrados, fila.total, nombre + ' no encontró: ' + JSON.stringify(fila.fallos));
  }
});

test('CAREO: el panel de antes no encontraba a la persona escrita con puntos o espacios', { skip: !hayCommit && 'no está el commit ' + ANTES }, async () => {
  const antes = await M.careo(M.FICHAS_DE_MENTIRA, ANTES);
  for (const [nombre, fila] of Object.entries(antes)) {
    assert.strictEqual(fila.maneras['tal cual'].encontrados, fila.maneras['tal cual'].total, nombre + ': antes SÍ encontraba lo escrito tal cual');
    assert.strictEqual(fila.maneras['con puntos de miles'].encontrados, 0, nombre + ': antes no encontraba con puntos');
  }
  const sucios = await M.careo(M.FICHAS_DE_MENTIRA, ANTES, null, { suciosEnMemoria: true });
  for (const [nombre, fila] of Object.entries(sucios)) assert.strictEqual(fila.encontrados, 0, nombre + ': antes no encontraba lo guardado sucio');
});

test('cada pantalla sigue decidiendo lo suyo alrededor (id, correo, «no es conductor»)', async () => {
  const datos = { usuarios: M.FICHAS_DE_MENTIRA };
  const { busquedas, consultas } = M.cargarBusquedas(datos);
  const b = Object.fromEntries(busquedas.map((x) => [x.funcion, x.correr]));
  // Códigos: pegar el id del chat sigue sirviendo, y el id va antes que el documento.
  assert.strictEqual((await b.buscarConductorPorDocumento('a1')).encontrado, 'a1');
  // Créditos y Administradores: el correo sigue sirviendo.
  assert.strictEqual((await b.buscarConductorCred('DOS@x.co')).encontrado, 'b2');
  assert.strictEqual((await b.buscarUsuario('tres@x.co')).encontrado, 'c3');
  // Créditos: una pasajera encontrada por documento sigue sin pasar («no es un conductor»).
  const cred = await b.buscarConductorCred('40.912');
  assert.strictEqual(cred.encontrado, null);
  assert.strictEqual(cred.aviso, 'Ese usuario no es un conductor');
  // Nadie con ese documento: el aviso de siempre.
  assert.strictEqual((await b.buscarUsuario('999')).aviso, 'No se encontró ningún usuario con ese correo o documento');
  // Vacío: ni se pregunta a Firestore.
  const n = consultas.length;
  assert.strictEqual((await b.buscarUsuarioParaAsignar('   ')).encontrado, null);
  assert.strictEqual(consultas.length, n, 'con el campo vacío no se consulta nada');
  // Y las búsquedas por documento van con UNA consulta «in», no con «==».
  assert.ok(consultas.includes('documento in'), 'la búsqueda por documento no pasó por la pieza: ' + JSON.stringify(consultas));
  assert.ok(!consultas.includes('documento =='), 'queda una búsqueda por documento con «==»');
});

test('si dos fichas tienen el mismo número, gana la guardada exactamente como se escribió', async () => {
  const fs_ = M.firestoreDeMentira({ usuarios: { a: { documento: '1.122.334.455' }, b: { documento: '1122334455' } } });
  const p = M.cargarPieza(M.textoDelPanel(M.PIEZA), fs_);
  assert.deepStrictEqual((await p.buscarPorDocumento(fs_.db, '1122334455')).map((f) => f.id), ['b', 'a']);
  assert.deepStrictEqual((await p.buscarPorDocumento(fs_.db, '1.122.334.455')).map((f) => f.id), ['a', 'b']);
});

test('ninguna pantalla de las tres apps escribe su propia consulta por documento', () => {
  const c = M.consultasEscritas();
  assert.deepStrictEqual(c, { 'guajirago-admin/src/documentoUsuario.js': 1 },
    'la consulta por documento vive SOLO en la pieza: ' + JSON.stringify(c));
  for (const b of M.BUSQUEDAS) {
    const t = soloCodigo(M.textoDelPanel(b.archivo));
    assert.match(t, /^import \{ buscarPorDocumento \} from '\.\/documentoUsuario';\r?$/m, b.archivo + ' no importa la pieza');
  }
});

test('el lector no se deja engañar: una pantalla con la consulta vieja se nota al correrla', async () => {
  const codigos = M.textoDelPanel('src/Codigos.js');
  const viejo = codigos.replace('const [d] = await buscarPorDocumento(db, valor);',
    "const s = await getDocs(query(collection(db, 'usuarios'), where('documento', '==', valor.trim()))); const d = s.docs[0] && { id: s.docs[0].id, ...s.docs[0].data() };");
  assert.notStrictEqual(viejo, codigos, 'el texto de mentira no calzó');
  const r = await M.careo(M.FICHAS_DE_MENTIRA, null, { 'src/Codigos.js': viejo });
  assert.ok(r['Códigos de recarga'].encontrados < r['Códigos de recarga'].total, 'la pantalla de mentira pasó como buena');
  assert.strictEqual(r['Asignar promoción'].encontrados, r['Asignar promoción'].total);
});
