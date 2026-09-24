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

### D1-bis · ALIADOS SE SEPARA. EL TRANSPORTE NO.

> **Decidido por el dueño el 24-sep-2026**, después de medirlo. Contesta la pregunta 1.

**Aliados va a su propio proyecto Firebase**, conectado con la superapp por un contrato estrecho.
**El transporte se queda dentro de la superapp**, y no es una inconsistencia: es que **no son el
mismo tipo de cosa**, y se midió.

#### Por qué aliados SÍ

| Razón | El número que la sostiene |
|---|---|
| **Ya es casi independiente** | usa 10 colecciones y **5 son suyas solas**: compras, empleados, mesas, ventas por plato, visitas |
| **La frontera son DOS cosas, no cinco** | el **catálogo** (aliados escribe `negocios` 29 veces, la superapp lee 3) y el **pedido**. `calificaciones` y `rechazos` son de juguete |
| **Ya no es el mismo software** | tiene que funcionar **sin internet**, con **servidor en el local** y empaquetado **nativo** (ANEXO C). Otra forma de guardar, de sincronizar y de instalarse |
| **El radio de daño** | **un solo archivo de reglas** gobierna las dos cosas: `pedidos` se nombra 46 veces y `negocios` 24, en el mismo archivo que `viajes` 28 y `usuarios` 26. Un error escribiendo la regla de una mesa puede dejar al aire la cédula de un conductor |
| **Los datos no son nuestros** | aliados guarda **las ventas, los empleados y los proveedores de otra gente**. El día que un negocio los pida o se vaya, sacarlos de un proyecto mezclado es un problema; separados, es una carpeta |

#### Por qué el transporte NO

| Razón | El número que la sostiene |
|---|---|
| **El pasajero y el conductor escriben el MISMO documento, en vivo** | `viajes` se toca **18** veces desde la pantalla del pasajero y **16** desde la del conductor |
| **No hay dos lados que sincronizar: hay uno** | separarlos obligaría a sincronizar un objeto **vivo** entre dos proyectos mientras el carro se mueve. Es lo más difícil que existe, y hoy no hace falta |
| **El transporte ES la superapp** | no es un inquilino, es el corazón. 4.430 renglones de transporte contra 1.641 de escaparate |

#### La diferencia, en una frase

> **Aliados se habla con la superapp de vez en cuando y puede esperar** (publica un catálogo,
> recibe un pedido). **El pasajero y el conductor se hablan cada segundo y no pueden esperar.**
>
> Lo que se puede separar es lo que ya está separado por el tiempo.

#### 🔴 Pero SÍ hay algo del transporte que hay que separar, y no es el proyecto

Hoy la app del **pasajero** y la del **conductor** se compilan y se publican **juntas**. Eso
significa que el pasajero **se descarga el código del conductor**, y que tocar una pantalla del
conductor **republica la app del cliente**.

**Eso es empaquetado, no base de datos.** Va al plan como trabajo aparte, y no cambia esta
decisión: **el mismo proyecto Firebase, dos aplicaciones que se publican por separado.**

#### Lo que esta decisión cuesta, dicho ahora

- **Dos proyectos Firebase**: dos de todo — reglas, índices, funciones, llaves, despliegues.
- **El catálogo deja de ser gratis**: hoy la superapp lee `negocios` directo; separados, aliados
  **publica** y la superapp **recibe**. Eso es trabajo real.
- **La identidad**: la misma persona puede ser dueña de restaurante **y** pedir taxis. Hay que
  decidir si es una cuenta o dos — es la **pregunta 10**, y ahora pesa más.
- 🔴 **NO está medido** lo que cuesta en dinero el segundo proyecto ni si el plan de Firebase
  contratado lo aguanta. Se pregunta antes de crearlo, no se supone.

#### Qué se decide ahora y qué después

- **AHORA**: que van separados. Lo necesita la **Fase 0**, porque construir **dos** ambientes de
  prueba desde el principio es mucho más barato que partir uno después.
- **DESPUÉS**: *cuándo* se ejecuta la separación. Puede ser dentro de la Fase 4, cuando aliados se
  convierta en producto.
- **Lo que NO podía esperar era la decisión**: el código que se escriba desde mañana depende de
  ella. «Juntos ahora, separamos después» es la respuesta cómoda y casi nunca ocurre — hoy la
  frontera son dos puntos, dentro de un año serán veinte.

---

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
