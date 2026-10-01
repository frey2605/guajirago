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
      'guajirago/src/firebase.js', 'guajirago/src/ambiente.js',
      // G97: la caja de los campos de «Crear cuenta» y de los datos del conductor; este recorrido llena los dos.
      'guajirago/src/estiloCampo.js'],
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
    vigila: ['guajirago/src/AppConductor.js', 'guajirago/src/Notificaciones.js', 'guajirago/src/pedirGps.js', 'guajirago/src/alerta.js'],
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
    vigila: ['guajirago/src/Seguridad.js', 'guajirago/src/ubicacionDeAhora.js', 'guajirago/src/mensajeEmergencia.js',
      'guajirago/src/pedirGps.js'],
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
    // Busca a la persona por su documento («ROBOT-PASAJERO», con guion): pasa por la pieza de G79.
    vigila: ['guajirago-admin/src/Promociones.js', 'guajirago-admin/src/reglaPromocion.js',
      'guajirago/src/Promociones.js', 'guajirago/src/reglaPromocion.js', 'guajirago-admin/src/documentoUsuario.js'],
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
    nombre: 'texto-beneficio',
    que: 'una promoción sin tipo de beneficio (el cobro la trata como un 15 %) dice «15% de descuento» en la app y en «Activas» del panel, no «$ 15 de crédito» (G52; crea una promoción de mentira en pruebas y la apaga)',
    archivo: 'texto-beneficio.cjs',
    // El Superadmin, «Tienes un descuento activo de…» (Solicitar.js) y la lista de categorías usan la misma pieza: los
    // EJECUTA pruebas/textoBeneficio.test.js con scripts/medir-texto-beneficio.cjs.
    vigila: ['guajirago/src/Promociones.js', 'guajirago/src/reglaPromocion.js', 'guajirago/src/Solicitar.js',
      'guajirago-admin/src/Promociones.js', 'guajirago-admin/src/reglaPromocion.js', 'guajirago-admin/src/Superadmin.js',
      'guajirago/functions/promociones.cjs'],
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
    nombre: 'total-recargas',
    que: '🎟️ Códigos → «VALOR RECARGADO» es la cuenta única del panel (recargas.js) sobre los códigos de la base de pruebas, contando el cobrado y anulado (G54; crea dos códigos fijos si faltan)',
    archivo: 'total-recargas.cjs',
    // El tablero (App.js, 💰 Recargas) usa la misma pieza; sus gráficas no se leen aquí: la cuenta con fechas la
    // EJECUTA pruebas/totalRecargas.test.js.
    vigila: ['guajirago-admin/src/Codigos.js', 'guajirago-admin/src/recargas.js'],
  },
  {
    nombre: 'que-paso-panel',
    que: '📦 Mensajería y 🛣️ Viajes del panel dicen la MISMA palabra de cada final de un mandado («Lo canceló el repartidor», «Quedó sin terminar») y enseñan su porqué, también el del sistema (G56; deja dos mandados fijos en pruebas)',
    archivo: 'que-paso-panel.cjs',
    // Las tarjetas del historial de la app (AppConductor, Home, MisViajes) las EJECUTA pruebas/quePaso.test.js.
    vigila: ['guajirago-admin/src/Mensajeria.js', 'guajirago-admin/src/Viajes.js', 'guajirago-admin/src/estadosViaje.js'],
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
    // El marco de la celebración (fondo y confeti) es PantallaFiesta.js desde G80: cómo se ve lo PINTA pruebas/pantallasFiesta.test.js.
    vigila: ['guajirago/src/Login.js', 'guajirago/src/PantallaFiesta.js'],
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
    nombre: 'estados-panel',
    que: 'el buscador de 🛣️ Viajes del panel ofrece todos los estados («Con conductor», «Nadie lo tomó», «Quedó sin terminar») y encuentra un viaje expirado, y la ficha del pasajero lo cuenta en «❌ Cancelados» (G25; usa un solo viaje de mentira en pruebas)',
    archivo: 'estados-panel.cjs',
    // El tablero (App.js) y las cajas de Mensajería usan la misma copia; esas cuentas las EJECUTA
    // pruebas/estadosPanel.test.js viaje por viaje (Mensajería no cambió nada a la vista: 0 → 0 mandados mal).
    vigila: ['guajirago-admin/src/Viajes.js', 'guajirago-admin/src/Pasajeros.js', 'guajirago-admin/src/estadosViaje.js'],
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
    nombre: 'me-aceptaron',
    que: 'el pasajero acepta la oferta a los 12 min de pedir (con confirmarConductor, en la base de pruebas) y la app del conductor dice «¡Trato hecho!» y pasa a «YENDO A RECOGER» (G24)',
    archivo: 'me-aceptaron.cjs',
    vigila: ['guajirago/src/AppConductor.js', 'guajirago/src/estadosViaje.js', 'guajirago/src/TratoHecho.js'],
  },
  {
    nombre: 'sin-saldo-confirmar',
    que: 'con el taxista de prueba en 0 créditos: VE el viaje pero al aceptar o contraofertar sale «Te falta saldo» y la base niega la oferta escrita a mano; el pasajero acepta la oferta que dejó antes y ve «Este conductor no puede tomar el viaje ahora. Escoge otra oferta.»; la oferta sale, el viaje sigue libre y no se cobra nada (P04; le devuelve los créditos)',
    archivo: 'sin-saldo-confirmar.cjs',
    // Qué hace el servidor con cada saldo (de sobra, justo, de menos) lo EJECUTA pruebas/saldoAlConfirmar.test.js.
    vigila: ['guajirago/src/Solicitar.js', 'guajirago/src/avisoRechazo.js', 'guajirago/src/AppConductor.js', 'guajirago/src/textosViaje.js'],
  },
  {
    nombre: 'disponible-sin-saldo',
    que: 'con el taxista de prueba en 0 créditos: prende «Estoy disponible» sin ventanita, ve la franja «Te falta saldo» (texto de AVISO_SIN_SALDO) y el viaje del pasajero, al aceptar sale «Te falta saldo» y no queda oferta; tocar la franja abre «Mis créditos» y con saldo la franja se va (P05; le devuelve los créditos)',
    archivo: 'disponible-sin-saldo.cjs',
    // Qué hace el interruptor y cuándo sale la franja, caso por caso, lo EJECUTA pruebas/disponibleSinSaldo.test.js.
    vigila: ['guajirago/src/AppConductor.js', 'guajirago/src/comisiones.js', 'guajirago/src/textosViaje.js'],
  },
  {
    nombre: 'espera-conductor',
    que: 'con 300 s en config/global de pruebas, el taxista aprieta «📍 Llegué al punto» y su reloj «Esperando al pasajero...» y el del pasajero «Sal pronto…» arrancan los dos de 5:00 (G26)',
    archivo: 'espera-conductor.cjs',
    vigila: ['guajirago/src/configApp.js', 'guajirago/src/AppConductor.js', 'guajirago/src/Solicitar.js'],
  },
  {
    nombre: 'vencer-busqueda',
    que: 'el pasajero pide un taxi y deja que se acabe el plazo del celular (2 min): ve «No encontramos conductor» sin la ventanita del cierre, y el viaje queda `vencido` con fecha, quién (app-pasajero) y por qué (G27; tarda ~3 min)',
    archivo: 'vencer-busqueda.cjs',
    // La ventana del conductor (AppConductor.js, VENTANA_MS) usa el mismo plazo, pero verla pide un taxista esperando
    // 2 min una solicitud: la EJECUTA pruebas/vencidoBusqueda.test.js, y por eso AppConductor.js no se nombra aquí.
    vigila: ['guajirago/src/configApp.js', 'guajirago/src/Solicitar.js'],
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
  {
    nombre: 'ruta-conductor',
    que: 'con el pasajero 1,3 km al sur del taxista, en las dos apps (taxista yendo a recoger y pasajero esperando) el 🚗 y el 📍 del mapa quedan entre la barra de arriba y la tarjeta de abajo (G29; deja un viaje cancelado y cuesta una comisión de prueba)',
    archivo: 'ruta-conductor.cjs',
    // Las pantallas «en viaje» de las dos apps usan el mismo mapa, pero llegar ahí pide el código de seguridad del
    // pasajero: las EJECUTA pruebas/mapaRuta.test.js con un Google Maps de mentira.
    vigila: ['guajirago/src/MapaConRuta.js', 'guajirago/src/AppConductor.js', 'guajirago/src/Solicitar.js',
      'guajirago/public/index.html'],
  },
  {
    nombre: 'carro-en-vivo',
    que: 'con un viaje aceptado, el taxista se mueve 600 m al este y el 🚗 del pasajero se corre en su mapa (lo lee del viaje vivo); el pasajero y otra cuenta NO leen la ficha del taxista, y con el viaje terminado el pasajero ya no ve el carro (P19; deja un viaje cancelado y cuesta una comisión de prueba)',
    archivo: 'carro-en-vivo.cjs',
    vigila: ['guajirago/src/ubicacionEnVivo.js', 'guajirago/src/AppConductor.js', 'guajirago/src/Solicitar.js', 'firestore.rules'],
  },
  {
    nombre: 'mercado-viajes',
    que: 'el pasajero pide un Taxi y el taxista lo VE en su lista; el mototaxista, el propio pasajero y el panel leen el viaje, y OTRA pasajera y el restaurante de prueba reciben «permiso denegado» (P20; deja un viaje cancelado, no cuesta comisión)',
    archivo: 'mercado-viajes.cjs',
    vigila: ['firestore.rules', 'guajirago/src/AppConductor.js', 'guajirago/src/estadosViaje.js', 'guajirago/src/viajeNuevo.js'],
  },
  {
    nombre: 'llave-maps',
    que: 'transporte y aliados cargan Google Maps con la llave de su .env.pruebas (la escribe CRA en el index.html), Google no la rechaza y un mapa se dibuja (G62; no entra ni escribe nada)',
    archivo: 'llave-maps.cjs',
    vigila: ['guajirago/public/index.html', 'guajirago/.env.pruebas', 'guajirago/.env.produccion',
      'guajirago-aliados/public/index.html', 'guajirago-aliados/.env.pruebas', 'guajirago-aliados/.env.produccion'],
  },
  {
    nombre: 'direccion-pedido',
    que: 'en el pedido de comida, «📍 Usar mi ubicación» escribe la calle que da Google; si Google no la da, deja las coordenadas y sale la ventanita «Falta el nombre de la calle» (G30; no crea pedidos)',
    archivo: 'direccion-pedido.cjs',
    // El mapa de recogida (Solicitar.js) también usa direccionDePunto.js: ese lo EJECUTAN
    // scripts/medir-origen-del-viaje.cjs y pruebas/direccionDePunto.test.js con un Google de mentira.
    vigila: ['guajirago/src/Restaurantes.js', 'guajirago/src/direccionDePunto.js', 'guajirago/public/index.html'],
  },
  {
    nombre: 'flujos-pedido',
    que: 'aliados → Configuración → «Flujos de pedido» enseña las 6 etapas del domicilio en orden, con «(siempre)» solo en Recepcionista y Cajero (G33; no guarda nada)',
    archivo: 'flujos-pedido.cjs',
    // guajirago/src/estadosPedido.js (lo que ve el cliente) y el aviso del servidor los EJECUTA
    // pruebas/estadosPedido.test.js: la pantalla del cliente se ve igual que antes de G33.
    vigila: ['guajirago-aliados/src/ConfigFlujos.js', 'guajirago-aliados/src/flujoPedidos.js', 'guajirago/src/estadosPedido.js'],
  },
  {
    nombre: 'limite-favoritos',
    que: 'con el tope de favoritos en 2 en config/global de pruebas y el pasajero con 2 guardados, la Ayuda dice «hasta 2 lugares favoritos» y ➕ abre «Llegaste al límite · Solo puedes guardar 2 lugares» sin guardar un tercero (G35; deja config y favoritos como estaban)',
    archivo: 'limite-favoritos.cjs',
    vigila: ['guajirago/src/AyudaSoporte.js', 'guajirago/src/configApp.js', 'guajirago/src/Solicitar.js'],
  },
  {
    nombre: 'llamado-atencion',
    que: 'con un llamado de atención sin ver (puesto como admin en pruebas), el pasajero ve «MENSAJE DE GUAJIRAGO» UNA vez; sin señal «Entendido» no lo cierra y dice «No se pudo confirmar» dentro; con señal entra y se cierra solo (G37; ~1 min)',
    archivo: 'llamado-atencion.cjs',
    // La pantalla del conductor (AppConductor.js) pone la MISMA pieza, pero verla pide entrar como conductor sin viaje:
    // este recorrido no la abre. Que la ponga (y solo sin viaje en curso) lo vigila pruebas/llamadoAtencion.test.js.
    vigila: ['guajirago/src/LlamadoAtencion.js', 'guajirago/src/Home.js', 'guajirago/src/AppConductor.js'],
  },
  {
    nombre: 'ventanitas-aviso',
    que: 'sin entrar a ninguna cuenta, «Crear cuenta» con todo vacío saca «Atención · Por favor completa todos los campos» en la ventanita COMÚN (AvisoModal, «Entendido» azul) y «Entendido» la cierra (G39; no crea cuentas)',
    archivo: 'ventanitas-aviso.cjs',
    // Las otras ventanitas que pasaron a AvisoModal en G39 (Calificacion, Turismo, App, Configuracion y las de
    // Restaurantes y Solicitar) no las abre este recorrido: las SACA del archivo y las EJECUTA
    // scripts/medir-ventanitas-aviso.cjs (pruebas/ventanitasAviso.test.js). La del límite de favoritos la ve
    // limite-favoritos, y la de la calle, direccion-pedido.
    vigila: ['guajirago/src/Login.js', 'guajirago/src/AvisoModal.js'],
  },
  {
    nombre: 'motivo-fallo',
    que: 'Mi perfil, con una foto de 11 MB que el almacén rechaza, dice el motivo de motivoDeRechazo y no «Revisa tu conexión» (G40; no escribe nada)',
    archivo: 'motivo-fallo.cjs',
    // Los otros cinco sitios de G40 (código de seguridad del conductor, sus datos al registrarse, el contacto de
    // confianza, la reserva de turismo) no los abre este recorrido: provocarles un rechazo desde la pantalla no se
    // puede sin tocar datos. Sus catch los SACA del archivo y los EJECUTA scripts/medir-motivo-fallo.cjs
    // (pruebas/motivoFallo.test.js); por eso esos archivos no se nombran aquí.
    vigila: ['guajirago/src/MiPerfil.js', 'guajirago/src/avisoRechazo.js'],
  },
  {
    nombre: 'whatsapp-panel',
    que: 'el «💬 WhatsApp» de Restaurantes y Turismo en el panel abre wa.me con el número que da la pieza (telefonoValido.js), o sale la ventanita si el teléfono no sirve (G41; no escribe nada)',
    archivo: 'whatsapp-panel.cjs',
    // Los negocios de pruebas tienen un teléfono BUENO, así que la ventanita de «no sirve» no se ve aquí sin tocar
    // datos: esa rama la SACA del archivo y la EJECUTA scripts/medir-numero-whatsapp.cjs (pruebas/numeroWhatsApp.test.js),
    // igual que el enlace de la agencia en la app, el de pedidos y reservas de aliados y enviarWhatsApp de Codigos
    // (que nadie llama); por eso esos archivos no se nombran aquí.
    vigila: ['guajirago-admin/src/NegociosDeUnTipo.js', 'guajirago-admin/src/tiposDeNegocio.js', 'guajirago-admin/src/telefonoValido.js'],
  },
  {
    nombre: 'telefono-unico',
    que: 'Mi perfil no guarda un teléfono que no sirve («abc») y dice que debe tener 10 cifras (G42; no escribe nada)',
    archivo: 'telefono-unico.cjs',
    // Los otros formularios de G42 (registro, alta del conductor, pedido, reserva, mandado, registro y perfil de
    // aliados, editar conductor en el panel) guardan de verdad o piden una cuenta nueva: sus funciones de guardar las
    // SACA del archivo y las EJECUTA pruebas/telefonoUnico.test.js; por eso esos archivos no se nombran aquí.
    vigila: ['guajirago/src/MiPerfil.js', 'guajirago/src/telefonoValido.js'],
  },
  {
    nombre: 'foto-pasajero-panel',
    que: 'la ficha de 🙋 Pasajeros del panel enseña la foto guardada en fotoConductor (G43; pone una foto en la ficha de PRUEBAS de pasajero@ y la devuelve)',
    archivo: 'foto-pasajero-panel.cjs',
    // Las otras pantallas de G43 (App.js, Home.js, MiPerfil.js y AppConductor.js en la app, y Conductores.js en el
    // panel) ya enseñaban fotoConductor antes y la siguen enseñando: las SACA del archivo y las EJECUTA
    // pruebas/fotoFicha.test.js; por eso esos archivos no se nombran aquí.
    vigila: ['guajirago-admin/src/Pasajeros.js', 'guajirago-admin/src/fotoUsuario.js', 'guajirago/src/fotoUsuario.js'],
  },
  {
    nombre: 'placa-panel',
    que: 'editando la ficha en 🚗 Conductores del panel, una placa («AB 12») o un vehículo («hola») que no sirven NO se guardan y sale la ventanita (G45; toca la ficha de PRUEBAS de taxi@ y la devuelve)',
    archivo: 'placa-panel.cjs',
    // El registro del conductor (App.js) también usa la regla: lo cubre registrar-conductor (escribe ROB123 / ROB12A),
    // y el trozo de la placa lo SACA del archivo y lo EJECUTA pruebas/placaVehiculo.test.js.
    vigila: ['guajirago-admin/src/Conductores.js', 'guajirago-admin/src/vehiculoConductor.js', 'guajirago/src/vehiculoConductor.js'],
  },
  {
    nombre: 'horario-agencia',
    que: 'con la agencia y el restaurante de prueba abriendo y cerrando a la misma hora (0 y 0), las listas del pasajero dicen «Abierta ahora» y «Abierto ahora»; con un horario que no incluye la hora de Colombia, la agencia dice «Cerrada ahora» (G46; cambia el horario de la agencia de PRUEBAS y lo devuelve)',
    archivo: 'horario-agencia.cjs',
    vigila: ['guajirago/src/Turismo.js', 'guajirago/src/Restaurantes.js', 'guajirago/src/horarioNegocio.js'],
  },
  {
    nombre: 'pedir-ahora',
    que: 'fuera de horario, la tarjeta del dueño en aliados dice «🔴 Cerrado ahora · Estás fuera de tu horario…» y el panel «⚪ Fuera de horario» (como el cliente); con 24 horas, «🟢 Abierto» en los dos (G47; cambia el horario del restaurante de PRUEBAS y lo devuelve)',
    archivo: 'pedir-ahora.cjs',
    // La regla entera (candado, escaparate, pausa, horario) la SACA de cada pantalla y la EJECUTA pruebas/pedirAhora.test.js.
    vigila: ['guajirago-aliados/src/App.js', 'guajirago-aliados/src/horarioNegocio.js', 'guajirago-aliados/src/escaparate.js',
      'guajirago-aliados/src/reglaPromocion.js', 'guajirago-admin/src/NegociosDeUnTipo.js', 'guajirago-admin/src/tiposDeNegocio.js', 'guajirago-admin/src/horarioNegocio.js',
      'guajirago-admin/src/escaparate.js', 'guajirago-aliados/src/alerta.js'],
  },
  {
    nombre: 'fecha-pedido',
    que: 'el pasajero hace un domicilio (y lo cancela) y «🧾 pedidos hoy» del panel sube en uno, con la fecha pintada en la ficha (G48; crea un pedido en PRUEBAS)',
    archivo: 'fecha-pedido.cjs',
    // La pieza, cada convertidor de aliados y el «hoy» de Corte de caja los SACA de su archivo y los EJECUTA
    // pruebas/fechaPedido.test.js.
    vigila: ['guajirago-admin/src/NegociosDeUnTipo.js', 'guajirago-admin/src/tiposDeNegocio.js', 'guajirago-admin/src/fechaGuardada.js', 'guajirago/src/fechaGuardada.js',
      'guajirago/src/Restaurantes.js'],
  },
  {
    nombre: 'corte-caja-hoy',
    que: 'con el reloj de la página a las 8 p. m. de Colombia, Corte de caja de aliados abre en el día de HOY y no en el de mañana (G48 y hallazgo de G16; no escribe nada)',
    archivo: 'corte-caja-hoy.cjs',
    // Los convertidores de Mesero, PedidosDomicilio, HistorialDomicilios y ResumenDia no cambian lo que se ve (leen
    // igual los dos formatos): los SACA de su archivo y los EJECUTA pruebas/fechaPedido.test.js.
    vigila: ['guajirago-aliados/src/CorteCaja.js', 'guajirago-aliados/src/fechaGuardada.js', 'guajirago-aliados/src/Mesero.js',
      'guajirago-aliados/src/PedidosDomicilio.js', 'guajirago-aliados/src/HistorialDomicilios.js', 'guajirago-aliados/src/ResumenDia.js'],
  },
  {
    nombre: 'aprobar-negocio',
    que: 'con el Restaurante de Prueba suspendido y la cuenta apagada en Cobros, «✅ Aprobar» del panel lo aprueba y la cuenta sigue apagada (G49; cambia tres campos del restaurante de PRUEBAS y los devuelve)',
    archivo: 'aprobar-negocio.cjs',
    // Los tres botones (Restaurantes, Turismo y Aliados pendientes) los SACA de su archivo y los EJECUTA
    // pruebas/aprobarNegocio.test.js.
    vigila: ['guajirago-admin/src/aprobarNegocio.js', 'guajirago-admin/src/NegociosDeUnTipo.js',
      'guajirago-admin/src/AliadosPendientes.js'],
  },
  {
    nombre: 'estado-aprobacion',
    que: 'con el Restaurante de Prueba suspendido, 🤝 Aliados pendientes del panel lo enseña «SUSPENDIDO» con «Reactivar y aprobar», no como un registro nuevo con «Rechazar» (G50; cambia dos campos del restaurante de PRUEBAS y los devuelve)',
    archivo: 'estado-aprobacion.cjs',
    // La etiqueta y la pestaña «Pendientes» de Restaurantes y Turismo, y la tarjeta de Aliados pendientes, las SACA de
    // su archivo y las EJECUTA pruebas/estadoAprobacion.test.js.
    vigila: ['guajirago-admin/src/aprobarNegocio.js', 'guajirago-admin/src/AliadosPendientes.js', 'guajirago-admin/src/NegociosDeUnTipo.js',
      'guajirago-admin/src/tiposDeNegocio.js'],
  },
  {
    nombre: 'menu-navegacion',
    que: '«Mis viajes» y «Ganancias» del menú abren la misma pantalla desde módulos y desde el menú de pasajero y conductor, y ninguna dice «muy pronto» (G51; solo mira)',
    archivo: 'menu-navegacion.cjs',
    // Cada botón (41 combinaciones de entrada, papel y opción) lo SACA de su archivo y lo EJECUTA
    // pruebas/menuNavegacion.test.js, también la tarjeta «Mis viajes» del conductor fuera de turno.
    // theme.js (LA paleta, G90) le da los colores al menú: si cambia, este recorrido abre el menú. Que se VEA igual lo
    // pinta y lo carea con React pruebas/paleta.test.js (el robot no compara colores).
    vigila: ['guajirago/src/navegacionMenu.js', 'guajirago/src/MenuLateral.js', 'guajirago/src/App.js', 'guajirago/src/Home.js',
      'guajirago/src/AppConductor.js', 'guajirago/src/theme.js'],
  },
  {
    nombre: 'recuperar-contrasena',
    que: 'sin entrar a ninguna cuenta, «¿Olvidaste tu contraseña?» con un correo que no existe da la ventanita neutra («Si ese correo está registrado…») y con uno mal escrito dice que no está bien escrito (G71; no envía correos ni toca la base)',
    archivo: 'recuperar-contrasena.cjs',
    // «Cambiar contraseña» de Configuracion.js manda un correo de verdad a la cuenta de prueba: no lo toca este
    // recorrido. Lo SACA del archivo y lo EJECUTA, con cada respuesta del servidor, pruebas/recuperarContrasena.test.js.
    vigila: ['guajirago/src/Login.js', 'guajirago/src/recuperarContrasena.js'],
  },
  {
    nombre: 'errores-de-cuenta',
    que: 'entrar con una contraseña que no es, en las tres apps (y en aliados con un correo que existe y con uno que no): sale la misma frase de avisoRechazo.js, «No se pudo iniciar sesión. El correo o la contraseña no son correctos…», y no delata qué correos existen (G72; no escribe nada)',
    archivo: 'errores-de-cuenta.cjs',
    // Crear cuenta, eliminar la cuenta y crear un empleado crean o borran cuentas de verdad: sus catch los SACA del
    // archivo y los EJECUTA, con cada error de Firebase, pruebas/erroresDeCuenta.test.js.
    vigila: ['guajirago/src/Login.js', 'guajirago/src/avisoRechazo.js', 'guajirago-admin/src/App.js',
      'guajirago-admin/src/avisoRechazo.js', 'guajirago-aliados/src/Login.js', 'guajirago-aliados/src/avisoRechazo.js'],
  },
  {
    nombre: 'paginas-legales',
    que: 'sin entrar a ninguna cuenta, «Crear cuenta» → «Términos y condiciones» y «Política de privacidad» abren con su título, sus 11 secciones y el correo de soporte (1 y 2 veces), y «‹ Volver» regresa al registro (G75; no escribe nada)',
    archivo: 'paginas-legales.cjs',
    // La Ayuda (que también dice el correo) la cubre limite-favoritos. Que las tres pantallas se vean EXACTAMENTE como
    // antes (HTML pintado) lo vigila pruebas/soporteLegal.test.js.
    vigila: ['guajirago/src/TerminosCondiciones.js', 'guajirago/src/PoliticaPrivacidad.js', 'guajirago/src/PaginaLegal.js',
      'guajirago/src/correoSoporte.js'],
  },
  {
    nombre: 'saldo-conductor',
    que: 'el saldo guardado en la ficha del taxista de prueba se ve igual en «Mis créditos» y en la pantalla del conductor (G81; solo lee la base)',
    archivo: 'saldo-conductor.cjs',
    // Que los cuatro sitios den EXACTAMENTE lo mismo que antes, con valores raros, lo SACA del archivo y lo EJECUTA
    // pruebas/saldoConductor.test.js.
    vigila: ['guajirago/src/saldoUsuario.js', 'guajirago/src/Creditos.js', 'guajirago/src/AppConductor.js'],
  },
  // G82 · las fotos se suben con UNA pieza, subirAlAlmacen (copia idéntica en cada repo). Cada recorrido sube una foto
  // de verdad en pruebas y le pregunta al almacén con qué tipo quedó. Que los 13 sitios hagan lo mismo que antes lo
  // SACA de cada archivo y lo EJECUTA pruebas/subirFoto.test.js; contra las reglas de verdad, pruebas/storage.test.js.
  // La cédula y los papeles del conductor (App.js) los sube de verdad registrar-conductor.
  {
    nombre: 'subir-foto-transporte',
    que: 'el pasajero de prueba cambia su foto en «Mi perfil» con una foto SIN tipo: queda en la ficha, abre, y el almacén la guarda como image/jpeg (G82; al final se le devuelve la ficha)',
    archivo: 'subir-foto.cjs',
    args: ['transporte'],
    vigila: ['guajirago/src/subirAlAlmacen.js', 'guajirago/src/MiPerfil.js'],
  },
  {
    nombre: 'subir-foto-panel',
    que: 'el superadmin sube la imagen de un anuncio (sin publicarlo) y sale su vista previa (G82). Hoy el almacén la rechaza con 403 por un permiso que le falta al proyecto, no por G82: ver robot/APRENDIDO.md',
    archivo: 'subir-foto.cjs',
    args: ['panel'],
    vigila: ['guajirago-admin/src/subirAlAlmacen.js'],
  },
  {
    nombre: 'subir-foto-aliados',
    que: 'el restaurante y la agencia de prueba suben su logo SIN tipo (sin guardar el negocio): sale la vista previa, abre, y queda como image/jpeg (G82)',
    archivo: 'subir-foto.cjs',
    args: ['aliados', 'agencia'],
    vigila: ['guajirago-aliados/src/subirAlAlmacen.js', 'guajirago-aliados/src/PerfilRestaurante.js', 'guajirago-aliados/src/PerfilAgencia.js'],
  },
  {
    nombre: 'estrellas-restaurante',
    que: 'el promedio de estrellas del restaurante de prueba se ve igual en la lista y el menú del cliente y en «Calificaciones» de aliados (G83; solo mira)',
    archivo: 'estrellas-restaurante.cjs',
    // Que los tres sitios den el mismo número con casos raros (una de taxi al dueño, sin estrellas, reportadas) lo
    // SACA de cada archivo y lo EJECUTA pruebas/promedioRestaurante.test.js.
    vigila: ['guajirago/src/estrellasNegocio.js', 'guajirago-aliados/src/estrellasNegocio.js', 'guajirago-aliados/src/CalificacionesRestaurante.js',
      'guajirago/src/Restaurantes.js'],
  },
  {
    nombre: 'quien-cancelo',
    que: 'de tres pedidos cancelados (uno nuevo del cliente, uno viejo del cliente y uno viejo sin datos), «Mis pedidos» y el seguimiento del cliente y «Cancelado» de aliados dicen lo mismo de quién canceló (G84; deja 3 pedidos fijos en PRUEBAS)',
    archivo: 'quien-cancelo.cjs',
    // Que los tres sitios digan el mismo «quién» con todos los casos (y el careo con el código de antes) lo SACA de
    // cada archivo y lo EJECUTA pruebas/quienCancelo.test.js.
    vigila: ['guajirago/src/estadosPedido.js', 'guajirago-aliados/src/flujoPedidos.js', 'guajirago-aliados/src/PedidosDomicilio.js',
      'guajirago/src/Restaurantes.js'],
  },
  {
    nombre: 'metodos-pago',
    que: 'la app (al pedir) y el cobro de la mesa en aliados ofrecen los mismos cuatro métodos de pago, y la mesa se cierra en Efectivo con su pago guardado (G85; reabre y cierra un pedido de mesa fijo en PRUEBAS)',
    archivo: 'metodos-pago.cjs',
    // Que los cuatro sitios (app, cierre del domicilio, mesa y corte de caja) usen la MISMA lista, y el careo con el
    // código de antes, lo SACA de cada archivo y lo EJECUTA pruebas/metodosPago.test.js.
    vigila: ['guajirago/src/estadosPedido.js', 'guajirago-aliados/src/flujoPedidos.js', 'guajirago-aliados/src/Mesero.js',
      'guajirago/src/Restaurantes.js'],
  },
  {
    nombre: 'unidades-tour',
    que: 'con cuatro tours fijos (uno por unidad) en la agencia de prueba, la lista de «Tours y alquileres» de aliados, su selector y las tarjetas de la app dicen «por persona / por grupo / por día / por hora» igual (G86; cambia los tours de la agencia de PRUEBAS y se los devuelve)',
    archivo: 'unidades-tour.cjs',
    // Que los tres sitios digan lo mismo en todos los casos (y el careo con el código de antes) lo SACA de cada archivo
    // y lo EJECUTA pruebas/unidadesTour.test.js.
    vigila: ['guajirago/src/unidadesTour.js', 'guajirago-aliados/src/unidadesTour.js', 'guajirago-aliados/src/Tours.js',
      'guajirago/src/Turismo.js'],
  },
  {
    nombre: 'dias-promocion',
    que: 'con dos promociones fijas «por días» en el restaurante de prueba, la lista de «Promociones» de aliados, sus botones L M M J V S D y la etiqueta del plato en la app dicen los días igual (G87; cambia las promociones del restaurante de PRUEBAS y se las devuelve)',
    archivo: 'dias-promocion.cjs',
    // Que los tres sitios digan lo mismo en todos los casos (y el careo con el código de antes) lo SACA de cada archivo
    // y lo EJECUTA pruebas/diasPromocion.test.js.
    vigila: ['guajirago/src/diasSemana.js', 'guajirago-aliados/src/diasSemana.js', 'guajirago-aliados/src/Promociones.js',
      'guajirago/src/Restaurantes.js'],
  },
  {
    nombre: 'recordados-telefono',
    que: '«Mis pedidos» y «Mis reservas» leen lo ya guardado en el teléfono (forma de siempre, con basura dentro o roto) sin caerse ni quedarse cargando (G88; deja un pedido y una reserva fijos, cancelados, en PRUEBAS)',
    archivo: 'recordados-telefono.cjs',
    // Qué lee y guarda cada pantalla en 15 casos (y el careo con el código de antes) lo SACA de cada archivo y lo
    // EJECUTA pruebas/recordadosTelefono.test.js.
    vigila: ['guajirago/src/recordadosEnTelefono.js', 'guajirago/src/Restaurantes.js', 'guajirago/src/Turismo.js'],
  },
  {
    nombre: 'pantallas-negocios',
    que: '🍽️ Restaurantes y 🧭 Turismo del panel, que ahora son UNA pantalla, enseñan cada uno sus textos: menú lateral, lista (el número del título cuadra con las tarjetas), Resumen con sus cinco números, Pendientes y la ficha; y pasar de 🍽️ (con una ficha abierta) a 🧭 por el menú enseña las agencias (G89; solo mira)',
    archivo: 'pantallas-negocios.cjs',
    // Que cada paso se vea y escriba IGUAL que antes (HTML, escrituras de Aprobar / Suspender / Rechazar, WhatsApp y
    // avisos, con datos de mentira) lo PINTA con React y lo carea scripts/medir-pantallas-negocios.cjs
    // (pruebas/pantallasNegocios.test.js).
    vigila: ['guajirago-admin/src/NegociosDeUnTipo.js', 'guajirago-admin/src/tiposDeNegocio.js'],
  },
  {
    nombre: 'boton-volver',
    que: 'el «‹ Volver» es la misma pastilla gris en 15 pantallas (menú de módulos, Términos, escoger rol, pasajero, Mis pedidos, Restaurantes, Mis reservas, Turismo), cabe en el celular y al tocarlo vuelve a donde volvía (G91; solo mira)',
    archivo: 'boton-volver.cjs',
    // Que cada uno de los 24 botones vuelva al MISMO sitio que antes de G91 lo SACA de su archivo, lo pinta con React,
    // lo toca y lo carea scripts/medir-boton-volver.cjs (pruebas/botonVolver.test.js). El de Solicitar.js y los dos del
    // conductor (AppConductor.js) no los recorre este robot (pedir un viaje o ser conductor es otro recorrido), ni el de
    // MisViajes.js, que solo sale a quien no ha escogido papel (pasajero@gg.test ya es pasajero: ve el de Home.js).
    vigila: ['guajirago/src/BotonVolver.js', 'guajirago/src/theme.js', 'guajirago/src/MiPerfil.js', 'guajirago/src/Home.js',
      'guajirago/src/Creditos.js', 'guajirago/src/Ganancias.js', 'guajirago/src/Seguridad.js', 'guajirago/src/Promociones.js',
      'guajirago/src/AyudaSoporte.js', 'guajirago/src/Configuracion.js', 'guajirago/src/PaginaLegal.js', 'guajirago/src/App.js',
      'guajirago/src/Restaurantes.js', 'guajirago/src/Turismo.js'],
  },
  {
    nombre: 'logo-esquina',
    que: 'el logo de arriba a la derecha es el mismo pin de GuajiraGo (arriba 14, derecha 16) en 12 pantallas: de 28 en el encabezado (menú de módulos, Restaurantes, pedir mandado) y de 34 en las portadas (pasajero, mensajería) (G92; solo mira)',
    archivo: 'logo-esquina.cjs',
    // Que cada uno de los 14 logos esté en la misma pantalla que antes de G92, y cuáles cambiaron de forma, lo SACA de
    // su archivo, lo pinta con React y lo carea scripts/medir-logo-esquina.cjs (pruebas/logoEsquina.test.js). El del
    // conductor (AppConductor.js) no lo mira este robot (ser conductor es otro recorrido), ni el de MisViajes.js, que
    // solo sale a quien no ha escogido papel (pasajero@gg.test ya es pasajero: ve el de Home.js).
    vigila: ['guajirago/src/Logo.js', 'guajirago/src/MiPerfil.js', 'guajirago/src/Home.js', 'guajirago/src/Creditos.js',
      'guajirago/src/Ganancias.js', 'guajirago/src/Seguridad.js', 'guajirago/src/Promociones.js', 'guajirago/src/AyudaSoporte.js',
      'guajirago/src/Configuracion.js', 'guajirago/src/App.js', 'guajirago/src/Restaurantes.js', 'guajirago/src/Solicitar.js'],
  },
  {
    nombre: 'chat-del-viaje',
    que: 'con un viaje aceptado (confirmarConductor, en la base de pruebas), el taxista escribe en el chat con Enter, el pasajero lo ve en «💬 Chat con el conductor (1)» y contesta con ➤, y los dos ven los dos mensajes sin ventanita de error (G96; ~2 min)',
    archivo: 'chat-del-viaje.cjs',
    // Que se escriba en la base LO MISMO que antes de G96 (texto, autor, autorId, fecha), y que la escucha avise si el
    // servidor la corta, lo CORRE scripts/medir-chat-del-viaje.cjs (pruebas/chatDelViaje.test.js).
    vigila: ['guajirago/src/chatDelViaje.js', 'guajirago/src/AppConductor.js', 'guajirago/src/Solicitar.js'],
  },
  {
    nombre: 'foto-redonda',
    que: 'la foto redonda del ☰ Menú (56) y de «Mi perfil» (80) sale cargada con una foto buena, y el muñeco 👤 sin foto y con una foto ROTA (G98; cambia la foto de la ficha de PRUEBAS de pasajero@ y la devuelve)',
    archivo: 'foto-redonda.cjs',
    // Las tres fotos del conductor en la pantalla del pasajero (la oferta, el que viene y el viaje en curso) las SACA
    // de Solicitar.js, las pinta con React con foto, sin foto y rota, y las carea con el código de antes
    // scripts/medir-foto-redonda.cjs (pruebas/fotoRedonda.test.js).
    vigila: ['guajirago/src/FotoRedonda.js', 'guajirago/src/MenuLateral.js', 'guajirago/src/MiPerfil.js'],
  },
  {
    nombre: 'total-pedido',
    que: 'el pasajero pide un domicilio y el servidor le deja su total (con revisionServidor); el mismo pedido creado por la red con los platos a $1 queda con el precio del menú; los dos se cancelan y el cliente ya no puede cambiar el total (P09; crea dos pedidos en PRUEBAS; necesita la función notificarNuevoPedido y las reglas publicadas en pruebas)',
    archivo: 'total-pedido.cjs',
    // La cuenta compartida, el careo del carrito con el código de antes, la transacción del servidor y el disparo de
    // index.js los EJECUTA pruebas/totalPedido.test.js; el disparador de verdad, pruebas/funciones.test.js (P09).
    vigila: ['guajirago/src/precioPedido.js', 'guajirago/src/Restaurantes.js'],
  },
  {
    nombre: 'revision-precio',
    que: 'un pedido normal sale «revisado» y sin aviso; P12: uno con el teléfono «300/1100110» no entra y otro con la promoción «a/b» a $1 sale «revisado» con el precio del menú; P13: uno lleno casi hasta 1 MiB con un campo de sobra no entra y uno lleno dentro de una línea sale «revisado», con el precio del menú y pequeño; y en uno marcado «sin revisar» (la marca la pone la administradora de pruebas: el cliente ya no puede hacer fallar la revisión) aliados dice «⚠️ Precio sin revisar» en su tarjeta y al confirmar (P11, P12 y P13; crea cuatro pedidos en PRUEBAS y los cancela; necesita notificarNuevoPedido, las reglas y aliados publicados en pruebas)',
    archivo: 'revision-precio.cjs',
    // La pieza (y su copia atada), la marca del servidor, los 7 caminos de index.js y el confirmar de aliados con el
    // careo los EJECUTA pruebas/revisionPrecio.test.js.
    vigila: ['guajirago-aliados/src/revisionPrecio.js', 'guajirago-aliados/src/PedidosDomicilio.js'],
  },
  {
    nombre: 'promo-agotada',
    que: 'con una promoción de un uso ya gastada por ese teléfono (en otro aparato), la app la quita y lo dice («Promoción sin cupos»), y al volver a enviar el pedido ENTRA sin descuento y al precio del menú (hasta P14 salía «No se pudo enviar el pedido» cada vez); crea una promoción del 50 % en el Restaurante de Prueba como admin@gg.test, dos pedidos que cancela, y deja las promociones como estaban (P14; necesita notificarNuevoPedido publicada en pruebas)',
    archivo: 'promo-agotada.cjs',
    // El carrito y el envío sacados de Restaurantes.js y ejecutados con el candado y la validación de Firestore de
    // verdad, con el careo con el código de antes, los corre pruebas/pedidoSinIndefinidos.test.js.
    vigila: ['guajirago/src/Restaurantes.js', 'guajirago/src/precioPedido.js'],
  },
  {
    nombre: 'reserva-sin-nombre',
    que: 'con un tour sin nombre ni código en la Agencia de Turismo de Prueba, el cliente reserva y ve «¡Reserva enviada!» (hasta P16 salía «No se pudo enviar la reserva» cada vez), y la reserva queda como «Tour», sin tourId y con el teléfono en 10 cifras; le pone el tour a la agencia como agencia@gg.test, la reserva la cancela admin@gg.test, y deja los tours como estaban (P16)',
    archivo: 'reserva-sin-nombre.cjs',
    // El envío sacado de Turismo.js y ejecutado con la validación de Firestore de verdad, con el careo con el código
    // de antes, y el careo de las reglas en el emulador, los corre pruebas/reservaCerrada.test.js.
    vigila: ['guajirago/src/Turismo.js'],
  },
  {
    nombre: 'reserva-total',
    que: 'tres reservas de 2 personas a un tour de $1.000 por persona: la honrada ($2.000) queda igual y «revisado»; la inventada ($1) queda en $2.000 «revisado» con el $1 guardado; la de un tour borrado queda «sin revisar» y aliados lo dice en su tarjeta (P17; pone un tour del robot como agencia@gg.test, crea tres reservas en PRUEBAS que cancela admin@gg.test, y deja los tours como estaban; necesita notificarNuevaReserva y aliados publicados en pruebas)',
    archivo: 'reserva-total.cjs',
    // La cuenta compartida (y su copia atada), el careo de la pantalla con el código de antes, la transacción del
    // servidor, el disparo de index.js con el careo y la tarjeta de aliados los EJECUTA pruebas/totalReserva.test.js.
    vigila: ['guajirago-aliados/src/ReservasTurismo.js', 'guajirago/src/Turismo.js', 'guajirago/src/precioPedido.js'],
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
