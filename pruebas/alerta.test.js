// ─────────────────────────────────────────────────────────────────────────────
//  G63 (29-sep-2026) · LA ALARMA DE UN AVISO NUEVO SALE DE UNA PIEZA
//
//  Estaba escrita dos veces —transporte (Notificaciones.js) y aliados (alerta.js)— y ya no se portaban igual: en
//  transporte el toque no despertaba el tono, así que en el iPhone el conductor y el pasajero no oían nada, y en las
//  dos el respaldo nacía en un motor nuevo que el iPhone deja callado. Y cuando no sonaba, nadie lo sabía.
//  Ahora: guajirago/src/alerta.js, con copia IDÉNTICA en guajirago-aliados/src/alerta.js.
//
//  Esta prueba:
//    1. exige que la copia de aliados sea byte a byte la de transporte;
//    2. CORRE las dos copias en un celular de mentira (iPhone y Android, con y sin toque, con el tono roto) y exige
//       lo mismo de las dos: suena si hubo toque, y si no suena lo dice;
//    3. corre el medidor (scripts/medir-alarma.cjs), que saca del archivo lo que cada pantalla llama en el toque;
//    4. y le da al medidor el código de ANTES (commit 66ef894) para comprobar que ahí sí ve el fallo.
// ─────────────────────────────────────────────────────────────────────────────
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer } = require('./cargar.cjs');
const { medir, celular, cargar, correrCaso, CASOS } = require('../scripts/medir-alarma.cjs');

const APP = 'guajirago/src/alerta.js';
const COPIA = 'guajirago-aliados/src/alerta.js';
const ANTES = '66ef894'; // el último commit de la raíz con la alarma vieja en Notificaciones.js

// Con tope: una alarma que se queda esperando al motor para siempre tiene que salir ROJA, no colgar la tanda.
describe('G63 · la alarma de un aviso nuevo sale de UNA pieza', { timeout: 10000 }, () => {
  it(COPIA + ' es byte a byte ' + APP, () => {
    assert.strictEqual(leer(COPIA).replace(/\r\n/g, '\n'), leer(APP).replace(/\r\n/g, '\n'),
      '⛔ la copia de aliados se separó de la de transporte: se copia ENTERA, no se arregla a mano en un solo lado');
  });

  for (const ruta of [APP, COPIA]) {
    const alarma = { texto: leer(ruta).replace(/\r\n/g, '\n'), sonar: 'sonarAlerta', origen: ruta };
    it(ruta + ' · con un toque antes suena el tono, en iPhone y en Android', async () => {
      for (const c of CASOS.filter((x) => x[2] && !x[3])) {
        const r = await correrCaso(alarma, ['desbloquearAudio'], c);
        assert.strictEqual(r.que, 'el tono', c[0] + ': ' + r.que);
        assert.strictEqual(r.contesto, 'tono');
        assert.strictEqual(r.vibra, '[300,100,300,100,600]');
        assert.strictEqual(r.volumen, 1);
        assert.ok(r.desdeElPrincipio, 'el tono no arranca desde el principio');
      }
    });
    it(ruta + ' · con el tono roto suenan las notas de respaldo en el motor despertado con el toque', async () => {
      for (const c of CASOS.filter((x) => x[3])) {
        const r = await correrCaso(alarma, ['desbloquearAudio'], c);
        assert.strictEqual(r.que, 'notas de respaldo (6)', c[0] + ': ' + r.que);
        assert.strictEqual(r.contesto, 'respaldo');
      }
      const diez = await correrCaso(alarma, ['desbloquearAudio'], ['', 'iphone', true, true], 10);
      assert.strictEqual(diez.motores, 1, '⛔ diez alarmas crearon ' + diez.motores + ' motores de sonido: tiene que ser UNO');
    });
    it(ruta + ' · sin ningún toque no suena, y NO se calla sin decirlo (REGLA 9)', async () => {
      for (const c of CASOS.filter((x) => !x[2])) {
        const r = await correrCaso(alarma, ['desbloquearAudio'], c);
        assert.strictEqual(r.que, 'NADA', c[0]);
        assert.strictEqual(r.contesto, false, '⛔ no sonó y contesta ' + JSON.stringify(r.contesto));
        assert.ok(r.dijo, '⛔ ' + c[0] + ': no sonó y no dejó rastro');
      }
    });
    it(ruta + ' · la alarma no revienta aunque el navegador no tenga sonido ni vibración', async () => {
      const cel = celular('android');
      cel.window.AudioContext = undefined;
      cel.navigator.vibrate = undefined;
      const { piezas } = cargar(alarma, cel);
      class SinTono { constructor() { throw new Error('sin audio'); } }
      // eslint-disable-next-line no-new-func
      const p2 = new Function('window', 'navigator', 'Audio', 'console', 'setTimeout', 'clearTimeout', 'apuntarRechazo',
        alarma.texto.replace(/^import[^\n]*\n/gm, '').replace(/^export\s+/gm, '') + '\nreturn { sonarAlerta, desbloquearAudio };')(
        cel.window, cel.navigator, SinTono, cel.consola, cel.setTimeout, cel.clearTimeout, cel.apuntarRechazo);
      cel.tocar(() => { piezas.desbloquearAudio(); p2.desbloquearAudio(); });
      const a = p2.sonarAlerta();
      await cel.esperar();
      assert.strictEqual(await a, false);
      assert.ok(cel.r.rastros.some((x) => /no dejó sonar/.test(x)), 'no sonó y no lo dijo');
    });
    it(ruta + ' · suena UNA vez por llamada: repetirla es cosa de quien llama (el negocio, en su App.js)', () => {
      assert.ok(!/setInterval|setTimeout\([^)]*sonarAlerta/.test(alarma.texto), '⛔ la pieza no repite: eso lo decide la pantalla');
    });
  }

  it('el medidor, con el código de hoy: una versión, nada a mano, nadie callado con toque, nada mudo', async () => {
    const m = await medir();
    assert.strictEqual(m.distintas, 1, 'hay ' + m.distintas + ' versiones de la alarma');
    assert.deepStrictEqual(m.aMano, [], '⛔ alarma escrita a mano fuera de alerta.js: ' + m.aMano.join(', '));
    for (const f of m.filas) {
      assert.deepStrictEqual(f.toque, ['desbloquearAudio'], f.quien + ': el toque llama a ' + f.toque.join('+'));
      assert.match(f.origen, /\/src\/alerta\.js$/, f.quien + ' no usa la pieza');
      assert.strictEqual(f.motoresEnDiez, 1, f.quien + ': ' + f.motoresEnDiez + ' motores en 10 alarmas');
      for (const c of f.casos) {
        if (/con toque|tono roto/.test(c.caso)) assert.ok(!c.callado, '⛔ ' + f.quien + ' · ' + c.caso + ': no se oye nada');
        if (c.callado) assert.ok(c.dijo, '⛔ ' + f.quien + ' · ' + c.caso + ': se calla sin decirlo');
      }
    }
  });

  it('el medidor VE el fallo en el código de antes (' + ANTES + '): dos versiones, callado con toque en el iPhone y mudo', async () => {
    const m = await medir({ commit: ANTES, aliados: '8e619f8' });
    assert.strictEqual(m.distintas, 2);
    const conductor = m.filas.find((f) => /conductor/.test(f.quien));
    assert.match(conductor.origen, /Notificaciones\.js$/);
    assert.deepStrictEqual(conductor.toque, ['activarAudioiOS', 'precargarAudio']);
    const iphone = conductor.casos.find((c) => c.caso === 'iPhone, con toque antes');
    assert.ok(iphone.callado && !iphone.dijo, 'el medidor no ve que el conductor en iPhone no oía nada');
    const negocio = m.filas.find((f) => /negocio/.test(f.quien));
    assert.ok(!negocio.casos.find((c) => c.caso === 'iPhone, con toque antes').callado, 'el negocio sí sonaba');
    assert.ok(negocio.casos.find((c) => c.caso === 'iPhone, tono roto').callado, 'el respaldo del negocio en iPhone no sonaba');
    assert.ok(m.filas.every((f) => f.motoresEnDiez >= 10), 'antes cada respaldo creaba un motor nuevo');
  });
});
