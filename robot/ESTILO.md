# 🎨 El estilo de GuajiraGo — contra esto juzga el robot cada pantalla

> Lo usa el agente «probador» cuando revisa una pantalla con ojos de usuario. Sale de lo que el
> dueño ha pedido y de lo que ya está construido; si el dueño decide algo nuevo, se anota aquí
> con la fecha. Lo que vale para TODOS los proyectos (hablar en cristiano, avisos claros, un toque
> un resultado) está en el estilo general del robot, en la carpeta `.claude` de su cuenta.

## Cómo se ve

- **Tema claro:** fondo blanco `#FFFFFF`, texto `#1A1A1E`, texto secundario `#6B7280`, bordes
  `#ECECEF`. Lo oscuro solo donde es a propósito (pantalla de llamada, tarjetas de celebración,
  chips del código de seguridad).
- **Azul de acento `#1C8EF9`** (y `#39A6FF` en degradados): bordes de tarjetas, enlaces. Ningún
  otro azul.
- **Botón principal:** degradado cálido del logo `#FFCF4D → #FF7A2F → #D6357E`.
- **Botón de menú ☰:** degradado azul → naranja. **«Volver»:** pastilla gris con `‹`.
- **Cuadros de opción** (módulos, pasajero/conductor): borde `2px solid #1C8EF9`.
- **Logo:** centrado en entrar y escoger rol; arriba a la derecha en las demás pantallas.
- **Pruebas se nota:** cartel naranja «PRUEBAS · datos de mentira» arriba. En producción NO sale.

## Cómo habla y cómo avisa

- **Todo aviso es una ventanita** (fondo oscuro, tarjeta blanca centrada, ícono, mensaje claro y
  botón para cerrar). Un renglón rojo suelto como único aviso **está mal** (decisión del dueño,
  5-jul-2026).
- **Nada se rechaza en silencio:** si algo falla, la pantalla lo dice y dice por qué.
- **Español de la calle**, sin palabras técnicas ni en inglés.

## Cómo se portan los botones (LA LEY DEL BOTÓN, 26-sep-2026)

Todo lo que guarda, envía o cambia algo:
1. **un solo toque**, aunque se toque dos veces;
2. **dice su palabra mientras trabaja** («Guardando…», «Enviando…») y se apaga;
3. **al final dice la verdad**, en ventanita: ✅ quedó, o ⚠️ qué pasó;
4. **nunca se queda trabado**: a los 20 s dice «No se pudo confirmar, revisa si quedó hecho».

Hay pantallas que todavía NO cumplen la ley: están contadas en `scripts/medir-ley-boton.cjs`
(`PENDIENTES`). El robot no las da por falla nueva; sí la da si una pantalla ya arreglada se rompe.

## Qué mira el robot con ojos de usuario

- ¿Se entiende qué hay que hacer sin que nadie lo explique?
- ¿Cada botón hace algo visible al tocarlo? ¿Hay alguno que no hace nada?
- ¿Los avisos son ventanitas y dicen qué hacer?
- ¿Algo se sale de la pantalla del celular (400 px de ancho) o queda tapado?
- ¿Algo se ve de otro estilo (otro azul, un botón gris donde van los cálidos, texto en inglés)?
- ¿Cuántos toques cuesta hacer lo principal (pedir un viaje, registrarse)?
