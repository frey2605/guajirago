> Parte del **plan general** de GuajiraGo. La puerta de entrada y el índice están en
> [`plan/00-INDICE.md`](00-INDICE.md). Este archivo se puede actualizar solo, sin tocar
> los demás — para eso se partió.

## 3 · SEGURIDAD — POR CAPAS, NO POR LISTA

La seguridad no es una tarea: son ocho frentes, y cada uno se cierra solo.

### 3.1 · Identidad — ¿quién eres?
- Un solo sistema de identidad para los cuatro tipos de persona: **cliente, conductor, aliado,
  administrador**. Hoy los roles viven repartidos.
- El rol **no lo dice el celular**: lo dice un documento que solo el servidor escribe.
- Verificación real del conductor: documento, foto, placa. Un conductor sin verificar **no recibe
  viajes**, y eso lo decide el servidor, no la pantalla.

### 3.2 · La puerta — ¿desde dónde llamas?
- **App Check** (hoy: no existe). Sin él, cualquiera con la llave pública —que viaja dentro de la
  app, a la vista— puede hablar con tu base desde un guion, sin abrir la app nunca.
- Es la diferencia entre "mis reglas están bien escritas" y "solo mis apps pueden intentarlo".

### 3.3 · Las reglas — negar por defecto
- 2.235 renglones hoy. La pregunta no es si están bien: es **si alguien las puede leer**.
- Objetivo: reglas cortas que **niegan todo** y abren por excepción, con **pruebas que las
  ejecutan** (ya existen: `pruebas/reglas.test.js` corre contra el emulador).
- **Un aliado no ve a otro aliado.** Se prueba ejecutando, no leyendo.

### 3.4 · El dinero — una sola calculadora, y es del servidor
- Hoy el total del pedido lo suma el celular del cliente y el restaurante **vuelve a sumarlo con
  esos mismos precios**. Eso no es validar: es repetir.
- Objetivo: el precio sale del catálogo **en el servidor**, en el momento del pedido. El celular
  enseña un número; el que vale es el que calculó el servidor.
- Lo mismo para comisiones, tarifas, descuentos, suscripciones y arriendos.

### 3.5 · Los datos personales
- Cédulas, teléfonos, fotos, ubicaciones. Hoy viven en el Almacén con 345 renglones de reglas.
- Qué hace falta decidir: **cuánto se guarda, cuánto tiempo, y quién lo puede ver**. Un
  administrador no necesita ver la cédula de todos los conductores todos los días.

### 3.6 · Seguridad del transporte — la que es física
Esto no es informática: es que alguien se sube a un carro con un desconocido.
- **Conductor verificado** antes de recibir un solo viaje.
- **El viaje tiene un dueño**: nadie puede leer, cambiar ni cancelar un viaje que no es suyo.
- **La ubicación es de verdad** — hoy ya se cerró que el viaje no nazca en la plaza; falta que el
  viaje guarde **de dónde salió su coordenada** (del GPS, del marcador, o escrita).
- **Botón de pánico** que funcione con el viaje vivo, no con datos pegados de antes.
- **Código de seguridad** del viaje: que el conductor sea el que dijo ser.

### 3.7 · Rastro — quién hizo qué
- Toda decisión del servidor que mueva dinero o cambie un estado deja registro: quién, cuándo,
  qué había antes.
- **Los borrados dejan lápida** (ya es ley del proyecto). Aplicarlo a todo.

### 3.8 · Secretos y despliegue
- Llaves de servicio, permisos de GitHub, llave de Maps. Hoy: una llave de servicio que ya se
  expuso una vez y el dueño decidió conservar.
- Objetivo: **ninguna llave en el repo**, todas con caducidad conocida, y el despliegue con los
  cinco botones que ya existen — **pero desde `main`, que hoy no tiene ninguno**.
