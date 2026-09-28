// ═══════════════════════════════════════════════════════════════════════════
//  LAS GANANCIAS DEL PANEL SALEN DE UNA SOLA CUENTA · gemelo G15, 28-sep-2026
//
//  El tablero del panel (guajirago-admin/src/App.js, Dashboard) contaba las ganancias como «viajes finalizados × 800»,
//  con un 800 escrito a mano: a un mototaxi (que se cobra $400 según config/global) o a un mandado ($1.000) les ponía
//  800 igual, y no miraba lo que el servidor cobró de verdad (comisionCobrada). Mientras tanto «Ingresos reales»
//  (Superadmin.js) sí lo hacía bien: dos pantallas del mismo panel, dos cifras para la misma plata. Medido con
//  scripts/medir-ganancias-g15.cjs: julio salía $5.600 en el tablero y se cobró $5.800.
//  Y la nota de «Ingresos reales» decía «mototaxi $300 · taxi $800, según tu configuración» leyendo los números de
//  RESPALDO del panel, cuando la configuración de verdad dice mototaxi $400.
//
//  Aquí se prueba, EJECUTANDO el código de las pantallas (sacado del archivo, no copiado):
//    · la cuenta del tablero cobra cada viaje con guajirago-admin/src/comisiones.js y la config;
//    · las cuatro barras de «Ganancias» salen de esa cuenta, y no queda un número fijo;
//    · «Ingresos reales» usa la MISMA copia, y las dos pantallas dan el mismo total con los mismos viajes;
//    · la nota enseña la config que se cargó, no los números de respaldo.
//  (Que la copia del panel diga lo mismo que el servidor lo vigila pruebas/amarres.test.js, describe G03.)
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, cargarDeLaApp, cuerpoDeLaFuncion, soloCodigo } = require('./cargar.cjs');

const PANEL = cargarDeLaApp('guajirago-admin/src/comisiones.js');
const SERVIDOR = require('../guajirago/functions/comisiones.cjs');
const APP_JS = () => soloCodigo(leer('guajirago-admin/src/App.js')).replace(/\r\n/g, '\n');
const SUPER = () => soloCodigo(leer('guajirago-admin/src/Superadmin.js')).replace(/\r\n/g, '\n');

/** El cuerpo de Dashboard (la carga del tablero). */
function dashboard() {
  const t = APP_JS();
  const desde = t.indexOf('function Dashboard(');
  assert.ok(desde >= 0, 'App.js ya no tiene function Dashboard(');
  return cuerpoDeLaFuncion(t, desde).texto;
}

/** Un renglón `const <nombre> = ...;` del cuerpo, tal cual. */
function renglon(cuerpo, nombre) {
  const m = cuerpo.match(new RegExp('\\n\\s*(const ' + nombre + ' = [^\\n]*;)\\n'));
  assert.ok(m, 'no encuentro «const ' + nombre + ' = …;» en un renglón');
  return m[1];
}

/** La cuenta de ganancias del tablero, EJECUTADA con sus propios fechaViaje y enRango. */
function gananciasDelTablero(viajes, cfgCom) {
  const d = dashboard();
  const codigo = [renglon(d, 'fechaViaje'), renglon(d, 'enRango'), renglon(d, 'ganancias'), 'return ganancias;'].join('\n');
  return new Function('viajes', 'cfgCom', 'comisionDeViaje', codigo)(viajes, cfgCom, PANEL.comisionDeViaje);
}

/** La cuenta de «Ingresos reales» (comisionDe + acumular), EJECUTADA. */
function acumularDeIngresos(viajes, cfgCom) {
  const s = SUPER();
  const desde = s.indexOf('const cargarIngresos = useCallback(');
  assert.ok(desde >= 0, 'Superadmin.js ya no tiene cargarIngresos');
  const cuerpo = cuerpoDeLaFuncion(s, desde).texto;
  const ia = cuerpo.indexOf('const acumular = (desde) =>');
  assert.ok(ia >= 0, 'cargarIngresos ya no tiene acumular');
  const acumular = 'const acumular = (desde) => {' + cuerpoDeLaFuncion(cuerpo, ia).texto + '};';
  const codigo = [renglon(cuerpo, 'comisionDe'), acumular, 'return acumular;'].join('\n');
  return new Function('viajes', 'cfgCom', 'comisionDeViaje', codigo)(viajes, cfgCom, PANEL.comisionDeViaje);
}

const CFG = { comisionMototaxi: 400, comisionTaxi: 800, comisionDomicilio: 1000 };
const DIA = '2026-07-10T15:00:00';
const VIAJES = [
  { estado: 'finalizado', tipo: 'Taxi', fechaSolicitud: DIA },
  { estado: 'finalizado', tipo: 'Mototaxi', fechaSolicitud: DIA },
  { estado: 'finalizado', tipo: 'Mensajería', fechaSolicitud: DIA },
  { estado: 'finalizado', tipo: 'Taxi', comisionCobrada: 350, fechaSolicitud: DIA },
  { estado: 'finalizado', fechaSolicitud: DIA }, // sin tipo: se cobra como taxi
  { estado: 'cancelado', tipo: 'Taxi', fechaSolicitud: DIA }, // no cuenta
];

describe('LAS GANANCIAS DEL PANEL · el tablero y «Ingresos reales» cuentan con la regla única (G15)', () => {
  it('la cuenta del tablero cobra cada viaje con lo que se cobró o con la config, no con un número fijo', () => {
    const g = gananciasDelTablero(VIAJES, CFG);
    const desde = new Date('2026-07-01T00:00:00');
    const hasta = new Date('2026-07-31T23:59:59');
    // Taxi 800 + Mototaxi 400 + Mandado 1000 + cobrado 350 + sin tipo 800 = 3.350 (el cancelado no cuenta).
    assert.strictEqual(g(desde, hasta), 3350, 'el tablero no cuenta lo que se cobró de verdad');
    // Con otra config cambia (lo que no guarda comisionCobrada), y lo cobrado se queda quieto.
    const g2 = gananciasDelTablero(VIAJES, { comisionMototaxi: 5, comisionTaxi: 6, comisionDomicilio: 7 });
    assert.strictEqual(g2(desde, hasta), 6 + 5 + 7 + 350 + 6, 'el tablero no lee la config que se le pasa');
    // Fuera del rango no cuenta nada.
    assert.strictEqual(g(new Date('2026-08-01T00:00:00'), new Date('2026-08-31T23:59:59')), 0);
    // Y cada viaje, uno por uno, da lo mismo que cobra el servidor.
    for (const v of VIAJES.filter((x) => x.estado === 'finalizado' && x.comisionCobrada === undefined)) {
      assert.strictEqual(gananciasDelTablero([v], CFG)(desde, hasta), SERVIDOR.comisionSegunTipoDeViaje(v.tipo, CFG),
        'el tablero cuenta un viaje «' + v.tipo + '» distinto de lo que cobra el servidor');
    }
  });

  it('las cuatro barras de «Ganancias» salen de esa cuenta, y la config se lee de config/global', () => {
    const d = dashboard();
    const bloque = d.slice(d.indexOf('const gananciasData = ['), d.indexOf('const snapUsuarios'));
    assert.ok(bloque.length > 0, 'no encuentro gananciasData / gananciasMesData en el tablero');
    const valores = [...bloque.matchAll(/valor:\s*([^}]*)\}/g)].map((m) => m[1].trim());
    assert.strictEqual(valores.length, 4, 'el tablero ya no tiene las cuatro barras de ganancias');
    for (const v of valores) {
      assert.match(v, /^ganancias\([^()]*\)$/, 'una barra de ganancias no sale de la cuenta única: «' + v + '»');
    }
    assert.match(d, /getDoc\(doc\(db, 'config', 'global'\)\)/, 'el tablero ya no lee config/global');
    assert.match(d, /if \(snapCfg\.exists\(\)\) cfgCom = snapCfg\.data\(\);/, 'el tablero no guarda la config que leyó');
    const t = APP_JS();
    assert.match(t, /^import \{ comisionDeViaje \} from '\.\/comisiones';/m, 'App.js no importa la cuenta del panel');
    assert.ok(!/COMISION_POR_VIAJE/.test(t), 'volvió el número fijo COMISION_POR_VIAJE');
  });

  it('«Ingresos reales» usa la MISMA copia, y con los mismos viajes da el mismo total que el tablero', () => {
    const s = SUPER();
    assert.match(s, /^import \{ comisionDeViaje \} from '\.\/comisiones';/m, 'Superadmin.js no importa la cuenta del panel');
    const acumular = acumularDeIngresos(VIAJES.filter((v) => v.estado === 'finalizado'), CFG);
    const r = acumular(new Date('2026-07-01T00:00:00'));
    const tablero = gananciasDelTablero(VIAJES, CFG)(new Date('2026-07-01T00:00:00'), new Date('2026-07-31T23:59:59'));
    assert.strictEqual(r.total, tablero, 'el tablero y «Ingresos reales» dan cifras distintas para los mismos viajes');
    assert.strictEqual(r.cuenta, 5);
  });

  it('la nota de «Ingresos reales» enseña la config que se cargó, no los números de respaldo', () => {
    const s = SUPER();
    const desde = s.indexOf('const renderIngresos = () =>');
    assert.ok(desde >= 0, 'Superadmin.js ya no tiene renderIngresos');
    const cuerpo = cuerpoDeLaFuncion(s, desde).texto;
    const nota = (cuerpo.match(/ℹ️ Son comisiones brutas[^\n]*/) || [''])[0];
    assert.ok(nota, 'no encuentro la nota «Son comisiones brutas»');
    assert.ok(!/CONFIG_POR_DEFECTO/.test(nota), 'la nota volvió a enseñar los números de respaldo (CONFIG_POR_DEFECTO)');
    for (const clave of ['comisionMototaxi', 'comisionTaxi', 'comisionDomicilio']) {
      assert.ok(nota.includes('cop(ingresos.comisiones.' + clave + ')'), 'la nota no enseña ' + clave + ' de la config cargada');
    }
    const ci = cuerpoDeLaFuncion(s, s.indexOf('const cargarIngresos = useCallback(')).texto;
    assert.match(ci, /comisiones: cfgCom,/, 'cargarIngresos no le pasa a la pantalla la config que usó para contar');
    assert.match(ci, /if \(snapCfg\.exists\(\)\) cfgCom = \{ \.\.\.CONFIG_POR_DEFECTO, \.\.\.snapCfg\.data\(\) \};/,
      'cargarIngresos ya no toma la config de config/global');
  });
});
