> Parte del **plan general** de GuajiraGo. La puerta de entrada y el índice están en
> [`plan/00-INDICE.md`](00-INDICE.md). Este archivo se puede actualizar solo, sin tocar
> los demás — para eso se partió.

# 📎 ANEXO D — LO QUE FALTA POR HACER

> **Qué es esto.** El inventario de lo pendiente, **sacado de donde ya estaba escrito y medido**,
> no de la memoria de nadie. Sirve para que ninguna deuda se pierda al entrar en el plan grande y
> para saber **a qué fase va cada cosa**.
>
> 🔑 **Y lo que este archivo NO hace: copiar la tabla de deuda.** Esa tabla vive en `CLAUDE.md`,
> que es su sitio, y copiar 43 filas aquí sería el gemelo que se queda viejo — y el que se queda
> viejo es el que nadie mira (SEGUNDA LEY). Aquí se **cuenta**, se **agrupa** y se **dice a qué
> fase va**. Para leer cada deuda, se va a `CLAUDE.md`.

---

## D.1 · El conteo, medido el 24-sep-2026

| De dónde sale | Cuántos | Con qué se contó |
|---|---|---|
| Tabla de deuda de `CLAUDE.md` — **abiertas** | **43** | se localiza la tabla por su cabecera y se cuentan sus filas, quitando las tachadas y las marcadas CERRADA |
| … de esas, marcadas 🔴 (las que muerden) | **16** | las mismas filas, filtrando por 🔴 |
| … cerradas (ya hechas, se dejan como historia) | 12 | ídem |
| `catch` mudos en las tres apps | **149** | `grep -rhoE "catch *\([a-z]*\) *\{ *\}\|catch *\([a-z]*\) *\{ *console"` |
| Medidores que existen (cada uno vigila algo) | 22 | `ls scripts/medir-*.cjs \| wc -l` |
| `TODO` / `FIXME` de verdad en el código | **1** | `grep -rhoE "//\s*(TODO\|FIXME\|HACK\|XXX)"` |
| Commits que le faltan a `main` | **25** | `git log origin/main..HEAD --oneline \| wc -l` |
| Botones de despliegue escritos / **en `main`** | **5 / 0** | `ls .github/workflows/*.yml`, `git ls-tree origin/main -- .github/` |

### 🟢 Lo primero que dice este conteo, y es bueno

**Un solo `TODO` en 25.000 renglones.** Aquí lo pendiente **no se abandona dentro del código**: se
escribe, se mide y se le pone nombre. Por eso este inventario se puede hacer en diez minutos y no
es una excavación.

### 🔴 Y lo segundo, que no lo es

**149 `catch` mudos.** Cada uno es un sitio donde algo puede fallar y **no se lo dice a nadie**.
Va contra la REGLA 9 de este proyecto —*nada se rechaza en silencio*— y **ya mordió**: el 23-sep
el dueño apretó un botón en su casa, no pasó nada, y costó media hora de adivinar lo que un
renglón habría dicho.

---

## D.2 · Lo que BLOQUEA HOY, y no puede esperar a ninguna fase

Esto no es deuda: es trabajo empezado que está a medias y no sirve de nada hasta terminarlo.

| # | Qué | Estado medido | Quién lo desbloquea |
|---|---|---|---|
| **P1** | El permiso de lectura de los repos hermanos | **caducado o revocado** — GitHub contesta `Bad credentials` | **el dueño**, renovándolo |
| **P2** | Los 5 botones de despliegue | escritos y probados, **0 en `main`**, **ninguno ha desplegado nunca** | fusionar los 25 commits |
| **P3** | Los permisos (roles) de la llave de servicio | faltan 2 para reglas e índices, 5 para la nube | **el dueño**, en la consola de Google |
| **P4** | Los arreglos de las librerías de panel y aliados | hechos, **en una rama sin fusionar** en cada repo hermano | fusionarlos |
| **P5** | ¿Corre la suite entera en GitHub? | **sin respuesta**: la medición no llegó a intentarlo por culpa de P1 | se contesta sola al arreglar P1 |

> **P1 es el primero de todos.** Mientras no sirva, P5 no se puede contestar y P2 no se debería
> fusionar a ciegas.

---

## D.3 · Los grupos de deuda, y a qué fase va cada uno

Las 43 filas abiertas de `CLAUDE.md` no son 43 trabajos distintos: son **siete familias**. Y casi
todas se tocan solas al hacer las fases del plan.

| Familia | Cuántas, aprox. | Qué es | Fase |
|---|---|---|---|
| **Listas de estados incompletas** | ~8 | la misma lista de finales de un viaje, copiada corta en varias pantallas: hacen desaparecer registros sin avisar | **2** (la frontera: es un contrato) |
| **Silencios** (`catch` mudos y salidas sin aviso) | ~6 filas, **149 sitios** | algo falla y no se dice | **3** (junto con el dinero: un cobro que falla y calla es lo mismo) |
| **Gemelos** (lo mismo escrito dos veces) | ~7 | el WhatsApp en 8 sitios, la plomería en 31 guiones, dos listas en el panel | **2 y 3** (es la SEGUNDA LEY) |
| **El dinero lo decide el celular** | ~3 | el total del pedido, las tarifas bajo los cancelados | **3** |
| **Consultas que eligen a ciegas** | ~4 | topes sin decir por cuál empezar: al pasar del tope, el servidor elige qué se ve | **5** |
| **Notas y medidores que se quedaron viejos** | ~8 | cifras sin comando, avisos que mandan a esperar algo que ya pasó | **6** |
| **Del transporte** (pánico, origen del viaje, conductor) | ~7 | seguridad de la persona que se sube al carro | **5** |

🔴 **Las 16 marcadas 🔴 no esperan a su fase.** Son las que ya mordieron o pueden morder: se hacen
cuando toque su archivo, no cuando toque su familia.

---

## D.4 · Lo que apareció HOY y todavía no tiene sitio en ninguna tabla

Encontrado el 23 y 24 de septiembre trabajando. **Ninguno está en `CLAUDE.md` todavía**, así que
se apunta aquí para que no se pierda.

| # | Qué | Dónde | Por qué importa |
|---|---|---|---|
| **N1** | 🔴 **El detector de «código movido» tiene puerta de atrás** | el guardián | Basta con mover el código a un **archivo nuevo** y no dice nada. Demostrado: 747 renglones movidos sin una queja, cuando el 23-sep paró el trabajo por seis |
| **N2** | La foto del guardián **no puede declarar una carpeta** | el guardián | Hay trabajos en los que los nombres de los archivos **nacen del trabajo**, y entonces no se pueden declarar antes |
| **N3** | El libro de excepciones **para al guardián** | el guardián | Escribir en él es tocar un archivo no declarado. Ya estaba anotado; hoy se midió además que lo llama «cambio invisible a git» cuando **sí** está en git |
| **N4** | El respaldo del conductor **sigue mudo** | app del conductor | Si los dos intentos de GPS fallan, no se le dice nada. Hermano de los 149 |
| **N5** | La prueba de citas **no ve los archivos de otros repos con extensión de código** | los amarres | Cazó un nombre `.md` de otro repo pero **no** tres `.jsx`. Un hueco del propio vigilante |
| **N6** | El emulador de **funciones** no arranca en el contenedor de trabajo | la caja, no el repo | `pruebas/funciones.test.js` lleva días sin poder correr aquí. **No está medido por qué** |
| **N7** | El canal de prueba necesitó autorizar **dos** listas de dominios | fuera del repo | Maps y Auth, cada una por su lado. Ya resuelto para este canal; **el siguiente canal lo pedirá otra vez** |

> **N1, N2 y N3 son el mismo arreglo**, en el mismo archivo, y son de una o dos líneas cada uno.
> Van juntos, con sus pasos. **Y van pronto**: N1 deja abierto el candado que más ha protegido a
> este proyecto.

---

## D.5 · Lo que este inventario NO trae, dicho para que no se lea como completo

- **No trae los pendientes de los dos repos hermanos.** Panel y aliados tienen sus propios trabajos
  a medias y **no se midieron aquí**. Hacen falta cuando les toque su fase.
- **No trae nada del servidor ni de las reglas puestas.** Saber si lo que corre en la nube es lo
  que dice el repo **necesita una llave de lectura que aquí no hay**. Es un hueco conocido y
  escrito.
- **No trae lo que nadie ha mirado todavía.** Esto es un inventario de lo **anotado**; lo que no
  se midió nunca no aparece, y eso no significa que no exista.
- **No pone fechas ni orden dentro de cada familia.** Eso sale cuando cada fase se desglose.

---

## D.6 · Lo que se propone hacer con esto

1. **Arreglar P1** (el permiso). Es de minutos y desbloquea cuatro cosas.
2. **N1 + N2 + N3 juntos**, con sus pasos. Es poco trabajo y devuelve el candado que hoy tiene una
   puerta abierta.
3. **Contestar la pregunta 1** (¿aliados comparte proyecto Firebase?), que es lo que bloquea la
   Fase 0 y por tanto todo lo demás.
4. **Volcar N1–N7 a la tabla de `CLAUDE.md`** cuando cada uno se arregle o se decida — este
   archivo es el borrador, no el destino. Si un pendiente se queda aquí para siempre, este anexo
   se convierte en el gemelo de la tabla de deuda — que es justo lo que la nota de arriba dice
   evitar. (Esa cita decía «lo que D.0 dice», y no hay ningún D.0: una nota que manda a un sitio
   que no existe, en el archivo que se escribió para que nada se pierda.)
