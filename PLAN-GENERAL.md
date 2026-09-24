# 🗺️ PLAN GENERAL — GuajiraGo y el software de Aliados

> **Qué es este archivo.** El plan de arriba, el que manda sobre los demás. No trae código ni
> pasos detallados: trae las **decisiones de fondo**, el **orden** en que hay que hacer las cosas
> y **cómo se sabrá que cada una quedó hecha**. Cada punto de aquí se desglosa después en su
> propio plan de trabajo, con sus 14 pasos.
>
> **Escrito el 24-sep-2026.** Todo número lleva al lado el comando que lo produjo, porque un
> número sin comando no se puede recontar y es el que se queda viejo sin que nadie se entere.

---

## 0 · LO QUE HAY HOY, MEDIDO

No supuesto. Cada fila se puede volver a contar.

| Qué | Cuánto | Con qué se contó |
|---|---|---|
| Proyectos Firebase | **1** (`guajirago`) | `cat .firebaserc guajirago*/.firebaserc` |
| Ambientes | **1**, y es **producción** | `grep -rhoE "projectId: *['\"][^'\"]+" */src` → un solo valor |
| App Check | **no existe** | `grep -rl "appCheck\|AppCheck" */src */functions` → 0 fuera de `node_modules` |
| Escrituras del celular directo a la base | **150** | `grep -rhoE "\b(addDoc\|setDoc\|updateDoc\|deleteDoc)\(" */src \| wc -l` |
| Llamadas a funciones del servidor | **8** | `grep -rhoE "httpsCallable\(" */src \| wc -l` |
| App del pasajero/conductor | 10.311 renglones, 48 archivos | `cat guajirago/src/*.js \| wc -l` |
| Panel de administración | 7.912 renglones, 22 archivos | `cat guajirago-admin/src/*.js \| wc -l` |
| Software de aliados | 6.719 renglones, 35 archivos | `cat guajirago-aliados/src/*.js \| wc -l` |
| Servidor (Cloud Functions) | 1.139 renglones, 19 funciones | `wc -l`, `grep -cE '^exports\.'` |
| Reglas de Firestore | 2.235 renglones | `wc -l < firestore.rules` |
| Reglas del Almacén | 345 renglones | `wc -l < storage.rules` |
| Colecciones que comparten la superapp y aliados | **5** | `negocios`, `pedidos`, `calificaciones`, `rechazos`, `reservasTurismo` |

### 🔴 El número que manda sobre todo el plan

> **150 escrituras del celular · 8 llamadas al servidor.**

El celular **no le pide** a un servidor que haga las cosas: **las hace él y escribe en la base
directamente**. Lo único que lo separa de escribir cualquier cosa son las 2.235 líneas de reglas.

Eso funciona para una app de taxis en pruebas. **No funciona para un negocio donde entra dinero
de terceros** (restaurantes, hoteles, arriendos, servicios), porque quien controla el celular
controla lo que se escribe, y una regla que se escapa no avisa: deja pasar.

### 🟢 La ventaja que hay que gastar YA

**No hay clientes todavía.** Los 91 viajes de la base son de prueba, de julio. Eso significa que
hoy se pueden hacer cambios que rompen cosas —renombrar campos, mover colecciones, partir
negocios— **sin llamar a nadie para disculparse**.

Esa ventana se cierra sola el día que entre el primer cliente de verdad. **Todo lo que este plan
llama "cambio de raíz" hay que hacerlo antes de esa fecha, o ya no se hace nunca.**

---

## 1 · LAS CUATRO DECISIONES DE FONDO

Todo lo demás cuelga de éstas. Si una cambia, el plan se rehace.

### D1 · Son DOS productos, no uno con pestañas

| | **GuajiraGo** (la superapp) | **Aliados** (el software de distribución) |
|---|---|---|
| Quién la usa | el vecino de Riohacha | el dueño del restaurante, del hotel, el plomero |
| Qué vende | viajes, mandados, y el **escaparate** de todo lo demás | **software**: vender, rentar, gestionar |
| Cómo cobra | comisión por viaje | **suscripción / licencia** |
| Si se cae | la gente no consigue taxi | **un negocio no puede facturar** |
| Quién responde | GuajiraGo | GuajiraGo, como **proveedor de software** |

**Son negocios distintos y se rompen distinto.** Un restaurante que no puede cobrar a las 8 de la
noche es un problema contractual, no un mal rato.

**Lo que esta decisión implica, y hay que aceptarlo entero:**
- Aliados tiene su propio ciclo: se despliega aparte, se prueba aparte, se cae aparte.
- **Un aliado NO puede ver datos de otro aliado.** Hoy eso lo cuidan las reglas; mañana tiene que
  cuidarlo también la forma de los datos.
- La superapp **consume** lo que aliados publica. No al revés.

### D2 · Un ambiente de pruebas de verdad: SEGUNDO proyecto Firebase

Hoy hay uno solo, y es producción. Probar hoy es tocar los datos de verdad.

**No sirve** un "modo prueba" dentro del mismo proyecto (una bandera, un prefijo, una colección
`_test`). Un error de una línea escribe en producción y nadie se entera. La separación tiene que
ser **física**: otro proyecto, otra base, otras llaves.

**Decisión:** `guajirago-dev` como proyecto aparte, con **datos falsos**, nunca copiados de los
reales.

### D3 · El servidor decide, el celular enseña

Es la SEGUNDA LEY de este proyecto aplicada al dinero y a los permisos.

Hoy el celular calcula el total del pedido y lo escribe. Mañana, con arriendos y suscripciones,
eso es una puerta abierta. **Todo lo que decide dinero, estado o permiso pasa al servidor.**

**No es "migrar las 150 escrituras".** Es clasificarlas: las que son datos propios del usuario
(su nombre, su foto) pueden seguir; las que mueven dinero, cambian estado de un pedido o tocan a
otro, no.

### D4 · Entre las apps hay CONTRATOS, no costumbres

Hoy, escrito en las leyes del proyecto: *«Todo el acoplamiento entre apps es contrato implícito de
campos en Firestore: no hay API. Cambiar un campo en una app puede romper otra sin que nada
avise.»*

Con dos negocios y tres apps eso deja de ser sostenible. **Cada dato que cruza de un producto a
otro tiene que tener un dueño, una forma declarada y una prueba que se pone roja si se separan.**

La buena noticia: ese mecanismo **ya existe** en este proyecto y funciona — se llama `amarres`, y
hoy son 90 pruebas que leen los dos lados de cada contrato. Lo que falta no es inventarlo: es
**aplicarlo a todo lo que cruza**, en vez de a lo que fue mordiendo.

---

## 2 · LA ESTRUCTURA OBJETIVO

### Las cuatro capas

```
   ┌─────────────────────────────────────────────────────────────┐
   │  APPS            pasajero · conductor · aliados · panel      │
   │                  ENSEÑAN. No deciden dinero ni permisos.     │
   ├─────────────────────────────────────────────────────────────┤
   │  CONTRATOS       los datos que cruzan de una app a otra.     │
   │                  Un dueño, una forma, un amarre que los ata. │
   ├─────────────────────────────────────────────────────────────┤
   │  SERVIDOR        decide. Cobra, cambia estados, autoriza.    │
   │                  Se salta las reglas: es el que manda.       │
   ├─────────────────────────────────────────────────────────────┤
   │  DATOS           Firestore + Almacén, con reglas que niegan  │
   │                  por defecto y abren por excepción.          │
   └─────────────────────────────────────────────────────────────┘
```

### La frontera entre los dos negocios

Hoy comparten **5 colecciones**. Ésa es la frontera, y hoy no está dibujada en ninguna parte.

| Colección | Quién la ESCRIBE | Quién la LEE | Qué hay que decidir |
|---|---|---|---|
| `negocios` | aliados, panel | superapp | **el catálogo público**: qué campos ve el cliente y cuáles son privados del negocio |
| `pedidos` | superapp (cliente), aliados (negocio) | los dos | **quién manda el precio** — hoy lo manda el celular del cliente |
| `reservasTurismo` | superapp, aliados | los dos | lo mismo |
| `calificaciones` | superapp | aliados, panel | quién puede calificar y cuántas veces |
| `rechazos` | los dos | los dos | qué es un rechazo y quién lo puede escribir |

**Cada una de estas cinco es un plan de trabajo aparte.** Ninguna se toca "de paso".

---

## 3 · SEGURIDAD — POR CAPAS, NO POR LISTA

La seguridad no es una tarea: son ocho frentes, y cada uno se cierra solo.

### 3.1 · Identidad — ¿quién eres?
- Un solo sistema de identidad para los cuatro tipos de persona: **cliente, conductor, aliado,
  administrador**. Hoy los roles viven repartidos.
- El rol **no lo dice el celular**: lo dice un documento que solo el servidor escribe.
- Verificación real del conductor: documento, foto, placa. Un conductor sin verificar **no recibe
  viajes**, y eso lo decide el servidor, no la pantalla.

### 3.2 · La puerta — ¿desde dónde llamas?
- **App Check** (hoy: no existe). Sin él, cualquiera con la llave pública —que viaja dentro de la
  app, a la vista— puede hablar con tu base desde un guion, sin abrir la app nunca.
- Es la diferencia entre "mis reglas están bien escritas" y "solo mis apps pueden intentarlo".

### 3.3 · Las reglas — negar por defecto
- 2.235 renglones hoy. La pregunta no es si están bien: es **si alguien las puede leer**.
- Objetivo: reglas cortas que **niegan todo** y abren por excepción, con **pruebas que las
  ejecutan** (ya existen: `pruebas/reglas.test.js` corre contra el emulador).
- **Un aliado no ve a otro aliado.** Se prueba ejecutando, no leyendo.

### 3.4 · El dinero — una sola calculadora, y es del servidor
- Hoy el total del pedido lo suma el celular del cliente y el restaurante **vuelve a sumarlo con
  esos mismos precios**. Eso no es validar: es repetir.
- Objetivo: el precio sale del catálogo **en el servidor**, en el momento del pedido. El celular
  enseña un número; el que vale es el que calculó el servidor.
- Lo mismo para comisiones, tarifas, descuentos, suscripciones y arriendos.

### 3.5 · Los datos personales
- Cédulas, teléfonos, fotos, ubicaciones. Hoy viven en el Almacén con 345 renglones de reglas.
- Qué hace falta decidir: **cuánto se guarda, cuánto tiempo, y quién lo puede ver**. Un
  administrador no necesita ver la cédula de todos los conductores todos los días.

### 3.6 · Seguridad del transporte — la que es física
Esto no es informática: es que alguien se sube a un carro con un desconocido.
- **Conductor verificado** antes de recibir un solo viaje.
- **El viaje tiene un dueño**: nadie puede leer, cambiar ni cancelar un viaje que no es suyo.
- **La ubicación es de verdad** — hoy ya se cerró que el viaje no nazca en la plaza; falta que el
  viaje guarde **de dónde salió su coordenada** (del GPS, del marcador, o escrita).
- **Botón de pánico** que funcione con el viaje vivo, no con datos pegados de antes.
- **Código de seguridad** del viaje: que el conductor sea el que dijo ser.

### 3.7 · Rastro — quién hizo qué
- Toda decisión del servidor que mueva dinero o cambie un estado deja registro: quién, cuándo,
  qué había antes.
- **Los borrados dejan lápida** (ya es ley del proyecto). Aplicarlo a todo.

### 3.8 · Secretos y despliegue
- Llaves de servicio, permisos de GitHub, llave de Maps. Hoy: una llave de servicio que ya se
  expuso una vez y el dueño decidió conservar.
- Objetivo: **ninguna llave en el repo**, todas con caducidad conocida, y el despliegue con los
  cinco botones que ya existen — **pero desde `main`, que hoy no tiene ninguno**.

---

## 4 · EL AMBIENTE DE PRUEBAS (la Fase 0, y la más importante)

Sin esto, **nada de lo demás se puede hacer sin riesgo**. Por eso va primero.

### Tres niveles, cada uno con su trabajo

| Nivel | Dónde corre | Para qué | Datos |
|---|---|---|---|
| **1 · Emulador** | en la máquina, o en GitHub | las pruebas de siempre, cada cambio | de mentira, se borran solos |
| **2 · `guajirago-dev`** | proyecto Firebase aparte | probar la app **entera**, con el celular en la mano | falsos, sembrados por un guion |
| **3 · `guajirago`** | producción | los clientes | reales |

### Las cinco reglas del ambiente de pruebas

1. **Separación física.** Otro proyecto Firebase, no una bandera. Un `if` mal escrito no puede
   escribir en producción si la llave ni siquiera apunta ahí.
2. **Nunca se copian datos reales al ambiente de pruebas.** Se siembran datos falsos con un guion
   que vive en el repo. Copiar producción a dev es sacar los datos de tus usuarios de su caja.
3. **El ambiente no se elige a mano.** Se deduce de dónde está corriendo la app. Un desplegable
   que diga "producción / pruebas" se acaba dejando mal puesto.
4. **Se ve a simple vista.** La app de pruebas tiene un color distinto y un cartel. Nadie debe
   poder confundirse mirando la pantalla.
5. **Lo que no se puede probar en dev, se dice.** Los pagos de verdad, los SMS de verdad, las
   notificaciones a teléfonos de verdad. Se escribe qué queda fuera, en vez de fingir que no.

### 🔴 Lo que esto cuesta, dicho antes de empezar
- Un segundo proyecto Firebase **cuesta dinero** (poco, pero no cero) y hay que mantener dos
  configuraciones de todo: reglas, índices, funciones, llaves.
- **La llave de Maps y los dominios de Auth** hay que autorizarlos también para dev. Eso ya mordió
  una vez con el canal de prueba (23-sep-2026).
- Cada despliegue pasa a ser **dos**: primero dev, luego producción.

---

## 5 · EL ORDEN DE TRABAJO

El orden **no es negociable** en las tres primeras fases: cada una necesita la anterior.

### FASE 0 — El ambiente de pruebas
*Sin esto no se puede tocar nada más sin arriesgar datos reales.*
- Crear `guajirago-dev` y apuntar las tres apps según dónde corren.
- Sembrar datos falsos con un guion del repo.
- Desplegar reglas, índices y funciones a dev.
- Cartel y color que digan «esto es pruebas».
- **Hecho cuando:** se puede romper la app en dev desde el celular y en producción no cambia nada.

### FASE 1 — Cerrar la puerta
*Barato, rápido, y protege todo lo que venga después.*
- **App Check** en las tres apps y en el servidor.
- Los cinco botones de despliegue **en `main`** (hoy están en una rama y nunca han corrido).
- Los permisos (roles) que faltan en la llave de servicio.
- **Hecho cuando:** una llamada a la base desde fuera de tus apps es rechazada, y se demuestra
  ejecutándola.

### FASE 2 — La frontera de los dos negocios
*Dibujar la línea antes de construir encima de ella.*
- Las **5 colecciones compartidas**, una por una: quién escribe, quién lee, qué campos.
- Un amarre por contrato, de los que se ponen rojos si los dos lados se separan.
- **Hecho cuando:** cambiar un campo en aliados pone roja una prueba **antes** de romper la
  superapp.

### FASE 3 — El dinero al servidor
*La que de verdad convierte esto en un software que puede cobrar.*
- Clasificar las **150 escrituras**: cuáles son datos propios y cuáles deciden.
- Mover al servidor las que deciden, empezando por el total del pedido.
- **Hecho cuando:** un celular modificado no puede pedir a otro precio, y se demuestra
  intentándolo.

### FASE 4 — Aliados como producto
- Suscripción y licencia. Alta de un negocio de punta a punta.
- Aislamiento entre aliados, probado ejecutando.
- Lo de **rentar** (arriendos), que hoy no existe.

### FASE 5 — Transporte, lo que queda
- Verificación del conductor.
- De dónde salió la coordenada del viaje.
- Las deudas ya anotadas del pánico, los estados y los historiales.

### FASE 6 — La deuda medida que ya está escrita
La tabla de deuda de `CLAUDE.md` con ~30 filas vivas. **No se atiende antes**: casi todas se
tocan solas al hacer las fases de arriba, y las que no, se harán con el ambiente de pruebas ya
puesto, que es más barato y más seguro.

---

## 6 · CÓMO SE SABRÁ QUE CADA FASE QUEDÓ HECHA

Este proyecto ya tiene la costumbre y no se cambia: **se mide, no se promete.**

| | Regla |
|---|---|
| 1 | Cada fase tiene un **guion que se corre** (`node scripts/medir-*.cjs`) y da un número |
| 2 | Cada protección tiene un **amarre** que se pone rojo si alguien la deshace |
| 3 | Cada amarre está **saboteado**: se le mete el fallo y tiene que quejarse |
| 4 | Lo que no se pudo medir **se escribe como no medido**, no se firma |
| 5 | El paso 12 se carea con el paso 1: **el mismo guion, antes y después** |

---

## 7 · LO QUE NO ESTÁ DECIDIDO — hacen falta respuestas del dueño

Ninguna de estas la puedo decidir yo. Cada una cambia el plan.

| # | Pregunta | Por qué importa |
|---|---|---|
| 1 | ¿Aliados comparte proyecto Firebase con la superapp, o va a tener el suyo? | Es la diferencia entre «dos productos» y «dos empresas». Compartir es más barato hoy y más caro el día que aliados crezca |
| 2 | ¿Cómo cobra aliados: mensualidad fija, porcentaje, o las dos? | Decide la forma de los datos de suscripción, y eso no se cambia después sin migrar |
| 3 | ¿Qué es exactamente «rentar»? ¿Habitaciones de hotel? ¿Herramientas? ¿Vehículos? | Hoy no existe nada de eso en el código. Es un producto nuevo entero |
| 4 | ¿Los pagos son en efectivo, o entra una pasarela? | Si entra pasarela, la seguridad del dinero sube de nivel y hay obligaciones legales |
| 5 | ¿Cuándo entra el primer cliente de verdad? | Es el reloj de todo el plan: los cambios de raíz van **antes** de esa fecha |
| 6 | ¿Qué es «el software de Calaira» y cuáles son los puntos que propuso? | Pediste revisarlo y no sé a qué apunta. Si es el otro proyecto, dime el nombre del repo y lo leo |

---

## 8 · LOS RIESGOS, DICHOS AHORA

| Riesgo | Por qué pasa | Qué lo baja |
|---|---|---|
| **El plan se queda escrito y no se hace** | es grande y no hay fecha | fases cortas, cada una con su número medido |
| **Mover las 150 escrituras rompe lo que funciona** | es el cambio más grande del plan | la PRIMERA LEY: una a una, con amarre antes de tocar |
| **El ambiente de pruebas se desincroniza de producción** | dos configuraciones de todo | los botones de despliegue publican a los dos, en orden |
| **Se copian datos reales a pruebas «por comodidad»** | es lo más fácil del mundo | está prohibido por escrito, arriba, y el guion de siembra existe para eso |
| **La ventana de «no hay clientes» se cierra antes** | el negocio empuja | por eso las fases 0 a 3 van primero y las bonitas después |
| **Dos calculadoras nuevas** (la enfermedad de siempre) | dos productos, más código | la SEGUNDA LEY, y los amarres que ya la vigilan |

---

## 9 · LO QUE ESTE PLAN **NO** ES

- **No es un rediseño visual.** No habla de colores ni de pantallas nuevas. Si hace falta, es otro
  trabajo.
- **No es una reescritura.** Nada aquí dice «empezar de cero». Los 24.942 renglones que hay
  funcionan; lo que cambia es **quién decide** y **dónde se prueba**.
- **No es un cronograma.** No trae fechas, porque no sé de cuánto tiempo dispones. Trae **orden**,
  que es lo que de verdad no se puede cambiar.
- **No está aprobado.** Es una propuesta. El paso 3 de las leyes dice PROPONER y **PARAR**.

---

# 📎 ANEXO A — QUÉ SE COPIA DE CONTROL-ELITE

> Contesta la pregunta 6. **«Calaira» es `control-elite`**, el otro proyecto del dueño: un software
> de distribución con POS, cartera, nómina y tesorería — o sea, **plata de verdad moviéndose**.
> No hizo falta preguntarle a su sesión: ese repo ya está en esta sesión y se leyó directamente.
>
> Medido el 24-sep-2026 con los MISMOS comandos que la sección 0, para que el careo valga.

## A.1 · El careo, número a número

| | **control-elite** | **GuajiraGo** | |
|---|---|---|---|
| Escrituras del cliente directo a la base | **16** | **150** | 🔴 |
| Llamadas al servidor (`httpsCallable`) | **23** | **8** | 🔴 |
| **Proporción** | **más servidor que cliente** | **19 clientes por cada servidor** | |
| Reglas de Firestore | **172** renglones | **2.235** | |
| Reglas del Almacén | **50** | **345** | |
| Renglones de app | 126.628 | 24.942 | |
| Renglones de pruebas | **164.131** | — | |
| Reglas de negocio numeradas | **643** | 0 | 🔴 |
| App Check | **no** | **no** | ⚠️ los dos |
| Ambiente de pruebas | **no** | **no** | ⚠️ los dos |

### 🔴 EL HALLAZGO, Y ES UNO SOLO

> **La proporción está INVERTIDA.** En control-elite el servidor decide (23) y el cliente escribe
> poco (16). En GuajiraGo el cliente escribe 150 veces y le pide al servidor 8.

**Y de ahí sale todo lo demás, incluida la cifra que más sorprende:** las reglas de control-elite
son **172 renglones y las de GuajiraGo 2.235** — trece veces más. No es que las suyas estén peor
escritas: es que **cuando el cliente casi no escribe, casi no hay nada que vigilar**.

Unas reglas de 2.235 renglones **nadie las puede leer entera**, y una regla que nadie lee es una
regla en la que nadie confía. Bajar ese número no es cosmética: es la única forma de que la
seguridad sea **comprobable** y no un acto de fe.

### 🟢 Y hay más pruebas que aplicación

**164.131 renglones de prueba contra 126.628 de app.** Ese proyecto escribió **más código para
comprobar que funciona** que código que funciona. Con **643 reglas de negocio numeradas**, que se
citan por su número cuando algo se discute («REGLA 923», «REGLA 1407»).

GuajiraGo tiene leyes de PROCESO (`CLAUDE.md`) pero **cero reglas de negocio numeradas**. Eso es
lo que hace que una discusión acabe en «yo creía que…» en vez de en un número.

## A.2 · Los siete puntos que SE COPIAN

Salen de su **plan de cimientos** — una auditoría de 41 hallazgos sobre un software que mueve
plata. **No se escribe aquí el nombre de su archivo**: vive en el otro repo, y una cita que manda
a un archivo que en ESTE repo no existe es una nota que miente. Lo dice en rojo la prueba «LAS
NOTAS NO MIENTEN», que se puso roja al escribir este anexo y tenía razón.
Cada uno se traduce aquí a lo que significa **en GuajiraGo**.

| # | Lo que aprendió control-elite | Qué es en GuajiraGo |
|---|---|---|
| **C1** | **Escrituras no atómicas.** Su operación más crítica se guardaba en **5 escrituras sueltas**: si se cae la señal a mitad, la plata queda a medias y nada lo atrapa | Un viaje que se acepta, un pedido que se confirma, una recarga que se canjea. Hoy varias de esas son varias escrituras sueltas. **Se hacen en una transacción o no se hacen** |
| **C2** | **Idempotencia: id estable del cliente, el servidor deduplica por ese id — nunca por un consecutivo local.** Su `max+1` local daba números repetidos entre dispositivos | Un pasajero con mala señal que aprieta «pedir» dos veces. Un restaurante que confirma dos veces. **Hoy nada lo impide** |
| **C3** | **La regla de oro: un envío se BLOQUEA al enviarse.** Solo se reabre si lo rechazan. `borrador → ENVIADO → ACEPTADO / RECHAZADO` | Es exactamente lo que le falta a `pedidos` y a `viajes`: hoy el estado lo cambia quien llegue, y ya se midió que hay listas de estados incompletas en 6 pantallas |
| **C4** | **Falla CERRADA, nunca abierta.** A un abono sin la bandera de cuadre no se le cree: **la ausencia de bandera = no cuenta** | Las reglas de Firestore tienen que **negar por defecto** y abrir por excepción. Con 2.235 renglones, hoy nadie puede afirmar que sea así |
| **C5** | **Verificar el resultado de cada escritura de plata.** Uno de sus fallos era no comprobar si el guardado funcionó → el empleado pagaba dos veces | GuajiraGo tiene **`catch` mudos** ya contados y anotados. Un cobro que falla y no avisa es exactamente este fallo |
| **C6** | **Nunca decidir sobre caché rancia** (`requiereNube`) | Las apps leen de Firestore con caché. Una decisión de dinero sobre un dato viejo es el mismo agujero |
| **C7** | **Una sola calculadora por proceso.** Su cartera se reimplementaba en ≥4 pantallas y daban totales distintos | Es la SEGUNDA LEY de GuajiraGo, ya escrita. Y el total del pedido **ya está en dos sitios** hoy |

## A.3 · Y el método, que vale más que los siete puntos

De su sección 5, dicho con sus palabras:

> **«No tapar 41 huecos uno por uno. Construir los cimientos que eliminan categorías enteras de una
> vez. Este es el momento —antes de operar, con datos de prueba—: 10× más barato que después.»**

Es **la misma frase** que la sección 0 de este plan: GuajiraGo no tiene clientes todavía. Los dos
proyectos están en la misma ventana, y los dos la tienen que gastar ahora.

**Por eso las fases 0 a 3 de este plan son cimientos y no parches:** el ambiente de pruebas, la
puerta, la frontera y el dinero al servidor **matan categorías enteras** de fallos. La tabla de
deuda de ~30 filas de `CLAUDE.md` es lo que queda después, no lo que va antes.

## A.4 · Lo que NO se copia, porque allá tampoco está

Honradez antes que entusiasmo: control-elite **no** es un modelo en todo.

| | Estado allá | Qué significa |
|---|---|---|
| **Ambiente de pruebas** | **no tiene** — un solo proyecto, `control-elite` | Copiarle esto sería copiar el mismo agujero. La Fase 0 de aquí **va por delante** de lo que ellos tienen |
| **App Check** | **no tiene** | Igual: es un hueco compartido, no un ejemplo |
| **Archivos gigantes** | sus tres pantallas de dinero pasan de los 1.000 renglones cada una —caja, entregas y nómina—, y su propio plan las marca como riesgo. Los nombres de esos archivos no se escriben aquí, por lo mismo que arriba | GuajiraGo tiene la misma enfermedad (`Solicitar.js`). No se copia: se evita |
| **41 hallazgos abiertos** | su plan es una **propuesta**, no un trabajo terminado | Se copia el MÉTODO y el diagnóstico, no un resultado que todavía no existe |

🔴 **Y lo que este anexo NO dice:** que control-elite sea seguro. Lo que se leyó es su **propia
auditoría**, que enumera 41 fragilidades, 7 de ellas capaces de **perder o duplicar plata**. Lo que
se copia es **cómo se dieron cuenta** y **qué decidieron construir**, no un certificado.

## A.5 · Cómo entra esto en el plan

Ninguna fase cambia de orden. Lo que cambia es que **tres de ellas se vuelven más concretas**:

- **Fase 1 (cerrar la puerta)** → se le añade **C2 (idempotencia)**: id estable del cliente y
  deduplicación en el servidor. Es barato y mata los pedidos y viajes duplicados.
- **Fase 2 (la frontera)** → se le añade **C3 (la regla de oro)**: el estado de `pedidos` y
  `reservasTurismo` pasa a ser una máquina con bloqueo, no un campo que cambia quien llegue.
- **Fase 3 (el dinero al servidor)** → se le añaden **C1 (atómico)**, **C4 (falla cerrada)**,
  **C5 (verificar el guardado)** y **C6 (nada de caché rancia)**. Son las cuatro que evitan perder
  o duplicar plata, y son exactamente las que a ellos les mordieron.

Y una decisión nueva, **que hay que tomar**:

> **¿Se adopta el libro de reglas numeradas?** Allá son 643 y se citan por su número. Aquí serían
> las reglas del negocio de GuajiraGo —qué es un viaje válido, quién puede cancelar, cómo se
> calcula una comisión— escritas, numeradas y con una prueba cada una.
> **Cuesta trabajo por delante y lo devuelve cada vez que hay una duda.** Es decisión del dueño.

---

# 📎 ANEXO B — ALIADOS SIN SEÑAL, LA RED INTERNA, Y TODO DESDE EL CELULAR

> Decisiones del dueño, 24-sep-2026. **Cambian la arquitectura**, no son un añadido. Y una de
> ellas descansa sobre algo que resultó NO ser cierto — está medido abajo, en B.3.

## B.1 · Lo que se decidió

| # | Decisión | Qué era antes |
|---|---|---|
| **B-1** | **Aliados es un aplicativo INDEPENDIENTE.** Restaurantes, hoteles, oficios. Vive en un computador, una tablet o un dispositivo — no es una pestaña de la superapp | una web que se abre en el navegador |
| **B-2** | **Funciona TOTALMENTE sin señal.** No «aguanta un rato»: sin señal se puede trabajar el día entero | hoy no funciona sin internet |
| **B-3** | **Los dispositivos se hablan ENTRE SÍ por una red interna, con un router**, sin depender de internet | no existe |
| **B-4** | **Todo se trabaja desde el celular**, sin depender de un computador encendido | ya hay 5 botones de despliegue, pero ninguno en `main` |
| **B-5** | **El respaldo pasa de Dropbox a Google Drive**, con copia fija | Dropbox (y ya se comió una copia del código una vez) |

## B.2 · Lo que control-elite SÍ tiene, y se copia tal cual

Medido el 24-sep-2026 leyendo el repo:

| Pieza | Tamaño | Qué hace |
|---|---|---|
| La cola de salida (`outbox`) | **813** renglones | guarda lo que hay que subir y lo sube cuando vuelve la señal |
| El fusionador (`mergeStore`) | **809** | decide qué gana cuando el mismo dato cambió en dos sitios |
| El almacén por trozos (`shardStore`) | **885** | parte los datos por mes para no bajarlo todo |
| El almacén local | **1.707** | los datos en el aparato |
| **Total de maquinaria de «sin señal»** | **≈ 4.200 renglones** | y son sólo las cuatro piezas principales |

Además: **es una app nativa de Android** (empaquetada con Capacitor), y usa la **persistencia local
de Firestore** (`persistentLocalCache`) como base sobre la que monta todo lo anterior.

> 🔴 **Que quede claro el tamaño de lo que se pide:** «que funcione sin señal» no es una casilla.
> Allá son **cuatro mil doscientos renglones** de código dedicado, más una app nativa. Es un
> proyecto entero, y hay que planificarlo como tal.

## B.3 · 🔴 LA CORRECCIÓN — control-elite NO habla por el router

La decisión **B-3** se pidió *«como lo hace control-elite»*. **Control-elite no hace eso.**

Medido, buscando en todo su código direcciones de red local, descubrimiento de dispositivos,
servidores locales y conexiones directas entre aparatos: **cero resultados.**

**Lo que de verdad hace:**

```
  SIN SEÑAL      cada aparato trabaja SOLO, guardando en su propia memoria.
                 Dos tablets en el mismo local NO se ven entre ellas.

  VUELVE SEÑAL   cada aparato sube lo suyo a la nube y baja lo de los demás.
                 Ahí, y sólo ahí, se enteran unos de otros.
```

O sea: **aguanta sin señal, pero se sincroniza por la nube, no por el router.**

**Por qué importa y no es un detalle:** si en el restaurante hay dos tablets y se cae internet, con
lo de control-elite el mesero toma pedidos en una y la cocina **no los ve** hasta que vuelva la
señal. Lo que tú pides es que **sí los vea**, por el router, sin internet. Eso es otra cosa, y
mucho más grande.

## B.4 · Las tres formas de resolver B-2 y B-3, con lo que cuesta cada una

| | Cómo funciona | Sin internet, ¿se ven los aparatos? | Qué cuesta |
|---|---|---|---|
| **Opción 1 — Sin señal, sincroniza por nube** *(lo de control-elite)* | cada aparato guarda local y sube cuando puede | **NO** | ≈ 4.200 renglones. **Ya está probado allá**; se puede copiar el método |
| **Opción 2 — Un aparato hace de servidor en el local** | uno manda (la caja, el computador), los demás le hablan por el router. Ese uno sube a la nube cuando hay señal | **SÍ** | La 1 **más** descubrirse en la red, un servidor dentro de la app, y qué pasa si el aparato-servidor se apaga |
| **Opción 3 — Todos iguales, todos se hablan** | cada aparato habla con todos | **SÍ** | La más cara con diferencia: sin un jefe, hay que resolver quién gana cuando dos cambian lo mismo a la vez. **No la recomiendo** |

### Lo que recomiendo, y por qué

**Opción 1 primero, y la 2 sólo si el negocio la exige de verdad.**

Razón: la Opción 1 **ya está resuelta y probada** en el otro proyecto — se copia el método, no se
inventa. La Opción 2 se construye **encima** de la 1, nunca en vez de ella: incluso con servidor
local, cada aparato necesita guardar lo suyo y subirlo a la nube después.

Así que la 1 **no es tiempo perdido aunque acabemos en la 2**: es su cimiento.

🔴 **Y una pregunta que hay que contestar antes de decidir**, porque cambia el resultado: **¿los
restaurantes de Riohacha se quedan sin internet de verdad, y cuánto?** Si es media hora al mes, la
Opción 1 sobra. Si es todos los días, la 2 se justifica. **Eso no lo sé y no lo voy a suponer.**

## B.5 · B-1: «aplicativo independiente» — qué significa técnicamente

Hoy aliados es una web. «Que viva en un computador o una tablet» son tres caminos distintos:

| | Qué es | A favor | En contra |
|---|---|---|---|
| **App instalable desde el navegador** (PWA) | la misma web, que se instala y funciona sin señal | un solo código, sin tiendas de apps | menos acceso al aparato; en escritorio es más limitada |
| **App nativa** (lo que hace control-elite) | se empaqueta y se instala como cualquier app | acceso completo al aparato, impresora, red local | hay que compilar y firmar; la tienda de Google mete demoras |
| **Programa de escritorio** | se instala en el computador | para caja con impresora y cajón de dinero | es un tercer empaquetado más que mantener |

**Para la Opción 2 (red interna) hace falta la nativa o la de escritorio.** Una web instalada
desde el navegador **no puede** montar un servidor en la red local.

## B.6 · B-4: trabajar todo desde el celular

Esto es lo más cerca de estar hecho:

| | Estado hoy |
|---|---|
| 5 botones de despliegue (app, reglas, panel+aliados, nube, medir) | **escritos y probados, pero en una rama** |
| ¿Han desplegado alguna vez? | **no, ninguno** |
| Qué falta | fusionar a `main`, los permisos que faltan, y renovar el permiso de lectura que hoy sale **`Bad credentials`** |

**No hay que construir nada nuevo aquí: hay que terminar lo empezado.** Es la Fase 1 del plan.

## B.7 · B-5: de Dropbox a Google Drive

Control-elite tiene dos guiones de respaldo a Dropbox. La decisión es pasarlos a Google Drive con
copia fija.

**Lo que hay que respetar, y ya está escrito en las leyes de este proyecto:**

> «Si el proyecto se pone en Dropbox hay que excluir `.git` y `node_modules`. **Dropbox ya se comió
> una copia entera del código.**»

**Google Drive tiene el mismo peligro**: sincroniza a medias y corrompe. Así que la regla no
cambia de nube, cambia de forma:

- **El respaldo del CÓDIGO es GitHub, y sólo GitHub.** Drive no reemplaza eso.
- **Drive es para la COPIA FIJA DE LOS DATOS**: un archivo por día, escrito por un guion, que nunca
  se vuelve a tocar. Eso es un respaldo. Una carpeta que se sincroniza sola no lo es.
- **Nunca sincronizar una carpeta de trabajo.** El guion escribe el archivo y se va.

## B.8 · Lo que esto le hace al plan

**El orden de las fases no cambia.** Lo que cambia es el tamaño de dos de ellas y aparece una nueva.

| Fase | Qué le pasa |
|---|---|
| **0 · Ambiente de pruebas** | igual, y ahora **más necesaria**: sin señal y con red local, probar en producción es impensable |
| **1 · Cerrar la puerta** | igual, y absorbe **B-4** (terminar los botones) y **B-5** (el respaldo a Drive) |
| **2 · La frontera** | **crece**: si aliados es un aplicativo aparte que trabaja sin señal, el contrato con la superapp deja de ser «leer la misma colección» y pasa a ser **publicar y recibir** |
| **3 · El dinero al servidor** | 🔴 **choca con B-2 y hay que resolverlo**: si el servidor decide y no hay señal, **no se puede cobrar**. La salida es que sin señal se **registra** y al volver la señal el servidor **confirma** — que es exactamente la regla de oro del ANEXO A (`borrador → ENVIADO → ACEPTADO`) |
| **4 · Aliados como producto** | **es la fase más grande del plan**, con diferencia: aplicativo independiente + sin señal + empaquetado |
| **NUEVA · 4b · La red interna** | sólo si la Opción 2 se aprueba. **No empieza hasta que la 4 esté funcionando** |

### 🔴 El choque de B-2 con la seguridad, dicho claro

Sin señal, **el aparato decide solo**. Eso es justo lo contrario de «el servidor decide». No hay
forma de tener las dos cosas a la vez, y la salida no es elegir una: es **separar el momento**.

> Sin señal se **anota lo que pasó**. Con señal, el servidor **dice si vale**.
>
> Y lo que el servidor rechace, el aliado lo ve en una bandeja y lo corrige. Nunca desaparece en
> silencio.

Eso es más trabajo que cualquiera de las dos por separado, y es la razón por la que la Fase 4 es
la más grande. **Mejor saberlo ahora que a mitad.**

## B.9 · Preguntas nuevas (se suman a las 5 que quedaban)

| # | Pregunta | Por qué decide |
|---|---|---|
| 7 | **¿Cuánto tiempo se quedan sin internet de verdad los negocios de Riohacha?** | Decide si hace falta la Opción 2 (red interna) o basta la 1. Es la pregunta más cara del plan |
| 8 | **¿Cuántos aparatos por negocio?** ¿Un cajero, o mesero + cocina + caja? | Con uno solo, la red interna no hace falta en absoluto |
| 9 | **¿Hace falta impresora de tirilla o cajón de dinero?** | Si sí, la web instalable no sirve y hay que ir a nativa o escritorio |
| 10 | **¿Aliados y la superapp comparten cuenta de usuario?** | Un dueño de restaurante que además pide taxis, ¿es la misma persona para el sistema? |

---

# 📎 ANEXO C — LA RED INTERNA DEL NEGOCIO (ya no es opción: es requisito)

> **Pregunta 7, contestada por el dueño el 24-sep-2026: «todos los días».**
> Los negocios de Riohacha se quedan sin internet **a diario**. Con eso, la Opción 2 del ANEXO B
> —un aparato hace de servidor en el local— deja de ser una posibilidad y pasa a ser **la base del
> producto de aliados**.

## C.1 · Lo que esta respuesta fija, y ya no se discute

| | Antes | Ahora |
|---|---|---|
| La red interna | «sólo si el negocio lo exige» | **requisito** |
| El empaquetado de aliados | tres caminos abiertos | **nativa o de escritorio**. La web instalada desde el navegador **queda descartada**: no puede montar un servidor en la red local |
| La fase 4b | condicional | **entra en el plan**, dentro de la Fase 4 |
| Quién manda en el dato durante el día | la nube | **el servidor del local** |

🔴 **Lo que sigue sin medirse, y no cambia la decisión pero sí el tamaño:** «todos los días» no
dice **cuántas horas**. Diez minutos diarios y cuatro horas diarias piden el mismo diseño, pero no
el mismo esfuerzo en lo que aguanta la memoria y en cuántos días seguidos puede estar sin subir.
**Se anota como no medido** y se preguntará cuando toque dimensionar, no ahora.

## C.2 · Cómo se ve un negocio por dentro

```
   ┌──────────────── EL LOCAL (el router, sin internet) ────────────────┐
   │                                                                     │
   │   📱 mesero      📱 mesero      🖥️ cocina                           │
   │       │              │              │                               │
   │       └──────────────┼──────────────┘                               │
   │                      │                                              │
   │            ┌─────────────────────┐                                  │
   │            │  EL SERVIDOR DEL    │  ← un solo aparato: la CAJA      │
   │            │  LOCAL (la caja)    │    · guarda la verdad del día    │
   │            │                     │    · le pone la hora a todos     │
   │            └─────────┬───────────┘    · manda a la impresora        │
   │                      │                                              │
   └──────────────────────┼──────────────────────────────────────────────┘
                          │  cuando VUELVE la señal
                          ▼
                    ☁️  LA NUBE  → confirma, cobra, y guarda de verdad
```

## C.3 · La ley del dato: quién manda y cuándo

Es la regla más importante de este anexo. **Nunca dos jefes para el mismo dato.**

| Qué | Quién manda | Por qué |
|---|---|---|
| Un pedido de hoy, sin internet | **el servidor del local** | es el único que los ve todos |
| El catálogo y los precios | **la nube**. El local los recibe y **no los inventa** | si el local pudiera poner precios, el dinero tendría dos calculadoras (SEGUNDA LEY) |
| Si un pedido vale o no | **la nube, al final del día** | es el ANEXO A: sin señal se **anota**, con señal se **confirma** |
| La hora | **el servidor del local** | ya hay deuda medida por usar el reloj de cada aparato. Sin internet, el único reloj común es él |
| Quién es cada empleado | **la nube**, y el local guarda la copia del día | sin internet nadie puede darse de alta solo |

## C.4 · Las cinco cosas que esto rompe, y hay que resolver ANTES de construir

Ninguna es opcional. Si alguna se deja para después, el software funciona en la demostración y
falla en el local.

### 1 · 🔴 El aparato-servidor se apaga, se cae o se lo roban
Si la caja es la única que tiene la verdad del día y se muere a las 6 de la tarde, **se pierde el
día entero**. En un restaurante eso es todas las cuentas abiertas.

**Lo que hay que construir:** cada aparato guarda **también** lo suyo, no sólo lo manda. El
servidor es quien decide, pero **no es el único que recuerda**.

### 2 · 🔴 ¿Cuál de los aparatos es el servidor?
Alguien tiene que decirlo, y el sistema tiene que aguantar que se encienda un segundo por error.
**Dos servidores a la vez es peor que ninguno**: dos números de factura iguales, dos verdades.

**Lo que hay que construir:** una forma de que un aparato se anuncie en la red y de que los demás
lo encuentren — y una regla clara de qué pasa si aparecen dos.

### 3 · 🔴 La wifi del negocio NO es de confianza
Esto es lo que más se olvida. La clave del wifi de un restaurante la sabe medio barrio. **Estar en
la misma red no puede significar «tienes permiso»**.

**Lo que hay que construir:** el servidor del local pide identidad igual que la nube. Un aparato
que no se ha dado de alta **no entra**, aunque esté en la misma wifi.

### 4 · 🔴 La hora
Ya hay deuda medida en este proyecto por usar el reloj de cada aparato. En un local sin internet
es peor: no hay nadie que ponga la hora en hora.

**Lo que hay que construir:** el servidor del local sella la hora de todo. El reloj de la tablet
del mesero **no decide nada**.

### 5 · 🔴 Varios días seguidos sin subir
Si la señal falta todos los días, puede faltar tres días seguidos. La memoria del aparato no es
infinita y la cola de salida crece.

**Lo que hay que construir:** saber cuánto aguanta, y **avisar antes** de llenarse — no quedarse
mudo, que va contra la REGLA 9.

## C.5 · La seguridad tiene una capa nueva

El ANEXO A hablaba de la nube. Ahora hay un segundo sitio donde se decide, y necesita lo suyo:

| | En la nube | **En el local (nuevo)** |
|---|---|---|
| Quién eres | cuenta de usuario | **el aparato se da de alta una vez, con la nube, y guarda su credencial** |
| Desde dónde llamas | App Check | **sólo aparatos dados de alta**, no «cualquiera en la wifi» |
| Qué puedes hacer | reglas de Firestore | **el servidor del local comprueba lo mismo**, no supone |
| Qué queda escrito | rastro en la nube | **rastro en el local**, que sube después |

🔴 **Y la trampa más fácil de caer:** pensar que «como es la red del negocio, aquí no hace falta
seguridad». Un local con wifi abierta y un servidor que no pregunta es una caja registradora con
la puerta abierta a la calle.

## C.6 · El orden dentro de la Fase 4

La Fase 4 se parte en tres, **y no se saltan**:

| | Qué se hace | Por qué en este orden |
|---|---|---|
| **4a** | **Sin señal, un aparato solo.** Cola de salida, almacén local, subir cuando vuelva la señal | Es el cimiento de todo lo demás. Aunque haya servidor local, **cada aparato sigue necesitando esto**. Y es lo único que ya está probado en el otro proyecto |
| **4b** | **El servidor del local.** Descubrimiento, identidad en la red, la hora, y qué pasa si se apaga | Sólo tiene sentido cuando 4a funciona. Sin 4a, el servidor local es un punto único de fallo sin red de seguridad |
| **4c** | **La nube confirma.** Lo que se anotó sin señal se sube, el servidor dice si vale, y lo rechazado va a una bandeja | Cierra el circuito. Es la regla de oro del ANEXO A, aplicada |

## C.7 · Lo que NO se puede prometer, dicho ahora

- **Esto no lo hace control-elite**, así que no hay de dónde copiarlo: 4a sí, **4b y 4c no**. Lo
  que allá está resuelto es un tercio de esto.
- **No sé cuánto tarda.** Sé que es la fase más grande del plan y que tiene cinco problemas duros
  antes de escribir la primera línea útil. Poner una fecha hoy sería inventarla.
- **Un local sin internet no puede cobrar con tarjeta.** Si mañana entra una pasarela de pago, eso
  no funciona sin señal y hay que decírselo al negocio, no descubrirlo el primer sábado.
- **La primera versión de aliados no debería traer esto.** Un aliado que funcione **con** internet,
  bien hecho, vale más que uno que promete funcionar sin él y falla a medias. La 4a da el 80 % del
  alivio con el 20 % del trabajo: **con ella, una caída de internet ya no detiene al negocio, sólo
  separa a los aparatos un rato.**

## C.8 · Cómo quedan las preguntas

| # | Pregunta | Estado |
|---|---|---|
| 1 | ¿Aliados comparte proyecto Firebase con la superapp? | **abierta — es la que bloquea la Fase 0** |
| 2 | ¿Cómo cobra aliados? | abierta |
| 3 | ¿Qué es «rentar»? | abierta |
| 4 | ¿Efectivo o pasarela? | abierta — **y ahora pesa más**: sin internet no hay tarjeta |
| 5 | ¿Cuándo entra el primer cliente? | abierta — **es el reloj de todo** |
| 6 | ¿Qué es «Calaira»? | ✅ contestada (ANEXO A) |
| 7 | ¿Cuánto se quedan sin internet? | ✅ **contestada: todos los días** → red interna es requisito |
| 8 | ¿Cuántos aparatos por negocio? | **abierta — y ahora es urgente**: con un solo aparato, 4b sobra |
| 9 | ¿Impresora de tirilla o cajón de dinero? | abierta — decide nativa o escritorio |
| 10 | ¿Aliados y la superapp comparten cuenta de usuario? | abierta |
