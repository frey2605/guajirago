// ─────────────────────────────────────────────────────────────────────────────
// ¿ESTA PLACA Y ESTE VEHÍCULO SIRVEN? — una sola respuesta (gemelo G45, 28-sep-2026).
//
// La placa y el vehículo del conductor se escribían en DOS sitios y no con la misma regla:
//   · el REGISTRO del conductor (App.js, PantallaDatosConductor) exigía 6 caracteres y
//     armaba el vehículo como «Marca Año» con dos listas (marca y año del modelo);
//   · la EDICIÓN del panel (guajirago-admin, Conductores.js) guardaba lo que se escribiera:
//     «AB 12», «ABC12345678» o un vehículo «hola», y además dejaba `marca` y `modelo` con
//     lo viejo mientras `vehiculo` decía otra cosa. El pasajero ve esa placa y ese vehículo
//     para saber a qué carro subirse.
//
// LA PLACA: 6 letras o números. En Colombia el taxi lleva «ABC123» y la moto «ABC12D»; aquí
// NO se exige ese dibujo exacto porque el registro nunca lo exigió y hay placas guardadas
// que no lo cumplen (lo cuenta scripts/medir-placa-vehiculo.cjs): la regla es la que el
// registro ya aplicaba —6 caracteres—, con dos cosas más que antes se colaban: los
// espacios, guiones y puntos se QUITAN («ABC-123» y «abc 123» son ABC123), y lo que no sea
// letra o número no sirve. Se guarda en MAYÚSCULAS y sin separadores: `placaLimpia` da esa
// forma, o '' si no sirve.
//
// EL VEHÍCULO: «Marca Año», como lo arma el registro (`vehiculoDe`). La marca es texto libre
// (el registro tiene la opción «Otra»); el año, de 1990 al año en curso, que es lo que ofrece
// la lista del registro. `datosDelVehiculo` lee un texto escrito a mano («chevrolet   2015»)
// y devuelve los TRES campos que se guardan juntos —vehiculo, marca y modelo—, o null si no
// sirve: así el panel no deja `marca` y `modelo` diciendo una cosa y `vehiculo` otra.
//
// 🔴 Lo que esto NO decide:
//   · el TIPO de vehículo (Taxi / Mototaxi) ni sus documentos → documentosConductor.js;
//   · el teléfono del conductor → telefonoValido.js (G42) y telefonoUsuario.js (G08).
// Lo ya guardado NO se cambió: lo cuenta scripts/medir-placa-vehiculo.cjs.
//
// El panel (guajirago-admin) es un repo APARTE y no puede importar de aquí: tiene una copia
// IDÉNTICA de este archivo, atada byte a byte por pruebas/placaVehiculo.test.js. Se cambia
// aquí primero y se copia igual.
//
// Sin imports a propósito: así las pruebas lo cargan y lo ejecutan tal cual está en el
// disco (pruebas/cargar.cjs).
// ─────────────────────────────────────────────────────────────────────────────

export const PRIMER_ANIO_MODELO = 1990;

export function placaLimpia(texto) {
  const sinSeparadores = String(texto == null ? '' : texto).toUpperCase().replace(/[\s.-]/g, '');
  return /^[A-Z0-9]{6}$/.test(sinSeparadores) ? sinSeparadores : '';
}

export function placaSirve(texto) {
  return placaLimpia(texto) !== '';
}

// Mientras se escribe: mayúsculas, sin separadores y hasta 6 (así «ABC-123» cabe entero).
export function placaMientrasEscribe(texto) {
  return String(texto == null ? '' : texto).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

export function vehiculoDe(marca, modelo) {
  return `${String(marca == null ? '' : marca).trim()} ${String(modelo == null ? '' : modelo).trim()}`;
}

export function datosDelVehiculo(texto, anioActual = new Date().getFullYear()) {
  const limpio = String(texto == null ? '' : texto).trim().replace(/\s+/g, ' ');
  const partes = limpio.match(/^(.+) (\d{4})$/);
  if (!partes) return null;
  const anio = Number(partes[2]);
  if (anio < PRIMER_ANIO_MODELO || anio > anioActual) return null;
  return { vehiculo: vehiculoDe(partes[1], partes[2]), marca: partes[1], modelo: partes[2] };
}

export function vehiculoSirve(texto, anioActual) {
  return datosDelVehiculo(texto, anioActual) !== null;
}
