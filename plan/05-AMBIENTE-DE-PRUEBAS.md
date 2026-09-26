> Parte del **plan general** de GuajiraGo. La puerta de entrada y el índice están en
> [`plan/00-INDICE.md`](00-INDICE.md). Este archivo se puede actualizar solo, sin tocar
> los demás — para eso se partió.

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

### 🟢 Lo que ya está puesto (25-sep-2026)

- **Nivel 2 empezado.** `guajirago-pruebas` existe (lo creó el dueño; se llama `-pruebas` y no `-dev`, como
  en Talaria). Tiene app web registrada y tres sitios: `guajirago-pruebas.web.app` (transporte),
  `guajirago-pruebas-admin.web.app` (panel) y `guajirago-pruebas-aliados.web.app` (aliados). Desde la noche del
  25-sep-2026 tiene, hecho por el dueño en la consola y comprobado contra la nube solo leyendo: **base de Firestore**
  (nam5, modo producción), **Authentication** con correo/contraseña y los 5 dominios autorizados, **plan Blaze** (con una
  cuenta de facturación aparte de la de producción), la API de **Cloud Messaging**, y la **llave de notificaciones**
  (`7ef29a2`). La llave de Maps de producción ya admite `guajirago-pruebas.web.app` y `guajirago-pruebas-aliados.web.app`
  (el panel no carga Maps). Y desde aquí se le publicaron **las reglas y los 3 índices del repo** (copia limpia de
  `7ef29a2`, `--project guajirago-pruebas`, leídos de vuelta del servidor: idénticos; antes tenía las reglas «todo
  cerrado» de la consola y cero índices). **No tiene todavía** Firebase Storage activado (la consola pide «Comenzar»):
  sin eso no entran las reglas del almacén ni las funciones. Producción no se tocó (sus reglas siguen siendo las del
  12-sep y sus 3 índices).
- **La app de transporte cumple las reglas 1, 3 y 4** (`b1c8a63`): proyecto aparte, el ambiente lo fija cómo
  se compila (`npm run build:pruebas` / `build:produccion`, nunca a mano), y la copia de pruebas lleva cartel
  naranja. La regla 5 se cumple: la llave de notificaciones de pruebas la generó el dueño el 25-sep y
  está en los `.env.pruebas` de transporte y aliados (`7ef29a2`, y `c886693` en el repo de aliados); y transporte ya la
  lee del ambiente para pasajero y conductor (`f704c34`: antes `src/Notificaciones.js` llevaba la de producción a
  mano y el medidor no la veía). 🔴 El paquete de pruebas de transporte publicado sigue siendo el de `b1c8a63` (con la
  llave de producción dentro): se vuelve a publicar con el arreglo de los dos `firebase-messaging-sw.js`, que llevan
  producción a mano. La regla 2 (sembrar datos falsos con un guion) **no está hecha**.
- **El panel cumple lo mismo que transporte** (`0664217` de `guajirago-admin`, 25-sep-2026): la MISMA pieza
  `src/ambiente.js` (copia, porque es otro repo; atada byte a byte por `pruebas/elAmbiente.test.js`), `.env`
  por ambiente con las mismas llaves —en producción el panel comparte la app web de Firebase con transporte
  y solo cambia el sitio, medido ese día—, cartel naranja, y `.firebaserc` con el target `admin` mapeado en
  los dos proyectos (`guajirago-admin` / `guajirago-pruebas-admin`). Publicado en pruebas desde copia limpia.
- **Aliados cumple lo mismo** (`30cd8d1` de `guajirago-aliados`, 25-sep-2026): la misma pieza atada, las mismas
  llaves, cartel, y el target `aliados` en los dos proyectos (`guajirago-aliados` / `guajirago-pruebas-aliados`).
  Y lo suyo: la segunda conexión con la que crea cuentas de empleados (`firebaseSecundario.js`) saca las
  llaves de la misma calculadora, no de una copia; y la llave Web Push con la que los negocios reciben
  los avisos de pedidos sale del ambiente (en pruebas está vacía y el `.env` lo dice). Publicado en pruebas
  desde copia limpia. Lo cuenta `node scripts/medir-ambientes.cjs`: 6 de 6 en las tres.
