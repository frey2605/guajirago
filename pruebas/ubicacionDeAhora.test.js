/**
 * «DAME MI UBICACIÓN DE AHORA» — la de los DOS botones de emergencia (G05, 27-sep-2026)
 *
 * Tres cosas, y las tres EJECUTANDO el código de verdad:
 *   1. la función de `guajirago/src/ubicacionDeAhora.js`, con un teléfono de mentira:
 *      contesta, se queda mudo, niega, revienta… y el mensaje nunca espera más del tope;
 *   2. la regla del respaldo del GPS (`elRespaldoDelGps`, de `pruebas/cargar.cjs`), la MISMA
 *      que juzga a las pantallas del pasajero y del conductor: no se escribe otra;
 *   3. los dos botones de verdad, sacados de su archivo y corridos por
 *      `scripts/medir-ubicacion-panico.cjs`: ninguno puede volver a mandar como «Mi ubicación»
 *      un sitio que no es el de ahora. El recorrido vive en el guion; aquí se IMPORTA.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { cargarDeLaApp, leer, soloCodigo, cuerpoDeLaFuncion, elRespaldoDelGps } = require('./cargar.cjs');
const { medir, seAvisaSiBloquean } = require('../scripts/medir-ubicacion-panico.cjs');

const ARCHIVO = 'guajirago/src/ubicacionDeAhora.js';
const { ubicacionDeAhora, TOPE_UBICACION_MS } = cargarDeLaApp(ARCHIVO);

const AHORA = { lat: 11.5010, lng: -72.8700 };
const CARRO = { lat: 11.5012, lng: -72.8702 };
const VIEJA = { lat: 11.5444, lng: -72.9072 };

/** Un teléfono de mentira. `respuestas` dice qué hace cada intento: 'bien', 'mal', 'mudo' o 'revienta'. */
function telefono(...respuestas) {
  const pedidos = [];
  return {
    pedidos,
    geolocation: {
      getCurrentPosition: (bien, mal, opts) => {
        const que = respuestas[pedidos.length] || 'mudo';
        pedidos.push(opts || {});
        if (que === 'revienta') throw new Error('el navegador no deja');
        if (que === 'bien') setTimeout(() => bien({ coords: { latitude: AHORA.lat, longitude: AHORA.lng } }), 5);
        if (que === 'mal') setTimeout(() => mal({ code: 3, message: 'timeout' }), 5);
      },
    },
  };
}

describe('UBICACIÓN DE AHORA · la función', () => {
  it('EL QUE MUERDE · si el GPS contesta, va la de AHORA, no el respaldo', async () => {
    const r = await ubicacionDeAhora([{ punto: VIEJA, de: 'ultima' }], 1000, telefono('bien'));
    assert.deepStrictEqual(r, { punto: AHORA, de: 'ahora' });
  });

  it('si el satélite no aparece y el wifi sí (bajo techo), llega por el segundo intento', async () => {
    const tel = telefono('mal', 'bien');
    const r = await ubicacionDeAhora([], 1000, tel);
    assert.deepStrictEqual(r, { punto: AHORA, de: 'ahora' });
    assert.strictEqual(tel.pedidos.length, 2);
  });

  it('EL QUE MUERDE · si el GPS no contesta NUNCA, el mensaje no espera: a los `tope` ms sale con el respaldo', async () => {
    const t0 = Date.now();
    const r = await ubicacionDeAhora([{ punto: CARRO, de: 'carro' }], 80, telefono('mudo'));
    const ms = Date.now() - t0;
    assert.deepStrictEqual(r, { punto: CARRO, de: 'carro' });
    assert.ok(ms < 1000, 'esperó ' + ms + ' ms con un tope de 80: el tope no está mandando.');
  });

  it('si el GPS dice que no, sale YA con el respaldo, sin esperar al tope', async () => {
    const t0 = Date.now();
    const r = await ubicacionDeAhora([{ punto: VIEJA, de: 'ultima' }], 5000, telefono('mal', 'mal'));
    assert.deepStrictEqual(r, { punto: VIEJA, de: 'ultima' });
    assert.ok(Date.now() - t0 < 1000, 'con el GPS negado se quedó esperando el tope entero.');
  });

  it('EL QUE MUERDE · los respaldos van EN ORDEN, y uno sin punto se salta', async () => {
    const r = await ubicacionDeAhora([{ punto: null, de: 'carro' }, { punto: VIEJA, de: 'ultima' }], 5000, telefono('mal', 'mal'));
    assert.deepStrictEqual(r, { punto: VIEJA, de: 'ultima' });
    const r2 = await ubicacionDeAhora([{ punto: CARRO, de: 'carro' }, { punto: VIEJA, de: 'ultima' }], 5000, telefono('mal', 'mal'));
    assert.deepStrictEqual(r2, { punto: CARRO, de: 'carro' });
  });

  it('sin GPS y sin respaldo, contesta «ninguna» (y el mensaje dice que no la tiene): nunca se inventa un punto', async () => {
    assert.deepStrictEqual(await ubicacionDeAhora([], 5000, telefono('mal', 'mal')), { punto: null, de: 'ninguna' });
    assert.deepStrictEqual(await ubicacionDeAhora(undefined, 5000, {}), { punto: null, de: 'ninguna' });
    assert.deepStrictEqual(await ubicacionDeAhora([{ punto: VIEJA, de: 'ultima' }], 5000, null), { punto: VIEJA, de: 'ultima' });
  });

  it('EL QUE MUERDE · si el navegador REVIENTA al pedir el GPS, el mensaje sale igual, y YA', async () => {
    // El tiempo se mide a propósito: sin el `catch`, el tope rescata el mensaje igual… pero a los 5 s. El sabotaje
    // del 27-sep-2026 quitó el `respaldo()` del catch y esta prueba seguía verde porque solo miraba el resultado.
    const t0 = Date.now();
    const r = await ubicacionDeAhora([{ punto: VIEJA, de: 'ultima' }], 5000, telefono('revienta'));
    assert.deepStrictEqual(r, { punto: VIEJA, de: 'ultima' });
    assert.ok(Date.now() - t0 < 1000, 'con el navegador reventando, el mensaje se quedó esperando el tope entero.');
  });

  it('una respuesta TARDÍA del GPS no cambia lo que ya se contestó', async () => {
    let tarde;
    const tel = { geolocation: { getCurrentPosition: (bien) => { tarde = bien; } } };
    const r = await ubicacionDeAhora([{ punto: VIEJA, de: 'ultima' }], 30, tel);
    tarde({ coords: { latitude: AHORA.lat, longitude: AHORA.lng } });
    assert.deepStrictEqual(r, { punto: VIEJA, de: 'ultima' });
  });

  it('EL QUE MUERDE · el tope cabe en la ventana en que el navegador deja abrir WhatsApp (5 s tras el toque)', () => {
    assert.ok(Number.isFinite(TOPE_UBICACION_MS) && TOPE_UBICACION_MS > 0, 'el tope no es un número');
    assert.ok(TOPE_UBICACION_MS < 5 * 1000,
      'el tope es de ' + TOPE_UBICACION_MS + ' ms. Los navegadores solo dejan abrir otra ventana unos 5 s después del '
      + 'toque: con más, WhatsApp se puede quedar sin abrir en plena emergencia. Y la persona está esperando.');
  });
});

describe('UBICACIÓN DE AHORA · cumple la regla del respaldo del GPS (la misma de las otras pantallas)', () => {
  it('EL QUE MUERDE · primero el punto bueno, respaldo más fácil, acepta la guardada, llega bajo techo, y cabe en el tope', () => {
    const r = elRespaldoDelGps(leer(ARCHIVO), 'export function ubicacionDeAhora');
    assert.ok(!r.falla, r.falla);
    assert.ok(r.elPrimeroPideElBueno, 'el primer intento no pide precisión alta: quien está en la calle recibe el aproximado.');
    assert.ok(r.ningunRespaldoPideMas, 'el respaldo pide MÁS que el intento que falló (satélite bajo techo).');
    assert.ok(r.todosAceptanGuardada, 'algún intento no acepta una posición que el aparato ya tiene (`maximumAge: 0`).');
    assert.ok(r.bajoTechoLlega, 'bajo techo (sin satélite, con wifi) la ubicación no llega.');
    assert.ok(r.silencioTotal <= TOPE_UBICACION_MS,
      'los intentos suman ' + r.silencioTotal + ' ms y el tope es ' + TOPE_UBICACION_MS + ': el segundo intento '
      + 'nunca llegaría a contestar antes de que el tope lo corte.');
  });
});

describe('LOS DOS BOTONES DE EMERGENCIA · piden la ubicación AL TOCAR', () => {
  it('EL QUE MUERDE · ninguno manda como «Mi ubicación» un sitio que no es el de ahora, y ninguno se hace esperar', async () => {
    const v = await medir(null);
    assert.deepStrictEqual(v.fallos, [], 'el medidor no pudo correr estos botones, así que lo que diga de ellos no vale.');
    assert.strictEqual(v.total, 9, 'el medidor corre ' + v.total + ' casos y el 27-sep-2026 corría 9.');
    const mal = v.salidas.filter((s) => !s.bien).map((s) => s.boton.nombre + ' ' + s.fase + ' · GPS ' + s.como + ' → '
      + s.r.punto + ' «' + s.r.etiqueta + '» en ' + s.r.ms + ' ms');
    assert.deepStrictEqual(mal, [],
      'estos casos no mandan lo que tienen que mandar (G05):\n   · ' + mal.join('\n   · ')
      + '\n   El familiar recibiría un sitio viejo como si fuera el de ahora, o el mensaje se haría esperar.');
    const aCiegas = v.salidas.filter((s) => s.r.aCiegas && s.r.aCiegas.length)
      .map((s) => s.boton.nombre + ': ' + s.r.aCiegas.join(', '));
    assert.deepStrictEqual([...new Set(aCiegas)], [],
      'el medidor tuvo que rellenar a ciegas nombres que el botón usa; lo que midió puede no ser lo que pasa.');
  });

  it('EL QUE MUERDE · si el navegador no deja abrir WhatsApp (pasó rato desde el toque), los dos lo DICEN', async () => {
    const b = await seAvisaSiBloquean(null);
    assert.deepStrictEqual(b, { 'el 🚨 del mapa': true, 'Ajustes → Seguridad': true },
      'con WhatsApp bloqueado por el navegador, algún botón se queda callado: la persona cree que el mensaje salió '
      + 'y no salió. Ahora hay una espera antes de abrir (el GPS), y eso lo hace posible.');
  });

  it('y ninguno de los dos pide el GPS por su cuenta: los dos pasan por ubicacionDeAhora', () => {
    for (const [archivo, funcion] of [['guajirago/src/Seguridad.js', 'const compartirUbicacion'], ['guajirago/src/Solicitar.js', 'const compartirSeguridad']]) {
      const t = soloCodigo(leer(archivo));
      assert.match(t, /import\s*\{[^}]*\bubicacionDeAhora\b[^}]*\}\s*from\s*['"]\.\/ubicacionDeAhora['"]/,
        archivo + ' no importa `ubicacionDeAhora`: la ubicación del mensaje de emergencia vuelve a salir de otro sitio.');
      const cuerpo = cuerpoDeLaFuncion(t, t.indexOf(funcion));
      assert.ok(cuerpo, 'no encuentro «' + funcion + '» en ' + archivo);
      assert.ok(!/navigator\.geolocation/.test(cuerpo.texto),
        '«' + funcion + '» vuelve a pedir el GPS por su cuenta: una segunda versión de «dame mi ubicación de ahora».');
    }
    // Y la pantalla de Ajustes ya no la pide al abrir: esa era la ubicación vieja.
    assert.ok(!/navigator\.geolocation/.test(soloCodigo(leer('guajirago/src/Seguridad.js'))),
      'Seguridad.js vuelve a pedir el GPS al abrir la pantalla. El mensaje mandaría ESA, aunque se apriete mucho después.');
  });
});
