> Parte del **plan general** de GuajiraGo. La puerta de entrada y el índice están en
> [`plan/00-INDICE.md`](00-INDICE.md). Este archivo se puede actualizar solo, sin tocar
> los demás — para eso se partió.

## 0 · LO QUE HAY HOY, MEDIDO

No supuesto. Cada fila se puede volver a contar.

| Qué | Cuánto | Con qué se contó |
|---|---|---|
| Proyectos Firebase | **1** (`guajirago`) | `cat .firebaserc guajirago*/.firebaserc` |
| Ambientes | **1**, y es **producción** | `grep -rhoE "projectId: *['\"][^'\"]+" */src` → un solo valor |
| App Check | **no existe** | `grep -rl "appCheck\|AppCheck" */src */functions` → 0 fuera de `node_modules` |
| Escrituras del celular directo a la base | **150** | `grep -rhoE "\b(addDoc\|setDoc\|updateDoc\|deleteDoc)\(" */src \| wc -l` |
| Llamadas a funciones del servidor | **8** | `grep -rhoE "httpsCallable\(" */src \| wc -l` |
| App del pasajero/conductor | 10.311 renglones, 48 archivos | `cat guajirago/src/*.js \| wc -l` |
| Panel de administración | 7.912 renglones, 22 archivos | `cat guajirago-admin/src/*.js \| wc -l` |
| Software de aliados | 6.719 renglones, 35 archivos | `cat guajirago-aliados/src/*.js \| wc -l` |
| Servidor (Cloud Functions) | 1.139 renglones, 19 funciones | `wc -l`, `grep -cE '^exports\.'` |
| Reglas de Firestore | 2.235 renglones | `wc -l < firestore.rules` |
| Reglas del Almacén | 345 renglones | `wc -l < storage.rules` |
| Colecciones que comparten la superapp y aliados | **5** | `negocios`, `pedidos`, `calificaciones`, `rechazos`, `reservasTurismo` |

### 🔴 El número que manda sobre todo el plan

> **150 escrituras del celular · 8 llamadas al servidor.**

El celular **no le pide** a un servidor que haga las cosas: **las hace él y escribe en la base
directamente**. Lo único que lo separa de escribir cualquier cosa son las 2.235 líneas de reglas.

Eso funciona para una app de taxis en pruebas. **No funciona para un negocio donde entra dinero
de terceros** (restaurantes, hoteles, arriendos, servicios), porque quien controla el celular
controla lo que se escribe, y una regla que se escapa no avisa: deja pasar.

### 🟢 La ventaja que hay que gastar YA

**No hay clientes todavía.** Los 91 viajes de la base son de prueba, de julio. Eso significa que
hoy se pueden hacer cambios que rompen cosas —renombrar campos, mover colecciones, partir
negocios— **sin llamar a nadie para disculparse**.

Esa ventana se cierra sola el día que entre el primer cliente de verdad. **Todo lo que este plan
llama "cambio de raíz" hay que hacerlo antes de esa fecha, o ya no se hace nunca.**
