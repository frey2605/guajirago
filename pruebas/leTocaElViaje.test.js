// ═══════════════════════════════════════════════════════════════════════════
//  ¿A QUIÉN LE SUENA EL AVISO DE UN VIAJE? · gemelo G04, 27-sep-2026
//
//  El servidor (tokensConductoresCerca) avisaba solo por distancia; la lista del conductor filtraba además por tipo
//  de vehículo. A un taxista le sonaba «Nuevo viaje» por un mototaxi que no veía. Y si el viaje llegaba sin radio o
//  con 0, el servidor usaba 3 km y la lista 7 km; el panel dejaba guardar 0 al borrar el campo.
//
//  Aquí se EJECUTA todo: las dos copias de la regla (servidor y app) con los mismos casos, la función del servidor
//  sacada de index.js con una base de datos de mentira, y el guardar del panel sacado de Superadmin.js.
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, cargarDeLaApp, cuerpoDeLaFuncion } = require('./cargar.cjs');
const SERVIDOR = require('../guajirago/functions/leTocaElViaje.cjs');
const { porQueNoSeLeAvisa } = require('../guajirago/functions/avisables.cjs');
const { medir, ANTES, reglasDeHoy, cargarLeTocaDeLaApp } = require('../scripts/medir-aviso-g04.cjs');

const APP = cargarLeTocaDeLaApp();
const COMISIONES_APP = cargarDeLaApp('guajirago/src/comisiones.js');
const { CONFIG_COMPARTIDA } = cargarDeLaApp('guajirago/src/configApp.js');

const TIPOS_VIAJE = ['Taxi', 'Mototaxi', 'Mensajería', undefined, ''];
const VEHICULOS = ['Taxi', 'Mototaxi', '', undefined];
const RADIOS = [undefined, 0, null, -1, '5', 3, 7];
const KMS = [undefined, 0.5, 2.9, 3, 3.1, 5, 6.9, 7, 7.1, 10];

/** Saca una función de un archivo por su arranque y devuelve su texto entero. */
function textoDe(codigo, arranque) {
  const i = codigo.indexOf(arranque);
  assert.ok(i >= 0, 'no está «' + arranque + '»');
  const f = cuerpoDeLaFuncion(codigo, i);
  return codigo.slice(i, f.fin + 1);
}

describe('G04 · la regla de «¿le toca este viaje?» dice lo mismo en el servidor y en la lista del conductor', () => {
  it('las dos copias contestan igual en todos los casos (tipo, vehículo, radio y distancia)', () => {
    let casos = 0;
    for (const tipo of TIPOS_VIAJE) for (const tv of VEHICULOS) for (const radioBusqueda of RADIOS) for (const km of KMS) {
      const viaje = { tipo, radioBusqueda };
      assert.strictEqual(APP.porQueNoLeToca(viaje, tv, km), SERVIDOR.porQueNoLeToca(viaje, tv, km),
        'dicen distinto con ' + JSON.stringify({ viaje, tv, km }));
      casos++;
    }
    assert.ok(casos > 1000);
  });

  it('los tipos que ve cada vehículo son los de comisiones.js de la app (la lista del interruptor)', () => {
    for (const tv of VEHICULOS) {
      assert.deepStrictEqual(SERVIDOR.tiposDeViajeQueVe(tv), COMISIONES_APP.tiposDeViajeQueVe(tv), 'vehículo ' + JSON.stringify(tv));
    }
  });

  it('el radio de repuesto es el INICIAL de configApp.js, el mismo en los dos lados', () => {
    assert.strictEqual(SERVIDOR.RADIO_DE_REPUESTO_KM, CONFIG_COMPARTIDA.radioBusquedaInicial);
    assert.strictEqual(APP.RADIO_DE_REPUESTO_KM, CONFIG_COMPARTIDA.radioBusquedaInicial);
    for (const r of [undefined, 0, null, -1, '5', NaN]) {
      assert.strictEqual(SERVIDOR.radioDelViaje({ radioBusqueda: r }), 3, 'radio ' + String(r));
      assert.strictEqual(APP.radioDelViaje({ radioBusqueda: r }), 3, 'radio ' + String(r));
    }
    assert.strictEqual(SERVIDOR.radioDelViaje({ radioBusqueda: 7 }), 7);
  });

  it('los casos de la auditoría', () => {
    // Un taxista a 2 km de un mototaxi: no le toca (antes le sonaba).
    assert.ok(SERVIDOR.porQueNoLeToca({ tipo: 'Mototaxi', radioBusqueda: 3 }, 'Taxi', 2));
    // El mototaxista sí ve el mandado; el taxista no.
    assert.strictEqual(SERVIDOR.porQueNoLeToca({ tipo: 'Mensajería', radioBusqueda: 3 }, 'Mototaxi', 2), null);
    assert.ok(SERVIDOR.porQueNoLeToca({ tipo: 'Mensajería', radioBusqueda: 3 }, 'Taxi', 2));
    // Viaje sin radio o con 0, conductor a 5 km: ni suena ni lo ve (antes: no sonaba y la lista SÍ lo enseñaba, con 7).
    for (const r of [undefined, 0]) {
      assert.ok(SERVIDOR.porQueNoLeToca({ tipo: 'Taxi', radioBusqueda: r }, 'Taxi', 5));
      assert.ok(APP.porQueNoLeToca({ tipo: 'Taxi', radioBusqueda: r }, 'Taxi', 5));
    }
    // Sin saber la distancia no se descarta por distancia; sin tipo de vehículo lo ve todo.
    assert.strictEqual(SERVIDOR.porQueNoLeToca({ tipo: 'Taxi', radioBusqueda: 3 }, 'Taxi', undefined), null);
    assert.strictEqual(SERVIDOR.porQueNoLeToca({ tipo: 'Mototaxi', radioBusqueda: 3 }, '', 1), null);
  });
});

describe('G04 · el servidor avisa con ESA regla (tokensConductoresCerca, ejecutado con una base de mentira)', () => {
  const idx = leer('guajirago/functions/index.js').replace(/\r\n/g, '\n');
  const AHORA = Date.now();
  const P = { lat: 11.544, lng: -72.907 };
  const cerca = { lat: P.lat + 0.018, lng: P.lng }; // ~2 km
  const lejos = { lat: P.lat + 0.045, lng: P.lng }; // ~5 km
  const CONDUCTORES = [
    { id: 'taxi2', d: { activo: true, fcmToken: 'T-taxi2', ubicacion: cerca }, t: AHORA },
    { id: 'moto2', d: { activo: true, fcmToken: 'T-moto2', ubicacion: cerca }, t: AHORA },
    { id: 'sinTipo2', d: { activo: true, fcmToken: 'T-sinTipo2', ubicacion: cerca }, t: AHORA },
    { id: 'taxi5', d: { activo: true, fcmToken: 'T-taxi5', ubicacion: lejos }, t: AHORA },
    { id: 'sinFicha', d: { activo: true, fcmToken: 'T-sinFicha', ubicacion: cerca }, t: AHORA },
    { id: 'taxiSinUbicacion', d: { activo: true, fcmToken: 'T-taxiSinUbicacion' }, t: AHORA },
    { id: 'taxiDormido', d: { activo: true, fcmToken: 'T-taxiDormido', ubicacion: cerca }, t: AHORA - 13 * 3600 * 1000 },
  ];
  const USUARIOS = {
    taxi2: { tipoVehiculo: 'Taxi' }, moto2: { tipoVehiculo: 'Mototaxi' }, sinTipo2: {},
    taxi5: { tipoVehiculo: 'Taxi' }, taxiSinUbicacion: { tipoVehiculo: 'Taxi' }, taxiDormido: { tipoVehiculo: 'Taxi' },
  };

  function correr(viaje) {
    const pedidas = [];
    const db = {
      collection(nombre) {
        return {
          where: () => ({
            get: async () => {
              assert.strictEqual(nombre, 'conductores');
              return { forEach: (fn) => CONDUCTORES.forEach((c) => fn({ id: c.id, data: () => c.d, updateTime: { toMillis: () => c.t } })) };
            },
          }),
          doc: (id) => ({ coleccion: nombre, id }),
        };
      },
      getAll: async (...refs) => refs.map((r) => {
        pedidas.push(r.coleccion + '/' + r.id);
        const u = r.coleccion === 'usuarios' ? USUARIOS[r.id] : undefined;
        return { exists: !!u, data: () => u };
      }),
    };
    const admin = { firestore: () => db };
    // eslint-disable-next-line no-new-func
    const distanciaKm = new Function(textoDe(idx, 'function distanciaKm(') + '\nreturn distanciaKm;')();
    // eslint-disable-next-line no-new-func
    const tokensConductoresCerca = new Function('admin', 'porQueNoSeLeAvisa', 'porQueNoLeToca', 'distanciaKm',
      textoDe(idx, 'async function tokensConductoresCerca(') + '\nreturn tokensConductoresCerca;')(
      admin, porQueNoSeLeAvisa, SERVIDOR.porQueNoLeToca, distanciaKm);
    return tokensConductoresCerca(viaje).then((tokens) => ({ tokens: tokens.slice().sort(), pedidas }));
  }

  it('index.js trae la regla de leTocaElViaje.cjs y las dos funciones de aviso le pasan el VIAJE entero', () => {
    assert.match(idx, /const \{ porQueNoLeToca \} = require\('\.\/leTocaElViaje\.cjs'\);/);
    assert.match(textoDe(idx, 'exports.notificarNuevoViaje'), /await tokensConductoresCerca\(viaje\);/);
    assert.match(textoDe(idx, 'exports.notificarNuevaOferta'), /await tokensConductoresCerca\(despues\);/);
  });

  it('un mototaxi a 2 km NO le suena al taxista; sí al mototaxista, al que no tiene tipo y al que no tiene ficha', async () => {
    const r = await correr({ tipo: 'Mototaxi', radioBusqueda: 3, pasajeroLat: P.lat, pasajeroLng: P.lng });
    assert.deepStrictEqual(r.tokens, ['T-moto2', 'T-sinFicha', 'T-sinTipo2']);
    assert.ok(r.pedidas.every((p) => p.startsWith('usuarios/')), 'el tipo de vehículo sale de usuarios/{uid}');
    assert.ok(!r.pedidas.includes('usuarios/taxiDormido'), 'al que no está en servicio ni se le pregunta');
  });

  it('un taxi a 2 km le suena a los taxistas cercanos y al que no se sabe dónde está; al de 5 km no', async () => {
    const r = await correr({ tipo: 'Taxi', radioBusqueda: 3, pasajeroLat: P.lat, pasajeroLng: P.lng });
    assert.deepStrictEqual(r.tokens, ['T-sinFicha', 'T-sinTipo2', 'T-taxi2', 'T-taxiSinUbicacion']);
  });

  it('con radio 0 o sin radio usa el de repuesto (3 km, como la lista): el de 5 km no; con 7, sí', async () => {
    for (const radioBusqueda of [0, undefined]) {
      const r = await correr({ tipo: 'Taxi', radioBusqueda, pasajeroLat: P.lat, pasajeroLng: P.lng });
      assert.ok(!r.tokens.includes('T-taxi5'), 'radio ' + radioBusqueda);
      assert.ok(r.tokens.includes('T-taxi2'), 'radio ' + radioBusqueda);
    }
    const r7 = await correr({ tipo: 'Taxi', radioBusqueda: 7, pasajeroLat: P.lat, pasajeroLng: P.lng });
    assert.ok(r7.tokens.includes('T-taxi5'));
  });
});

describe('G04 · el panel no deja guardar un radio de búsqueda en 0 (guardarConfig, ejecutado)', () => {
  const sa = leer('guajirago-admin/src/Superadmin.js').replace(/\r\n/g, '\n');
  const texto = textoDe(sa, 'const guardarConfig = async () =>');
  const flecha = texto.slice(texto.indexOf('async () =>'));

  async function guardar(config) {
    const escrito = []; const mensajes = [];
    const nombres = ['config', 'setGuardando', 'setMensajeConfig', 'setDoc', 'doc', 'db', 'usuario', 'registrarLog', 'setTimeout'];
    // eslint-disable-next-line no-new-func
    const fn = new Function(...nombres, 'return ' + flecha)(
      config, () => {}, (m) => mensajes.push(m), async (ref, datos) => { escrito.push(datos); }, () => 'ref', {}, { nombre: 'x' }, () => {}, () => {});
    await fn();
    return { escrito, mensajes };
  }

  it('con el radio inicial o el ampliado en 0 (campo borrado) no escribe nada y dice cuál', async () => {
    const r1 = await guardar({ radioBusquedaInicial: 0, radioBusquedaAmpliado: 7 });
    assert.strictEqual(r1.escrito.length, 0);
    assert.match(r1.mensajes.join(' '), /inicial.*mayor que 0/);
    const r2 = await guardar({ radioBusquedaInicial: 3, radioBusquedaAmpliado: 0 });
    assert.strictEqual(r2.escrito.length, 0);
    assert.match(r2.mensajes.join(' '), /ampliado.*mayor que 0/);
  });

  it('con radios buenos guarda como siempre', async () => {
    const r = await guardar({ radioBusquedaInicial: 3, radioBusquedaAmpliado: 7, comisionTaxi: 800 });
    assert.strictEqual(r.escrito.length, 1);
    assert.strictEqual(r.escrito[0].comisionTaxi, 800);
  });
});

describe('G04 · el medidor', () => {
  it('con las reglas de ANTES cuenta el aviso falso; con las de HOY (sacadas de los archivos), cero', () => {
    const viajes = [{ id: 'v1', tipo: 'Mototaxi', radioBusqueda: 3, pasajeroLat: 11.544, pasajeroLng: -72.907 },
      { id: 'v2', tipo: 'Taxi', radioBusqueda: 0, pasajeroLat: 11.544, pasajeroLng: -72.907 }];
    const conductores = [{ id: 'c1', tipoVehiculo: 'Taxi', ubicacion: { lat: 11.562, lng: -72.907 } },
      { id: 'c2', tipoVehiculo: 'Taxi', ubicacion: { lat: 11.589, lng: -72.907 } }];
    const antes = medir(viajes, conductores, ANTES);
    assert.strictEqual(antes.avisoFalso.length, 1, 'el mototaxi le suena al taxista');
    assert.strictEqual(antes.mudo.length, 1, 'el viaje con radio 0 a 5 km: la lista lo enseña (7) y no suena (3)');
    const hoy = medir(viajes, conductores, reglasDeHoy());
    assert.strictEqual(hoy.avisoFalso.length, 0);
    assert.strictEqual(hoy.mudo.length, 0);
    assert.deepStrictEqual(hoy.radios, { '3 km': 1, 'radio 0': 1 });
  });
});
