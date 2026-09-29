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
| `node robot/me-aceptaron.cjs` | el pasajero acepta a los 12 min de pedir (confirmarConductor en pruebas) y la app del conductor dice «¡Trato hecho!» y va a recoger (G24) |
| `node robot/espera-conductor.cjs` | con 300 s en el panel de pruebas, el taxista aprieta «Llegué al punto» y su reloj y el del pasajero arrancan los dos de 5:00 (G26) |
| `node robot/vencer-busqueda.cjs` | el pasajero pide un taxi, se acaba el plazo de 2 min: «No encontramos conductor» y el viaje queda vencido con fecha, quién y por qué (G27) |
| `node robot/limite-favoritos.cjs` | con el tope de favoritos en 2 en el panel de pruebas, la Ayuda y la ventanita «Llegaste al límite» dicen 2 lugares y no se guarda un tercero (G35) |

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
  · 28-sep-2026 (G18): ese $8.000 ya NO lo pone el teléfono: se lo pide al servidor (`descuentoDeBienvenida`)
    DESPUÉS de guardar la ficha, así que la celebración tarda un poco más (medido: 3,9 s con la función caliente).
    🪤 Recién publicada la función (fría), `registrar-conductor.cjs` no la vio en sus 6 s y encontró los módulos: la app
    (App.js, el vigilante de la sesión) salta a «¿QUÉ QUIERES HACER?» 2 s después de ver la ficha, y si la
    celebración llega tarde ya no se ve (el descuento SÍ queda en la ficha). Las dos corridas siguientes pasaron.
    Para esperarla se usa `waitFor` con tope, no una pausa fija.

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

### ganancias-panel (G15, 28-sep-2026)
- «GANANCIAS HOY» es una de las tarjetas de ARRIBA del panel (solo la ve el superadmin) y sale en TODAS las pantallas,
  también dentro de 👑 Superadmin: en «Ingresos reales» se busca la columna con `\bHOY` para no confundirla.
- La config de la base de pruebas trae 300 / 800 / 1.000, los MISMOS números del respaldo del panel: comparar las
  cifras de la nota no distingue la versión vieja de la nueva. Lo que sí la distingue es que la nota nueva nombra
  también el «mandado»; la vieja no. Y en pruebas no hay viajes finalizados hoy, así que las dos ganancias dan $ 0:
  la cuenta con viajes de verdad la ejecuta `pruebas/gananciasTablero.test.js`. Solo lee (usa `entrarALaBase` para
  leer config/global).

### vigencia-promo (G16, 28-sep-2026)
- Una promoción que dura UN solo día (inicio = fin = hoy en Colombia) es la que enseña el fallo de pintar: antes la
  app decía «Válida hasta» AYER y el panel pintaba «ayer → ayer». Se lee el día y el mes del texto («28/9/2026»),
  no el texto entero, porque el formato de Edge y el de Node pueden diferir en ceros.
- En el panel la tarjeta se busca en «Activas» (se toca el texto exacto `Activas`): si la regla la mandara a
  Próximas o Vencidas, no se encuentra y el robot lo dice.
- Lo que NO puede probar: la hora que importa (de 7 p. m. a medianoche) — el reloj del servidor no se mueve. Eso, y
  los anuncios (Anuncio.js), las promos de restaurante (Restaurantes.js) y el Superadmin, los EJECUTA
  `pruebas/vigenciaHoy.test.js` en cuatro zonas horarias. Por eso Anuncio.js y Restaurantes.js salen «SIN RECORRIDO».

### uso-promo (G17, 28-sep-2026)
- Las dos promociones nacen con `limiteUsosPorPersona: null` (ilimitado): así el robot se puede correr las veces que
  haga falta con el mismo pasajero sin chocar con el tope.
- Después de «¡Promoción asignada…!» hay que tocar «Cerrar» y esperar ~2,5 s: el panel vuelve a leer las promociones
  (`cargarPromos`) y solo entonces la tarjeta dice «1 usos» y «Invertido: $ 1.000».
- El «Invertido» se lee de la tarjeta y se cambia el espacio duro de `cop()` por uno normal antes de comparar.
- La asignación SÍ le sube $1.000 al pasajero de prueba: el robot se lo devuelve al final, pase lo que pase.
- Lo que NO puede probar: la otra mitad (el servidor apuntando el uso al cobrar el descuento de un viaje), porque pide
  un viaje entero con el código verificado por el conductor. Esa la ejecuta `pruebas/reglaPromocion.test.js`.

### valor-viaje-panel (G19, 28-sep-2026)
- En pruebas no había ningún viaje con `contraofertaValor` (el campo es del flujo viejo de contraofertas): el robot se
  fabrica UNO como el pasajero de prueba (las reglas le dejan crear un viaje suyo sin `conductorId`), siempre con el
  mismo id, `robot-valor-viaje-g19`: la primera vez lo crea y las siguientes solo lo pone al día (`cambiar` hace PATCH).
- Va SIN el texto `tarifa` a propósito: las tarjetas de Viajes pintan `v.tarifa || cop(valorViaje(v))`, así que con el
  texto puesto la regla no se ve nunca.
- La tarjeta se busca como el ÚLTIMO `div` que tiene el origen y un «$»: es la fila de dentro de la tarjeta, con una
  sola cifra. Viajes es el ícono 🛣️ del menú de abajo, y la pestaña se toca con el texto exacto «Sin completar».
- Lo que NO puede probar: las sumas (Conductores, Pasajeros, Mensajería, el historial y Ganancias del conductor), que
  piden viajes finalizados; esas las EJECUTA `pruebas/valorViaje.test.js`.

### viaje-cerrado (G20, 28-sep-2026)
- Un viaje EN CURSO del pasajero se consigue sin conductor: las reglas le dejan al pasajero cambiar el `estado` de SU
  viaje (no el `conductorId`), así que el robot lo pone `aceptado` desde la base y la pantalla pasa a «🚗 CONDUCTOR EN
  CAMINO» tras la celebración de 3 s. Luego lo pone `expirado` con `expiradoPor: 'sistema'` y su `motivoExpiracion`,
  como lo escribe `expirarViajesColgados`.
- La primera corrida CAZÓ UN FALLO que las pruebas de Node no veían: la ventanita salía bien, pero «Entendido» no la
  cerraba, porque el respaldo de cada 5 s de `Solicitar.js` volvía a leer el viaje cerrado y la abría otra vez. Se
  arregló apagando ese respaldo al salir (`clearInterval(intervaloRespaldoRef.current)` en `elServidorCerroElViaje`).
  La lección: las pruebas corren UNA pasada del vigilante; lo que pasa en la segunda solo lo ve quien se queda mirando.
- Lo que NO puede probar: el lado del conductor, que pide un viaje confirmado por `confirmarConductor`; ese lo
  EJECUTA `pruebas/viajeCerrado.test.js`.

### historial-viajes (G21, 28-sep-2026)
- Las dos «Mis viajes» del pasajero se abren igual: «Menú → Mis viajes». Recién entrado, la pantalla es la de MÓDULOS
  y ese menú abre `MisViajes.js`; tras «Transporte y movilidad → Soy pasajero», el mismo menú abre la de `Home.js`.
- Si la consulta ordenada falla (índice `pasajeroId` + `fechaSolicitud` sin construir) la pantalla dice «Aún no tienes
  viajes» y NO avisa de nada: por eso el recorrido lo trata como fallo. El índice se publica ANTES que la app y se
  espera a que el servidor lo diga READY (la primera espera se cortó sola porque la sesión dio un fallo pasajero y el
  `grep -q CREATING` lo leyó como «ya no está creando»: se espera la línea READY, no la ausencia de CREATING).
- No escribe nada: se apoya en los viajes `expirado` que deja `viaje-cerrado.cjs` (salen «Quedó sin terminar»).
- El portero avisó de sellos INVALID en esta tanda; los recorridos pasaron igual. No se investigó aquí.

### ganancias-conductor (G23, 28-sep-2026)
- El conductor llega a las dos pantallas por «Transporte y movilidad → Soy conductor → Menú»: «Ganancias» (tarjeta HOY,
  texto «HOY … GANADO $ x») y «Mis viajes» (recuadro «GANANCIAS DE HOY», que SOLO sale si la cifra es mayor que 0).
- 🔴 No se puede fabricar un viaje finalizado de un conductor desde afuera: las reglas no dejan poner `conductorId` a
  nadie (ni al admin: «Missing or insufficient permissions»); solo lo pone el servidor en `confirmarConductor`. Y el
  taxista de prueba no tiene ningún viaje. Por eso el recorrido solo comprueba que las dos pantallas abren con la
  consulta nueva sin error en la consola y dicen lo mismo ($ 0 y sin recuadro, hoy); la suma la ejecuta
  `pruebas/gananciasHoy.test.js`.
- Si la consulta fallara (índice `conductorId + estado + fechaSolicitud` o reglas), el historial lo escribe en la
  consola (`console.error`) y «Ganancias» se queda callada en $ 0: el recorrido mira la consola por eso.

### me-aceptaron (G24, 28-sep-2026)
- 🔑 **Un viaje ACEPTADO sí se puede fabricar desde afuera**, y como en la calle: el pasajero de prueba crea su viaje
  (las reglas le dejan crearlo sin `conductorId`), el taxista deja su oferta en `viajes/{id}/contraofertas/{suUid}`, y
  el PASAJERO llama a `confirmarConductor` (`db.llamar(nombre, datos)` de `comun.cjs`, anotado en el cuaderno como
  `cloudfunctions`). Lo que dice arriba G23 («solo lo pone el servidor») sigue siendo cierto: lo pone el servidor, pero
  el robot se lo puede pedir. El servidor de pruebas contestó `{"ok":true}`.
- El taxista tiene que estar LIBRE antes (`enViajeId: null`): con una marca de otro viaje el servidor contesta «ocupado».
- El caso que importa es la aceptación TARDÍA: la fecha de solicitud se escribe 12 min atrás (el servidor deja aceptar
  hasta 20). Con el código de antes publicado en pruebas el robot salió 🔴 («no se enteró»: el servidor ya había
  confirmado y la app del taxista seguía en la lista); con el arreglo, «¡Trato hecho!» y «YENDO A RECOGER» con el origen.
- Cuesta UNA comisión de los créditos de prueba del taxista en cada corrida (la cobra el servidor; las reglas no dejan
  devolverla). Al final el taxista cancela el viaje y su ficha vuelve a como estaba (enViajeId, ocupado, activo).
- El 403 de la consola sale igual que en los demás recorridos.

### estados-panel (G25, 28-sep-2026)
- El pasajero de prueba puede dejar SU viaje en `expirado` o `finalizado` (las reglas le dejan cambiar el `estado` de
  su viaje sin `conductorId`): así se fabrica el caso que la lista vieja no veía, siempre en el mismo documento.
- 🛣️ Viajes → «Buscar» (texto exacto) tiene UN solo `<select>`, el de ESTADO: se leen sus opciones con
  `allInnerTexts()` y se escoge por VALOR (`selectOption('expirado')`), no por el texto.
- La ficha del pasajero: 🙋 → «Buscar» → «Correo electrónico» = pasajero@gg.test → «🔍 Buscar» → tocar la tarjeta.
  El panel carga los viajes UNA vez al abrir, así que para ver un cambio de la base hay que recargar la página y
  volver a entrar. El caso que muerde es la DIFERENCIA: «❌ Cancelados» baja en uno al pasar el viaje de `expirado`
  a `finalizado` (con la lista vieja no bajaba). Con el pasajero de prueba salió 21 → 20.
- Lo que NO mira: el tablero (App.js) y las cajas de Mensajería; esas cuentas las EJECUTA
  `pruebas/estadosPanel.test.js` viaje por viaje.

### espera-conductor (G26, 28-sep-2026)
- 🔑 **Dos apps a la vez sí se puede**: `abrir('transporte', …)` dos veces da dos navegadores aparte, uno con el taxista
  y otro con el pasajero, y los dos ven el mismo viaje en vivo.
- El viaje lo pide el PASAJERO por la pantalla (como en `viaje-cerrado`, sacando el id de lo que la app manda a
  Firestore), el taxista deja la oferta por la base y el pasajero la acepta con `confirmarConductor` (como en
  `me-aceptaron`). Después, en la app del taxista: botón `📍 Llegué al punto`.
- Los relojes se leen del texto: el del taxista va detrás de «Esperando al pasajero...» y el del pasajero detrás de
  «Sal pronto o el conductor puede cancelar», con forma `m:ss`. A los 4 s de apretar se leen 297 y 297.
- El caso que muerde es poner en config/global de PRUEBAS un número distinto de 240 (el superadmin de prueba puede):
  300. Con el código de antes publicado en pruebas salió 🔴 taxista 297 · pasajero 237; con el arreglo, 297 · 297.
  Al final se devuelve el número de antes (quedó en 240).
- Cuesta UNA comisión de los créditos de prueba del taxista en cada corrida, como `me-aceptaron`.

### vencer-busqueda (G27, 28-sep-2026)
- No hay que tocar nada: se pide el taxi y se ESPERA el plazo entero (BUSQUEDA.segundos de configApp.js, que el
  recorrido lee de la pieza, no lo copia) más 8 s de margen. Tarda ~3 min.
- A los 4 s de pedir el reloj ya va en 1:58. Al acabarse sale «No encontramos conductor» con «🔄 Seguir buscando» y
  la tarjeta de subir la oferta; NO sale «Este viaje ya se cerró» (esa ventanita es solo para lo que cierra el
  servidor en fase1/fase2).
- En la base: `vencido` · `expiradoPor: app-pasajero` · `fechaExpiracion` · `motivoExpiracion: «llevaba 2 min
  buscando conductor y nadie lo tomó»`. Que entre prueba también que las reglas dejan al pasajero escribir esos
  campos en su viaje (no hay lista cerrada de campos para el dueño del viaje).

### ruta-conductor (G29, 28-sep-2026)
- Mismo arranque que `espera-conductor` (dos apps, pedir por pantalla, oferta por la base, `confirmarConductor`), pero
  cada app con SU GPS de mentira: el taxista en la plaza y el pasajero 1,3 km al sur. Al sur del mapa es donde está la
  tarjeta: es el caso que muerde. Y el punto de recogida del viaje se escribe (`pasajeroLat`/`pasajeroLng`) antes de la
  oferta, porque la dirección escrita a mano la puede encontrar Google en otro sitio.
- 🔑 Google Maps SÍ carga en `guajirago-pruebas.web.app` (la ruta sale pintada). El `403` que sale en la consola de las
  dos apps ya salía antes del arreglo: no es del mapa.
- Los marcadores de Google se encuentran como un `div` sin hijos cuyo texto es SOLO el emoji (🚗/🏍️ o 📍).
- 🪤 La tarjeta NO se puede buscar como «lo que va pegado abajo»: Google también pinta capas `absolute` con `bottom: 0`
  a todo lo ancho, y la «tarjeta» salía empezando en y=0. Las de la app llevan `zIndex: 10` en su estilo; las de
  Google no.
- 🔑 Lo que enseñó (y ninguna lectura del código veía): el mapa del pasajero, que «sí dejaba sitio», TAMPOCO lo hacía.
  El `DirectionsRenderer` sin `preserveViewport` re-encuadra él solo, sin margen, y pisa el `fitBounds`: con el código
  de antes las DOS apps salían idénticas (🚗 y=121 · 📍 y=692, pantalla de 860) y el 📍 quedaba debajo de la tarjeta
  (taxista: empieza en 566; pasajero: en 451, la suya mide ~409 por el código de seguridad). Con el arreglo: taxista
  🚗 165 · 📍 451; pasajero 🚗 108 · 📍 394.
- Cuesta UNA comisión de los créditos de prueba del taxista en cada corrida.

### direccion-pedido (G30, 28-sep-2026)
- Camino: pasajero → «Restaurantes» (texto exacto) → «Restaurante de Prueba» → el `+` de un plato es un texto «+»
  (no un botón con nombre): `getByText('+', { exact: true }).last()` echa el «Jugo de corozo». Con algo en el carrito
  aparece abajo el campo «📍 Dirección de entrega» y el botón «📍 Usar mi ubicación». No hace falta pedir nada: el
  recorrido no toca la base.
- 🔑 Para decidir qué contesta Google se cambia `window.google.maps.Geocoder` en cuanto Google carga (un `setInterval`
  de 100 ms en `antesDeCargar`). Sirve porque la pantalla hace `new window.google.maps.Geocoder()` AL TOCAR el botón,
  no al cargar. Si un día lo crea al cargar, el cambio llegaría tarde: por eso el recorrido comprueba `__geoCambiado`
  y que se le preguntó UNA vez por el punto del GPS.
- La ventanita de «Falta el nombre de la calle» es la misma de «Ubicación no disponible» (la del GPS negado), con otro
  título. Con el `403` de siempre en la consola, que no es de esto.

### flujos-pedido (G33, 28-sep-2026)
- Camino: restaurante@gg.test → ☰ → «Configuración» (texto exacto) → «Flujos de pedido» (texto exacto). El recuadro
  de domicilio es el padre del `<p>` «🏍️ Pedidos a domicilio»; sus filas son los hijos desde el tercero (antes van el
  título y la explicación). El nombre de la etapa es el primer `<p>` de cada fila y «(siempre)» va DENTRO de él.
- No se toca «Guardar flujos»: el recorrido solo lee. En pruebas el restaurante tiene las 6 etapas encendidas.
- 🔑 Lo que de verdad arregló G33 (el aviso «¡Pedido entregado!» cuando el negocio apaga esa etapa) no se ve en una
  pantalla: es un aviso del servidor. Lo ejecuta pruebas/estadosPedido.test.js con las 16 formas del flujo, y en la
  nube de pruebas se miró el registro de `notificarClienteDelPedido`.

### limite-favoritos (G35, 28-sep-2026)
- Camino a la Ayuda: nada más entrar como pasajero@gg.test, «Menú» → «Ayuda y soporte»; el buscador es
  `input[placeholder="Busca tu pregunta..."]` y la pregunta se abre tocando su texto. «Volver» regresa a módulos.
- Camino a la ventanita: Taxi → escribir solo el DESTINO (`¿A dónde vas? (Riohacha)`) y `Escape`; el botón de guardar es
  el texto «➕» (exacto). El origen lo llena el GPS de mentira.
- 🔑 El tope se pone en 2 A PROPÓSITO, distinto del respaldo de configApp.js (3): si alguna pantalla no leyera el panel
  diría 3 y el recorrido lo pillaría. En pruebas config/global tenía 3 y el pasajero 0 favoritos: se devuelven al final.
  Con el mismo `403` de siempre en la consola, que no es de esto.

### llamado-atencion (G37, 28-sep-2026)
- El llamado se pone como lo pone el panel: `admin@gg.test` escribe `usuarios/<uid>.llamadoPendiente` con `cambiar`
  (el pasajero de prueba no puede escribírselo a sí mismo como si fuera el panel, y así no hace falta abrir el panel).
- 🔑 **Para probar el «no se pudo» del candado sin romper nada: `pagina.context().setOffline(true)`.** La escritura se
  queda esperando, a los 20 s el candado dice «Sin confirmar · No se pudo confirmar…» y, al devolver la señal con
  `setOffline(false)`, la escritura entra sola y el aviso se corrige: la ventanita se cierra. Los `ERR_FAILED` de la
  consola en ese rato son del corte, no de la app.
- Careo en pantalla ANTES de publicar: con el código viejo el robot vio **2** ventanitas «MENSAJE DE GUAJIRAGO» y el
  clic en «Entendido» se quedó 30 s sin poder darse (una tapaba a la otra). Con el nuevo: 1, y el clic entra.
- El aviso del fallo tiene que ir DENTRO de la ventanita del llamado: ésta va a `zIndex 99999` y AvisoModal a 10000,
  así que puesto fuera quedaría tapado. En la captura se ve el aviso encima, con el borde naranja del llamado detrás.
- Al final el campo queda en `null` si no lo tenía (el robot no sabe borrar un campo; la app lee `null` y «no está»
  igual).

### promo-asignar · la frase del servidor, limpia y en ventanita (G38, 28-sep-2026)
- 🔑 **La librería de firebase 12 le pega « [estado]» a TODO mensaje de nuestras funciones** («… Llevas 0 [400]»). En
  pantalla ya no sale (lo quita `motivoDeRechazo`), pero en la CONSOLA sí, en el renglón `[rechazo] useAccion (…)`:
  ese es el sitio bueno para la marca. Si el robot busca la frase en `a.texto()`, que no la exija con la marca.
- La ventanita del candado dice el título «No se pudo aplicar el código» y la frase debajo; el recorrido exige los dos.
- La primera corrida dentro de `probar-cambio.cjs` falló con «locator.click: Timeout 30000ms» en el lado del PANEL;
  corrida sola, a los dos minutos, pasó entera. Es la carrera del panel al cargar, no la app: se vuelve a correr
  antes de llamarlo fallo.

### ventanitas-aviso · el aviso sale en la ventanita común (G39, 28-sep-2026)
- 🔑 **Las palabras no distinguen la ventanita común de una hecha a mano**: las dos dicen «Atención» y «Entendido». Lo
  que sí las distingue es el botón: el de `AvisoModal` es azul liso (`rgb(28, 142, 249)`, sin degradado) y los de las
  hechas a mano eran naranja degradado. El recorrido lo lee con `getComputedStyle` (fondo e imagen de fondo). Con el
  código de antes (la app de pruebas sin publicar) salió 🔴 «linear-gradient(… rgb(255, 207, 77) …)»; es la forma de
  saber que el recorrido mira algo.
- En el inicio hay DOS botones «Crear cuenta» a lo largo del camino (el del inicio y el de enviar el registro): se toca
  `.first()` en el inicio y `.last()` ya en el registro.

### motivo-fallo · el fallo al guardar dice por qué (G40, 28-sep-2026)
- 🔑 **Un rechazo de verdad sin tocar datos**: una «foto» de 11 MB (`setInputFiles` con un `Buffer` y `mimeType`
  `image/jpeg`) pasa el `accept="image/*"` del teléfono, pero el almacén la rechaza por grande (`esUnaFoto` pide menos
  de 10 MB) con un 403 → `storage/unauthorized`. No se sube nada y el perfil no se toca.
- Con el código de antes (la app de pruebas sin publicar) salió 🔴 «Error al guardar. Revisa tu conexión e intenta de
  nuevo» con la red perfecta; con G40 dice «Algo falló por el camino y el cambio no se hizo. Inténtalo otra vez.» y la
  consola lleva el rastro `[rechazo] MiPerfil.js (guardar) · storage/unauthorized`.
- ⚠ `motivoDeRechazo` no conoce los códigos del almacén (`storage/unauthorized` cae en «otro», no en «sin permiso»):
  anotado para el dueño, no se tocó (la pieza está tres veces, atada en los tres repos).
- `registrar-conductor` salió 🔴 una vez dentro de `probar-cambio` y ✓ al correrlo solo, sin cambiar nada: se carea
  antes de llamarlo fallo.

### whatsapp-panel · el «💬 WhatsApp» abre el número de la pieza (G41, 28-sep-2026)
- 🔑 **Ver a dónde abre un botón sin abrir nada**: `antesDeCargar` cambia `window.open` por uno que solo apunta la
  dirección en `window.__abiertos` y devuelve `{}`. Así se lee el enlace exacto y no sale ninguna pestaña.
- ⚠ `r.texto()` llega en UN solo renglón: un `match(/📞\s*([^\n]*)/)` se traga la ficha entera. El teléfono se corta
  en el siguiente ícono (`/📞\s*(.*?)\s*✉️/`).
- En pruebas hay un restaurante y una agencia, los dos con un teléfono BUENO (+57 …20): la ventanita «No puedo abrir
  WhatsApp» no se ve sin tocar datos; esa rama la ejecuta `pruebas/numeroWhatsApp.test.js`.
- Las tarjetas de la lista se encuentran por lo que dicen («N platos», «N tours/alquileres»), no por el estilo solo.

### telefono-unico · Mi perfil no guarda un teléfono que no sirve (G42, 28-sep-2026)
- En Mi perfil el teléfono guardado es el `span` que va justo después del del ícono «📞»; el segundo «Editar» (`nth(1)`)
  es el del teléfono y su campo es `input[placeholder="Tu teléfono"]`. Con «abc» sale el renglón rojo «10 cifras» y
  no se escribe nada (pasajero@gg.test tiene 3000000000).
- `registrar-conductor` salió 🔴 UNA vez dentro de la tanda del robot y ✓ al correrlo solo, sin tocar nada: es el que
  pasa por `celularDisponible` (ya compara por las 10 cifras en pruebas). Si vuelve a salir rojo, mirar su salida
  entera antes de culpar al cambio: el resumen de `probar-cambio.cjs` no dice el motivo.

### foto-pasajero-panel · la foto del pasajero sale en el panel (G43, 28-sep-2026)
- Ningún pasajero de pruebas tiene foto, así que el recorrido le PONE una a pasajero@gg.test (`fotoConductor`, que es
  el nombre con que «Mi perfil» la guarda) y la devuelve al final. La foto es una imagen SVG escrita en la propia
  dirección (`data:image/svg+xml;utf8,…`): carga sin almacén y sin red, y el panel la pinta igual que una de verdad.
- 🙋 Pasajeros → «Buscar» → `input[placeholder="Correo electrónico"]` → «🔍 Buscar» → tocar el `div` con el correo
  (el mismo camino de `estados-panel`). La foto se busca por su `src` exacto entre los `img`, y se exige que cargue
  (`naturalWidth > 0`).
- 🪤 `base.cambiar` no sabe BORRAR un campo (un `undefined` lo rechaza `aCampos`): si no había foto, se deja en `null`,
  que para `fotoDe` es «sin foto».
- `registrar-conductor` salió 🔴 dos veces seguidas («no salió la bienvenida al crear la cuenta») y ✓ la tercera, sin
  tocar nada: es la celebración que espera a `descuentoDeBienvenida` en frío (ver arriba, G18). G43 no toca el registro.

### placa-panel · el panel no guarda una placa o un vehículo que no sirven (G45, 28-sep-2026)
- 🚗 Conductores → «Buscar» → `input[placeholder="Nombre del conductor"]` con la primera palabra del nombre de
  taxi@gg.test (se lee de su ficha) → «🔍 Buscar» → su fila → «✏️ Editar datos». Las casillas de edición no tienen
  `placeholder`: se buscan por su rótulo, `p` «PLACA» / «VEHÍCULO» y el `input` del `div` que le sigue.
- Un caso por vuelta (primero la placa, después el vehículo): la placa se revisa ANTES que el vehículo, así que con
  los dos malos a la vez solo se vería la ventanita de la placa. Tras cada «Guardar cambios» se cierra la ventanita
  («Entendido») y, si la edición sigue abierta, «Cancelar».
- Careo hecho: con el panel viejo en pruebas guardó «AB 12» y «hola» sin decir nada (🔴 4 fallos); con el nuevo,
  ventanita «Revisa la placa» / «Revisa el vehículo» y la ficha como estaba (✓).
- La ficha de taxi@gg.test tiene vehículo «Chevrolet Spark (de prueba)», que NO es «Marca Año»: no pasa nada mientras
  no se edite el vehículo (la regla solo mira lo que se cambia).
- `registrar-conductor` salió 🔴 una vez en la tanda y otra solo («no salió la bienvenida»), y ✓ las dos siguientes; el
  mototaxi (placa ROB12A) ✓ a la primera. La placa del registro pasa por la regla nueva y ROB123 / ROB12A siguen sirviendo.

### horario-agencia · la agencia y el restaurante dicen lo mismo con la misma hora (G46, 29-sep-2026)
- En pruebas la agencia y el restaurante de prueba abren y cierran a las 0 y a las 0 (lo siembra
  `sembrar-pruebas.cjs`): con la regla vieja la lista de agencias decía «Cerrada ahora» A TODA HORA y la de
  restaurantes «Abierto ahora». Con G46 las dos salen abiertas (misma hora = 24 horas).
- Pasajero → «Turismo» (el cuadro del menú de módulos, texto exacto) → la tarjeta «Agencia de Turismo de Prueba»; su
  renglón de estado es un `p` que dice «Abierta ahora» o «Cerrada ahora». En Restaurantes el estado va en un `span`
  («Abierto ahora» / «Cerrado ahora»). Se busca el nombre y, en los 8 nodos `p`/`span` siguientes, el estado.
- Para ver que la regla sigue CERRANDO, la agencia (agencia@gg.test, por la base) se pone de (hora de Colombia + 2) a
  (+ 4); el pasajero vuelve a Turismo y ve «Cerrada ahora». Al final se le devuelve el 0 y 0 (se lee para comprobarlo).
- ✓ a la primera. Los dos 403 de la consola salen igual que en los demás recorridos.

### pedir-ahora · el dueño y el panel dicen lo mismo que el cliente (G47, 29-sep-2026)
- El restaurante de prueba (restaurante@gg.test, por la base) se pone de (hora de Colombia + 2) a (+ 4). En aliados,
  `entrarComoRestaurante` deja al dueño en la bienvenida: la tarjeta tiene que decir «🔴 Cerrado ahora» y «Estás fuera
  de tu horario: ahora no pueden pedirte», y NO «Los clientes pueden pedirte». En el panel (admin@gg.test) → 🍽️ (menú
  de abajo, texto exacto del ícono) → la sección «Todos» ya viene abierta; el chip va en un `span` en los 8 nodos
  `p`/`span` después de «Restaurante de Prueba» y dice «⚪ Fuera de horario».
- Corrido ANTES de publicar (pruebas con el código viejo) salió ROJO: el dueño veía «Los clientes pueden pedirte» y el
  panel «🟢 Abierto» fuera de horario. Después de publicar, verde a la primera. Al final se le devuelve el 0 y 0.
- Los 403 de la consola salen igual que en los demás recorridos.

### fecha-pedido · «pedidos hoy» del panel cuenta el domicilio (G48, 29-sep-2026)
- El Restaurante de Prueba pide un mínimo de $ 10.000: un «Jugo de corozo» ($ 5.000) no alcanza y el botón dice
  «Pedido mínimo $ 10.000». Se toca dos veces el ÚLTIMO «+» (el primero es el del menú; el segundo ya es el del carrito).
- En el panel, «🧾 N pedidos hoy» va en un `span` dentro de los 12 nodos `p`/`span` después de «Restaurante de Prueba».
  En la ficha (se abre tocando el nombre), cada fila de «Pedidos recientes» dice «<fecha> · <estado>»: el separador no
  casa con « · » a pelo (el texto no trae espacios normales ahí); se busca con `\s·`.
- Corrido con el panel VIEJO publicado en pruebas (a9b5a4c): «0 pedidos hoy» antes y después del domicilio, y las tres
  fechas de la ficha en «—». Con el nuevo (2df3503): sube en uno y las fechas salen («29/9/2026, 1:17:32 a. m.»).
- Los 403 de la consola salen igual que en los demás recorridos.

### corte-caja-hoy · el «hoy» de Corte de caja es el de Colombia (G48, 29-sep-2026)
- Para probar «a las 8 p. m.» sin esperar a las 8 p. m.: `antesDeCargar` cambia `window.Date` por uno CORRIDO (misma
  hora que corre, más un corrimiento hasta las 20:00 de hoy en Colombia). `new Date(x)` con fecha no se toca. El
  inicio de sesión de Firebase aguanta el reloj corrido unas horas hacia adelante sin quejarse.
- Corte de caja está en ☰ → «💰 Corte de caja» (el módulo `corte` viene encendido en el restaurante de prueba). Las
  fechas «desde / hasta» son los dos `input[type="date"]`.
- Con aliados VIEJO publicado en pruebas (2e224b7) las dos salen con el día de MAÑANA; con el nuevo (f56c606), hoy.

### aprobar-negocio · aprobar respeta lo que se apagó en Cobros (G49, 29-sep-2026)
- Las llaves se ponen como SUPERADMIN (`entrarALaBase('admin@gg.test')`): el dueño del restaurante no puede escribir
  `aprobado` ni `activo` (las reglas se lo niegan). Suspendido + `activo:false` es lo que deja Cobros al apagar «La
  cuenta está viva».
- La ficha del panel se abre tocando el nombre «Restaurante de Prueba» en la lista de 🍽️; con `aprobado:false` el botón
  es «✅ Aprobar» y, ya aprobado, sale «🚫 Suspender» (sirve para saber que el clic entró).
- La verdad se lee en la BASE, no en la pantalla: el chip dice «Bloqueado» en los dos casos y no distingue.
- Con el panel VIEJO publicado en pruebas (2df3503) `activo` vuelve a true; con el nuevo (6d06be8) se queda en false.
- Los 403 de la consola salen igual que en los demás recorridos.

### estado-aprobacion · el suspendido no sale como pendiente (G50, 29-sep-2026)
- 🤝 Aliados pendientes NO está en el menú de abajo del panel: está DENTRO de 👑 Superadmin, en su lista de secciones con
  su nombre («Aliados pendientes»). Buscar el ícono 🤝 suelto se queda esperando 30 s.
- La tarjeta de un negocio se agarra como «el último div que tiene el nombre Y algún botón»: la cabecera tiene el nombre
  sin botones y la fila de botones no tiene el nombre; solo la tarjeta tiene las dos cosas.
- No hace falta pulsar nada: lo que se prueba es cómo se ENSEÑA. Solo se cambian `aprobado` y `estadoAprobacion` del
  Restaurante de Prueba y se le devuelven.
- Con el panel VIEJO publicado en pruebas (6d06be8) la tarjeta del suspendido sale sin etiqueta y con «Rechazar /
  ✅ Aprobar»; con el nuevo, «SUSPENDIDO» y «Reactivar y aprobar».

### menu-navegacion · «Mis viajes» y «Ganancias» abren lo mismo desde cualquier sitio (G51, 29-sep-2026)
- «La misma pantalla» se compara con una FIRMA de lo pintado: el texto entero y cuántos logos
  (`svg[aria-label="GuajiraGo"]`) lleva. La del conductor no lleva logo y la de los dos lados sí: con un conductor sin
  viajes, las dos dicen el mismo «Aún no tienes viajes» y solo el logo las separa.
- La de los dos lados se reconoce por las etiquetas «Como pasajero / Como conductor» de cada tarjeta.
- El «muy pronto» del menú es un `alert()`: el motor lo apunta en los errores como «ALERTA: …», y el recorrido además
  escucha `dialog` para contarlo. Si no se abre nada, NO se puede pulsar «Volver» a ciegas: en el menú del pasajero
  ese «Volver» es el de la pantalla y saca a «rol».
- taxi@gg.test entra EN TURNO, así que la tarjeta «Mis viajes / Ver historial y ganancias» (solo sale fuera de turno)
  no aparece; esa tarjeta la ejecuta pruebas/menuNavegacion.test.js.
- Con la app VIEJA publicada en pruebas: pasajero, módulos → la de los dos lados (50 etiquetas) y su menú → la suya;
  «Ganancias» del pasajero → «muy pronto»; taxista, módulos → la de los dos lados (39 etiquetas) y su menú → la suya.

### total-recargas · «VALOR RECARGADO» es la cuenta única del panel (G54, 29-sep-2026)
- La base de pruebas NO tenía ningún código de recarga: sin datos la cuenta vieja y la nueva dan $ 0 y el recorrido no
  demuestra nada. Por eso crea (solo si faltan) dos códigos fijos: uno cobrado ($ 50.000) y otro cobrado y ANULADO
  ($ 40.000), el caso que separaba las cuentas. Las reglas no dejan borrar un código ni cambiarle `usado`: se REUSAN.
- Los códigos no se pueden LISTAR desde el robot (`entrarALaBase` solo lee de a uno): el recorrido saca los nombres de
  la pantalla «Todos» (el texto que va justo después de la etiqueta DISPONIBLE / USADO / ANULADO) y los lee uno por uno.
- Con el panel VIEJO publicado en pruebas: «VALOR RECARGADO» $ 50.000 contra $ 90.000 de la cuenta única → rojo.
  Con el nuevo, $ 90.000 → verde.

### que-paso-panel · Viajes y Mensajería dicen lo mismo de cada final (G56, 29-sep-2026)
- El pasajero de prueba SÍ puede escribir un mandado en `cancelado_conductor` (con `canceladoPor` y `razonCancelacion`)
  y otro en `expirado` con `motivoExpiracion`: las reglas lo dejan porque el viaje es suyo.
- 📦 Mensajería → Buscar filtra al escribir (sin botón); el campo se encuentra por el principio del texto de ayuda
  (`placeholder^="Quien envía"`). 🛣️ Viajes → Buscar sí necesita «🔍 Buscar», y el detalle se abre tocando la tarjeta.
- Con el panel VIEJO (862a143) publicado en pruebas: Mensajería dice «Lo soltó el repartidor», Viajes otra cosa, y ninguna
  enseña el porqué del sistema → 4 fallos, rojo. Con el nuevo → verde.

### llave-maps · Maps carga con la llave del .env (G62, 29-sep-2026)
- La llave de Maps se lee del `<script>` que queda en la página (`document.scripts`), no del código: es lo que de verdad
  sirvió el sitio. Si CRA no la reemplazó, llega como `%REACT_APP_GOOGLE_MAPS_KEY%`.
- `window.gm_authFailure` es lo que Google llama cuando la llave o el dominio no valen; se pone en `antesDeCargar` para
  que exista antes de que Google cargue. Google comprueba la llave al DIBUJAR, así que el recorrido dibuja un mapa
  pequeño (espera `tilesloaded`) sin entrar con ninguna cuenta.
- Con la llave escrita a mano (antes de G62) y con la del .env (después): las dos apps de pruebas cargan, dibujan y 0
  rechazos.

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
- 28-sep-2026 en adelante: una promoción `promociones/ROBOT-G16-<hora>` de un solo día por cada corrida de
  `vigencia-promo.cjs`, ya apagada.
- 28-sep-2026 en adelante: dos promociones `promociones/ROBOT-G17C-<hora>` (crédito, con 1 uso) y `ROBOT-G17P-<hora>`
  (porcentaje) por cada corrida de `uso-promo.cjs`, ya apagadas; el saldo del pasajero se devuelve.
- 28-sep-2026 en adelante: una cuenta de pasajero nueva «Robot Pasajero De Prueba» (robot.pasajero.<hora>@gg.test, con
  la clave de pruebas) por cada corrida de `bienvenida-pasajero.cjs`, con su crédito de bienvenida sin usar (la primera:
  robot.pasajero.1790596960121@gg.test).
- 28-sep-2026 en adelante: UN solo viaje `viajes/robot-valor-viaje-g19` de pasajero@gg.test, cancelado, con
  tarifaValor 10.000 y contraofertaValor 11.000; cada corrida de `valor-viaje-panel.cjs` lo reusa (no se amontonan).
- 28-sep-2026 en adelante: un viaje de Taxi de pasajero@gg.test por cada corrida de `viaje-cerrado.cjs`, ya `expirado`
  por «el sistema» y sin conductor (el primero: qo4yNd13wlwWQs3We2D1).
- 28-sep-2026 en adelante: un viaje de Taxi `viajes/robotG24<hora>` de pasajero@gg.test por cada corrida de
  `me-aceptaron.cjs`, aceptado por el taxista y ya `cancelado_conductor` (el primero: robotG241790613250747).
- 28-sep-2026 en adelante: UN solo viaje `viajes/robot-estados-panel-g25` de pasajero@gg.test, `expirado`, sin
  conductor; cada corrida de `estados-panel.cjs` lo reusa (lo pasa un momento a `finalizado` y lo devuelve).
- 28-sep-2026 en adelante: un viaje de Taxi de pasajero@gg.test por cada corrida de `espera-conductor.cjs`, aceptado
  por el taxista, con «Llegué al punto» y ya `cancelado_conductor` (el primero: LPAelN1GEn69u32GPCcK).
- 28-sep-2026 en adelante: un viaje de Taxi de pasajero@gg.test por cada corrida de `vencer-busqueda.cjs`, ya
  `vencido` por «app-pasajero» y sin conductor (el primero: AMXhA9Ea3CoD6VEK9AiC).
- 28-sep-2026 en adelante: un viaje de Taxi de pasajero@gg.test por cada corrida de `ruta-conductor.cjs`, aceptado
  por el taxista y ya `cancelado_conductor` (el primero: foMJSjN38ljk9fUWVraa).
- 28-sep-2026 en adelante: la ficha de pasajero@gg.test lleva `fotoConductor: null` (lo deja `foto-pasajero-panel.cjs`
  al devolverla; antes no tenía el campo). Para `fotoDe` es lo mismo: sin foto.
- 28-sep-2026 en adelante: la ficha de taxi@gg.test lleva `marca: null` y `modelo: null` (lo deja `placa-panel.cjs` al
  devolverla; antes no tenía esos campos). Nadie los lee de esa ficha.
- 29-sep-2026 en adelante: un pedido de domicilio de pasajero@gg.test al Restaurante de Prueba por cada corrida de
  `fecha-pedido.cjs` (dos jugos de corozo, «Calle Robot G48 #1-2»), ya `cancelado` por el cliente.
- 29-sep-2026 en adelante: el Restaurante de Prueba lleva `fechaAprobacion` (lo escribe cada corrida de
  `aprobar-negocio.cjs`; antes no tenía el campo). `aprobado`, `estadoAprobacion` y `activo` se le devuelven como estaban.
- 29-sep-2026 en adelante: una promoción `promociones/ROBOT-G52-<hora>` sin tipo de beneficio y valor 15, de un solo día,
  por cada corrida de `texto-beneficio.cjs`, ya apagada.
- 29-sep-2026: dos códigos de recarga FIJOS de `total-recargas.cjs`, `codigos/ROBOT-G54-COBRADO` ($ 50.000, usado) y
  `codigos/ROBOT-G54-COBRADO-ANULADO` ($ 40.000, usado y anulado), sin conductor. Ya cobrados: nadie los puede canjear y
  no tocaron ningún saldo. Cada corrida los reusa. Suben el «💰 Recargas» del tablero de pruebas del 29-sep a $ 90.000.
- 29-sep-2026 en adelante: dos mandados FIJOS de pasajero@gg.test, `viajes/robot-que-paso-g56-soltado`
  (`cancelado_conductor`) y `viajes/robot-que-paso-g56-cerrado` (`expirado`, con `motivoExpiracion`), de
  `que-paso-panel.cjs`. Cada corrida los reescribe; ya terminados, nadie los toma.
