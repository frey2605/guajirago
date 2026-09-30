/**
 * 🔑 RECUPERAR LA CONTRASEÑA — gemelo G71 (29-sep-2026).
 *
 * La app manda el correo para crear una contraseña nueva desde dos pantallas (Login.js y Configuracion.js). Ahora las
 * dos lo mandan con UNA pieza, guajirago/src/recuperarContrasena.js, que da el MISMO aviso exista o no el correo, y
 * los fallos los dice el candado de LA LEY DEL BOTÓN con motivoDeRechazo (avisoRechazo.js): sin señal, demasiados
 * intentos, correo mal escrito. Esta prueba SACA cada función de su pantalla y la CORRE con un envío de mentira que
 * contesta lo que puede contestar Firebase (scripts/medir-recuperar-contrasena.cjs), y hace el careo con el código de
 * antes para demostrar que el medidor sí ve el fallo.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, copiaIdentica } = require('./cargar.cjs');
const M = require('../scripts/medir-recuperar-contrasena.cjs');

const ANTES = '21aa0e0'; // el último commit con Login culpando al correo de todo.

/** Un lector que cambia UN archivo por una versión de mentira (el resto, del disco). */
function con(archivo, cambiar) {
  const del = M.lector(null);
  return (r) => {
    if (r !== archivo) return del(r);
    const t = del(r).replace(/\r\n/g, '\n');
    const roto = cambiar(t);
    assert.notStrictEqual(roto, t, 'la pantalla de mentira no cambió nada en ' + archivo);
    return roto;
  };
}
const deLaApp = (r) => r.sitios.filter((s) => s.app === 'transporte');
const resumen = (r) => {
  const app = deLaApp(r);
  return {
    faltan: app.filter((s) => s.falta).length,
    mentiras: app.reduce((n, s) => n + (s.mentiras || []).length, 0),
    delata: app.filter((s) => s.delata).length,
    verdades: app.reduce((n, s) => n + (s.verdades || []).filter((v) => v.dice).length, 0),
    distintos: r.fallosDistintos,
  };
};

describe('G71 · recuperar la contraseña sale de UNA pieza', () => {
  it('hoy: ninguna mentira, no delata correos, dice la verdad de los 3 fallos en las 2 pantallas, y las dos dicen lo mismo', async () => {
    const r = await M.medir(M.lector(null));
    assert.deepStrictEqual(resumen(r), { faltan: 0, mentiras: 0, delata: 0, verdades: 6, distintos: 0 });
    assert.ok(r.pieza, 'no existe guajirago/src/recuperarContrasena.js');
    assert.deepStrictEqual(r.llamadas.transporte, ['recuperarContrasena.js ×1'],
      'en la app solo la pieza puede llamar a sendPasswordResetEmail');
    for (const s of deLaApp(r)) assert.ok(s.normaliza, s.archivo + ' manda el correo sin limpiarlo');
  });

  it('el aviso neutro es el mismo exista o no el correo (y lo dice la pieza, no la pantalla)', async () => {
    const r = await M.medir(M.lector(null));
    const login = r.sitios.find((s) => s.funcion === 'recuperarContrasena');
    const texto = (id) => login.por[id].vistos.map((v) => v.texto).join(' + ');
    assert.match(texto('existe'), /^Si ese correo está registrado/);
    assert.strictEqual(texto('noExisteDelata'), texto('existe'));
    assert.strictEqual(texto('noExisteProtegido'), texto('existe'));
    // Dentro de la cuenta (Configuracion) el aviso sigue diciendo lo mismo que antes de G71, con el correo de la persona.
    const conf = r.sitios.find((s) => s.funcion === 'cambiarContrasena');
    assert.deepStrictEqual(conf.por.existe.vistos.map((v) => v.texto), ['Te enviamos un enlace para cambiar tu contraseña a: persona@ejemplo.com. '
      + 'Si no lo ves en tu bandeja de entrada, revisa la carpeta de correo no deseado o spam.']);
  });

  it('la pieza limpia el correo y solo se calla las respuestas que delatan', async () => {
    const enviados = [];
    let contesta = null;
    const P = M.laPieza(leer('guajirago/src/recuperarContrasena.js'), async (a, c) => {
      enviados.push(c);
      if (contesta) { const e = new Error(contesta); e.code = contesta; throw e; }
    });
    await P.mandarCorreoDeRecuperacion('  Persona@Ejemplo.COM ');
    assert.deepStrictEqual(enviados, ['persona@ejemplo.com']);
    for (const codigo of ['auth/user-not-found', 'auth/user-disabled']) {
      contesta = codigo;
      await P.mandarCorreoDeRecuperacion('x@y.co'); // no revienta: se trata como si hubiera salido
    }
    for (const codigo of ['auth/network-request-failed', 'auth/too-many-requests', 'auth/invalid-email', 'auth/internal-error']) {
      contesta = codigo;
      await assert.rejects(P.mandarCorreoDeRecuperacion('x@y.co'), (e) => e.code === codigo, codigo + ' tiene que llegar al candado');
    }
  });

  it('las tres copias de avisoRechazo.js siguen idénticas (la clase del fallo se decide igual en las tres apps)', () => {
    copiaIdentica('guajirago-admin/src/avisoRechazo.js', 'guajirago/src/avisoRechazo.js');
    copiaIdentica('guajirago-aliados/src/avisoRechazo.js', 'guajirago/src/avisoRechazo.js');
  });

  it('careo: con el código de ANTES el medidor ve las 5 mentiras, que delata, y 0 verdades', async () => {
    const r = await M.medir(M.lector(ANTES));
    assert.deepStrictEqual(resumen(r), { faltan: 0, mentiras: 5, delata: 1, verdades: 0, distintos: 4 });
    assert.ok(!r.pieza);
  });

  describe('pantallas de mentira: el medidor tiene que quejarse de todas', () => {
    const casos = [
      ['Login vuelve a culpar al correo', 'guajirago/src/Login.js',
        (t) => t.replace("return correr(() => mandarCorreoDeRecuperacion(email), 'recuperar', CORREO_DE_RECUPERACION_ENVIADO, 'enviar el correo');",
          "try { await mandarCorreoDeRecuperacion(email); setError(''); } catch (e) { setError('No encontramos ese correo. Verifica e intenta de nuevo'); }")
          .replace('const recuperarContrasena = () => {', 'const recuperarContrasena = async () => {'),
        (s) => s.mentiras > 0],
      ['la pieza deja pasar «no existe»', 'guajirago/src/recuperarContrasena.js',
        (t) => t.replace("export const RESPUESTAS_QUE_DELATAN = ['auth/user-not-found', 'auth/user-disabled'];", 'export const RESPUESTAS_QUE_DELATAN = [];'),
        (s) => s.delata > 0],
      ['avisoRechazo olvida la señal de las cuentas', 'guajirago/src/avisoRechazo.js',
        (t) => t.replace(" || codigo === 'network-request-failed')", ')'),
        (s) => s.verdades < 6],
      ['Configuracion con su propio texto de fallo', 'guajirago/src/Configuracion.js',
        (t) => t.replace("return correr(() => mandarCorreoDeRecuperacion(user.email), 'contrasena',",
          "return correr(() => mandarCorreoDeRecuperacion(user.email).catch(() => { throw new Error('x'); }), 'contrasena',"),
        (s) => s.distintos > 0 && s.verdades < 6],
      ['Login dice «te enviamos» a secas', 'guajirago/src/Login.js',
        (t) => t.replace("'recuperar', CORREO_DE_RECUPERACION_ENVIADO,", "'recuperar', 'Te enviamos un correo para restablecer tu contraseña',"),
        (s) => s.mentiras > 0],
    ];
    for (const [nombre, archivo, cambiar, seQueja] of casos) {
      it(nombre, async () => {
        const r = await M.medir(con(archivo, cambiar));
        assert.ok(seQueja(resumen(r)), 'el medidor no se quejó: ' + JSON.stringify(resumen(r)));
      });
    }
  });
});
