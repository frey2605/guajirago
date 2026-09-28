# 🤖 Lo que el robot aprendió de GuajiraGo

> Cuaderno del robot probador para ESTE proyecto. Lo que vale para cualquier app está en el
> cuaderno general del robot, y el agente que lo usa es el «probador»: los dos viven en la carpeta
> `.claude` de la cuenta del dueño (no en este repo), dentro de `robot` y de `agents`.
> **Cada trampa nueva se anota aquí, con la fecha y cómo se resolvió.**

## Los sitios y las cuentas

- Solo PRUEBAS: `guajirago-pruebas.web.app` (transporte), `guajirago-pruebas-admin.web.app`
  (panel), `guajirago-pruebas-aliados.web.app` (aliados). Salen del cartel naranja
  «PRUEBAS · datos de mentira».
- Cuentas sembradas (`scripts/sembrar-pruebas.cjs`): pasajero@, pasajera@, taxi@, moto@,
  restaurante@, agencia@ y admin@ (todas `@gg.test`, superadmin la de admin). La clave está en
  `PROYECTOS\guajirago\cuentas-de-pruebas.txt`, FUERA del repo.
- Las cuentas que crea el robot se llaman `robot.<tipo>.<hora>@gg.test` y «Robot … De Prueba».

## Los recorridos que hay

| Recorrido | Qué comprueba |
|---|---|
| `node robot/probar-cambio.cjs [archivos]` | **tras cada cambio**: corre lo que cubre lo cambiado (según `robot/mapa.cjs`), el humo y el portero; nombra las pantallas SIN RECORRIDO |
| `node robot/humo.cjs` | las tres apps de pruebas abren con su cartel y sin romperse |
| `node robot/mirar.cjs transporte\|panel\|aliados` | qué hay en una pantalla (lo primero ante una nueva) |
| `node robot/registrar-conductor.cjs Taxi\|Mototaxi` | crear cuenta → Soy conductor → con una foto de menos se para y dice cuál; con todas entra |
| `node robot/revisar-panel.cjs "Robot Taxi De Prueba"` | el panel enseña los 6 documentos del conductor, cargados |
| `node robot/radio-panel.cjs` | 👑 Superadmin: con el radio de búsqueda borrado (queda en 0) no guarda, lo dice, y config/global no cambia |
| `node robot/portero.cjs [horas]` | cuántas llamadas llegaron a pruebas con el sello de App Check (solo lectura) |

## Pantallas: cómo se manejan (27-sep-2026)

**Crear cuenta (transporte).** Botón «Crear cuenta» → campos por `placeholder`: «NOMBRE COMPLETO»,
«Correo electrónico», «Confirmar correo electrónico», «3001234567» (el celular; el segundo con ese
mismo placeholder es el del contacto de confianza), la fecha con tres `select` (día, mes, año),
«Contraseña (mínimo 6 caracteres)», «Confirmar contraseña», «Nombre del contacto».
- 🪤 **Los términos son un cuadrito (`div`), no un checkbox**: el primer `div` hijo del bloque que
  contiene «Términos y condiciones». Sin él: «Debes aceptar los Términos y condiciones».
- 🪤 **El celular no se puede repetir**: «Ese número de celular ya está registrado en otra cuenta».
  Se genera con la hora.
- Al crearla sale «¡Bienvenido a GuajiraGo! … $8.000» con el botón «¡Vamos!»: cerrarlo.

**Módulos → Soy conductor.** «Transporte y movilidad» → «Soy conductor».

**Datos del conductor.** Primer `select` = tipo de vehículo (Taxi / Mototaxi); «Placa del vehículo
(6 caracteres)»; «Marca del vehículo» abre una lista → «Otra» → «Escribe la marca»; segundo
`select` = modelo; «Color» abre una lista y se toca el NOMBRE («Azul»); «Documento de identidad».
Siete `input type=file`: la foto del conductor y los 6 documentos de `documentosConductor.js`.
Botón «Entrar a GuajiraGo». Si falta una foto: ventanita «Falta subir la foto: …» con «Entendido».
Con todo: «¡Bienvenido, conductor! … $20.000». Tarda: esperar ~15 s tras tocar el botón.

**Panel.** Correo `input[type=email]`, clave `input[type=password]`, botón «Entrar al panel» (el
Enter no entra). 🪤 El menú está ABAJO y son solo íconos: Conductores es el 🚗. Ahí «Buscar» →
«Nombre del conductor» → botón «🔍 Buscar». 🪤 Los nombres salen en MAYÚSCULAS. La ficha trae el
cuadro «📂 Documentos (N de 6)»; el `alt` de cada foto es el nombre de la lista (sin la variante
del mototaxi: la variante sale en el texto de abajo, no en el `alt`).

**Panel · Superadmin (27-sep-2026, G04).** 👑 en el menú de abajo abre «Configuración global». Los campos
no tienen `name` ni `placeholder`: se encuentran por su etiqueta, el `<p>` en mayúsculas («RADIO DE BÚSQUEDA
INICIAL») y el `input` dentro del `div` hermano (xpath `following-sibling::div//input`). Vaciar el campo lo
deja en 0 (el panel convierte lo vacío a 0). El aviso del guardado sale en rojo ENCIMA del botón «Guardar
cambios», no en ventanita.

**Aliados (crear un empleado).** 🪤 La portada pregunta «¿QUÉ TIPO DE NEGOCIO TIENES?»: para entrar se
toca «Ya tengo cuenta · Ingresar». Campos «Correo» y «Contrasena» (sin tilde), botón «Entrar» (exacto).
Cuenta: restaurante@gg.test. Luego Configuración → «Mi equipo» → «+ Agregar empleado»: «Nombre del
empleado», «Correo para que inicie sesión», «Mínimo 6 caracteres», se toca un rol por su nombre
(«Mesero») y el botón «Crear empleado». Crear el empleado usa la SEGUNDA conexión de aliados: el
27-sep-2026, antes del arreglo, Google contó esas llamadas como `MISSING` (sin sello); después, con sello.

**Aliados sin señal.** 🪤🪤 Dos trampas, medidas el 27-sep-2026:
- **Dos pestañas NO lo provocan:** el almacén local se lo queda la primera pestaña, y la segunda
  trabaja en memoria SIN quejarse. Lo que sí lo provoca es un navegador sin almacén: se simula con
  `antesDeCargar` del motor quitándole `window.indexedDB` antes de que cargue la app.
- **Firebase ya no falla cuando no puede guardar en el aparato:** escribe en su registro «Falling back
  to memory cache» y sigue. La primera versión del arreglo esperaba un error y se quedó muda; el robot
  lo cazó. Ahora aliados escucha el registro (`onLog`). Y el aviso sale al ENTRAR, no en la portada:
  Firebase prueba el almacén la primera vez que usa la base.
- Para entrar a aliados hay una sola pieza: `entrarComoRestaurante` de `robot/comun.cjs`.

## Lo que encontró la primera visita de usuario (27-sep-2026)

- 🔴→✓ **El botón «¡A rodar!» de la bienvenida del conductor era blanco sobre blanco.** Arreglado ese
  día; `registrar-conductor.cjs` ahora mira el color que pinta el navegador y falla si vuelve.
- El bono de bienvenida del conductor **cambia según el vehículo, a propósito** (el servidor lo decide
  en `creditosDeBienvenida`): el mototaxi recibe menos que el taxi. No es falla.
- Mejoras anotadas, sin hacer: al mototaxi todo le dice «vehículo» y le enseña un carro 🚗; al escoger
  la marca «Otra» la casilla queda vacía y solo abajo sale lo escrito; el número del bono va negro
  en el conductor y blanco en el pasajero; registrarse como conductor cuesta ~30 toques.
- 🪤 **El resumen de `robot/probar-cambio.cjs` solo copia las 3 últimas líneas de cada recorrido:** se
  pierden renglones (el de transporte en el humo, el correo de la cuenta creada). Para verlo todo,
  correr el recorrido solo.
- Las capturas de página entera enseñan el cartel de PRUEBAS a media imagen (es fijo arriba); no es
  falla de la app.

**Conductor en turno (27-sep-2026).** «Ya tengo cuenta» → «Correo electrónico» y «Contraseña» →
«Entrar a GuajiraGo» → «Transporte y movilidad» → «Soy conductor». Cuenta: taxi@gg.test. Arriba dice
«🟢 Estoy disponible» o «⚪ No disponible»; el interruptor es el `div` que va justo DESPUÉS de ese texto.
- 🪤 **El GPS se finge antes de cargar** (`antesDeCargar` cambia `navigator.geolocation`). Como el motor
  no le pasa datos, el guion va como TEXTO con la coordenada dentro: así cada vuelta usa un punto
  distinto y se sabe que la posición de la ficha es de ESTA vuelta.
- 🔑 **Lo que no se ve en pantalla se mira en la base de pruebas**: `entrarALaBase(correo)` de
  `robot/comun.cjs` entra con la cuenta de prueba (las reglas deciden, como en la app) y se niega si
  `.env.pruebas` no dice guajirago-pruebas. `cambiar` toca solo los campos dados.
- Comprobado con la versión VIEJA publicada un momento en pruebas: el recorrido sale 🔴 «el GPS BORRÓ
  la marca del viaje en curso». Con la buena, ✓. Al terminar deja la ficha como estaba.
- 🪤 **El navegador del robot no da permiso de avisos**: al entrar sale la ventanita «Así no te van a
  sonar los viajes» (desde el 27-sep-2026; antes se pintaba el texto técnico «FCM: permiso=denied»).
  El recorrido exige que salga y la cierra con «Entendido»: si no, tapa el interruptor.
- Visto de paso, sin tocar: sin saldo, el interruptor avisa con un `alert` del navegador, no con una
  ventanita.

**El portero y el sello (27-sep-2026).**
- 🔑 Las llamadas DIRECTAS del robot a la base (`entrarALaBase`) no llevan sello y llegan como «sin
  origen». Se anotan en el cuaderno `llamadas-directas.log` (carpeta temporal del PC, `robot-guajirago`) y
  el portero las descuenta: solo es alarma lo que sobra, o un sello INVÁLIDO.
- 🔴 **Desde ~01:20 UTC del 28-sep el navegador del robot recibe sellos INVÁLIDOS** en todas sus
  llamadas; hasta las 01:13 eran todos buenos. Medido cada 5 minutos contra las horas de las corridas:
  los inválidos caen SOLO cuando corre el robot. El paquete publicado era idéntico byte a byte, así que no
  fue el código. Sospecha, no medida: el sistema anti-robots de Google empezó a marcarlo tras muchas
  corridas. Lo que NO se sabe: si a un celular de verdad le pasa igual — eso decide si se puede cerrar la
  puerta de App Check.

**Ajustes → Seguridad y la ubicación del mensaje de emergencia (27-sep-2026, G05).** Cuenta
pasajero@gg.test → «Ya tengo cuenta» → entrar → «Menú» → «Seguridad» (texto exacto). El contacto de confianza
ya estaba guardado («Contacto de Prueba», 3000000001); si sale «Sin número», el recorrido guarda uno de mentira.
- 🔑 **WhatsApp no se abre de verdad:** `antesDeCargar` cambia `window.open` por uno que anota el enlace y la hora
  en `window.__abiertos`. Así se lee el mensaje entero y se mide cuánto tardó en salir desde el toque.
- 🔑 **El GPS mudo se finge con un `getCurrentPosition` que no llama a nadie.** Con él, el mensaje sale a los ~4,03 s
  diciendo «No pude obtener mi ubicación exacta»: el tope de `ubicacionDeAhora.js` funciona en el navegador.
- 🔴 **El candado de la ley del botón revienta en el navegador** («ROMPIÓ: Illegal invocation»). `candado.js` guarda
  `{ poner: setTimeout, quitar: clearTimeout }` y los llama como `reloj.poner(…)`: en Node va, en el navegador no
  (la trampa ya estaba en el cuaderno general, sacada de Talaria). Medido en la página de pruebas:
  `({ poner: setTimeout }).poner(…)` → «Illegal invocation». Efecto visto con el botón de emergencia colgado del
  candado: el mensaje salía UNA vez, el botón se quedaba en «Buscando tu ubicación…» y el segundo toque no hacía
  nada. Por eso los botones de emergencia quedaron SIN candado, y el recorrido exige que el segundo toque funcione.
  Las pruebas de Node no lo ven porque le pasan su propio reloj al candado.
- El 🚨 del mapa (Solicitar.js) usa la misma función, pero probarlo pide un viaje en curso con conductor: este
  recorrido NO lo cubre.

**El candado de la ley del botón, en Créditos (27/28-sep-2026, `candado-recarga.cjs`).** Cuenta taxi@gg.test →
«Ya tengo cuenta» → entrar → «Menú» → «Mis créditos» → campo «ESCRIBE TU CÓDIGO» → botón «Recargar».
- 🔑 **Un código INVENTADO es el botón perfecto para probar el candado**: pasa por `useAccion`, el servidor contesta
  «Ese código no existe. Verifícalo» (functions/not-found) y no cambia ningún saldo. La ventanita se cierra con
  «Entendido».
- 🔴 Con lo publicado el 27-sep (reloj `{ poner: setTimeout }`): el primer toque rompe con «Illegal invocation», el
  botón se queda en «Recargando…», no sale ventanita, y ya no hay botón «Recargar» para el segundo toque. Curioso: el
  registro del rechazo SÍ sale en la consola («[rechazo] useAccion (canjear el código) · functions/not-found»): la
  acción corrió y se tradujo, pero la carrera contra el tope ya había reventado antes de decirlo.

**El pasajero cancela un viaje (28-sep-2026, G06, `cancelar-viaje.cjs`).** Cuenta pasajero@gg.test → «Ya tengo cuenta»
→ entrar (cae directo en su inicio, «¿QUÉ NECESITAS?») → «Taxi» → campos «¿Dónde estás? (Riohacha)» y «¿A dónde vas?
(Riohacha)» → botón «Solicitar Taxi — $…» → pantalla de espera → «Cancelar viaje» → ventanita «¿Por qué cancelas?».
- 🔑 **Se puede pedir un viaje sin mapa**: con el GPS fingido (`antesDeCargar`), si la dirección escrita no se
  encuentra el viaje nace en la ubicación del aparato. El viaje es de verdad en la base de PRUEBAS.
- 🔑 **El id del viaje sale de lo que la app le manda a Firestore** (`page.on('request')`, se busca
  `documents/viajes/<id>` en el cuerpo): el SDK arma el id en el aparato, y el código de seguridad NO está en el
  navegador (va al cajón privado del viaje). Con el id, `entrarALaBase` lee el viaje y se comprueba estado y motivo.
- 🔴 **Con lo publicado ANTES de G06, el robot sale rojo**: los cinco motivos se pintan `rgb(255, 255, 255)` sobre
  `rgb(255, 255, 255)`, contraste 1. El viaje igual quedó cancelado con «Otro motivo»: la caja funciona, solo no se ve.
- Visto de paso, sin tocar: al cancelar, la pantalla vuelve al inicio y el «Viaje cancelado.» del candado **no llega a
  verse nunca** (la pantalla se cierra en el mismo instante). Sale un 403 en la consola de la página en cada corrida.
- La ventanita del conductor es la MISMA (ModalCancelacion.js), pero allí solo se abre con un viaje aceptado: este
  recorrido NO la cubre. La cubre la prueba de Node (pruebas/modalCancelacion.test.js).

**El conductor sale por el menú (28-sep-2026, G07, `salir-por-el-menu.cjs`).** Cuenta taxi@gg.test → entrar →
«Transporte y movilidad» → «Soy conductor» → (ventanita de avisos: «Entendido») → interruptor «Estoy disponible» →
«Menú» (el botón «☰ Menú» de arriba a la izquierda; `getByText('Menú')`) → «Cerrar sesión» → vuelve a «Ya tengo cuenta».
- 🔑 **Lo que se juzga está en la base, no en la pantalla**: la pantalla vuelve a la de entrar con el código viejo Y con
  el nuevo. La diferencia es la ficha `conductores/{uid}`: con lo publicado antes de G07 queda `activo: true`; con
  G07, `activo: false`. El 403 de la consola sale en las DOS corridas (y en `conductor-en-turno`), así que NO es la
  señal: no se sabe de qué petición es.
- Visto de paso, sin tocar: al salir la ficha sigue con la ubicación guardada. El interruptor «No disponible» sí la
  quita (`deleteField`); la salida solo pone `activo: false`.
- Al final el recorrido deja `activo` como estaba antes de empezar.

**La placa fresca (28-sep-2026, G09, `placa-fresca.cjs`).** Cuenta taxi@gg.test → entrar → «Transporte y movilidad» →
«Soy conductor» (la app deja su copia en `localStorage`, clave `guajirago_usuario`) → el ADMIN de prueba
(admin@gg.test, con `entrarALaBase`) cambia `placa` en `usuarios/{uid}` del taxista → `p.reload()` (la copia sigue
puesta) → otra vez «Transporte y movilidad» → «Soy conductor» → se busca la placa en la pantalla → disponible → se lee
la placa de `conductores/{uid}` (la escribe su GPS con la misma placa que va en sus ofertas).
- 🔑 **`p.reload()` conserva el `localStorage`**: es la forma de «volver a abrir la app con la copia puesta» sin
  cerrar sesión. Con lo publicado ANTES de G09 sale 🔴 dos veces: la pantalla enseña PRU001 y la hoja lleva PRU001,
  con la ficha diciendo la nueva.
- 🔑 **El admin de prueba SÍ puede cambiar la ficha de otro** (como el panel); el taxista escribe su propia hoja.
- Al final se devuelven la placa de la ficha y la de la hoja, y `activo`, a lo que había. Los 403 de la consola salen
  aquí también (como en `conductor-en-turno` y `salir-por-el-menu`): no son la señal.

### contacto-emergencia (G10, 28-sep-2026)
- Seguridad enseña el número guardado en un `<span>` cuando no se edita; el segundo «Editar» es el del número y su
  campo es `input[placeholder="Ej: 3001234567"]`. El aviso de Seguridad es un `<p>` rojo en la pantalla (no ventanita).
- Para saber qué quedó en la base sin leerla: `p.reload()` y volver a Menú → Seguridad; lo que enseña es lo guardado.
- pasajero@gg.test trae el contacto sembrado 3000000001: el recorrido NO escribe nada (el número malo no pasa). Los dos
  403 de la consola salen igual que en los demás recorridos: no son la señal.

### fecha-reserva (G11, 28-sep-2026)
- Aliados como la AGENCIA: `entrarComoRestaurante(p, 'agencia@gg.test')` (la misma pieza, con otro correo). Su negocio
  es `prueba-agencia`. «Reservas» está a la vista al entrar (si no, detrás de «☰ Menú»); abre en «Nuevas».
- 🔑 **La reserva de mentira se escribe con `entrarALaBase('pasajero@gg.test')`**: las reglas dejan crearla si
  `clienteId` es el propio pasajero. `cambiar` (PATCH con máscara) CREA el documento si no existe. No se puede borrar
  (reglas: `delete: if false`), así que al final el pasajero la pone `cancelada`.
- 🔑 **El fallo depende de la zona horaria**: el recorrido lee la del navegador y exige `America/Bogota` (la del PC).
  En una máquina con hora UTC, el código viejo pintaría bien y el robot no vería nada.
- Con lo publicado ANTES de G11 sale 🔴 «la agencia ve "dom, 4 de oct"» con la reserva guardada «2026-10-05» (lunes).
- La tarjeta pinta el día en un `<p>` con 📅, dos renglones debajo del 👤 con el nombre del cliente.

### promo-asignar (G12, 28-sep-2026)
- Panel: el módulo de Promociones es el 🎁 del menú de abajo (solo superadmin). A la izquierda, «Vencidas»/«Activas».
  La tarjeta se encuentra por su nombre; el botón es «🎁 Asignar». La ventana busca a la persona por DOCUMENTO
  (`input[placeholder="Número de documento"]`) y habilita «Asignar» cuando la encuentra.
- 🔑 **Las cuentas de prueba nacen SIN documento**, así que «Asignar» no las encuentra. El recorrido le pone al
  pasajero de prueba el documento fijo `ROBOT-PASAJERO` (solo en pruebas) la primera vez.
- Las promociones de mentira las crea `entrarALaBase('admin@gg.test')` con `cambiar` (crea si no existe). No se borran
  (lápidas): al final se ponen `activa: false`, pase lo que pase (van en un `finally`).
- App: Menú → «Promociones», campo `input[placeholder="Escribe el código"]`, botón «Aplicar». El motivo del servidor sale
  como `<p>` rojo (no ventanita) y lleva pegado « [400]».
- El 403 de la consola sale igual que en los demás recorridos; el 400 es la respuesta del servidor que rechaza el código.
- Lo que se ve de paso: las fechas de las tarjetas del panel salen UN DÍA ANTES (2026-01-01 → «31/12/2025») y la app
  dice «Válida hasta 30/12/2099» de una promoción que acaba el 31: el mismo fallo de G11, en Promociones.

### precio-viaje (G13, 28-sep-2026)
- 🔑 **Un teléfono en otro idioma se simula en `antesDeCargar`**: el motor no deja escoger el idioma del navegador, así
  que se cambia `Number.prototype.toLocaleString` para que, sin idioma, escriba como `en-US`. El recorrido comprueba
  primero que de verdad escribe «10,000»; si no, no firma nada.
- El precio se lee en la BASE (el `tarifa` del viaje que la app nombró al escribir), no en la pantalla: la pantalla de
  espera pinta la tarifa con su propio formateo (eso es G14).
- `cop()` escribe «$» + ESPACIO FIJO (U+00A0) + «10.000»; un `includes('$ 10')` con espacio normal no lo encuentra.
- Pedir y cancelar es el mismo camino de `cancelar-viaje.cjs` (Taxi, GPS de mentira, «Otro motivo»).
- La oferta del conductor y la nueva oferta del pasajero no se prueban aquí: piden un conductor ofertando en vivo.

### pesos-panel (G14, 28-sep-2026)
- Mismo truco de `antesDeCargar` que `precio-viaje`, pero en el PANEL: el computador «en inglés» escribe 125500 como
  «125,500». Solo lee: no toca la base.
- Se lee la PANTALLA de 👑 Superadmin → «Ingresos reales» (la nota «mototaxi $ 800 · taxi $ 1.000») y «Control de
  créditos» («CRÉDITOS EN CIRCULACIÓN $ 460.000» el día que nació). Las secciones se abren con `getByText(label, exact)`.
- Lo que se busca como fallo es cualquier «$» PEGADO a un dígito (`/\$\d/`): así caen «$800» y «$125,500» a la vez.
- No se lee la lista de Viajes: ahí sale el `tarifa` GUARDADO de cada viaje, y los viejos siguen diciendo «$10,000»
  (G13 midió 30). Eso es dato, no pantalla, y G14 no lo toca.

## Lo que el robot dejó creado en pruebas

- 27-sep-2026: «Robot Taxi De Prueba» (robot.taxi.1790508222079@gg.test) y
  «Robot Mototaxi De Prueba» (robot.mototaxi.1790509022569@gg.test), con fotos de mentira.
- 28-sep-2026 en adelante: un viaje de Taxi de pasajero@gg.test por cada corrida de `cancelar-viaje.cjs`, ya
  cancelado por el pasajero con «Otro motivo» (el primero: ZV3QbClY4rj2kZgUILGO).
- 28-sep-2026 en adelante: una reserva de turismo `reservasTurismo/robot-g11-<hora>` a la agencia de prueba por cada
  corrida de `fecha-reserva.cjs`, cliente «Robot G11 <hora>», ya cancelada (la primera: robot-g11-1790579356242).
- 28-sep-2026 en adelante: dos promociones `promociones/ROBOT-G12V-<hora>` (vencida) y `ROBOT-G12N-<hora>` (pide 99
  viajes) por cada corrida de `promo-asignar.cjs`, ya apagadas (las primeras: ROBOT-G12V-315512 y ROBOT-G12N-315512).
  Y al pasajero de prueba se le puso el documento `ROBOT-PASAJERO`.
- 28-sep-2026 en adelante: un viaje de Taxi de pasajero@gg.test por cada corrida de `precio-viaje.cjs`, ya cancelado
  por el pasajero con «Otro motivo» (el primero: qxSxf8ofamCWGFng3Xzu).
