> Parte del **plan general** de GuajiraGo. La puerta de entrada y el índice están en
> [`plan/00-INDICE.md`](00-INDICE.md). Este archivo se puede actualizar solo, sin tocar
> los demás — para eso se partió.

## 1 · LAS CUATRO DECISIONES DE FONDO

Todo lo demás cuelga de éstas. Si una cambia, el plan se rehace.

### D1 · Son DOS productos, no uno con pestañas

| | **GuajiraGo** (la superapp) | **Aliados** (el software de distribución) |
|---|---|---|
| Quién la usa | el vecino de Riohacha | el dueño del restaurante, del hotel, el plomero |
| Qué vende | viajes, mandados, y el **escaparate** de todo lo demás | **software**: vender, rentar, gestionar |
| Cómo cobra | comisión por viaje | **suscripción / licencia** |
| Si se cae | la gente no consigue taxi | **un negocio no puede facturar** |
| Quién responde | GuajiraGo | GuajiraGo, como **proveedor de software** |

**Son negocios distintos y se rompen distinto.** Un restaurante que no puede cobrar a las 8 de la
noche es un problema contractual, no un mal rato.

**Lo que esta decisión implica, y hay que aceptarlo entero:**
- Aliados tiene su propio ciclo: se despliega aparte, se prueba aparte, se cae aparte.
- **Un aliado NO puede ver datos de otro aliado.** Hoy eso lo cuidan las reglas; mañana tiene que
  cuidarlo también la forma de los datos.
- La superapp **consume** lo que aliados publica. No al revés.

### D2 · Un ambiente de pruebas de verdad: SEGUNDO proyecto Firebase

Hoy hay uno solo, y es producción. Probar hoy es tocar los datos de verdad.

**No sirve** un "modo prueba" dentro del mismo proyecto (una bandera, un prefijo, una colección
`_test`). Un error de una línea escribe en producción y nadie se entera. La separación tiene que
ser **física**: otro proyecto, otra base, otras llaves.

**Decisión:** `guajirago-dev` como proyecto aparte, con **datos falsos**, nunca copiados de los
reales.

### D3 · El servidor decide, el celular enseña

Es la SEGUNDA LEY de este proyecto aplicada al dinero y a los permisos.

Hoy el celular calcula el total del pedido y lo escribe. Mañana, con arriendos y suscripciones,
eso es una puerta abierta. **Todo lo que decide dinero, estado o permiso pasa al servidor.**

**No es "migrar las 150 escrituras".** Es clasificarlas: las que son datos propios del usuario
(su nombre, su foto) pueden seguir; las que mueven dinero, cambian estado de un pedido o tocan a
otro, no.

### D4 · Entre las apps hay CONTRATOS, no costumbres

Hoy, escrito en las leyes del proyecto: *«Todo el acoplamiento entre apps es contrato implícito de
campos en Firestore: no hay API. Cambiar un campo en una app puede romper otra sin que nada
avise.»*

Con dos negocios y tres apps eso deja de ser sostenible. **Cada dato que cruza de un producto a
otro tiene que tener un dueño, una forma declarada y una prueba que se pone roja si se separan.**

La buena noticia: ese mecanismo **ya existe** en este proyecto y funciona — se llama `amarres`, y
hoy son 90 pruebas que leen los dos lados de cada contrato. Lo que falta no es inventarlo: es
**aplicarlo a todo lo que cruza**, en vez de a lo que fue mordiendo.
