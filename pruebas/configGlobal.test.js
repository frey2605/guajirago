/**
 * G36 + G66 (28-sep-2026) · LOS RESPALDOS DE config/global Y LA ÚNICA FORMA DE LEERLA.
 *
 * Antes (G36): el mensaje de mantenimiento tenía TRES versiones (la app «Estamos haciendo mejoras. Volvemos muy
 * pronto.», el panel al cargar «…en GuajiraGo. Volvemos muy pronto. ¡Gracias por tu paciencia!» y el panel si fallaba
 * la carga «…en GuajiraGo. Volvemos muy pronto.»); los cuatro módulos y el regalo de bienvenida tenían respaldo en la app,
 * en el panel y en el servidor sin prueba que los atara.
 * Antes (G66): seis sitios de la app (App.js dos veces, AppConductor, Solicitar, Ganancias, AyudaSoporte) leían
 * config/global a mano, cada uno con su respaldo y su `catch` mudo.
 *
 * Esta prueba:
 *   · EJECUTA `leerConfig`, `modulosDe` y `mensajeDeMantenimiento` de configApp.js;
 *   · ata el mensaje y los módulos de la app a la copia del panel, y el regalo del panel al del servidor, EJECUTANDO los
 *     dos lados (con el lector de scripts/medir-config-g36.cjs, no una copia);
 *   · exige que ningún archivo de la app lea config/global fuera de configApp.js y que los seis sitios usen leerConfig;
 *   · y que el medidor, con el código de antes, sí vea las tres versiones y las seis lecturas (si no, no miraría nada).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { RAIZ, leer, cargarDeLaApp, soloCodigo } = require('./cargar.cjs');
const medidor = require('../scripts/medir-config-g36.cjs');

const piezas = cargarDeLaApp('guajirago/src/configApp.js');
const { leerConfig, modulosDe, mensajeDeMantenimiento, MENSAJE_MANTENIMIENTO, MODULOS_DEFECTO, RESPALDO_CONFIG } = piezas;

/** Un Firestore de mentira: `doc` apunta, `getDoc` contesta lo que se le diga (o revienta). */
function firestoreDeMentira({ datos, noExiste, falla, fallaAlApuntar }) {
  const pedidos = [];
  return {
    pedidos,
    db: { soy: 'db' },
    doc: (db, col, id) => { if (fallaAlApuntar) throw new Error('doc reventó'); pedidos.push([db, col, id]); return col + '/' + id; },
    getDoc: async () => {
      if (falla) { const e = new Error('sin permiso'); e.code = 'permission-denied'; throw e; }
      return { exists: () => !noExiste, data: () => ({ ...datos }) };
    },
  };
}

/** Corre algo con console.warn atrapado; devuelve [resultado, avisos]. */
async function conAvisos(fn) {
  const avisos = [];
  const original = console.warn;
  console.warn = (...a) => { avisos.push(a.join(' ')); };
  try { return [await fn(), avisos]; } finally { console.warn = original; }
}

describe('G66 · leerConfig: la única forma de leer config/global en la app', () => {
  it('con el documento: lo del servidor ENCIMA del respaldo entero, y lee config/global', async () => {
    const fsm = firestoreDeMentira({ datos: { comisionTaxi: 900, maximoFavoritos: 2, moduloTurismo: true } });
    const [r, avisos] = await conAvisos(() => leerConfig(fsm));
    assert.deepStrictEqual(fsm.pedidos, [[fsm.db, 'config', 'global']], 'leerConfig no lee config/global');
    assert.strictEqual(r.existe, true);
    assert.strictEqual(r.error, null);
    assert.strictEqual(r.config.comisionTaxi, 900, 'lo del servidor no manda');
    assert.strictEqual(r.config.maximoFavoritos, 2);
    assert.strictEqual(r.config.moduloTurismo, true);
    assert.strictEqual(r.config.tarifaMinimaDia, RESPALDO_CONFIG.tarifaMinimaDia, 'lo que el servidor no trae no sale del respaldo');
    assert.strictEqual(r.config.moduloRestaurantes, false);
    assert.strictEqual(avisos.length, 0, 'avisó de un fallo que no hubo');
  });

  it('sin el documento: el respaldo, existe=false y sin error', async () => {
    const [r, avisos] = await conAvisos(() => leerConfig(firestoreDeMentira({ noExiste: true })));
    assert.deepStrictEqual(r.config, RESPALDO_CONFIG);
    assert.strictEqual(r.existe, false);
    assert.strictEqual(r.error, null);
    assert.strictEqual(avisos.length, 0);
  });

  for (const [nombre, opciones] of [['si getDoc falla', { falla: true }], ['si doc() revienta al apuntar', { fallaAlApuntar: true }]]) {
    it('nunca revienta y AVISA ' + nombre + ': el respaldo, existe=false y el error', async () => {
      const [r, avisos] = await conAvisos(() => leerConfig(firestoreDeMentira(opciones)));
      assert.deepStrictEqual(r.config, RESPALDO_CONFIG, 'si falla no devuelve el respaldo');
      assert.strictEqual(r.existe, false);
      assert.ok(r.error instanceof Error, 'si falla no dice el error');
      assert.strictEqual(avisos.length, 1, 'el fallo se quedó mudo');
      assert.match(avisos[0], /config\/global no cargó/);
    });
  }

  it('el respaldo entero es tarifas + comisiones + números + módulos, de sus propias piezas', () => {
    const { CONFIG_TARIFAS_DEFECTO } = cargarDeLaApp('guajirago/src/tarifas.js');
    const { COMISIONES_DEFECTO } = cargarDeLaApp('guajirago/src/comisiones.js');
    assert.deepStrictEqual(RESPALDO_CONFIG,
      { ...CONFIG_TARIFAS_DEFECTO, ...COMISIONES_DEFECTO, ...piezas.CONFIG_COMPARTIDA, ...MODULOS_DEFECTO });
  });

  it('NINGÚN archivo de la app lee config/global fuera de configApp.js', () => {
    const carpeta = path.join(RAIZ, 'guajirago', 'src');
    const culpables = [];
    for (const nombre of fs.readdirSync(carpeta)) {
      if (!nombre.endsWith('.js') || nombre === 'configApp.js') continue;
      const codigo = soloCodigo(fs.readFileSync(path.join(carpeta, nombre), 'utf8'));
      if (/['"`]config['"`]\s*,\s*['"`]global['"`]/.test(codigo) || /['"`]config\/global['"`]/.test(codigo)) culpables.push(nombre);
    }
    assert.deepStrictEqual(culpables, [],
      'estos archivos leen config/global a mano: ' + culpables.join(', ') + '. Se lee con leerConfig de configApp.js (G66).');
  });

  it('los seis sitios que la leían usan leerConfig, y ponen lo que devuelve', () => {
    const sitios = [
      ['guajirago/src/App.js', 'leerConfig({ getDoc, doc, db }).then(({ config, existe }) => { if (existe) setModulos(modulosDe(config)); })'],
      ['guajirago/src/App.js', 'const { config: d, existe } = await leerConfig({ getDoc, doc, db }); if (!existe) return false;'],
      ['guajirago/src/AppConductor.js', 'const { config: d, existe, error: e } = await leerConfig({ getDoc, doc, db }); if (existe) { setConfigApp(d);'],
      ['guajirago/src/Solicitar.js', 'const { config: nueva, existe } = await leerConfig({ getDoc, doc, db }); if (existe) { setConfigApp(nueva);'],
      ['guajirago/src/Ganancias.js', 'const { config: cfgComisiones } = await leerConfig({ getDoc, doc, db });'],
      ['guajirago/src/AyudaSoporte.js', 'leerConfig({ getDoc, doc, db }).then(({ config, existe }) => { if (existe) setConfigApp(config); })'],
    ];
    for (const [archivo, texto] of sitios) {
      const codigo = soloCodigo(leer(archivo)).replace(/\s+/g, ' ');
      assert.ok(codigo.includes(texto), archivo + ' ya no lee config/global así: «' + texto + '»');
    }
    for (const archivo of ['guajirago/src/AppConductor.js', 'guajirago/src/Solicitar.js']) {
      assert.ok(soloCodigo(leer(archivo)).includes('const CONFIG_APP_DEFECTO = RESPALDO_CONFIG;'),
        archivo + ' arma su propio respaldo en vez de usar RESPALDO_CONFIG de configApp.js');
    }
  });
});

describe('G36 · los respaldos de módulos, regalo y mantenimiento: uno solo, atado al panel', () => {
  it('modulosDe: el panel manda si dice verdadero/falso; si no, el respaldo (igual que las reglas de antes)', () => {
    // Las reglas que había escritas en App.js: Transporte y Mensajería `!== false`, Restaurantes y Turismo `=== true`.
    const deAntes = (d) => ({
      moduloTransporte: d.moduloTransporte !== false, moduloMensajeria: d.moduloMensajeria !== false,
      moduloRestaurantes: d.moduloRestaurantes === true, moduloTurismo: d.moduloTurismo === true,
    });
    const casos = [{}, { moduloTransporte: false }, { moduloTurismo: true, moduloRestaurantes: true },
      { moduloMensajeria: 'no', moduloTurismo: 'sí', moduloRestaurantes: 1 }, { moduloTransporte: null, moduloTurismo: false }];
    for (const c of casos) assert.deepStrictEqual(modulosDe(c), deAntes(c), 'con ' + JSON.stringify(c) + ' cambió lo que se ve');
    assert.deepStrictEqual(modulosDe(null), MODULOS_DEFECTO);
  });

  it('mensajeDeMantenimiento: el del panel si trae texto; si falta, vacío o en blanco, el respaldo', () => {
    assert.strictEqual(mensajeDeMantenimiento({ mensajeMantenimiento: 'Cerrado por lluvia' }), 'Cerrado por lluvia');
    for (const m of [undefined, '', '   ', 7, null]) {
      assert.strictEqual(mensajeDeMantenimiento({ mensajeMantenimiento: m }), MENSAJE_MANTENIMIENTO, 'con ' + JSON.stringify(m));
    }
    assert.strictEqual(mensajeDeMantenimiento(null), MENSAJE_MANTENIMIENTO);
  });

  it('el mensaje de mantenimiento es UNO: la app y los dos sitios del panel, ejecutados, dicen lo mismo', () => {
    const r = medidor.medir(medidor.fuentes(false), false);
    assert.strictEqual(r.mensajes.app, MENSAJE_MANTENIMIENTO, 'App.js no enseña el respaldo de configApp.js');
    assert.strictEqual(r.mensajes.panelCarga, MENSAJE_MANTENIMIENTO, 'el panel al cargar dice otro mensaje que la app');
    assert.strictEqual(r.mensajes.panelFallo, MENSAJE_MANTENIMIENTO, 'el panel si falla la carga dice otro mensaje que la app');
    assert.strictEqual(r.versiones, 1);
    assert.strictEqual(medidor.mensajeDeLaApp(medidor.fuentes(false), { mensajeMantenimiento: 'Hoy no' }), 'Hoy no',
      'App.js ya no enseña el mensaje que escribió el dueño');
  });

  it('los módulos que ve la app si la config no carga son los del panel', () => {
    const r = medidor.medir(medidor.fuentes(false), false);
    assert.deepStrictEqual(r.modApp, MODULOS_DEFECTO, 'App.js no arranca con los módulos de configApp.js');
    assert.deepStrictEqual(r.modulosDistintos, [], 'la app y el panel arrancan con módulos distintos');
  });

  it('el regalo de bienvenida arranca igual en el panel y en el servidor', () => {
    const f = medidor.fuentes(false);
    const panel = medidor.constantesDelPanel(f.panel).CONFIG_POR_DEFECTO;
    assert.strictEqual(typeof panel.viajeGratisNuevoPasajero, 'boolean', 'el panel ya no tiene el interruptor del regalo');
    // El servidor sin el campo, y con el valor que el panel escribiría: tienen que decir lo mismo.
    assert.strictEqual(medidor.regaloDelServidor(f, {}), panel.viajeGratisNuevoPasajero,
      'sin el campo, el servidor ' + (medidor.regaloDelServidor(f, {}) ? 'da' : 'no da') + ' el regalo y el panel dice lo contrario');
    assert.strictEqual(medidor.regaloDelServidor(f, { viajeGratisNuevoPasajero: panel.viajeGratisNuevoPasajero }),
      panel.viajeGratisNuevoPasajero);
    assert.strictEqual(medidor.regaloDelServidor(f, { viajeGratisNuevoPasajero: false }), false, 'el servidor no apaga el regalo');
  });

  it('y el medidor SÍ ve lo de antes: 3 versiones del mensaje y 6 lecturas a mano (si no, no miraría nada)', () => {
    const r = medidor.medir(medidor.fuentes(true), true);
    assert.strictEqual(r.versiones, 3);
    assert.strictEqual(r.lectores.reduce((s, x) => s + x.n, 0), 6);
    const hoy = medidor.medir(medidor.fuentes(false), false);
    assert.strictEqual(hoy.lectores.length, 0, 'hoy hay lecturas a mano: ' + hoy.lectores.map((x) => x.archivo).join(', '));
  });
});
