/**
 * EL DOCUMENTO DEL VIAJE NUEVO — PRUEBAS DEL CONTRATO
 *
 * armarViajeNuevo escribe los campos que leen la app del conductor, el servidor
 * y las reglas. Aquí se comprueba el documento ENTERO, campo por campo, con
 * deepStrictEqual: si un campo se renombra, desaparece o cambia de forma, esto
 * se pone rojo ANTES de que el conductor deje de ver viajes en silencio.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// El cargador vive en cargar.cjs: un solo sitio para todas las pruebas (SEGUNDA LEY).
const { RAIZ, cargarDeLaApp } = require('./cargar.cjs');

const { armarViajeNuevo } = cargarDeLaApp('guajirago/src/viajeNuevo.js');
const { ESTADOS_MERCADO } = cargarDeLaApp('guajirago/src/estadosViaje.js');

// Datos fijos para que el documento salga siempre igual.
const RELOJ = new Date('2026-08-23T15:00:00.000Z');
const PEDIDO = {
  user: { uid: 'pasajera-1', email: 'ella@correo.com' },
  nombrePasajero: 'Erika',
  coords: { lat: 11.5444, lng: -72.9072 },
  tipo: 'Taxi',
  origen: 'Calle 15',
  destino: 'Aeropuerto',
  tarifa: 10000,
  datosDescuento: null,
  radioBusqueda: 3,
};

describe('SEGUNDA LEY · el documento del viaje se arma en un solo sitio', () => {
  it('el documento ENTERO, campo por campo — el contrato con el conductor y el servidor', () => {
    assert.deepStrictEqual(armarViajeNuevo(PEDIDO, RELOJ), {
      pasajeroId: 'pasajera-1',
      pasajeroEmail: 'ella@correo.com',
      pasajeroNombre: 'Erika',
      tieneCodigo: true,             // el aviso; el código va al cajón privado (REGLA 11)
      pasajeroLat: 11.5444,          // el servidor avisa a los conductores cercanos con esto
      pasajeroLng: -72.9072,
      tipo: 'Taxi',
      origen: 'Calle 15',
      destino: 'Aeropuerto',
      estado: 'esperando',
      tarifa: `$${(10000).toLocaleString()}`,  // la que se ENSEÑA
      tarifaValor: 10000,                      // la que se CALCULA (AppConductor)
      fechaSolicitud: '2026-08-23T15:00:00.000Z',
      radioBusqueda: 3,
    });
  });

  it('nace con la tarifa COMPLETA aunque haya descuento: lo del pasajero va aparte', () => {
    const conDescuento = armarViajeNuevo({
      ...PEDIDO,
      datosDescuento: { tarifaOriginal: 10000, tarifaPasajeroPaga: 2000, descuentoAplicado: 8000, consumido: false },
    }, RELOJ);
    // El conductor ve y recibe la tarifa completa...
    assert.strictEqual(conDescuento.tarifaValor, 10000);
    assert.strictEqual(conDescuento.tarifa, `$${(10000).toLocaleString()}`);
    // ...y lo que el pasajero paga de menos viaja en su propia ficha.
    assert.strictEqual(conDescuento.descuentoInfo.tarifaPasajeroPaga, 2000);
  });

  it('sin descuento NO existe el campo descuentoInfo (ni siquiera vacío)', () => {
    // Un descuentoInfo:null pondría a AppConductor a preguntar por un descuento
    // que no hay cada vez que finaliza un viaje.
    assert.ok(!('descuentoInfo' in armarViajeNuevo(PEDIDO, RELOJ)));
  });

  it('el paquete de mensajería entra por extras, y sin extras no deja rastro', () => {
    const mandado = armarViajeNuevo({
      ...PEDIDO,
      tipo: 'Mensajería',
      extras: { mensajeria: { queEnvia: 'Documentos', recibeNombre: 'Luis', recibeTel: '3001234567', nota: 'Timbrar' } },
    }, RELOJ);
    assert.deepStrictEqual(mandado.mensajeria, { queEnvia: 'Documentos', recibeNombre: 'Luis', recibeTel: '3001234567', nota: 'Timbrar' });
    assert.ok(!('mensajeria' in armarViajeNuevo(PEDIDO, RELOJ)), 'un taxi no debe llevar campos de mensajería');
    assert.ok(!('extras' in mandado), '«extras» es el sobre, no un campo: no debe quedar escrito en el viaje');
  });

  it('NACE DENTRO DEL MERCADO: su estado es de los que las reglas dejan ver a los conductores', () => {
    // El amarre con estadosViaje.js. Si un día el viaje naciera en un estado que
    // no está en la lista del mercado, ningún conductor lo vería y no habría
    // error: solo pasajeros esperando un taxi que jamás se entera de que existen.
    const nace = armarViajeNuevo(PEDIDO, RELOJ).estado;
    assert.ok(ESTADOS_MERCADO.includes(nace),
      'el viaje nace en «' + nace + '», que NO está en el mercado (' + ESTADOS_MERCADO.join(', ') + ')');
  });

  it('el código de seguridad JAMÁS va dentro del documento (REGLA 11)', () => {
    const documento = armarViajeNuevo({
      ...PEDIDO,
      // Aunque alguien lo cuele en el pedido, el documento no lo debe copiar:
      // el armado solo escribe los campos del contrato, no lo que le llegue.
      codigoSeguridad: '1234',
    }, RELOJ);
    assert.ok(!('codigoSeguridad' in documento),
      'el documento lleva codigoSeguridad: eso lo leía cualquiera que mirase el mercado');
    assert.strictEqual(documento.tieneCodigo, true, 'el aviso tieneCodigo sí debe ir');
  });

  it('NINGUNA pantalla arma el documento por su cuenta', () => {
    const PANTALLAS = ['guajirago/src/Solicitar.js', 'guajirago/src/SolicitarMensajeria.js'];
    for (const pantalla of PANTALLAS) {
      const fuente = fs.readFileSync(path.join(RAIZ, pantalla), 'utf8');
      assert.ok(!fuente.includes('pasajeroId: user.uid'),
        pantalla + ' volvió a armar el documento del viaje a mano. Eso vive en viajeNuevo.js.');
      assert.ok(/from\s+'\.\/viajeNuevo'/.test(fuente),
        pantalla + ' no está importando viajeNuevo.js.');
    }
  });
});
