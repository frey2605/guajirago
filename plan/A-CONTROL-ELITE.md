> Parte del **plan general** de GuajiraGo. La puerta de entrada y el índice están en
> [`plan/00-INDICE.md`](00-INDICE.md). Este archivo se puede actualizar solo, sin tocar
> los demás — para eso se partió.

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
