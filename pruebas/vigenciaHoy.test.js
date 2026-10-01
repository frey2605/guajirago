/**
 * G16 · ¿ESTA FECHA ESTÁ VIGENTE HOY? — UNA SOLA REGLA, EN HORA DE COLOMBIA (28-sep-2026)
 *
 * Las fechas de promociones, anuncios y promos de restaurante se guardan como un DÍA («2026-10-05»). Antes cada
 * máquina las leía en SU hora: el servidor (UTC) daba la promoción por acabada a las 7 de la noche del último día
 * mientras el teléfono la seguía ofreciendo; las promos de restaurante contaban «mañana» desde las 7 de la noche;
 * y la app y el panel pintaban las fechas de promociones un día antes.
 *
 *   1. `hoyEnColombia` es UNA: la regla la pide a cobros.cjs, y la copia de la app y del panel es la misma función,
 *      letra por letra, y da lo mismo ejecutándola.
 *   2. `etapaDeVigencia` (servidor, app y panel) da lo mismo en CUALQUIER zona horaria, en los bordes del día.
 *   3. Los seis sitios que deciden «¿vigente?» se EJECUTAN sacados de su archivo: el canje (regla), la lista de la app,
 *      los anuncios (Anuncio.js), las promos de restaurante (Restaurantes.js), las pestañas del panel y el Superadmin
 *      (promociones y anuncios). Con el reloj puesto a las 8 de la noche del último día, en UTC y en Colombia.
 *   4. Las fechas de promociones se pintan con fechaDeCalendario, y en las tres apps y el servidor nadie vuelve a leer
 *      una fechaInicio/fechaFin a pelo.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { RAIZ, leer, cargarDeLaApp, cuerpoDeLaFuncion, copiaIdentica } = require('./cargar.cjs');

const COBROS = require('../guajirago/functions/cobros.cjs');
const NUBE = require('../guajirago/functions/promociones.cjs');
const COPIAS = { app: 'guajirago/src/reglaPromocion.js', panel: 'guajirago-admin/src/reglaPromocion.js' };
const REGLAS = { servidor: NUBE, app: cargarDeLaApp(COPIAS.app), panel: cargarDeLaApp(COPIAS.panel) };
const ZONAS = ['UTC', 'America/Bogota', 'Pacific/Kiritimati', 'Pacific/Pago_Pago'];

function enZona(tz, fn) {
  const antes = process.env.TZ;
  process.env.TZ = tz;
  try { return fn(); } finally { if (antes === undefined) delete process.env.TZ; else process.env.TZ = antes; }
}
async function enZonaAsync(tz, fn) {
  const antes = process.env.TZ;
  process.env.TZ = tz;
  try { return await fn(); } finally { if (antes === undefined) delete process.env.TZ; else process.env.TZ = antes; }
}
// Un instante dicho en hora de Colombia: col('2026-10-07T20:00').
const col = (s) => new Date(s + ':00-05:00');
// Un reloj parado en `t` para el código que hace `new Date()` sin argumentos.
const RealDate = Date;
const relojEn = (t) => class extends RealDate {
  constructor(...a) { if (a.length) super(...a); else super(t.getTime()); }
  static now() { return t.getTime(); }
};
const sinCR = (t) => t.replace(/\r\n/g, '\n');

describe('G16 · hoyEnColombia es UNA', () => {
  it('la regla la pide a cobros.cjs y no tiene otra', () => {
    const src = sinCR(leer('guajirago/functions/promociones.cjs'));
    assert.match(src, /const \{ hoyEnColombia \} = require\('\.\/cobros\.cjs'\);/, 'promociones.cjs no pide hoyEnColombia a cobros.cjs');
    assert.doesNotMatch(src, /function hoyEnColombia/, 'promociones.cjs tiene su propio hoyEnColombia: un gemelo');
    assert.strictEqual(NUBE.hoyEnColombia, COBROS.hoyEnColombia);
  });

  it('la copia de la app y la del panel es la misma función que la de cobros.cjs, letra por letra', () => {
    const cuerpo = (ruta) => {
      const t = sinCR(leer(ruta));
      const d = t.search(/^(export )?function hoyEnColombia\(ahora\) \{/m);
      assert.ok(d >= 0, 'no está function hoyEnColombia(ahora) en ' + ruta);
      return cuerpoDeLaFuncion(t, d).texto;
    };
    const fuente = cuerpo('guajirago/functions/cobros.cjs');
    for (const ruta of Object.values(COPIAS)) {
      copiaIdentica({ nombre: 'hoyEnColombia de ' + ruta, texto: cuerpo(ruta) },
        { nombre: 'hoyEnColombia de guajirago/functions/cobros.cjs', texto: fuente }, ruta + ' se separó de cobros.cjs');
    }
  });

  it('y ejecutándolas dicen lo mismo, en cualquier zona', () => {
    for (const tz of ZONAS) {
      enZona(tz, () => {
        for (let t = Date.parse('2026-01-01T00:00:00Z'); t < Date.parse('2026-01-04T00:00:00Z'); t += 1800000) {
          const f = COBROS.hoyEnColombia(new Date(t));
          assert.strictEqual(REGLAS.app.hoyEnColombia(new Date(t)), f);
          assert.strictEqual(REGLAS.panel.hoyEnColombia(new Date(t)), f);
        }
        assert.strictEqual(COBROS.hoyEnColombia(col('2026-10-07T20:00')), '2026-10-07', 'en ' + tz);
      });
    }
  });
});

// Del lunes 5 al miércoles 7 de octubre.
const RANGO = ['2026-10-05', '2026-10-07'];
const BORDES = [
  ['2026-10-04T19:00', 'antes'], ['2026-10-04T23:59', 'antes'], ['2026-10-05T00:00', 'vigente'],
  ['2026-10-06T12:00', 'vigente'], ['2026-10-07T19:00', 'vigente'], ['2026-10-07T23:59', 'vigente'],
  ['2026-10-08T00:00', 'despues'], ['2026-10-08T06:00', 'despues'],
];

describe('G16 · etapaDeVigencia da lo mismo en el servidor, la app y el panel, en cualquier zona', () => {
  it('los bordes del día cuentan en hora de Colombia', () => {
    for (const tz of ZONAS) {
      enZona(tz, () => {
        for (const [nombre, regla] of Object.entries(REGLAS)) {
          for (const [cuando, esperado] of BORDES) {
            assert.strictEqual(regla.etapaDeVigencia(RANGO[0], RANGO[1], col(cuando)), esperado,
              nombre + ' en ' + tz + ' a las ' + cuando + ' (Colombia)');
          }
        }
      });
    }
  });

  it('un extremo vacío no limita; uno ilegible no se da por vigente', () => {
    for (const regla of Object.values(REGLAS)) {
      const t = col('2026-10-07T20:00');
      assert.strictEqual(regla.etapaDeVigencia('', '', t), 'vigente');
      assert.strictEqual(regla.etapaDeVigencia(undefined, '2026-10-07', t), 'vigente');
      assert.strictEqual(regla.etapaDeVigencia('2026-10-08', null, t), 'antes');
      assert.strictEqual(regla.etapaDeVigencia('2026-10-01', '7 de octubre', t), 'despues');
    }
  });

  it('el canje: a las 8 de la noche del último día la promoción SIGUE disponible, también con el reloj en UTC', () => {
    const promo = { activa: true, fechaInicio: RANGO[0], fechaFin: RANGO[1], aplicaA: 'ambos' };
    const persona = { esConductor: false, usosPrevios: 0, viajesCompletados: 0 };
    for (const tz of ZONAS) {
      enZona(tz, () => {
        for (const regla of Object.values(REGLAS)) {
          assert.strictEqual(regla.motivoParaNoUsar(promo, persona, col('2026-10-07T20:00')), null, 'en ' + tz);
          assert.deepStrictEqual(regla.motivoParaNoUsar(promo, persona, col('2026-10-04T20:00')), { codigo: 'fuera-de-fecha' }, 'en ' + tz);
          assert.deepStrictEqual(regla.motivoParaNoUsar(promo, persona, col('2026-10-08T00:30')), { codigo: 'fuera-de-fecha' }, 'en ' + tz);
        }
      });
    }
  });
});

// ── LOS QUE DECIDEN, sacados de su archivo y ejecutados ──
const APP = REGLAS.app;
const PANEL = REGLAS.panel;

function elFiltroDeAnuncios() {
  const f = sinCR(leer('guajirago/src/Anuncio.js'));
  assert.match(f, /import \{ etapaDeVigencia \} from '\.\/reglaPromocion';/, 'Anuncio.js no pide la regla');
  const d = f.indexOf('.filter(a => {', f.indexOf('const candidatos'));
  assert.ok(d >= 0, 'no está el filtro de anuncios');
  // eslint-disable-next-line no-new-func
  return new Function('etapaDeVigencia', 'tipoUsuario', 'hoy', 'localStorage', 'return (a) => {' + cuerpoDeLaFuncion(f, d).texto + '};');
}

function lasPromosDeRestaurante() {
  const f = sinCR(leer('guajirago/src/Restaurantes.js'));
  // P09: la pantalla pregunta ahora a la pieza del precio del pedido (precioPedido.js), que usa esta misma regla.
  assert.match(f, /import \{ promoVigenteHoy, [^}]*\} from '\.\/precioPedido';/, 'Restaurantes.js no pide la pieza del precio');
  const d = f.indexOf('const promosActivasHoy');
  assert.ok(d >= 0, 'no está promosActivasHoy');
  // eslint-disable-next-line no-new-func
  const hacer = new Function('restauranteActivo', 'promoVigenteHoy', 'Date', cuerpoDeLaFuncion(f, d).texto);
  const { promoVigenteHoy } = cargarDeLaApp('guajirago/src/precioPedido.js');
  // El segundo argumento (la regla de vigencia) ya no se usa: la pieza la importa de reglaPromocion.js.
  return (restauranteActivo, _regla, Reloj) => hacer(restauranteActivo, promoVigenteHoy, Reloj);
}

function lasPestanasDelPanel() {
  const f = sinCR(leer('guajirago-admin/src/Promociones.js'));
  const a = f.indexOf('  const ahora = new Date();\n');
  const b = f.indexOf('\n', f.indexOf('const promosVencidas'));
  assert.ok(a >= 0 && b > a, 'no están las pestañas del panel');
  // eslint-disable-next-line no-new-func
  return new Function('etapaDeVigencia', 'promos', 'Date', f.slice(a, b) + '\nreturn { promosActivas, promosProximas, promosVencidas };');
}

function laCargaDelSuperadmin(nombre, setters) {
  const f = sinCR(leer('guajirago-admin/src/Superadmin.js'));
  // G52: también pide de ahí el texto del beneficio (textoDelBeneficio).
  assert.match(f, /import \{ etapaDeVigencia(, textoDelBeneficio)? \} from '\.\/reglaPromocion';/, 'Superadmin.js no pide la regla');
  const d = f.indexOf('const ' + nombre + ' = useCallback(');
  assert.ok(d >= 0, 'no está ' + nombre);
  // eslint-disable-next-line no-new-func
  return new Function(...setters, 'getDocs', 'collection', 'db', 'etapaDeVigencia', 'Date',
    'return (async () => {' + cuerpoDeLaFuncion(f, d).texto + '})();');
}
const base = (lista) => async () => ({ docs: lista.map((x, i) => ({ id: x.id || 'd' + i, data: () => x })) });

describe('G16 · los seis sitios deciden con la regla, ejecutándolos', () => {
  const ULTIMO_DIA_8PM = col('2026-10-07T20:00');
  const DIA_ANTES_8PM = col('2026-10-04T20:00');
  const DESPUES = col('2026-10-08T00:30');

  it('la lista de ofertas de la app (Promociones.js) sigue usando la regla', () => {
    const f = sinCR(leer('guajirago/src/Promociones.js'));
    assert.match(f, /\.filter\(p => !motivoPorLaPromocion\(p, tipo === 'conductor', ahora\)\)/);
  });

  for (const tz of ['UTC', 'America/Bogota']) {
    it('anuncios de la app (' + tz + '): el último día hasta la medianoche de Colombia, y no antes del primero', () => {
      enZona(tz, () => {
        const filtro = elFiltroDeAnuncios();
        const anuncio = { activo: true, destino: 'todos', fechaInicio: RANGO[0], fechaFin: RANGO[1] };
        assert.strictEqual(filtro(APP.etapaDeVigencia, 'pasajero', ULTIMO_DIA_8PM, {})(anuncio), true);
        assert.strictEqual(filtro(APP.etapaDeVigencia, 'pasajero', DIA_ANTES_8PM, {})(anuncio), false);
        assert.strictEqual(filtro(APP.etapaDeVigencia, 'pasajero', DESPUES, {})(anuncio), false);
        // Lo demás sigue igual: el apagado y el de otro destino no salen.
        assert.strictEqual(filtro(APP.etapaDeVigencia, 'pasajero', ULTIMO_DIA_8PM, {})({ ...anuncio, activo: false }), false);
        assert.strictEqual(filtro(APP.etapaDeVigencia, 'pasajero', ULTIMO_DIA_8PM, {})({ ...anuncio, destino: 'conductores' }), false);
      });
    });

    it('promos de restaurante (' + tz + '): a las 8 de la noche sigue siendo HOY, no mañana', () => {
      enZona(tz, () => {
        const correr = lasPromosDeRestaurante();
        const promo = { id: 'r', activa: true, programacion: 'rango', fechaInicio: '2026-10-07', fechaFin: '2026-10-07' };
        const siempre = { id: 's', activa: true };
        const hoy = (t) => correr({ promociones: [promo, siempre] }, APP.etapaDeVigencia, relojEn(t)).map((p) => p.id);
        assert.deepStrictEqual(hoy(ULTIMO_DIA_8PM), ['r', 's'], 'la del día se cae a las 8 de la noche');
        assert.deepStrictEqual(hoy(col('2026-10-06T20:00')), ['s'], 'la de mañana empieza a las 8 de la noche de hoy');
        assert.deepStrictEqual(hoy(DESPUES), ['s']);
      });
    });

    it('pestañas del panel (' + tz + '): Activas / Próximas / Vencidas en hora de Colombia', () => {
      enZona(tz, () => {
        const promos = [
          { id: 'hoy', activa: true, fechaInicio: RANGO[0], fechaFin: RANGO[1] },
          { id: 'manana', activa: true, fechaInicio: '2026-10-08', fechaFin: '2026-10-09' },
          { id: 'ayer', activa: true, fechaInicio: '2026-10-01', fechaFin: '2026-10-06' },
          { id: 'apagada', activa: false, fechaInicio: RANGO[0], fechaFin: RANGO[1] },
        ];
        const r = lasPestanasDelPanel()(PANEL.etapaDeVigencia, promos, relojEn(ULTIMO_DIA_8PM));
        const ids = (l) => l.map((p) => p.id);
        assert.deepStrictEqual(ids(r.promosActivas), ['hoy']);
        assert.deepStrictEqual(ids(r.promosProximas), ['manana']);
        assert.deepStrictEqual(ids(r.promosVencidas), ['ayer', 'apagada']);
      });
    });

    it('Superadmin (' + tz + '): promociones vigentes y estado de los anuncios en hora de Colombia', async () => {
      await enZonaAsync(tz, async () => {
        let promos = null;
        await laCargaDelSuperadmin('cargarPromos', ['setCargandoPromos', 'setPromos'])(() => {}, (l) => { promos = l; },
          base([{ id: 'hoy', activa: true, fechaFin: RANGO[1] }, { id: 'ayer', activa: true, fechaFin: '2026-10-06' }, { id: 'sin', activa: true }]),
          () => ({}), {}, PANEL.etapaDeVigencia, relojEn(ULTIMO_DIA_8PM));
        assert.deepStrictEqual(promos.map((p) => [p.id, p.vigente]), [['hoy', true], ['ayer', false], ['sin', true]]);

        let anuncios = null;
        await laCargaDelSuperadmin('cargarAnuncios', ['setCargandoAnuncio', 'setListaAnuncios'])(() => {}, (l) => { anuncios = l; },
          base([
            { id: 'hoy', fechaInicio: RANGO[0], fechaFin: RANGO[1], fechaCreacion: '3' },
            { id: 'manana', fechaInicio: '2026-10-08', fechaFin: '2026-10-09', fechaCreacion: '2' },
            { id: 'ayer', fechaInicio: '2026-10-01', fechaFin: '2026-10-06', fechaCreacion: '1' },
            { id: 'off', activo: false, fechaInicio: RANGO[0], fechaFin: RANGO[1], fechaCreacion: '0' },
          ]),
          () => ({}), {}, PANEL.etapaDeVigencia, relojEn(ULTIMO_DIA_8PM));
        assert.deepStrictEqual(anuncios.map((a) => [a.id, a.estado]),
          [['hoy', 'activo'], ['manana', 'programado'], ['ayer', 'vencido'], ['off', 'inactivo']]);
      });
    });
  }
});

describe('G16 · la prueba del canje (funciones.test.js) arma sus días como el servidor, a cualquier hora', () => {
  // Esa prueba corre contra el emulador con el reloj de verdad: si arma «ayer» con otra cuenta que la del servidor,
  // se pone roja solo de 7 p. m. a medianoche de Colombia. Aquí se EJECUTAN sus renglones con el reloj parado.
  it('la VENCIDA (ayer→ayer) nunca sale vigente y la VIVA (ayer→mañana) siempre, las 24 horas y en cualquier zona', () => {
    const t = sinCR(leer('pruebas/funciones.test.js'));
    const a = t.indexOf("describe('REGLA 7 · reclamarPromocion', () => {\n");
    const b = t.indexOf('  beforeEach(', a);
    assert.ok(a >= 0 && b > a, 'no está el arranque del bloque de reclamarPromocion en funciones.test.js');
    const cuerpo = t.slice(t.indexOf('\n', a) + 1, b);
    assert.match(cuerpo, /const AYER = /, 'el bloque ya no arma AYER aquí');
    const dias = (ahora) => new Function('Date', 'require', cuerpo + '\nreturn { AYER, MANANA };')(
      relojEn(ahora), (r) => require(path.join(RAIZ, 'pruebas', r)));
    for (const tz of ZONAS) {
      enZona(tz, () => {
        for (let m = Date.parse('2026-09-28T05:00:00Z'); m < Date.parse('2026-09-29T05:00:00Z'); m += 1800000) {
          const ahora = new RealDate(m);
          const { AYER, MANANA } = dias(ahora);
          const hora = tz + ' ' + ahora.toISOString();
          assert.strictEqual(NUBE.etapaDeVigencia(AYER, AYER, ahora), 'despues', 'la VENCIDA sale vigente para el servidor a las ' + hora);
          assert.strictEqual(NUBE.etapaDeVigencia(AYER, MANANA, ahora), 'vigente', 'la VIVA no sale vigente para el servidor a las ' + hora);
          // Y son el ayer y el mañana DEL SERVIDOR, no otros días: hace 24 h era AYER, dentro de 24 h será MANANA.
          assert.strictEqual(NUBE.etapaDeVigencia(AYER, AYER, new RealDate(m - 86400000)), 'vigente', 'AYER no es el ayer del servidor a las ' + hora);
          assert.strictEqual(NUBE.etapaDeVigencia(MANANA, MANANA, new RealDate(m + 86400000)), 'vigente', 'MANANA no es el mañana del servidor a las ' + hora);
        }
      });
    }
  });
});

describe('G16 · las fechas de promociones se pintan con el día guardado', () => {
  it('la app («Válida hasta») y el panel (el rango) usan fechaDeCalendario, y da el día de verdad en Colombia', () => {
    const app = sinCR(leer('guajirago/src/Promociones.js'));
    assert.match(app, /import \{ fechaDeCalendario \} from '\.\/fechaCalendario';/);
    assert.match(app, /Válida hasta \{fechaDeCalendario\(p\.fechaFin\)\}/, 'la app no pinta «Válida hasta» con la pieza');
    const panel = sinCR(leer('guajirago-admin/src/Promociones.js'));
    assert.match(panel, /import \{ fechaDeCalendario \} from '\.\/fechaCalendario';/);
    assert.match(panel, /\{fechaDeCalendario\(p\.fechaInicio\)\} → \{fechaDeCalendario\(p\.fechaFin\)\}/, 'el panel no pinta el rango con la pieza');
    enZona('America/Bogota', () => {
      const { fechaDeCalendario } = cargarDeLaApp('guajirago-admin/src/fechaCalendario.js');
      assert.strictEqual(new RealDate('2026-10-07').getDate(), 6, 'la zona de Colombia no se aplicó');
      assert.strictEqual(fechaDeCalendario('2026-10-07'), new RealDate(2026, 9, 7).toLocaleDateString('es-CO'));
    });
  });

  it('en las tres apps y el servidor, nadie lee una fechaInicio/fechaFin a pelo', () => {
    const archivos = [];
    for (const carpeta of ['guajirago/src', 'guajirago-admin/src', 'guajirago-aliados/src', 'guajirago/functions']) {
      for (const f of fs.readdirSync(path.join(RAIZ, carpeta))) {
        if (/\.(c?js)$/.test(f) && !f.endsWith('.test.js')) archivos.push(carpeta + '/' + f);
      }
    }
    assert.ok(archivos.length > 50, 'no se leyeron las carpetas');
    const malos = [];
    for (const ruta of archivos) {
      const t = leer(ruta);
      // new Date(p.fechaFin) → medianoche UTC = el día anterior en Colombia; p.fechaFin + 'T23:59:59' → la hora de la máquina.
      for (const m of t.matchAll(/new Date\(\s*[A-Za-z0-9_.]+\.fecha(Inicio|Fin)\s*\)|fecha(Inicio|Fin)\s*\+\s*['"`]T/g)) malos.push(ruta + ': ' + m[0]);
    }
    assert.deepStrictEqual(malos, [], 'vuelve a leerse una fecha de vigencia a pelo: usa etapaDeVigencia o fechaDeCalendario');
  });
});
