// ═══════════════════════════════════════════════════════════════════════════
//  LA FICHA MANDA, LA COPIA DEL TELÉFONO SOLO ARRANCA · gemelo G09, 28-sep-2026
//
//  La app guarda en el teléfono una copia de la ficha `usuarios/{uid}` (guardarLocal, localStorage). Hasta hoy, si
//  la copia existía, al abrir NO se volvía a leer la ficha: solo se traía la foto. Si el panel corregía la placa
//  (ABC123 → XYZ789), el conductor seguía mandando ABC123 en sus ofertas hasta cerrar sesión —y el servidor
//  (confirmarConductor) la copia de la oferta al viaje: el pasajero ve una placa equivocada—. Y el tipo de vehículo
//  viejo decidía qué viajes veía y qué comisión se le exigía.
//
//  No se mira el texto: el efecto de arranque de App.js se SACA del archivo y se CORRE en un mundo de mentira
//  (copia local, sesión, ficha del servidor), y se mira con qué placa, vehículo, tipo y teléfono queda la app.
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, soloCodigo, cuerpoDeLaFuncion, cargarDeLaApp } = require('./cargar.cjs');

const { telefonoDe } = cargarDeLaApp('guajirago/src/telefonoUsuario.js');
const { fotoDe } = cargarDeLaApp('guajirago/src/fotoUsuario.js'); // G43: datosDeLaFicha saca la foto con la regla única

/** El efecto de arranque de App y la traducción de la ficha, sacados del texto de App.js (el de hoy, o el que se dé). */
function piezasDeApp(fuente) {
  const t = soloCodigo(fuente).replace(/\r\n/g, '\n');
  const app = t.indexOf('function App()');
  assert.ok(app >= 0, 'no encuentro function App() en App.js');
  const efecto = t.indexOf('useEffect(() => {', app);
  assert.ok(efecto >= 0, 'no encuentro el efecto de arranque de App');
  const cuerpo = cuerpoDeLaFuncion(t, efecto + 'useEffect('.length).texto;
  assert.match(cuerpo, /cargarLocal\(\)/, 'el primer efecto de App no es el de arranque (no lee la copia local)');
  const d = t.indexOf('function datosDeLaFicha(');
  const traduccion = d >= 0 ? t.slice(d, cuerpoDeLaFuncion(t, d).fin + 1) : '';
  return { cuerpo, traduccion };
}

/** Corre el arranque de la app en un mundo de mentira y devuelve cómo queda. */
async function arrancar({ copia, ficha, sesion = true, sinRed = false, fuente }) {
  const { cuerpo, traduccion } = piezasDeApp(fuente || leer('guajirago/src/App.js'));
  const estado = {};
  let guardada = copia ? JSON.parse(JSON.stringify(copia)) : null;
  const leidas = [];
  const piezas = {
    cargarLocal: () => (guardada ? JSON.parse(JSON.stringify(guardada)) : null),
    guardarLocal: (d) => { guardada = JSON.parse(JSON.stringify(d)); },
    telefonoDe,
    fotoDe,
    auth: {},
    db: {},
    doc: (_db, col, id) => col + '/' + id,
    onAuthStateChanged: (_auth, cb) => { Promise.resolve().then(() => cb(sesion ? { uid: 'c1' } : null)); return () => {}; },
    getDoc: async (ruta) => {
      leidas.push(ruta);
      if (sinRed) throw new Error('sin red');
      return { exists: () => !!ficha, data: () => ({ ...ficha }) };
    },
    setTimeout: (fn) => fn(),
  };
  for (const s of ['Screen', 'TipoUsuario', 'NombreUsuario', 'TelefonoUsuario', 'PlacaUsuario', 'VehiculoUsuario', 'TipoVehiculoUsuario', 'FotoUsuario']) {
    piezas['set' + s] = (v) => { estado[s[0].toLowerCase() + s.slice(1)] = v; };
  }
  const nombres = Object.keys(piezas);
  // eslint-disable-next-line no-new-func
  new Function(...nombres, traduccion + '\n' + cuerpo)(...nombres.map((n) => piezas[n]));
  for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
  return { estado, guardada, leidas };
}

const COPIA_VIEJA = { tipo: 'conductor', nombre: 'Taxista', celular: '3001112222', placa: 'ABC123', vehiculo: 'Spark viejo', tipoVehiculo: 'Taxi' };
const FICHA_CORREGIDA = { tipo: 'conductor', nombre: 'Taxista Corregido', celular: '3001112222', telefono: '3009998888', placa: 'XYZ789', vehiculo: 'Spark nuevo', tipoVehiculo: 'Mototaxi', fotoConductor: 'foto.jpg' };

describe('LA FICHA MANDA SOBRE LA COPIA DEL TELÉFONO · G09', () => {
  it('EL QUE MUERDE · el panel corrigió la placa: con copia vieja puesta, la app queda con la placa de la ficha', async () => {
    const r = await arrancar({ copia: COPIA_VIEJA, ficha: FICHA_CORREGIDA });
    assert.deepStrictEqual(r.leidas, ['usuarios/c1'], 'con copia puesta tiene que leer la ficha del servidor');
    assert.strictEqual(r.estado.placaUsuario, 'XYZ789', '⛔ el conductor seguiría mandando ABC123 en sus ofertas');
    assert.strictEqual(r.estado.vehiculoUsuario, 'Spark nuevo');
    assert.strictEqual(r.estado.tipoVehiculoUsuario, 'Mototaxi', '⛔ el tipo viejo decidiría qué viajes ve y qué comisión se le pide');
    assert.strictEqual(r.estado.telefonoUsuario, '3009998888', 'el teléfono sale de la ficha con la regla de G08');
    assert.strictEqual(r.estado.nombreUsuario, 'Taxista Corregido');
    assert.strictEqual(r.estado.fotoUsuario, 'foto.jpg');
    assert.strictEqual(r.estado.screen, 'modulos');
  });

  it('la copia se pone al día: la próxima vez que abra sin red, ya arranca con la placa buena', async () => {
    const r = await arrancar({ copia: COPIA_VIEJA, ficha: FICHA_CORREGIDA });
    assert.strictEqual(r.guardada.placa, 'XYZ789');
    assert.strictEqual(r.guardada.tipoVehiculo, 'Mototaxi');
    assert.strictEqual(telefonoDe(r.guardada), '3009998888');
    const sinRed = await arrancar({ copia: r.guardada, ficha: FICHA_CORREGIDA, sinRed: true });
    assert.strictEqual(sinRed.estado.placaUsuario, 'XYZ789');
  });

  it('el papel escogido (pasajero o conductor) sigue saliendo de la copia, como antes', async () => {
    const r = await arrancar({ copia: { ...COPIA_VIEJA, tipo: 'pasajero' }, ficha: FICHA_CORREGIDA });
    assert.strictEqual(r.estado.tipoUsuario, 'pasajero');
    assert.strictEqual(r.guardada.tipo, 'pasajero');
  });

  it('una copia guardada al entrar como pasajero (sin tipo de vehículo) lo recupera de la ficha', async () => {
    const copia = { tipo: 'pasajero', nombre: 'Taxista', celular: '3001112222', placa: 'XYZ789', vehiculo: 'Spark nuevo' };
    const r = await arrancar({ copia, ficha: FICHA_CORREGIDA });
    assert.strictEqual(r.estado.tipoVehiculoUsuario, 'Mototaxi');
  });

  it('sin red: arranca con la copia (para eso está) y no se queda colgado', async () => {
    const r = await arrancar({ copia: COPIA_VIEJA, ficha: FICHA_CORREGIDA, sinRed: true });
    assert.strictEqual(r.estado.placaUsuario, 'ABC123');
    assert.strictEqual(r.estado.tipoVehiculoUsuario, 'Taxi');
    assert.strictEqual(r.estado.telefonoUsuario, '3001112222');
    assert.strictEqual(r.estado.screen, 'modulos');
    assert.strictEqual(r.guardada.placa, 'ABC123', 'sin red no se toca la copia');
  });

  it('si la ficha no existe, se queda con la copia y no la borra', async () => {
    const r = await arrancar({ copia: COPIA_VIEJA, ficha: null });
    assert.strictEqual(r.estado.placaUsuario, 'ABC123');
    assert.deepStrictEqual(r.guardada, COPIA_VIEJA);
  });

  it('sin copia: lee la ficha, la guarda y entra (como antes)', async () => {
    const r = await arrancar({ copia: null, ficha: FICHA_CORREGIDA });
    assert.strictEqual(r.estado.placaUsuario, 'XYZ789');
    assert.strictEqual(r.estado.tipoVehiculoUsuario, 'Mototaxi');
    assert.strictEqual(r.estado.telefonoUsuario, '3009998888');
    assert.strictEqual(r.estado.fotoUsuario, 'foto.jpg');
    assert.strictEqual(r.estado.tipoUsuario, 'conductor');
    assert.strictEqual(r.guardada.placa, 'XYZ789');
    assert.strictEqual(r.estado.screen, 'modulos');
  });

  it('sin copia y sin sesión: va al inicio de sesión', async () => {
    const r = await arrancar({ copia: null, ficha: null, sesion: false });
    assert.strictEqual(r.estado.screen, 'login');
    assert.deepStrictEqual(r.leidas, []);
  });

  it('la placa, el vehículo y el tipo de la app son los que recibe la pantalla del conductor', () => {
    const t = soloCodigo(leer('guajirago/src/App.js'));
    assert.match(t, /<AppConductor[\s\S]*?placa=\{placaUsuario\}[\s\S]*?vehiculo=\{vehiculoUsuario\}[\s\S]*?tipoVehiculo=\{tipoVehiculoUsuario\}/,
      'la pantalla del conductor ya no recibe la placa/vehículo/tipo del estado que esta prueba mira');
  });
});

module.exports = { arrancar, COPIA_VIEJA, FICHA_CORREGIDA };
