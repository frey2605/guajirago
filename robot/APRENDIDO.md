# 🤖 Lo que el robot aprendió de GuajiraGo

> Cuaderno del robot probador para ESTE proyecto. Lo que vale para cualquier app está en
> `C:\Users\Windows 11\.claude\robot\APRENDIDO-GENERAL.md`. El agente que lo usa es
> `C:\Users\Windows 11\.claude\agents\probador.md`. **Cada trampa nueva se anota aquí, con la
> fecha y cómo se resolvió.**

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

## Lo que el robot dejó creado en pruebas

- 27-sep-2026: «Robot Taxi De Prueba» (robot.taxi.1790508222079@gg.test) y
  «Robot Mototaxi De Prueba» (robot.mototaxi.1790509022569@gg.test), con fotos de mentira.
