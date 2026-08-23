# 🔟 LOS 10 GRANDES PASOS — la guía al detalle

> El orden lo puso el dueño: «Antes de hacer cada arreglo lo mides, lo pruebas y lo auditas
> antes de desplegarlo». **Un «dale» autoriza el arreglo, NO autoriza saltarse pasos.**

**MEDIR y AUDITAR van DOS VECES (antes y después) y no son lo mismo:**

- **Medir** = contar DATOS reales. ¿Cuántos casos? ¿Cuánta plata? ¿Desde cuándo? ¿A quiénes?
- **Auditar** = leer CÓDIGO y sus efectos. ¿Qué caminos existen? ¿Qué se puede romper?

---

## ANTES DE TOCAR NADA

### 1 · MEDIR

**Qué es.** Ir a los datos REALES (Firestore vivo, no el caché ni una copia local) y contar
antes de opinar.

**Cómo se hace bien.** Un script de SOLO LECTURA que imprime números exactos con nombres y
fechas. El script se GUARDA: la re-auditoría del paso 10 lo vuelve a correr para comparar
antes y después.

**Qué no vale.** «Debe haber muchos» (suposición, no medición) · medir el caché o la copia
local · mirar un ejemplo y generalizar · prometer el resultado antes de contar.

### 2 · AUDITAR

**Qué es.** Leer el CÓDIGO alrededor: enumerar TODOS los caminos que escriben o leen esa
pieza, quién más la usa, y qué usos legítimos podría estorbar el arreglo.

**Cómo se hace bien.** Lista completa de escritores y lectores buscando en TODO el repo —
y en GuajiraGo eso significa **las tres apps**, porque no hay API entre ellas: el
acoplamiento es contrato implícito de campos en Firestore. Si el dato no cuadra con lo que
el código puede producir, ir al historial. El arreglo cae donde está la CAUSA, no donde
duele el síntoma.

**Qué no vale.** Leer solo la función que se piensa cambiar · suponer que «nadie más usa
esto» · arreglar el síntoma sin el porqué probado.

### 3 · PROPONER Y PARAR

**Qué es.** Presentar la propuesta CON el número medido, decir los riesgos sin maquillar, y
ESPERAR el permiso. Parar de verdad: ni una línea de código antes del «dale».

**Cómo se hace bien.** La propuesta dice: qué se arregla, qué archivos se tocan, qué NO se
toca, qué riesgos hay y qué preguntas decide el dueño. En palabras simples.

**Qué no vale.** «Aprovechar» para construir lo no pedido · escribir código «mientras
decide» · proponer sin números · esconder un riesgo para que apruebe rápido.

---

## CON PERMISO DEL DUEÑO

### 4 · CONSTRUIR

**Qué es.** Escribir SOLO lo declarado. Antes de tocar, la promesa se GRABA (la foto del
guardián); el candado niega en el momento cualquier escritura fuera de esa lista.

    node scripts/guardian.cjs foto "qué se arregla" guajirago/src/Archivo.js:funcion

**Cómo se hace bien.** Cambios quirúrgicos: dentro de un archivo permitido, solo los
renglones involucrados. Código que funciona no se mueve, no se renombra, no se embellece
«de paso». Si aparece OTRO problema: se ANOTA y se dice — no se arregla en el mismo cambio.

**Qué no vale.** Reordenar o «limpiar» lo que ya servía · tocar un archivo fuera de la lista
· dos arreglos en un commit.

### 5 · PROBAR

**Qué es.** Tres pruebas en una: pruebas nuevas que EJECUTAN el motor con datos como los
vivos + la suite COMPLETA mirando el conteo + la revisión del guardián.

**Cómo se hace bien.** La prueba corre la función real, no lee el texto del archivo. Y la
cacería de MUTANTES: dañar el arreglo a propósito y comprobar que alguna prueba FALLA — una
prueba que no puede fallar no protege nada.

**Qué no vale.** Ajustar una prueba vieja para que pase (la constitución solo se mueve si
cambió la LEY, con permiso del dueño CADA vez) · «pasó en mi máquina» sin mirar el conteo.

### 6 · AUDITAR OTRA VEZ

**Qué es.** El careo contra los datos REALES con el arreglo puesto: ¿hace lo que digo, y no
estorba lo que ya servía?

**Cómo se hace bien.** Correr el caso con el motor de ANTES y el de AHORA y enseñar la
diferencia. Repasar uno a uno los caminos enumerados en el paso 2.

**Qué no vale.** Confiar en que «las pruebas pasaron»: las pruebas ejecutan lo que uno
pensó; el careo busca lo que uno NO pensó.

### 7 · SIMULACRO (solo si se van a tocar datos)

**Qué es.** Toda herramienta que ESCRIBA datos corre primero SIN escribir y enseña qué
cambiaría, registro por registro. Aplicar de verdad se pide aparte.

**Cómo se hace bien.** El simulacro es el modo por DEFECTO; aplicar exige un argumento
explícito. El listado dice: qué registro, qué valor tiene hoy, qué valor quedaría.

**Qué no vale.** «Es solo un registro, lo escribo de una» · reparar datos sin lista previa.

---

## AL APLICAR

### 8 · APLICAR — con permiso otra vez, y SOLO lo de esta sesión

**Qué es.** Desplegar código o escribir datos: las dos formas de «aplicar», y las dos son
decisión del dueño. El «dale» de construir no incluye el de aplicar.

**Cómo se hace bien.** Copia limpia del commit → construir ahí → desplegar desde ahí. Jamás
desde la carpeta de trabajo viva. Antes de desplegar se mira qué hay sin commitear y de
quién es. Un arreglo = un commit = un despliegue = una verificación.

**En GuajiraGo hay que decir CUÁL de las tres apps se despliega** y con qué target:

    firebase deploy --only hosting              (app de pasajero/conductor)
    firebase deploy --only hosting:admin        (panel)
    firebase deploy --only functions            (Cloud Functions)
    firebase deploy --only firestore:rules      (reglas)

**Qué no vale.** Desplegar desde la carpeta de trabajo · servir «de paso» trabajo ajeno sin
verificar · aplicar datos y código juntos sin decirlo.

### 9 · VERIFICAR CONTRA LA NUBE

**Qué es.** Volver a LEER del servidor y comprobar. Jamás cantar «hecho» sin eso: que el
comando de despliegue diga «listo» no es prueba de nada.

**Cómo se hace bien.** Bajar lo que el servidor SIRVE y compararlo con lo construido. Si se
escribieron datos: releerlos y comprobar valor por valor.

**Qué no vale.** Verificar la copia local · confiar en el «listo» de la herramienta.

### 10 · RE-AUDITAR LO APLICADO

**Qué es.** «Audita, prueba y VUELVE a auditar.» Contar OTRA VEZ los datos (repetir la
medición del paso 1 con el arreglo vivo) y comprobar que lo que NO se debía tocar sigue
exactamente igual.

**Cómo se hace bien.** Re-correr el script del paso 1 y comparar. Barrer regresiones. Lo
pendiente se DICE — nada se deja en silencio «para después».

**Qué no vale.** Cerrar el caso con el despliegue · dejar la re-auditoría «para mañana».

---

## Tabla de bolsillo

| # | Paso | Pregunta que contesta | Se para si… |
|---|---|---|---|
| 1 | Medir | ¿Cuántos, cuánta plata, desde cuándo? | no hay acceso a datos reales |
| 2 | Auditar | ¿Quién escribe y lee esto? ¿La causa raíz? | el porqué no está probado |
| 3 | Proponer y parar | ¿El dueño aprueba con números? | no hay «dale» |
| 4 | Construir | ¿Solo lo declarado en la foto? | el candado niega un archivo |
| 5 | Probar | ¿Las pruebas EJECUTAN y cazan mutantes? | un mutante sobrevive |
| 6 | Auditar otra vez | ¿Antes contra ahora, con datos reales? | el careo muestra un estorbo |
| 7 | Simulacro | ¿Qué cambiaría, registro por registro? | (solo si se tocan datos) |
| 8 | Aplicar | ¿Permiso otra vez? ¿SOLO lo de esta sesión? | hay trabajo ajeno en la carpeta |
| 9 | Verificar | ¿Lo SERVIDO es lo construido? | el servidor entrega otra cosa |
| 10 | Re-auditar | ¿Los números cuadran? ¿Lo intocado sigue igual? | aparece una regresión |

---

## Las piezas que le dan dientes

- **El guardián** (`scripts/guardian.cjs`) — `foto` graba la promesa ANTES de tocar;
  `revisar` compara al final lo tocado contra lo prometido, cuenta renglones por archivo,
  caza código movido de sitio y PARA si una prueba que pasaba ahora falla.
- **El candado** (`.claude/candado.cjs`) — hook que corre antes de CADA escritura: muestra
  las leyes otra vez y NIEGA el cambio si el archivo no está declarado.
- **El libro de excepciones** (`.guardian-excepciones.log`) — cada escape anotado con fecha
  y motivo. Que el patrón se vea es lo que impide que se vuelva costumbre.
- **La segunda opinión** — antes de CADA commit, un revisor sin el contexto del que
  construyó contesta: *¿esto hacía falta para lo que se pidió?*
- **Las pruebas-constitución** — cada ley del dueño convertida en una prueba que EJECUTA.
  Jamás se ajusta una prueba para que pase.
