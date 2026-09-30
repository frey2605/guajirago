/**
 * ¿QUIÉN ES EL CONDUCTOR QUE LLEVA ESTE VIAJE? — la tarjeta del conductor, sacada de SU FICHA (pendiente P03, 30-sep-2026).
 *
 * `confirmarConductor` pone al conductor en el viaje, y hasta P03 copiaba su nombre, teléfono, placa, vehículo, foto y
 * color de la OFERTA (`viajes/{id}/contraofertas/{uid}`), que la escribe el teléfono del conductor con lo que él quiera.
 * Esa tarjeta es la que ve el pasajero para saber a qué carro subirse, y la que va en el MENSAJE DE EMERGENCIA
 * (mensajeEmergencia.js). Ahora sale de la ficha `usuarios/{uid}` del conductor —la que llena el alta del conductor y
 * corrige el panel—, con la MISMA receta con que la app arma la oferta honrada (App.js `datosDeLaFicha` y
 * AppConductor.js): así, con una oferta honrada el viaje queda idéntico, y con una mentirosa lleva la ficha.
 *
 * Lo que la ficha no tenga NO se toma de la oferta: se queda vacío (el nombre, «Conductor», como ya hacía la app). Un
 * dato que nadie puede comprobar no debe llegarle al pasajero, ni a su familia en una emergencia, como si fuera cierto.
 *
 * Las claves son `CAMPOS_DEL_CONDUCTOR` de guajirago/src/conductorDelViaje.js menos `conductorId` (G59), y
 * `telefonoDe` / `fotoDe` son COPIAS de guajirago/src/telefonoUsuario.js (G08) y fotoUsuario.js (G43): la nube no
 * puede importar la app. Las ata pruebas/tarjetaDelConductor.test.js, que ejecuta las dos con las mismas fichas.
 */
function telefonoDe(ficha) {
  if (!ficha) return '';
  return ficha.telefono || ficha.celular || '';
}

function fotoDe(ficha) {
  if (!ficha) return null;
  return ficha.fotoConductor || ficha.foto || null;
}

function tarjetaDelConductor(ficha) {
  const f = ficha || {};
  return {
    conductorNombre: f.nombre || 'Conductor',
    conductorTelefono: telefonoDe(f),
    conductorPlaca: f.placa || '',
    conductorVehiculo: f.vehiculo || '',
    conductorFoto: fotoDe(f),
    conductorColor: f.color || '',
  };
}

module.exports = { tarjetaDelConductor, telefonoDe, fotoDe };
