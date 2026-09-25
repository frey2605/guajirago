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
| Commits que le faltan a `main` | ~~25~~ → **0** el 24-sep (noche); ojo: la rama `claude/hola-6wz1a3` del servidor trae **3 commits sin fusionar** | `git log origin/main..HEAD --oneline \| wc -l` |
| Botones de despliegue escritos / **en `main`** | ~~5 / 0~~ → **5 / 5** el 24-sep (noche) | `ls .github/workflows/*.yml`, `git ls-tree origin/main -- .github/` |

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

> 🔄 **Vuelto a medir la noche del 24-sep-2026** con `node scripts/medir-pendientes.cjs` (no toca
> datos; solo hace `git fetch`). De los cinco, **cuatro se habían cerrado esa misma tarde** y la
> lista seguía mandando a trabajar en ellos.

| # | Qué | Estado medido | Quién lo desbloquea |
|---|---|---|---|
| ~~**P1**~~ | El permiso de lectura de los repos hermanos | ✅ **CERRADO** — la corrida que baja los tres repos sale bien desde el 24-sep (17:44 UTC) | — |
| ~~**P2**~~ | Los 5 botones de despliegue | ✅ **CERRADO** — los 5 en `main`, y `desplegar.yml` ya publicó la app el 24-sep. **Pero ya no se usan para publicar**: ver abajo | — |
| **P3** | Los permisos (roles) de la llave de servicio | faltan 2 para reglas e índices, 5 para la nube. **No medido el 24-sep**: se ve en la consola de Google, no desde aquí | **el dueño**, en la consola de Google |
| ~~**P4**~~ | Los arreglos de las librerías de panel y aliados | ✅ **CERRADO** — los dos repos hermanos en `main`, nada sin empujar y ninguna rama sin fusionar | — |
| ~~**P5**~~ | ¿Corre la suite entera en GitHub? | ✅ **CONTESTADO: sí** — desde las 17:44 UTC del 24-sep, 12 corridas de la tanda salieron bien y 1 se canceló a mano | — |

### 🖥️ Desde el 24-sep-2026 se publica desde el PC

Decisión del dueño: «Todo lo vamos a publicar desde aquí porque no tenemos minutos en GitHub», y
«que siga guardando en GitHub». GitHub queda **solo para guardar** (paso 9); publicar se hace con
`firebase` desde el PC (paso 10), desde la carpeta de cada app.

🔴 **Lo que eso obliga a hacer:** cuatro de los cinco botones **se disparan solos al subir código**
—`desplegar.yml` publica la app con cualquier cosa que entre a `main`—, así que guardar en GitHub
todavía **publica desde allá** sin pasar por el paso 10. Decidido apagarlos en GitHub
(`gh workflow disable`), sin tocar los archivos. **Pendiente**, como su propio arreglo.

🔴 **Y lo que eso destapa:** la tanda entera tiene que pasar **en el PC**, y el 24-sep no pasa —ver
D.4—.

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
| ~~**N1**~~ | ✅ **CERRADO** (commit `19e671b`, 24-sep) — el detector de «código movido» tenía puerta de atrás | el guardián | Bastaba con mover el código a un **archivo nuevo** y no decía nada. Demostrado: 747 renglones movidos sin una queja, cuando el 23-sep paró el trabajo por seis |
| ~~**N2**~~ | ✅ **CERRADO** (commit `bf175b1`, 24-sep) — la foto del guardián no podía declarar una carpeta | el guardián | Hay trabajos en los que los nombres de los archivos **nacen del trabajo**, y entonces no se pueden declarar antes |
| ~~**N3**~~ | ✅ **CERRADO** (commit `20da141`, 24-sep) — el libro de excepciones paraba al guardián | el guardián | Escribir en él era tocar un archivo no declarado, y lo llamaba «cambio invisible a git» cuando **sí** está en git |
| **N4** | El respaldo del conductor **sigue mudo** | app del conductor | Si los dos intentos de GPS fallan, no se le dice nada. Hermano de los 149 |
| **N5** | La prueba de citas **no ve los archivos de otros repos con extensión de código** | los amarres | Cazó un nombre `.md` de otro repo pero **no** tres `.jsx`. Un hueco del propio vigilante |
| **N6** | El emulador de **funciones** no arranca en el contenedor de trabajo | la caja, no el repo | `pruebas/funciones.test.js` lleva días sin poder correr aquí. **No está medido por qué** |
| **N7** | El canal de prueba necesitó autorizar **dos** listas de dominios | fuera del repo | Maps y Auth, cada una por su lado. Ya resuelto para este canal; **el siguiente canal lo pedirá otra vez** |
| — | 🔴 **La tanda entera NO pasa en el PC** (24-sep) | `pruebas/elBotonDeDesplegar.test.js`, los tres «y no se puede ablandar» | 979 de 982. Los tres que fallan vigilan los botones: **5 de sus 30 sabotajes no se ponen rojos** en el PC (2 de 15, 2 de 7 y 1 de 8), y en GitHub sí. Y como la tanda 1 falla, **funciones, chat y almacén ni se corren**. Ahora que se publica desde el PC, el PC es el único juez. **No medido por qué** |
| — | 🔴 **Nadie vigila las citas de la carpeta `plan/`** (24-sep) | `scripts/medir-citas.cjs`, su lista de carpetas | Saboteado: se metió aquí una cita a un guion que no existe y **nada se puso rojo**. El medidor no entra en `plan/`; y metiéndolo tal cual da 53 falsas alarmas, porque lee `01-DONDE-ESTAMOS.md` como `DONDE-ESTAMOS.md` (exige que el nombre empiece por letra) |

> N1, N2 y N3 se hicieron el 24-sep, cada uno con sus pasos.

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

1. ~~**Arreglar P1**~~ ✅ ya servía el 24-sep.
2. ~~**N1 + N2 + N3**~~ ✅ hechos el 24-sep.
2-bis. (24-sep) **Apagar en GitHub los botones que se disparan solos**, y **que la tanda entera
   pase en el PC** — cada uno como su propio arreglo.
3. **Contestar la pregunta 1** (¿aliados comparte proyecto Firebase?), que es lo que bloquea la
   Fase 0 y por tanto todo lo demás.
4. **Volcar N1–N7 a la tabla de `CLAUDE.md`** cuando cada uno se arregle o se decida — este
   archivo es el borrador, no el destino. Si un pendiente se queda aquí para siempre, este anexo
   se convierte en el gemelo de la tabla de deuda — que es justo lo que la nota de arriba dice
   evitar. (Esa cita decía «lo que D.0 dice», y no hay ningún D.0: una nota que manda a un sitio
   que no existe, en el archivo que se escribió para que nada se pierda.)
