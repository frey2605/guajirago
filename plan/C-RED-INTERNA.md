> Parte del **plan general** de GuajiraGo. La puerta de entrada y el índice están en
> [`plan/00-INDICE.md`](00-INDICE.md). Este archivo se puede actualizar solo, sin tocar
> los demás — para eso se partió.

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

## C.8 · Las preguntas

La lista con su estado vive **en un solo sitio**: [`08-PREGUNTAS.md`](08-PREGUNTAS.md).
Aquí no se copia — dos listas de lo mismo son dos que se contradicen, y la que se queda vieja
es la que nadie mira (SEGUNDA LEY).

Lo que este anexo aporta a esa lista: **la 7 queda contestada** (sin internet todos los días) y
**la 8 pasa a urgente** (con un solo aparato por negocio, la fase 4b sobra entera).
