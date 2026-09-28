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

## Lo que el robot dejó creado en pruebas

- 27-sep-2026: «Robot Taxi De Prueba» (robot.taxi.1790508222079@gg.test) y
  «Robot Mototaxi De Prueba» (robot.mototaxi.1790509022569@gg.test), con fotos de mentira.
