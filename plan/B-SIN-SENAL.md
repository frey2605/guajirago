> Parte del **plan general** de GuajiraGo. La puerta de entrada y el índice están en
> [`plan/00-INDICE.md`](00-INDICE.md). Este archivo se puede actualizar solo, sin tocar
> los demás — para eso se partió.

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
