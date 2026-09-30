/**
 * G73 · LAS ETIQUETAS «BUENAS» DE LA CALIFICACIÓN SALEN DE UN SOLO SITIO (29-sep-2026)
 *
 * La app (Calificacion.js) ofrece las etiquetas y dice cuáles son buenas; el panel (Conductores.js, ⭐ Calificaciones)
 * las pinta verdes o rojas con SU PROPIA lista de las buenas, escrita a mano tres veces. Ahora hay UNA pieza,
 * guajirago/src/etiquetasCalificacion.js, con copia idéntica en el panel. Esta prueba:
 *
 *   1. EJECUTA la pieza: las 17 etiquetas, cuáles son buenas, y que una que no conoce no es buena;
 *   2. exige que la copia del panel sea byte a byte la de la app;
 *   3. saca del panel cada condición que elige verde o rojo (con el medidor, scripts/medir-etiquetas-calificacion.cjs,
 *      que vive una sola vez) y la CORRE con cada etiqueta: pinta verde justo las buenas de la app;
 *   4. ni la pantalla de la app ni ninguna otra de las tres apps lleva una lista de etiquetas escrita a mano;
 *   5. careo: con el código de antes (e920588 / panel 40bdcfa) el panel pintaba exactamente igual;
 *   6. pantallas de mentira: el medidor se queja si el panel se separa.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { RAIZ, leer, cargarDeLaApp, copiaIdentica } = require('./cargar.cjs');
const { medir, lector, PIEZA, PIEZA_PANEL, CALIFICACION, CONDUCTORES, DESCONOCIDAS } = require('../scripts/medir-etiquetas-calificacion.cjs');

const { OPCIONES_PASAJERO, OPCIONES_CONDUCTOR, ETIQUETAS_BUENAS, esEtiquetaBuena } = cargarDeLaApp(PIEZA);

describe('G73 · la pieza: las etiquetas de la calificación', () => {
  it('el pasajero tiene 9 etiquetas y el conductor 8, con las buenas primero', () => {
    assert.deepStrictEqual(OPCIONES_PASAJERO.map((o) => [o.texto, o.buena]), [
      ['Llegó rápido', true], ['Buen trato', true], ['Conducción segura', true], ['Vehículo limpio', true],
      ['Llegó tarde', false], ['Mal trato', false], ['Conducción peligrosa', false], ['Vehículo sucio', false],
      ['Canceló sin avisar', false],
    ]);
    assert.deepStrictEqual(OPCIONES_CONDUCTOR.map((o) => [o.texto, o.buena]), [
      ['Pasajero puntual', true], ['Trato respetuoso', true], ['Buen comunicador', true], ['Sin contratiempos', true],
      ['Hizo esperar mucho', false], ['Trato grosero', false], ['Dirección incorrecta', false], ['Canceló sin avisar', false],
    ]);
  });

  it('las buenas son las 8 marcadas, y esEtiquetaBuena dice lo mismo que la marca de cada etiqueta', () => {
    assert.deepStrictEqual(ETIQUETAS_BUENAS, ['Llegó rápido', 'Buen trato', 'Conducción segura', 'Vehículo limpio',
      'Pasajero puntual', 'Trato respetuoso', 'Buen comunicador', 'Sin contratiempos']);
    for (const o of [...OPCIONES_PASAJERO, ...OPCIONES_CONDUCTOR]) assert.strictEqual(esEtiquetaBuena(o.texto), o.buena, o.texto);
  });

  it('una etiqueta que la app no ofrece NO es buena (el panel la pinta roja, como siempre)', () => {
    for (const e of [...DESCONOCIDAS, undefined, null]) assert.strictEqual(esEtiquetaBuena(e), false, String(e));
  });
});

describe('G73 · la copia del panel es la misma pieza', () => {
  it(PIEZA_PANEL + ' es idéntica a ' + PIEZA, () => {
    copiaIdentica(PIEZA_PANEL, PIEZA,
      PIEZA_PANEL + ' se separó de ' + PIEZA + ': se cambia allá primero y se copia IGUAL (son repos aparte y no pueden importar)');
  });
});

describe('G73 · el panel pinta cada etiqueta como la app', () => {
  const r = medir(lector());

  it('la verdad sale de la pieza, y Calificacion.js la importa sin listas propias', () => {
    assert.strictEqual(r.verdad.origen, PIEZA);
    assert.strictEqual(r.verdad.importaLaPieza, true, CALIFICACION + ' tiene que importar OPCIONES_PASAJERO y OPCIONES_CONDUCTOR de la pieza');
    assert.strictEqual(r.verdad.listasPropiasEnLaPantalla, 0, CALIFICACION + ' volvió a llevar su propia lista de etiquetas');
  });

  it('Conductores.js elige verde o rojo en sus 4 sitios con la pieza, sin lista propia', () => {
    assert.strictEqual(r.panel.condiciones.length, 4, 'se esperaban 4 sitios (fondo y letra de las 2 tarjetas); hay ' + r.panel.condiciones.length);
    assert.strictEqual(r.panel.tieneListaPropia, false);
    assert.strictEqual(r.panel.importaLaPieza, true);
    for (const c of r.panel.condiciones) assert.match(c.expr, /^esEtiquetaBuena\(op\)$/, 'renglón ' + c.renglon + ': ' + c.expr);
  });

  it('corrida con las 17 etiquetas y con etiquetas desconocidas: 0 desacuerdos', () => {
    assert.ok(r.tabla.length >= 17 + DESCONOCIDAS.length - 1);
    assert.deepStrictEqual(r.desacuerdos, []);
  });

  it('ninguna de las tres apps lleva una lista de etiquetas escrita a mano fuera de la pieza', () => {
    assert.deepStrictEqual(r.aMano, []);
  });
});

describe('G73 · careo con el código de antes (raíz e920588 · panel 40bdcfa)', () => {
  const hay = (cwd, c) => { try { execFileSync('git', ['cat-file', '-e', c + '^{commit}'], { cwd, stdio: 'ignore' }); return true; } catch (e) { return false; } };
  const puede = hay(RAIZ, 'e920588') && hay(path.join(RAIZ, 'guajirago-admin'), '40bdcfa');
  it('antes había 5 listas a mano y el panel pintaba exactamente igual que ahora', { skip: !puede && 'no están los commits de antes' }, () => {
    const antes = medir(lector('e920588', '40bdcfa'));
    const ahora = medir(lector());
    assert.strictEqual(antes.aMano.reduce((s, x) => s + x.veces, 0), 5);
    assert.strictEqual(antes.panel.condiciones.length, 4);
    assert.deepStrictEqual(antes.desacuerdos, []);
    assert.strictEqual(ahora.huella, antes.huella, 'lo que pinta el panel cambió respecto de antes');
  });
});

describe('G73 · el medidor no se deja engañar (pantallas de mentira)', () => {
  const real = lector();
  const conCambio = (archivo, de, a) => (r) => {
    const t = real(r);
    if (r !== archivo) return t;
    assert.ok(t.includes(de), 'el señuelo no calza en ' + archivo);
    return t.replace(de, a);
  };

  it('un panel que pinta verde una etiqueta mala: desacuerdo', () => {
    const r = medir(conCambio(CONDUCTORES, "color: esEtiquetaBuena(op) ? '#2ECC71'", "color: (esEtiquetaBuena(op) || op === 'Mal trato') ? '#2ECC71'"));
    assert.ok(r.desacuerdos.some((d) => d.etiqueta === 'Mal trato'), JSON.stringify(r.desacuerdos));
  });

  it('un panel que vuelve a su lista propia, sin una buena: desacuerdo y lista a mano', () => {
    const r = medir(conCambio(CONDUCTORES, "background: esEtiquetaBuena(op) ? '#E0F5E9'", "background: ['Llegó rápido','Buen trato'].includes(op) ? '#E0F5E9'"));
    assert.ok(r.desacuerdos.some((d) => d.etiqueta === 'Pasajero puntual'));
    assert.ok(r.aMano.some((x) => x.archivo === CONDUCTORES));
  });

  it('una copia del panel que se separa (una etiqueta buena menos): desacuerdo', () => {
    const r = medir(conCambio(PIEZA_PANEL, "{ texto: 'Sin contratiempos', buena: true }", "{ texto: 'Sin contratiempos', buena: false }"));
    assert.ok(r.desacuerdos.some((d) => d.etiqueta === 'Sin contratiempos'));
  });

  it('una pantalla de la app con su propia lista: se cuenta', () => {
    const r = medir(conCambio(CALIFICACION, 'function Calificacion(', "const OTRAS = ['Llegó rápido'];\nfunction Calificacion("));
    assert.ok(r.aMano.some((x) => x.archivo === CALIFICACION));
  });
});
