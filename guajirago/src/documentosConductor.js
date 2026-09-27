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
  Object.freeze({ campo: 'fotoTarjetaPropiedad', carpeta: 'tarjeta_propiedad', icono: '📑', nombre: 'Tarjeta de propiedad del vehículo', nombreMoto: 'Tarjeta de propiedad de la moto' }),
  Object.freeze({ campo: 'fotoVehiculoIzquierdo', carpeta: 'vehiculo_izquierdo', icono: '🚘', nombre: 'Vehículo, costado izquierdo', nombreMoto: 'Moto, costado izquierdo' }),
  Object.freeze({ campo: 'fotoVehiculoDerecho', carpeta: 'vehiculo_derecho', icono: '🚘', nombre: 'Vehículo, costado derecho', nombreMoto: 'Moto, costado derecho' }),
  Object.freeze({ campo: 'fotoVehiculoFrente', carpeta: 'vehiculo_frente', icono: '🚘', nombre: 'Vehículo de frente, con la placa', nombreMoto: 'Moto de frente' }),
  Object.freeze({ campo: 'fotoVehiculoAtras', carpeta: 'vehiculo_atras', icono: '🚘', nombre: 'Vehículo por detrás, con la placa', nombreMoto: 'Moto por detrás, con la placa' }),
]);

// El dibujo del vehículo. (27-sep-2026, lo encontró el robot probador: al mototaxi todo le
// enseñaba un carro.) OJO: la misma elección «Taxi → 🚗, si no → 🏍️» está escrita a mano en
// otros 7 sitios de la app (AppConductor, Home, MisViajes, Calificacion, Solicitar); no se
// tocaron: es un gemelo anotado, y juntarlos es trabajo aparte.
export function iconoDelVehiculo(tipoVehiculo) {
  return tipoVehiculo === 'Mototaxi' ? '🏍️' : '🚗';
}

// El nombre que se enseña. Al mototaxi se le habla de «moto», y como las motos solo llevan
// placa atrás, no se le pide la placa en la foto de frente.
export function nombreDelDocumento(d, tipoVehiculo) {
  return tipoVehiculo === 'Mototaxi' && d.nombreMoto ? d.nombreMoto : d.nombre;
}

// El ícono de cada foto: las del vehículo llevan el dibujo de SU vehículo.
export function iconoDelDocumento(d, tipoVehiculo) {
  return d.icono === '🚘' && tipoVehiculo === 'Mototaxi' ? iconoDelVehiculo(tipoVehiculo) : d.icono;
}

// El primer documento que falta, o null si están todos. `fotos` es { campo: archivo }.
export function documentoQueFalta(fotos) {
  return DOCUMENTOS_CONDUCTOR.find((d) => !(fotos && fotos[d.campo])) || null;
}
