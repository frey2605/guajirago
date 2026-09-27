// ─────────────────────────────────────────────────────────────────────────────
// LOS DOCUMENTOS DEL CONDUCTOR — una sola lista, para el registro y para el panel.
//
// Decisión del dueño (27-sep-2026): «no quiero ponerle trabas a los conductores al
// comenzar». El conductor SUBE las fotos al registrarse y trabaja de una vez; nadie
// tiene que aprobarlo antes. El dueño las revisa en el panel cuando pueda, y si algo no
// cuadra lo inhabilita con lo que el panel ya tiene. Pidió la cédula, la tarjeta de
// propiedad del vehículo y CUATRO fotos del vehículo: cada costado, de frente y por
// detrás, las dos últimas con la placa a la vista. (La licencia de conducción se pidió
// y se quitó el mismo día: «quiero quitar el tema de la licencia de conducción».)
//
// El registro (App.js) y el panel (guajirago-admin, otro repo, con una copia atada byte
// a byte por pruebas/documentosConductor.test.js) salen de AQUÍ: el nombre del campo que
// escribe uno es el que lee el otro, y si se separaran el panel enseñaría huecos.
//
// Sin imports a propósito: así las pruebas lo cargan tal cual (pruebas/cargar.cjs).
// ─────────────────────────────────────────────────────────────────────────────

// `campo`: dónde queda la dirección de la foto en usuarios/{uid}. `carpeta`: el nombre
// del archivo en el almacén (conductores/{uid}/…). `cedula` y `fotoCedula` ya existían
// antes de esta lista y se conservan tal cual: cambiarlos dejaría sin foto a los que ya
// se registraron.
export const DOCUMENTOS_CONDUCTOR = Object.freeze([
  Object.freeze({ campo: 'fotoCedula', carpeta: 'cedula', icono: '🪪', nombre: 'Cédula' }),
  Object.freeze({ campo: 'fotoTarjetaPropiedad', carpeta: 'tarjeta_propiedad', icono: '📑', nombre: 'Tarjeta de propiedad del vehículo' }),
  Object.freeze({ campo: 'fotoVehiculoIzquierdo', carpeta: 'vehiculo_izquierdo', icono: '🚘', nombre: 'Vehículo, costado izquierdo' }),
  Object.freeze({ campo: 'fotoVehiculoDerecho', carpeta: 'vehiculo_derecho', icono: '🚘', nombre: 'Vehículo, costado derecho' }),
  Object.freeze({ campo: 'fotoVehiculoFrente', carpeta: 'vehiculo_frente', icono: '🚘', nombre: 'Vehículo de frente, con la placa', nombreMoto: 'Vehículo de frente' }),
  Object.freeze({ campo: 'fotoVehiculoAtras', carpeta: 'vehiculo_atras', icono: '🚘', nombre: 'Vehículo por detrás, con la placa' }),
]);

// El nombre que se enseña. Las motos solo llevan placa atrás, así que al mototaxi no se
// le pide la placa en la foto de frente.
export function nombreDelDocumento(d, tipoVehiculo) {
  return tipoVehiculo === 'Mototaxi' && d.nombreMoto ? d.nombreMoto : d.nombre;
}

// El primer documento que falta, o null si están todos. `fotos` es { campo: archivo }.
export function documentoQueFalta(fotos) {
  return DOCUMENTOS_CONDUCTOR.find((d) => !(fotos && fotos[d.campo])) || null;
}
