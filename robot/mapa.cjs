// ─────────────────────────────────────────────────────────────────────────────
// 🗺️ EL MAPA DEL ROBOT — qué recorrido prueba qué archivo.
//
// Cuando cambia un archivo, `robot/probar-cambio.cjs` busca aquí qué recorridos lo cubren y los
// corre. Los de `siempre` corren en cada cambio. Una pantalla que cambió y no está en ningún
// recorrido sale en el informe como «SIN RECORRIDO»: es la señal para que el agente probador le
// escriba el suyo y lo añada aquí. pruebas/elRobot.test.js comprueba que cada recorrido y cada
// archivo de este mapa existan.
// ─────────────────────────────────────────────────────────────────────────────
const RECORRIDOS = [
  {
    nombre: 'humo',
    que: 'las tres apps de pruebas abren, con su cartel y sin errores',
    archivo: 'humo.cjs',
    siempre: true,
    vigila: [],
  },
  {
    nombre: 'registrar-conductor',
    que: 'crear cuenta y registrarse como conductor con sus documentos',
    archivo: 'registrar-conductor.cjs',
    args: ['Taxi'],
    vigila: ['guajirago/src/App.js', 'guajirago/src/Login.js', 'guajirago/src/documentosConductor.js',
      'guajirago/src/firebase.js', 'guajirago/src/ambiente.js'],
  },
  {
    nombre: 'revisar-panel',
    que: 'el panel enseña los documentos del conductor',
    archivo: 'revisar-panel.cjs',
    args: ['Robot Taxi De Prueba'],
    vigila: ['guajirago-admin/src/Conductores.js', 'guajirago-admin/src/documentosConductor.js',
      'guajirago-admin/src/App.js', 'guajirago-admin/src/firebase.js'],
  },
  {
    nombre: 'crear-empleado',
    que: 'aliados crea un empleado (usa su segunda conexión, que también lleva el sello)',
    archivo: 'crear-empleado.cjs',
    vigila: ['guajirago-aliados/src/Empleados.js', 'guajirago-aliados/src/firebaseSecundario.js',
      'guajirago-aliados/src/firebase.js', 'guajirago-aliados/src/Login.js', 'guajirago-aliados/src/Configuracion.js'],
  },
  {
    nombre: 'sin-senal-aliados',
    que: 'aliados avisa cuando no podrá trabajar sin internet (dos pestañas)',
    archivo: 'sin-senal-aliados.cjs',
    vigila: ['guajirago-aliados/src/firebase.js', 'guajirago-aliados/src/index.js',
      'guajirago-aliados/src/AvisoSinSenal.js', 'guajirago-aliados/src/sinSenal.js', 'guajirago-aliados/src/AvisoModal.js'],
  },
  {
    nombre: 'conductor-en-turno',
    que: 'el conductor se pone disponible y el GPS escribe su posición sin borrarle el viaje en curso (mira la base de pruebas)',
    archivo: 'conductor-en-turno.cjs',
    vigila: ['guajirago/src/AppConductor.js', 'guajirago/src/Notificaciones.js'],
  },
  {
    nombre: 'radio-panel',
    que: 'el panel no deja guardar el radio de búsqueda en 0 y lo dice (mira la base de pruebas)',
    archivo: 'radio-panel.cjs',
    vigila: ['guajirago-admin/src/Superadmin.js'],
  },
  {
    nombre: 'ubicacion-emergencia',
    que: 'el mensaje de emergencia de Ajustes lleva la ubicación de AHORA y, sin GPS, sale a tiempo diciéndolo (G05)',
    archivo: 'ubicacion-emergencia.cjs',
    // Solicitar.js (el 🚨 del mapa) usa la misma función, pero probarlo pide un viaje en curso con conductor: NO lo
    // cubre este recorrido, y por eso no se nombra aquí (ver APRENDIDO.md).
    vigila: ['guajirago/src/Seguridad.js', 'guajirago/src/ubicacionDeAhora.js', 'guajirago/src/mensajeEmergencia.js'],
  },
  {
    nombre: 'candado-recarga',
    que: 'el candado de la ley del botón no se traba en el navegador: un código de recarga inventado dice «no existe» y el botón vuelve a quedar tocable, dos veces',
    archivo: 'candado-recarga.cjs',
    // El candado es el MISMO archivo en las tres apps; se prueba en transporte (Créditos), la que tiene un botón que
    // pasa por él y se puede tocar sin cambiar nada en la base.
    vigila: ['guajirago/src/candado.js', 'guajirago/src/useAccion.js', 'guajirago/src/Creditos.js',
      'guajirago-admin/src/candado.js', 'guajirago-aliados/src/candado.js'],
  },
  {
    nombre: 'cancelar-viaje',
    que: 'el pasajero pide un taxi, lo cancela y LEE los cinco motivos de «¿Por qué cancelas?» (color que pinta el navegador); el viaje queda cancelado con el motivo escogido (G06)',
    archivo: 'cancelar-viaje.cjs',
    // La ventanita es la misma para el conductor (AppConductor.js), pero probarla allí pide un viaje aceptado: este
    // recorrido NO lo cubre, y por eso AppConductor.js no se nombra aquí (ver APRENDIDO.md).
    vigila: ['guajirago/src/ModalCancelacion.js', 'guajirago/src/Solicitar.js', 'guajirago/src/textosViaje.js'],
  },
  {
    nombre: 'salir-por-el-menu',
    que: 'el conductor disponible sale por «☰ Menú → Cerrar sesión» y su ficha queda APAGADA (mira la base de pruebas) (G07)',
    archivo: 'salir-por-el-menu.cjs',
    // «Eliminar cuenta» (Configuracion.js) usa la misma salida, pero probarla borraría la cuenta de prueba: NO la cubre
    // este recorrido, y por eso Configuracion.js no se nombra aquí. La cubre pruebas/salirDeLaApp.test.js.
    vigila: ['guajirago/src/MenuLateral.js', 'guajirago/src/App.js', 'guajirago/src/AppConductor.js'],
  },
  {
    nombre: 'placa-fresca',
    que: 'el admin corrige la placa del taxista en su ficha y, con la copia del teléfono puesta, la app enseña y manda la placa nueva (mira la base de pruebas) (G09)',
    archivo: 'placa-fresca.cjs',
    vigila: ['guajirago/src/App.js'],
  },
];

// Los archivos de pantalla: los que, si cambian, el robot debería poder probar. Todo lo que esté en
// `src/` de las tres apps y no sea una prueba.
const esPantalla = (f) => /^guajirago(-admin|-aliados)?\/src\/[^/]+\.js$/.test(f) && !/\.test\.js$/.test(f);

/** Qué recorridos tocan por esta lista de archivos cambiados, y qué pantallas quedan sin ninguno. */
function queProbar(cambiados) {
  const tocan = RECORRIDOS.filter((r) => r.siempre || r.vigila.some((v) => cambiados.includes(v)));
  const cubiertos = new Set(RECORRIDOS.flatMap((r) => r.vigila));
  const sinRecorrido = cambiados.filter((f) => esPantalla(f) && !cubiertos.has(f));
  return { tocan, sinRecorrido };
}

module.exports = { RECORRIDOS, queProbar, esPantalla };
