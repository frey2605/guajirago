// ═══════════════════════════════════════════════════════════════════════════
//  ¿A QUIÉN DEL NEGOCIO LE LLEGA CADA AVISO? · gemelo G64, 29-sep-2026
//
//  El pedido nuevo, la reserva nueva y el cobro del plan elegían a mano, cada uno en su sitio de
//  guajirago/functions/index.js, a qué empleados avisar. Ahora lo dice UNA tabla,
//  guajirago/functions/quienRecibeElAviso.cjs, y aquí se EJECUTA index.js entero (pruebas/nubeDeMentira.cjs):
//    1. a cada aviso le llega EXACTAMENTE el dueño y los roles de la tabla, ni uno más;
//    2. nadie en index.js vuelve a elegir empleados por su cuenta;
//    3. aliados está de acuerdo: todo rol que recibe un aviso registra su token y puede abrir lo que le avisan;
//    4. el medidor (scripts/medir-quien-recibe.cjs) no se puede ablandar: se le dan pantallas de mentira.
//
//  CAREO: `QUIEN_REF=a45e608 node --test pruebas/quienRecibe.test.js` corre lo MISMO contra el index.js de ese
//  commit: el bloque 1 pasa (a los mismos les llegaba lo mismo) y el 2 se pone rojo (lo elegía cada uno).
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { execSync } = require('child_process');
const path = require('path');
const { leer } = require('./cargar.cjs');
const PIEZA = require('../guajirago/functions/quienRecibeElAviso.cjs');
const M = require('../scripts/medir-quien-recibe.cjs');

const REF = process.env.QUIEN_REF || '';
const RAIZ = path.resolve(__dirname, '..');
const indexJs = () => (REF ? execSync('git show ' + REF + ':guajirago/functions/index.js', { cwd: RAIZ }).toString()
  : leer('guajirago/functions/index.js'));

describe('G64 · 1. a cada aviso le llega el dueño y los roles de la tabla' + (REF ? ' [careo contra ' + REF + ']' : ''), () => {
  it('la tabla nombra los tres avisos que van a la gente del negocio', () => {
    assert.deepStrictEqual(Object.keys(PIEZA.EMPLEADOS_QUE_RECIBEN).sort(), ['cobro', 'pedidoNuevo', 'reservaNueva']);
    assert.deepStrictEqual(Object.keys(M.AVISOS).sort(), Object.keys(PIEZA.EMPLEADOS_QUE_RECIBEN).sort(),
      'el medidor no enciende los mismos avisos que dice la tabla');
  });

  it('ejecutando index.js: dueño + exactamente esos roles; ni apagados, ni sin token, ni de otro negocio', async () => {
    const quien = await M.quienRecibeCadaAviso(REF || null);
    for (const [aviso, roles] of Object.entries(PIEZA.EMPLEADOS_QUE_RECIBEN)) {
      assert.strictEqual(quien[aviso].dueno, true, aviso + ': al dueño no le llega');
      assert.deepStrictEqual(quien[aviso].roles, [...roles].sort(), aviso + ': le llega a otros roles que los de la tabla');
      assert.deepStrictEqual(quien[aviso].coladosQueNoDeben, [], aviso + ': le llega a un empleado apagado o de otro negocio');
    }
  });

  it('la reserva NO es simétrica con el pedido, a propósito: el recepcionista de la agencia no abre «Reservas»', () => {
    assert.ok(PIEZA.EMPLEADOS_QUE_RECIBEN.pedidoNuevo.includes('recepcionista'));
    assert.ok(!PIEZA.EMPLEADOS_QUE_RECIBEN.reservaNueva.includes('recepcionista'),
      'si el recepcionista de una agencia ha de recibir la reserva, aliados tiene que dejarle abrir «Reservas» (y este '
      + 'renglón cambia a la vez)');
  });
});

describe('G64 · 2. nadie en index.js elige empleados por su cuenta' + (REF ? ' [careo contra ' + REF + ']' : ''), () => {
  it('cero consultas a «empleados» y cero roles nombrados en index.js: lo hace quienRecibeElAviso.cjs', () => {
    assert.deepStrictEqual(M.sitiosAMano(indexJs()), { consultas: 0, nombran: 0 });
  });
});

describe('G64 · 3. aliados está de acuerdo con la tabla', () => {
  it('todo rol de la tabla existe en aliados (Empleados.js)', () => {
    const roles = M.rolesDeAliados();
    for (const [aviso, lista] of Object.entries(PIEZA.EMPLEADOS_QUE_RECIBEN)) {
      for (const r of lista) assert.ok(roles.includes(r), aviso + ': «' + r + '» no es un rol que el dueño pueda dar');
    }
  });

  it('quien recibe un aviso registra su token y puede abrir la pantalla (App.js ejecutado)', async () => {
    const quien = await M.quienRecibeCadaAviso(null);
    const aliados = M.loQueDiceAliados();
    assert.strictEqual(aliados.duenoRegistra, true, 'el dueño ya no registra su token de avisos');
    assert.deepStrictEqual(M.desacuerdos(quien, aliados), []);
  });
});

describe('G64 · 4. la pieza y el medidor no se ablandan', () => {
  it('leLlegaAlEmpleado: rol, token y encendido; y un aviso que no existe revienta', () => {
    const ok = { fcmToken: 't', roles: { recepcionista: true } };
    assert.strictEqual(PIEZA.leLlegaAlEmpleado('pedidoNuevo', ok), true);
    assert.strictEqual(PIEZA.leLlegaAlEmpleado('reservaNueva', ok), false);
    assert.strictEqual(PIEZA.leLlegaAlEmpleado('pedidoNuevo', { ...ok, activo: false }), false);
    assert.strictEqual(PIEZA.leLlegaAlEmpleado('pedidoNuevo', { roles: ok.roles }), false);
    assert.strictEqual(PIEZA.leLlegaAlEmpleado('pedidoNuevo', { fcmToken: 't', roles: { cocina: true } }), false);
    assert.throws(() => PIEZA.leLlegaAlEmpleado('pedidoNuevoo', ok), /no conozco el aviso/);
  });

  it('el cobro no consulta empleados (ningún rol lo recibe)', async () => {
    const db = { collection: () => { throw new Error('consultó'); } };
    assert.deepStrictEqual(await PIEZA.tokensDeLosEmpleados(db, 'N', 'cobro'), []);
  });

  it('el medidor ve un rol nombrado o una consulta a mano en index.js', () => {
    assert.deepStrictEqual(M.sitiosAMano('if ((d.roles || {}).cajero) x();'), { consultas: 0, nombran: 1 });
    assert.deepStrictEqual(M.sitiosAMano("db.collection('empleados').get()"), { consultas: 1, nombran: 0 });
    assert.deepStrictEqual(M.sitiosAMano('// r.recepcionista en un comentario no cuenta'), { consultas: 0, nombran: 0 });
  });

  it('el medidor ve a aliados en desacuerdo (pantallas de mentira)', () => {
    const app = leer('guajirago-aliados/src/App.js');
    const quien = { pedidoNuevo: { roles: ['administrador', 'recepcionista'] }, reservaNueva: { roles: ['administrador'] }, cobro: { roles: [] } };
    const sinToken = app.replace('|| r.administrador || r.recepcionista) registrarTokenFCM', '|| r.administrador) registrarTokenFCM');
    assert.notStrictEqual(sinToken, app, 'el señuelo del token no calzó');
    assert.match(M.desacuerdos(quien, M.loQueDiceAliados(sinToken)).join('\n'), /recepcionista.*token/);
    const sinEstacion = app.replace("const opRoles = ['recepcionista', ", 'const opRoles = [');
    assert.notStrictEqual(sinEstacion, app, 'el señuelo de la estación no calzó');
    assert.match(M.desacuerdos(quien, M.loQueDiceAliados(sinEstacion)).join('\n'), /pedidoNuevo.*recepcionista.*pantalla/);
    const conReserva = { ...quien, reservaNueva: { roles: ['administrador', 'recepcionista'] } };
    assert.match(M.desacuerdos(conReserva, M.loQueDiceAliados(app)).join('\n'), /reservaNueva.*recepcionista.*pantalla/);
    assert.match(M.desacuerdos({ cobro: { roles: ['jefe'] } }, M.loQueDiceAliados(app)).join('\n'), /no es un rol/);
  });
});
