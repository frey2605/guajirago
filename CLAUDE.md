# ⚖️ LEYES DEL PROYECTO — SE LEEN ANTES DE TOCAR NADA

Este archivo se carga solo al abrir cada sesión **y** se muestra otra vez antes de cada
cambio de archivo (hook `PreToolUse`). No es un recordatorio: manda sobre cualquier
comportamiento por defecto.

---

## 🔴 LA PRIMERA LEY — SOLO SE TOCA LO QUE SE PIDIÓ REPARAR

> **Palabras del dueño:**
> «Lo que quiero evitar es que cuando hagas un arreglo me muevas código que ya está
> funcionando bien, porque ya me está pasando.»
> «Quiero que solo toques y repares lo que necesito reparar.»
> Y la precisión que de verdad muerde:
> «No es solo no tocar el archivo que ya funciona, sino los CÓDIGOS que ya funcionan bien y
> que no están involucrados.»

Esta manda sobre todas las demás. Antes de cada cambio:

1. **Se escribe qué se va a arreglar y qué archivos se van a tocar.** Esa es la lista. Un
   archivo fuera de la lista es una violación, aunque el cambio "se vea mejor".
2. **Dentro de un archivo que SÍ se toca, solo se tocan los renglones involucrados.** Entrar
   a un archivo con permiso no es permiso para acomodar lo demás.
3. **Código que funciona no se mueve, no se reordena, no se reescribe "de paso".** Mover un
   bloque sano de sitio cuenta como tocarlo: el guardián lo detecta y para el trabajo.
4. **Si al arreglar aparece OTRO problema: se ANOTA y se le dice al dueño.** No se arregla en
   el mismo cambio.
5. **Se mide, no se promete. Y la promesa se GRABA antes de empezar.**
   Antes de tocar: `node scripts/guardian.cjs foto "<qué se arregla>" <sitio> [<sitio>...]`
   Al terminar:   `node scripts/guardian.cjs revisar`
   **Se declara el SITIO, no solo el archivo** — `guajirago/src/AppConductor.js:guardarUbicacion`.
   La lista se compara contra la que quedó grabada en la FOTO, no contra la que se diga al
   final. Sin declaración previa el guardián no deja seguir.
6. **Si de verdad hay que tocar algo fuera de la lista, se pide permiso primero.**
7. **Tres candados más:**
   · **El cambio se niega EN EL MOMENTO.** `.claude/candado.cjs` corre antes de cada
     escritura: si el archivo no está declarado, la escritura no se hace.
   · **Libro de excepciones.** Cada escape queda anotado en `.guardian-excepciones.log`.
   · **Segunda opinión antes de cada commit.** Un revisor independiente contesta una sola
     pregunta: *¿esto hacía falta para lo que se pidió?*

---

## 🔟 LOS 10 GRANDES PASOS — el orden de TODO arreglo

> Un «dale» autoriza el arreglo, NO autoriza saltarse pasos.

**MEDIR y AUDITAR van DOS VECES, antes y después. Y no son lo mismo.**
· **Medir** = mirar los DATOS reales (Firestore vivo) y contar. ¿Cuántos? ¿Cuánta plata? ¿Desde cuándo?
· **Auditar** = mirar el CÓDIGO y sus efectos. ¿Qué caminos existen? ¿Qué se puede romper?

**ANTES DE TOCAR NADA**
1. **MEDIR.** Script de SOLO LECTURA contra Firestore vivo. Se guarda: el paso 10 lo re-corre.
2. **AUDITAR.** Enumerar TODOS los escritores y lectores en las tres apps. La causa, no el síntoma.
3. **PROPONER Y PARAR.** Con el número medido, los riesgos sin maquillar, y se espera el «dale».

**CON PERMISO DEL DUEÑO**
4. **CONSTRUIR** solo lo declarado en la foto. Ni un renglón de más.
5. **PROBAR.** Pruebas que EJECUTAN + suite completa + `guardian.cjs revisar` + cacería de
   mutantes: dañar el arreglo a propósito y comprobar que una prueba FALLA.
6. **AUDITAR OTRA VEZ.** Careo contra los datos REALES con el arreglo puesto.
7. **SIMULACRO** (solo si se tocan DATOS). Correr SIN escribir y enseñar qué cambiaría, uno por uno.

**AL APLICAR**
8. **APLICAR** — con permiso otra vez, y **SOLO lo de esta sesión**. El despliegue sale de una
   COPIA LIMPIA de lo commiteado, jamás de la carpeta de trabajo viva.
9. **VERIFICAR CONTRA LA NUBE.** Volver a LEER del servidor. Que el comando diga "listo" no
   es prueba de nada.
10. **RE-AUDITAR lo aplicado.** Contar otra vez y comprobar que lo intocado sigue igual.

---

## 🔶 LA SEGUNDA LEY — UNA SOLA FUENTE, PARA TODO EL PROYECTO

> **Palabras del dueño (23-ago-2026):**
> «No pueden vivir dos procesos en diferentes archivos.»
> «No se pueden usar dos calculadoras para un mismo proceso.»
> «La información que se supone deben compartir debe salir de los mismos archivos.»

Manda sobre todo el proyecto, en las tres apps y en las funciones. Tiene tres caras:

1. **Un proceso vive en UN archivo.** Si el mismo trabajo está escrito en dos sitios, uno
   de los dos se queda viejo. No es una hipótesis: pasa siempre, y el que se queda viejo
   es el que nadie mira.
2. **Una sola calculadora por proceso.** Si un número —una comisión, una tarifa, un
   descuento, un saldo— se calcula en dos sitios, tarde o temprano dan resultados
   distintos. El dinero no admite dos respuestas. **La calculadora buena es la del
   servidor**; el celular puede *enseñar* el número, nunca *decidirlo*.
3. **Lo compartido sale del mismo sitio.** Si dos pantallas, dos apps o una función y una
   app necesitan el mismo dato o la misma lista, salen del mismo archivo. Copiar y pegar
   una lista de estados, un nombre de campo o una tarifa crea un contrato invisible que
   nadie recuerda que existe.
4. **Las conexiones entre el panel, la app y los restaurantes: ÚNICAS, ESTABLES y FUERTES.**
   · **Únicas** — una sola vía por cada cosa que se comparte. Si el panel y la app de
     aliados hablan del mismo negocio, hablan por un solo sitio. Dos copias del mismo dato
     en dos colecciones no son una conexión: son dos versiones que se van a contradecir.
   · **Estables** — un nombre de campo que cruza de una app a otra **no se cambia ni se
     renombra** sin mirar las tres apps y las funciones. Aquí no hay API que avise: si una
     app cambia un campo, la otra deja de funcionar **en silencio**.
   · **Fuertes** — lo que cruza se comprueba en el servidor, no se supone. Una conexión que
     se cae si el otro lado manda algo raro no es fuerte: es una casualidad que aguanta.

**Cómo se cumple, en la práctica:**

- **Antes de escribir algo nuevo se busca si ya existe.** Si existe parecido: se usa, o se
  saca a un sitio común. No se hace una segunda versión.
- **Si al arreglar aparece un gemelo, se ANOTA y se le dice al dueño.** No se unifica de
  paso: eso es tocar código que funciona, y lo prohíbe la PRIMERA LEY. Unificar es un
  trabajo aparte, con sus 10 pasos y su permiso.
- **Un arreglo que hay que aplicar dos veces es la prueba de que la ley está rota ahí.**
  Se hace el arreglo en los dos sitios —porque hay que dejarlo funcionando— y se anota el
  gemelo como deuda, con nombre y archivo.

**Deuda conocida el 23-ago-2026** (medida trabajando, no supuesta):

| Gemelos | Dónde | Qué duplican |
|---|---|---|
| `Solicitar.js` y `SolicitarMensajeria.js` | app de pasajero | pantalla entera de pedir viaje: el mismo arreglo hubo que aplicarlo **dos veces** en las REGLAS 5, 6 y 11 |
| La comisión del viaje | `functions/index.js` y `Ganancias.js` | el mismo número, calculado por **dos calculadoras** distintas |
| El empleado de un negocio | `empleados/{uid}` y `restaurantes/{id}/empleados/{uid}` | **la misma ficha, escrita dos veces a mano** en cada alta, cada cambio y cada activación (`aliados/Empleados.js:75-76`, `:96-103`, `:126-127`). Se leen por separado: la lista sale de una y el permiso de entrar, de la otra. **Si una escritura falla, un empleado despedido sigue pudiendo entrar.** Medido el 23-ago-2026: 1 empleado, las dos copias coinciden — por casualidad, no por diseño |

---

## Cómo se trabaja (leyes de siempre)

1. **Un arreglo a la vez.** Un arreglo = un commit = una verificación.
2. **Se re-audita lo arreglado.** "Audita, prueba y VUELVE a auditar."
3. **NADA sin pedirse.** Si se detecta una necesidad: se PROPONE, no se construye.
4. **Nada se deja para después.** O se hace, o se anota y se le dice al dueño.
5. **Un proceso, un solo sitio.** Antes de escribir algo nuevo: buscar si ya existe.
6. **Se reporta en cristiano.** Palabras simples; la jerga solo en los commits.
7. **Al citar una regla se dice qué dice.**
8. **Que lo diga la app, no yo.** El careo se construye en la pantalla del dueño.
9. **Nada se rechaza en silencio.** Todo rechazo va a una bandeja con su motivo.
10. **Los borrados dejan lápida.** Un registro solo se borra con su marca de borrado.

---

## 🗺️ EL TERRENO DE GUAJIRAGO (leer antes de cualquier despliegue)

**Tres apps, tres repos de GitHub, UN solo proyecto Firebase (`guajirago`).**
Todo el acoplamiento entre apps es contrato implícito de campos en Firestore: no hay API.
Cambiar un campo en una app puede romper otra sin que nada avise.

| Carpeta | Repo GitHub | Qué es | Hosting |
|---|---|---|---|
| `guajirago/` | `frey2605/guajirago` | app de pasajero y conductor (taxi, mototaxi, mensajería) | target por defecto |
| `guajirago-admin/` | `frey2605/guajirago-admin` | panel de administración y superadmin | target `admin` |
| `guajirago-aliados/` | `frey2605/guajirago-aliados` | restaurantes y agencias de turismo | — |

**`guajirago-admin/` y `guajirago-aliados/` están en `.gitignore` del repo raíz y son repos
APARTE.** Un `git status` en la raíz NO ve sus cambios. El guardián los mira por separado.

**Las Cloud Functions** (`guajirago/functions/index.js`) corren con el SDK admin y **se saltan
las reglas de Firestore**. Lo que se blinde en las reglas hay que moverlo allí, no borrarlo.

---

## 🪤 TRAMPAS DE ESTE REPO

> Esta sección se llena sola a medida que las trampas muerdan. Cada una con fecha.

- **(23-ago-2026) Ya solo queda UNA copia de trabajo.** La buena y única es
  `C:\Users\Windows 11\GuajiraGo` (rama `main`). La de `Dropbox\PROYECTOS\GuajiraGo` tenía
  **99 archivos borrados** del árbol de trabajo — un `git commit -a` allí borraba el proyecto —
  y **se borró el 23-ago-2026**, tras comprobar objeto por objeto que no contenía nada que no
  estuviera ya en la copia buena. Su `git branch -vv` decía *"ahead 11"*: era **mentira**,
  comparaba contra un `origin/main` viejo que nunca refrescó.
- **(23-ago-2026) Dentro de la copia buena hay otro repo anidado** en `guajirago/`, rama `v2.1`
  (HEAD `12a0de9`, 6-jul). No contiene el trabajo de taxi de julio: **no se trabaja desde ahí**.
  Y ojo — ese HEAD y sus **3 stashes NO están en GitHub**: es lo único del proyecto que vive
  solo en este disco.
- **(23-ago-2026) Las reglas de Firestore no estaban en el repo.** Vivían solo en la consola,
  sin historial. La copia bajada del servidor quedó en `firestore.rules.LIVE`.
- **(23-ago-2026) `firebase` no tiene comando para LEER reglas.** Se bajan con la API
  `firebaserules.googleapis.com` usando la sesión que el CLI ya tiene abierta.

---

## 🗄️ EL RESPALDO — regla del dueño

> **Palabras del dueño:** «GitHub es el respaldo principal.»
> «Si el proyecto se pone en Dropbox hay que excluir `.git` y `node_modules` de la
> sincronización. Dropbox ya se comió una copia entera del código.»

1. **El respaldo es GitHub, y solo GitHub.** Una carpeta en el disco no es respaldo. Una
   carpeta en Dropbox tampoco: es una copia que alguien más puede mover o borrar.
2. **Lo que no está empujado a GitHub, NO está respaldado.** Da igual que esté commiteado:
   un commit que solo vive en esta máquina se pierde con la máquina.
3. **Si el proyecto se pone en Dropbox, se excluyen de la sincronización `.git` y
   `node_modules`.** El `.git` porque Dropbox lo sincroniza a medias y lo corrompe;
   `node_modules` porque son miles de archivos que solo sirven para atascar la sincronización.
4. **Los tres repos se dejan al día.** Raíz, `guajirago-admin` y `guajirago-aliados` son
   repos APARTE: empujar uno no empuja los otros. Se comprueba contra el servidor
   (`git ls-remote`), no contra el `origin/main` local, que puede estar viejo.

**Lo que se midió el 23-ago-2026** (por eso esta regla existe): la copia de
`Dropbox\PROYECTOS\GuajiraGo` tenía **99 archivos borrados** del árbol de trabajo. Se salvó
el código porque ya estaba en GitHub — no porque Dropbox lo guardara. Y su `git branch -vv`
decía *"ahead 11"*, que era **mentira**: comparaba contra un `origin/main` viejo que nunca
refrescó. Los 11 commits ya estaban en GitHub.
