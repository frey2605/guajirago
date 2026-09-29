// ═══════════════════════════════════════════════════════════════════════════
//  EL LLAMADO DE ATENCIÓN · UNA SOLA VENTANITA, Y SI «ENTENDIDO» FALLA LO DICE · gemelo G37, 28-sep-2026
//
//  El panel le manda al usuario un llamado de atención (`usuarios/{uid}.llamadoPendiente`). Lo mostraban y
//  atendían DOS pantallas: la del pasajero (Home.js) pintaba la ventanita DOS veces y se cerraba aunque el
//  «marcar como leído» fallara (`catch(e) {}` y cerrar igual); la del conductor (AppConductor.js) ya pasaba por el
//  candado, pero su pantalla no tenía dónde pintar el aviso, así que el fallo se quedaba callado.
//  Ahora vive en guajirago/src/LlamadoAtencion.js y las dos pantallas la ponen.
//
//  El juez es scripts/medir-llamado-g37.cjs: recorre TODA guajirago/src, cuenta las ventanitas y los sitios que
//  marcan el llamado como leído, y EJECUTA cada «Entendido» con una base que rechaza y otra que acepta, con el
//  candado de verdad. Esta prueba no copia su recorrido: lo importa, y además le da piezas de mentira.
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, cuerpoDeLaFuncion } = require('./cargar.cjs');
const { medirCodigo, archivosDe } = require('../scripts/medir-llamado-g37.cjs');
const { soloCodigo } = require('../scripts/medir-ley-boton.cjs');

const PIEZA = 'guajirago/src/LlamadoAtencion.js';
const fuentePieza = () => leer(PIEZA).replace(/\r\n/g, '\n');

/** El cuerpo del `useEffect(() => { … })` de la pieza que contiene `marca`, para EJECUTARLO. */
function efectoCon(fuente, marca) {
  const codigo = soloCodigo(fuente);
  const i = codigo.indexOf(marca);
  assert.ok(i >= 0, 'la pieza ya no tiene «' + marca + '»');
  const ini = codigo.lastIndexOf('useEffect(', i);
  assert.ok(ini >= 0, 'no encuentro el useEffect de «' + marca + '»');
  const c = cuerpoDeLaFuncion(codigo, ini);
  assert.ok(c && c.ini <= i && i < c.fin, '«' + marca + '» no está dentro de un useEffect');
  return c.texto;
}

function correrCuerpo(cuerpo, env) {
  // eslint-disable-next-line no-new-func
  return new Function('env', 'with (env) { return (() => {' + cuerpo + '\n})(); }')(env);
}

describe('EL LLAMADO DE ATENCIÓN · una sola ventanita en las dos pantallas', () => {
  let r;
  const medida = async () => { if (!r) r = await medirCodigo(archivosDe(null)); return r; };

  it('se pinta UNA vez en toda la app, en LlamadoAtencion.js, con el aviso del fallo DENTRO', async () => {
    const m = await medida();
    assert.deepStrictEqual(m.ventanitas.map((v) => v.ruta), [PIEZA], '⛔ la ventanita del llamado volvió a nacer gemela (o se pinta dos veces)');
    assert.strictEqual(m.ventanitas[0].conAviso, true, '⛔ la ventanita del llamado no tiene dónde decir que «Entendido» falló');
  });

  it('un solo sitio marca el llamado como leído, y ese sitio pasa por el candado', async () => {
    const m = await medida();
    assert.deepStrictEqual(m.cierres.map((c) => c.ruta + ' (' + c.funcion + ')'), [PIEZA + ' (cerrar)']);
    const c = m.cierres[0];
    assert.strictEqual(c.siFalla.cierra, false, '⛔ si la base rechaza, la ventanita se cierra igual y el llamado vuelve a salir sin explicación');
    assert.ok(c.siFalla.aviso && c.siFalla.aviso.ok === false, '⛔ si la base rechaza, nadie lo dice');
    assert.match(c.siFalla.aviso.titulo, /marcar el llamado como leído/);
    assert.strictEqual(c.siEntra.cierra, true, '⛔ cuando sí entró, la ventanita no se cierra');
    assert.deepStrictEqual(m.seCierranAunqueFalle, []);
    assert.deepStrictEqual(m.fallanMudas, []);
    assert.deepStrictEqual(m.noSeCierranSiEntra, []);
  });

  it('la pantalla del pasajero y la del conductor la ponen (una vez cada una), y el conductor solo sin viaje en curso', async () => {
    const m = await medida();
    const usos = Object.fromEntries(m.usan.map((u) => [u.ruta.split('/').pop(), u]));
    assert.deepStrictEqual(Object.keys(usos).sort(), ['AppConductor.js', 'Home.js']);
    for (const u of Object.values(usos)) {
      assert.strictEqual(u.veces, 1, u.ruta + ' la pone ' + u.veces + ' veces');
      assert.strictEqual(u.importa, true, u.ruta + ' no la importa de ./LlamadoAtencion');
    }
    const conductor = soloCodigo(leer('guajirago/src/AppConductor.js'));
    assert.match(conductor, /\{!fase && <LlamadoAtencion \/>\}/, '⛔ el conductor vería el llamado encima del viaje en curso (antes solo salía sin viaje)');
    for (const p of ['guajirago/src/Home.js', 'guajirago/src/AppConductor.js']) {
      assert.doesNotMatch(soloCodigo(leer(p)), /llamadoPendiente/, '⛔ ' + p + ' vuelve a leer o escribir el llamado por su cuenta');
    }
  });

  it('«Entendido» NO borra el llamado: solo apaga la bandera de «sin ver»; el historial del panel no se toca', () => {
    const codigo = soloCodigo(fuentePieza());
    assert.match(codigo, /updateDoc\(doc\(db, 'usuarios', user\.uid\), \{ llamadoPendiente: null \}\)/);
    assert.doesNotMatch(codigo, /llamadosAtencion|deleteDoc|deleteField/, '⛔ la pieza toca el historial de llamados (REGLA de las lápidas)');
  });

  it('el oyente de la ficha pone el llamado, y un null que aún no confirma el servidor NO lo cierra', () => {
    const cuerpo = efectoCon(fuentePieza(), 'onSnapshot(');
    const puestos = [];
    let oyente = null;
    const env = {
      auth: { currentUser: { uid: 'u1' } }, db: {}, doc: () => 'ruta',
      onSnapshot: (_ref, fn) => { oyente = fn; return () => {}; },
      setLlamado: (v) => puestos.push(v),
    };
    correrCuerpo(cuerpo, env);
    assert.ok(oyente, 'el efecto no se suscribe a la ficha del usuario');
    const snap = (data) => ({ exists: () => true, data: () => data });
    oyente(snap({ llamadoPendiente: 'Te llamamos la atención por X' }));
    oyente(snap({ llamadoPendiente: null }));
    oyente(snap({}));
    assert.deepStrictEqual(puestos, ['Te llamamos la atención por X'], '⛔ el oyente cierra el llamado por su cuenta (o no lo pone)');
  });

  it('si el candado dijo «sin confirmar» y la escritura entró tarde, la ventanita se cierra sola', () => {
    const cuerpo = efectoCon(fuentePieza(), 'aviso.cual');
    const probar = (aviso) => { const p = []; correrCuerpo(cuerpo, { aviso, setLlamado: (v) => p.push(v) }); return p; };
    assert.deepStrictEqual(probar({ ok: true, cual: 'llamado' }), [null]);
    assert.deepStrictEqual(probar({ ok: false, cual: 'llamado' }), [], '⛔ un fallo cierra la ventanita');
    assert.deepStrictEqual(probar(null), []);
  });

  it('y el medidor no se puede ablandar: se queja de cada pieza de mentira', async () => {
    const buena = fuentePieza();
    const otros = { 'guajirago/src/Home.js': leer('guajirago/src/Home.js'), 'guajirago/src/AppConductor.js': leer('guajirago/src/AppConductor.js') };
    const con = (pieza) => medirCodigo({ ...otros, [PIEZA]: pieza });
    const cambiar = (a, b) => { assert.ok(buena.includes(a), 'la pieza de mentira no calza: ' + a); return buena.replace(a, b); };

    const cierraSiempre = await con(cambiar('if (r && r.ok) setLlamado(null);', 'setLlamado(null);'));
    assert.strictEqual(cierraSiempre.seCierranAunqueFalle.length, 1, 'no vio que se cierra aunque falle');

    const sinAviso = await con(cambiar('<AvisoModal aviso={aviso && !aviso.ok ? aviso : null} onCerrar={cerrarAviso} />', ''));
    assert.strictEqual(sinAviso.fallanMudas.length, 1, 'no vio que el fallo no tiene dónde pintarse');

    const sinCandado = await con(cambiar('const r = await correr(async () => {', 'const r = await (async () => {').replace(
      "}, 'llamado', 'Listo.', 'marcar el llamado como leído');", '})(); '));
    assert.strictEqual(sinCandado.fallanMudas.length, 1, 'no vio que el «Entendido» ya no pasa por el candado');

    // El pasajero de ANTES: la ventanita dos veces y el cierre que se traga el fallo.
    const antes = await medirCodigo(archivosDe('8f9af9f'));
    assert.strictEqual(antes.ventanitas.length, 3);
    assert.strictEqual(antes.seCierranAunqueFalle.length, 1);
    assert.strictEqual(antes.fallanMudas.length, 2);
  });
});
