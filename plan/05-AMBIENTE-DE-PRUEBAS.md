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
