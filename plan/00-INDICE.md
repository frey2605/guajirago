# 🗺️ PLAN GENERAL — GuajiraGo y el software de Aliados

> **Qué es esta carpeta.** El plan de arriba, el que manda sobre los demás. No trae código ni
> pasos detallados: trae las **decisiones de fondo**, el **orden** en que hay que hacer las cosas
> y **cómo se sabrá que cada una quedó hecha**. Cada punto se desglosa después en su propio plan
> de trabajo, con sus 14 pasos.
>
> **Empezado el 24-sep-2026.** Todo número lleva al lado el comando que lo produjo, porque un
> número sin comando no se puede recontar y es el que se queda viejo sin que nadie se entere.
>
> **NO ESTÁ APROBADO.** Es una propuesta. El paso 3 de las leyes dice PROPONER y **PARAR**.

---

## 📂 Las partes

Está partido a propósito: **cada archivo se puede actualizar solo**, sin abrir los demás y sin
riesgo de pisar lo que no se está tocando. Un plan de 763 renglones en un archivo es un plan que
nadie vuelve a abrir.

### El plan

| | Archivo | De qué trata |
|---|---|---|
| **0** | [`01-DONDE-ESTAMOS.md`](01-DONDE-ESTAMOS.md) | Lo que hay hoy, **medido**, con el comando de cada número. Empieza por aquí |
| **1** | [`02-DECISIONES.md`](02-DECISIONES.md) | Las cuatro decisiones de fondo. Si una cambia, el plan se rehace |
| **2** | [`03-ESTRUCTURA.md`](03-ESTRUCTURA.md) | Las cuatro capas y la frontera entre los dos negocios |
| **3** | [`04-SEGURIDAD.md`](04-SEGURIDAD.md) | Los ocho frentes de seguridad |
| **4** | [`05-AMBIENTE-DE-PRUEBAS.md`](05-AMBIENTE-DE-PRUEBAS.md) | El ambiente de pruebas: la Fase 0, y la más importante |
| **5** | [`06-FASES.md`](06-FASES.md) | El orden de trabajo. **No es negociable en las tres primeras** |
| **6** | [`07-COMO-SE-MIDE.md`](07-COMO-SE-MIDE.md) | Cómo se sabrá que cada fase quedó hecha |
| **7** | [`08-PREGUNTAS.md`](08-PREGUNTAS.md) | Lo que no está decidido. **Hacen falta respuestas del dueño** |
| **8** | [`09-RIESGOS.md`](09-RIESGOS.md) | Los riesgos, y lo que este plan **no** es |

### Los anexos

| | Archivo | De qué trata |
|---|---|---|
| **A** | [`A-CONTROL-ELITE.md`](A-CONTROL-ELITE.md) | Qué se copia del otro proyecto, careado número a número |
| **B** | [`B-SIN-SENAL.md`](B-SIN-SENAL.md) | Aliados sin señal, y todo desde el celular |
| **C** | [`C-RED-INTERNA.md`](C-RED-INTERNA.md) | La red interna del negocio: **es requisito**, no opción |
| **D** | [`D-PENDIENTES.md`](D-PENDIENTES.md) | Lo que falta por hacer: el inventario, medido, y a qué fase va cada cosa |
| **E** | [`E-APP-TRANSPORTE.md`](E-APP-TRANSPORTE.md) | Qué hay que separar de la app de transporte (pasajero y conductor) |
| **F** | [`F-APP-ALIADOS.md`](F-APP-ALIADOS.md) | Qué hay que hacer en la app de aliados, en orden |

---

## 🚦 Dónde estamos ahora mismo

| | |
|---|---|
| **Decidido** | **aliados se SEPARA** en su propio proyecto; **el transporte NO** (el pasajero y el conductor escriben el mismo documento en vivo). Ver [`02-DECISIONES.md`](02-DECISIONES.md) |
| **Fase 0, empezada (25-sep-2026)** | `guajirago-pruebas` existe y la app de transporte compila por ambiente (`b1c8a63`): `npm run build:pruebas` / `build:produccion`, cartel PRUEBAS, `.firebaserc` con PRUEBAS por defecto. Faltan: la base de datos y el plan Blaze de pruebas (consola, del dueño), reglas, índices y funciones a pruebas, el guion de siembra, y las otras dos apps. Lo cuenta `node scripts/medir-ambientes.cjs` |
| **Lo urgente detrás** | la **pregunta 8**: ¿cuántos aparatos por negocio? Con uno solo, la fase 4b entera sobra |
| **Contestadas** | la 1 (aliados se separa), la 6 (qué es «Calaira») y la 7 (sin internet **todos los días**) |
| **Lo que bloquea primero de todo** | ~~el permiso de lectura de los repos hermanos~~ ✅ servía desde la tarde del 24-sep. De lo que bloqueaba solo queda **P3**, los permisos de la llave de servicio, que son del dueño. Ver D.2 en [`D-PENDIENTES.md`](D-PENDIENTES.md) |
| **Lo siguiente que se hará** | lo dice D.6 en [`D-PENDIENTES.md`](D-PENDIENTES.md), y solo ahí: copiarlo aquí es el gemelo que se quedó viejo (el guardián N1–N3 y la pregunta 1 ya estaban hechos cuando este renglón los pedía) |

---

## ✍️ Cómo se actualiza esto

Cinco reglas, para que dentro de tres meses siga sirviendo:

1. **Se toca UN archivo por cambio.** Es para lo que se partió. Si un cambio obliga a tocar tres,
   probablemente es un cambio de fondo y va en [`02-DECISIONES.md`](02-DECISIONES.md).
2. **Todo número lleva su comando al lado.** Un número sin comando no se puede recontar, y el que
   no se puede recontar es el que se queda viejo sin que nadie se entere.
3. **Lo que no se midió se escribe como no medido.** Nunca se firma una cifra supuesta.
4. **No se escriben nombres de archivos de otros repos.** La prueba «LAS NOTAS NO MIENTEN» se pone
   roja, y con razón: quien la lea iría a buscar algo que aquí no existe. Se describe en palabras.
5. **Cuando una pregunta se conteste, se marca aquí y en
   [`08-PREGUNTAS.md`](08-PREGUNTAS.md)** — en los dos, o el índice empieza a mentir.
