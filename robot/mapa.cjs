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
    nombre: 'contacto-emergencia',
    que: 'Seguridad no guarda un contacto de emergencia que no sirve («300 123 45») y dice por qué (G10)',
    archivo: 'contacto-emergencia.cjs',
    // Login.js también usa la regla, pero probarlo pide crear una cuenta nueva: lo cubre registrar-conductor.
    vigila: ['guajirago/src/Seguridad.js', 'guajirago/src/telefonoValido.js'],
  },
  {
    nombre: 'fecha-reserva',
    que: 'la agencia ve la reserva de turismo el mismo día que la pidió el cliente, no el anterior (G11; escribe una reserva de mentira en la base de pruebas y la cancela)',
    archivo: 'fecha-reserva.cjs',
    // guajirago/src/Turismo.js también usa la pieza («Mis reservas» del cliente), pero verla pide reservar desde la
    // app: la cubre la prueba de Node (pruebas/fechaCalendario.test.js), que corre las dos pantallas.
    vigila: ['guajirago-aliados/src/ReservasTurismo.js', 'guajirago-aliados/src/fechaCalendario.js'],
  },
  {
    nombre: 'promo-asignar',
    que: 'el panel no asigna una promoción vencida (ventanita) y el servidor no deja canjear una que pide viajes previos a quien no los tiene (G12; crea dos promociones de mentira en pruebas y las apaga)',
    archivo: 'promo-asignar.cjs',
    vigila: ['guajirago-admin/src/Promociones.js', 'guajirago-admin/src/reglaPromocion.js',
      'guajirago/src/Promociones.js', 'guajirago/src/reglaPromocion.js'],
  },
  {
    nombre: 'uso-promo',
    que: 'asignar en el panel una promoción de crédito suma sus pesos al «Invertido» (1 uso, $1.000), y una de porcentaje no se asigna ni suma (G17; crea dos promociones de mentira en pruebas, devuelve el saldo y las apaga)',
    archivo: 'uso-promo.cjs',
    // La analítica del servidor (consumirDescuentoViaje) pide un viaje con código verificado por el conductor: la
    // EJECUTA pruebas/reglaPromocion.test.js y la corre de verdad pruebas/funciones.test.js con el emulador.
    vigila: ['guajirago-admin/src/Promociones.js', 'guajirago-admin/src/reglaPromocion.js', 'guajirago/functions/promociones.cjs'],
  },
  {
    nombre: 'vigencia-promo',
    que: 'una promoción que dura solo HOY sale vigente en la app y en «Activas» del panel, y las dos pintan el día de hoy, no el de ayer (G16; crea una promoción de mentira en pruebas y la apaga)',
    archivo: 'vigencia-promo.cjs',
    // Anuncio.js, Restaurantes.js (promos de restaurante) y Superadmin.js usan la misma regla, y la hora que importa
    // (las 7 de la noche) no se puede mover en el navegador: los EJECUTA pruebas/vigenciaHoy.test.js en cuatro zonas.
    vigila: ['guajirago/src/Promociones.js', 'guajirago/src/reglaPromocion.js', 'guajirago/src/fechaCalendario.js',
      'guajirago-admin/src/Promociones.js', 'guajirago-admin/src/reglaPromocion.js', 'guajirago-admin/src/fechaCalendario.js'],
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
    nombre: 'precio-viaje',
    que: 'un teléfono en inglés pide un taxi y el viaje guarda el precio con cop() («$ 10.000»), no con su idioma (G13; deja un viaje cancelado en pruebas)',
    archivo: 'precio-viaje.cjs',
    // La nueva oferta del pasajero (Solicitar.js) y la oferta del conductor (AppConductor.js) usan el mismo cop(), pero
    // probarlas pide un conductor ofertando en vivo: NO las cubre este recorrido. Las cubre pruebas/tarifaTexto.test.js.
    vigila: ['guajirago/src/viajeNuevo.js', 'guajirago/src/moneda.js'],
  },
  {
    nombre: 'pesos-panel',
    que: 'el panel con el navegador en inglés escribe la plata con cop() («$ 125.500»), no a mano («$125,500»), en Superadmin → Ingresos reales y Control de créditos (G14; solo lee)',
    archivo: 'pesos-panel.cjs',
    // Las demás pantallas del panel y de transporte que pasaron a cop() (Viajes, Códigos, Ganancias…) NO las recorre:
    // las cubre pruebas/formateoPesos.test.js, que cuenta los formateos a mano en las tres apps y el servidor.
    vigila: ['guajirago-admin/src/Superadmin.js', 'guajirago-admin/src/moneda.js'],
  },
  {
    nombre: 'ganancias-panel',
    que: 'el tablero del panel («GANANCIAS HOY») y 👑 Superadmin → «Ingresos reales» dicen la misma ganancia, y la nota enseña las comisiones de config/global (G15; solo lee)',
    archivo: 'ganancias-panel.cjs',
    // En pruebas no hay viajes finalizados hoy y config/global trae 300/800/1000 (los mismos del respaldo): la cuenta
    // con viajes de verdad y con otra config la EJECUTA pruebas/gananciasTablero.test.js.
    vigila: ['guajirago-admin/src/App.js', 'guajirago-admin/src/Superadmin.js', 'guajirago-admin/src/comisiones.js'],
  },
  {
    nombre: 'placa-fresca',
    que: 'el admin corrige la placa del taxista en su ficha y, con la copia del teléfono puesta, la app enseña y manda la placa nueva (mira la base de pruebas) (G09)',
    archivo: 'placa-fresca.cjs',
    vigila: ['guajirago/src/App.js'],
  },
  {
    nombre: 'bienvenida-pasajero',
    que: 'crear una cuenta de pasajero: la celebración enseña el crédito que dio el servidor ($ 8.000) y la ficha lleva el descuento firmado por el servidor (G18; crea una cuenta nueva en pruebas)',
    archivo: 'bienvenida-pasajero.cjs',
    // «Una sola vez por persona y por aparato» y «el teléfono no pide el valor» los EJECUTA pruebas/funciones.test.js
    // (G18 · descuentoDeBienvenida) con el emulador: aquí cada cuenta es nueva y el navegador también.
    vigila: ['guajirago/src/Login.js'],
  },
  {
    nombre: 'valor-viaje-panel',
    que: 'el panel enseña lo que valió el viaje (tarifaValor $ 10.000) y no la oferta vieja (contraofertaValor $ 11.000) (G19; usa un solo viaje de mentira en pruebas)',
    archivo: 'valor-viaje-panel.cjs',
    // Las sumas (Conductores, Pasajeros, Mensajería, el historial y Ganancias del conductor) piden viajes finalizados:
    // esas las EJECUTA pruebas/valorViaje.test.js.
    vigila: ['guajirago-admin/src/Viajes.js', 'guajirago-admin/src/valorViaje.js'],
  },
  {
    nombre: 'viaje-cerrado',
    que: 'el servidor cierra (expirado) el viaje en curso del pasajero: le sale la ventanita «Este viaje ya se cerró» con el porqué, «Entendido» la cierra y «Volver al inicio» lo lleva al inicio (G20)',
    archivo: 'viaje-cerrado.cjs',
    // El lado del conductor (AppConductor.js) pide un viaje confirmado por confirmarConductor: este recorrido NO lo
    // cubre, y por eso AppConductor.js no se nombra aquí; lo EJECUTA pruebas/viajeCerrado.test.js.
    vigila: ['guajirago/src/estadosViaje.js', 'guajirago/src/Solicitar.js'],
  },
  {
    nombre: 'historial-viajes',
    que: 'las dos pantallas «Mis viajes» del pasajero (menú de módulos y menú de transporte) enseñan también los viajes que no se completaron, en palabras (G21; solo mira)',
    archivo: 'historial-viajes.cjs',
    // El historial del CONDUCTOR (AppConductor.js) usa la misma pieza, pero verlo pide entrar como conductor con viajes
    // terminados: lo EJECUTA el amarre «EL HISTORIAL DEL CONDUCTOR» de pruebas/amarres.test.js, y por eso no se nombra.
    vigila: ['guajirago/src/Home.js', 'guajirago/src/MisViajes.js', 'guajirago/src/estadosViaje.js'],
  },
  {
    nombre: 'ganancias-conductor',
    que: 'la app del conductor: «Ganancias» y el recuadro «GANANCIAS DE HOY» de «Mis viajes» abren con la consulta de gananciasConductor.js sin error y dicen la misma cifra (G23; solo mira)',
    archivo: 'ganancias-conductor.cjs',
    // La SUMA con viajes de verdad no la puede ver: un viaje con conductor solo lo escribe el servidor y el taxista de
    // prueba no tiene ninguno. La EJECUTA pruebas/gananciasHoy.test.js contra un Firestore de mentira.
    vigila: ['guajirago/src/Ganancias.js', 'guajirago/src/gananciasConductor.js'],
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
