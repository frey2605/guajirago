/**
 * 🔐 LOS ERRORES DE LAS CUENTAS — gemelo G72 (29-sep-2026).
 *
 * Entrar, crear la cuenta, confirmar la contraseña para eliminarla y crear la cuenta de un empleado: siete sitios en
 * las tres apps que traducían a mano los fallos de Firebase Auth, cada uno con sus palabras. Ahora el texto lo dice
 * avisoRechazo.js (motivoDeRechazo y avisoEnUnaLinea; copia idéntica en las tres apps) y las pantallas solo lo
 * enseñan. Esta prueba SACA el catch de cada pantalla y lo CORRE con cada error que puede contestar Firebase
 * (scripts/medir-errores-de-cuenta.cjs), hace el careo con el código de antes, y le da pantallas de mentira al medidor.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, cargarDeLaApp } = require('./cargar.cjs');
const M = require('../scripts/medir-errores-de-cuenta.cjs');

// El último commit de cada repo con las tablitas a mano (antes de G72).
const ANTES = { transporte: '1fcbc6c', panel: 'e8ec621', aliados: 'b37746a' };

/** Un lector que cambia UN archivo por una versión de mentira (el resto, del disco). */
function con(archivo, cambiar) {
  const del = M.lector();
  return (r) => {
    if (r !== archivo) return del(r);
    const t = del(r).replace(/\r\n/g, '\n');
    const roto = cambiar(t);
    assert.notStrictEqual(roto, t, 'la pantalla de mentira no cambió nada en ' + archivo);
    return roto;
  };
}
const resumen = (r) => ({
  faltan: r.faltan, tablasAMano: r.tablasAMano, distintos: r.fallosConPalabrasDistintas,
  verdades: r.verdades, posibles: r.verdadesPosibles, mudos: r.mudos, delatan: r.delatan,
});

describe('G72 · los errores de las cuentas salen de UNA pieza en las tres apps', () => {
  it('hoy: 7 sitios, ninguno con texto propio, el mismo fallo se dice igual en todos, 34/34 verdades, nadie delata', () => {
    const r = M.medir(M.lector());
    assert.deepStrictEqual(resumen(r), { faltan: 0, tablasAMano: 0, distintos: 0, verdades: 34, posibles: 34, mudos: 0, delatan: 0 });
  });

  it('al entrar, «contraseña mala» y «correo sin cuenta» dicen EXACTAMENTE lo mismo en las tres apps', () => {
    const r = M.medir(M.lector());
    const entrar = r.sitios.filter((s) => s.tipo === 'entrar');
    assert.strictEqual(entrar.length, 3);
    const textos = new Set();
    for (const s of entrar) for (const id of ['credencial', 'claveMala', 'noExiste']) textos.add(s.texto(id));
    assert.deepStrictEqual([...textos], ['No se pudo iniciar sesión. El correo o la contraseña no son correctos. Revísalos y vuelve a intentar.']);
  });

  it('la pieza: los códigos de las cuentas no cambian de clase y avisoEnUnaLinea arma el renglón', () => {
    const P = cargarDeLaApp('guajirago/src/avisoRechazo.js');
    const err = (code) => Object.assign(new Error(code), { code });
    for (const c of ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/email-already-in-use', 'auth/weak-password']) {
      assert.strictEqual(P.motivoDeRechazo(err(c), 'x').clave, 'otro', c);
    }
    assert.strictEqual(P.motivoDeRechazo(err('auth/network-request-failed'), 'x').clave, 'sinRed');
    assert.strictEqual(P.avisoEnUnaLinea(err('auth/weak-password'), 'crear la cuenta'),
      'No se pudo crear la cuenta. La contraseña es muy débil: debe tener mínimo 6 caracteres.');
    // Cuando el título no es «No se pudo …», el texto ya dice qué se intentaba y va solo.
    assert.strictEqual(P.avisoEnUnaLinea(err('auth/network-request-failed'), 'iniciar sesión'),
      'No hay internet ahora mismo, así que no se pudo iniciar sesión. Inténtalo otra vez cuando haya señal.');
    // Los fallos de la base siguen igual que antes de G72.
    assert.strictEqual(P.motivoDeRechazo(err('permission-denied'), 'guardar').clave, 'permiso');
    assert.strictEqual(P.motivoDeRechazo(err('not-found'), 'guardar').texto, 'Algo falló por el camino y el cambio no se hizo. Inténtalo otra vez.');
  });

  it('las tres copias de avisoRechazo.js siguen idénticas', () => {
    const app = leer('guajirago/src/avisoRechazo.js');
    assert.strictEqual(leer('guajirago-admin/src/avisoRechazo.js'), app);
    assert.strictEqual(leer('guajirago-aliados/src/avisoRechazo.js'), app);
  });

  it('careo: con el código de ANTES el medidor ve las 7 tablas a mano, 9/9 fallos con palabras distintas y 14/34 verdades', () => {
    const r = M.medir(M.lector(ANTES));
    assert.deepStrictEqual(resumen(r), { faltan: 0, tablasAMano: 7, distintos: 9, verdades: 14, posibles: 34, mudos: 0, delatan: 0 });
  });

  describe('pantallas de mentira: el medidor tiene que quejarse de todas', () => {
    const casos = [
      ['Login de transporte vuelve a su tablita', 'guajirago/src/Login.js',
        (t) => t.replace("setError(avisoEnUnaLinea(err, 'iniciar sesión'));",
          "if (err.code === 'auth/invalid-credential') setError('Correo o contraseña incorrectos'); else setError('Error al ingresar. Intenta de nuevo');"),
        (s) => s.tablasAMano > 0 && s.distintos > 0 && s.verdades < 34],
      ['el panel delata qué correos existen', 'guajirago-admin/src/App.js',
        (t) => t.replace("setError(avisoEnUnaLinea(e, 'iniciar sesión'));",
          "setError(e.code === 'auth/user-not-found' ? 'Ese correo no está registrado' : avisoEnUnaLinea(e, 'iniciar sesión'));"),
        (s) => s.delatan > 0],
      ['la pieza separa «correo sin cuenta» de «contraseña mala»', 'guajirago/src/avisoRechazo.js',
        (t) => t.replace(" || codigo === 'user-not-found') {", ') {'),
        (s) => s.delatan > 0],
      ['la pieza olvida la contraseña débil', 'guajirago-aliados/src/avisoRechazo.js',
        (t) => t.replace("if (codigo === 'weak-password') {", "if (codigo === 'weak-passwordX') {"),
        (s) => s.verdades < 34 && s.distintos > 0],
      ['Empleados se traga el fallo', 'guajirago-aliados/src/Empleados.js',
        (t) => t.replace("setError(avisoEnUnaLinea(e, 'crear la cuenta del empleado'));", ''),
        (s) => s.mudos > 0],
      ['Configuracion con su propio texto', 'guajirago/src/Configuracion.js',
        (t) => t.replace("setErrorEliminar(avisoEnUnaLinea(e, 'eliminar la cuenta'));", "setErrorEliminar('Error al eliminar. Intenta más tarde');"),
        (s) => s.tablasAMano > 0 && s.verdades < 34],
    ];
    for (const [nombre, archivo, cambiar, seQueja] of casos) {
      it(nombre, () => {
        const r = M.medir(con(archivo, cambiar));
        assert.ok(seQueja(resumen(r)), 'el medidor no se quejó: ' + JSON.stringify(resumen(r)));
      });
    }
  });
});
