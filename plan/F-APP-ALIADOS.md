> Parte del **plan general** de GuajiraGo. La puerta de entrada y el índice están en
> [`plan/00-INDICE.md`](00-INDICE.md). Este archivo se puede actualizar solo, sin tocar
> los demás — para eso se partió.

# 📎 ANEXO F — QUÉ HAY QUE HACER EN LA APP DE ALIADOS

> El software de distribución: restaurantes, hoteles, turismo y oficios. **Es un producto que se
> vende**, no una pestaña de la superapp — decidido en [`02-DECISIONES.md`](02-DECISIONES.md).

---

## F.1 · Lo que ya existe, medido el 24-sep-2026

**6.719 renglones en 35 archivos.** No se empieza de cero, y eso hay que decirlo antes que lo que
falta.

| Lo más grande | Renglones | Qué es |
|---|---|---|
| Mesero | **988** | tomar pedidos en mesa |
| Pedidos a domicilio | 630 | los que llegan de la superapp |
| Inventario | 572 | existencias |
| La app | 542 | el armazón |
| Promociones · Menú · Tours | 357 · 351 · 289 | catálogo y ofertas |
| Login · Perfil · Empleados | 285 · 261 · 224 | quién entra y quién es |
| Resumen del día · Corte de caja | 207 · 167 | el cierre |

**Y usa 10 colecciones, 5 de ellas suyas solas**: compras de insumos, empleados, mesas, ventas por
plato, visitas diarias.

## F.2 · Lo que NO tiene, y son los cimientos

| | Estado medido | Por qué importa |
|---|---|---|
| **Llamadas al servidor** | **0** | **cero**. Todo lo decide el aparato. En un software que cobra, eso es la puerta abierta |
| **Escrituras directas a la base** | **34** | contra esas 0 llamadas. La proporción está invertida como en toda la casa, pero aquí al 100 % |
| **Cola de salida** (lo que se sube cuando vuelve la señal) | **no existe** | sin ella, «funciona sin señal» no puede ser verdad |
| **Suscripción o licencia** | **no existe** | hoy no hay forma de cobrar por el software ni de cortarle a quien no pague |
| **Servidor en el local** | **no existe** | es el requisito del [`C-RED-INTERNA.md`](C-RED-INTERNA.md) |
| **Empaquetado nativo** | **no existe** | es una web; la red interna exige nativa o escritorio |

### 🔴 Y una trampa que ya está puesta: cree que funciona sin señal, y falla callada

El arranque de la app dice esto:

```js
enableIndexedDbPersistence(db).catch(() => {});
```

Le pide al navegador guardar los datos localmente… **y si falla, no lo dice nadie.** Falla con
varias pestañas abiertas y en navegadores que no lo soportan. Además es la forma **vieja** de
pedirlo.

**Resultado:** hoy no se puede afirmar que aliados aguante sin señal, porque **nadie sabe si esa
línea funcionó**. Es uno de los 149 `catch` mudos, y es el peor sitio donde podía estar.

> **Esto se arregla PRIMERO, y es de un día**: que hable cuando falle. Sin eso, todo lo que se
> construya encima de «sin señal» se construye sobre una suposición.

## F.3 · El orden de trabajo

| | Qué | Por qué en este sitio |
|---|---|---|
| **F0** | **Que el «sin señal» que ya está puesto DIGA si falló** | Un día de trabajo. Todo lo demás se apoya en saber si eso funciona |
| **F1** | **Separar el proyecto Firebase** y su ambiente de pruebas | Decidido ya. Va con la Fase 0 del plan: dos ambientes desde el principio es mucho más barato que partir uno |
| **F2** | **El contrato con la superapp**: el catálogo se publica, el pedido se entrega | Son los dos únicos puntos de contacto. Sin esto, separar el proyecto rompe el escaparate |
| **F3** | **Las decisiones al servidor**: precios, pedidos, cierres | Es la Fase 3 del plan aplicada aquí. **Y choca con «sin señal»**: la salida es anotar sin señal y confirmar con señal ([`C-RED-INTERNA.md`](C-RED-INTERNA.md)) |
| **F4** | **Sin señal de verdad**: cola de salida, almacén local, subir al volver | Es la 4a del anexo C. **Lo único que se puede copiar** del otro proyecto |
| **F5** | **Empaquetado nativo o de escritorio** | Hace falta para F6, y para impresora y cajón |
| **F6** | **El servidor del local** (la red interna) | La 4b. **No empieza hasta que F4 funcione** |
| **F7** | **Suscripción y licencia** | Lo que convierte esto en un negocio. Puede ir en paralelo desde F2 |
| **F8** | **Aislamiento entre aliados**, probado ejecutando | Que un negocio no vea a otro. Se comprueba corriendo, no leyendo |
| **F9** | **Rentar** | Hoy **no existe nada**. Es producto nuevo, y hasta que no se sepa qué es (pregunta 3) no se puede planear |

## F.4 · Lo que hay que decidir antes de empezar F2

| | Pregunta | Dónde está |
|---|---|---|
| El precio | ¿mensualidad, porcentaje, o las dos? | pregunta 2 |
| Qué es rentar | ¿habitaciones, herramientas, vehículos? | pregunta 3 |
| Los pagos | ¿efectivo o pasarela? **Sin internet no hay tarjeta** | pregunta 4 |
| Cuántos aparatos | con uno solo por negocio, **F6 sobra entero** | pregunta 8 |
| Impresora y cajón | deciden nativa o escritorio | pregunta 9 |
| La cuenta | ¿el dueño del restaurante que además pide taxis es una persona o dos? | pregunta 10 |

Están todas en [`08-PREGUNTAS.md`](08-PREGUNTAS.md).

## F.5 · Lo que este anexo NO dice

- **No dice cuánto tarda.** F4 son ~4.200 renglones en el otro proyecto y F6 **no existe en
  ninguna parte**. Poner fechas hoy sería inventarlas.
- **No dice que haya que reescribir aliados.** Los 6.719 renglones que hay funcionan; lo que
  cambia es **quién decide** y **dónde se guarda**.
- **No mide los pendientes propios de aliados.** Ese repo tiene sus trabajos a medias y **no se
  midieron aquí** ([`D-PENDIENTES.md`](D-PENDIENTES.md) lo dice).
