> Parte del **plan general** de GuajiraGo. La puerta de entrada y el índice están en
> [`plan/00-INDICE.md`](00-INDICE.md). Este archivo se puede actualizar solo, sin tocar
> los demás — para eso se partió.

## 5 · EL ORDEN DE TRABAJO

El orden **no es negociable** en las tres primeras fases: cada una necesita la anterior.

### FASE 0 — El ambiente de pruebas
*Sin esto no se puede tocar nada más sin arriesgar datos reales.*
- Crear `guajirago-dev` y apuntar las tres apps según dónde corren.
- Sembrar datos falsos con un guion del repo.
- Desplegar reglas, índices y funciones a dev.
- Cartel y color que digan «esto es pruebas».
- **Hecho cuando:** se puede romper la app en dev desde el celular y en producción no cambia nada.

### FASE 1 — Cerrar la puerta
*Barato, rápido, y protege todo lo que venga después.*
- **App Check** en las tres apps y en el servidor.
- Los cinco botones de despliegue **en `main`** (hoy están en una rama y nunca han corrido).
- Los permisos (roles) que faltan en la llave de servicio.
- **Hecho cuando:** una llamada a la base desde fuera de tus apps es rechazada, y se demuestra
  ejecutándola.

### FASE 2 — La frontera de los dos negocios
*Dibujar la línea antes de construir encima de ella.*
- Las **5 colecciones compartidas**, una por una: quién escribe, quién lee, qué campos.
- Un amarre por contrato, de los que se ponen rojos si los dos lados se separan.
- **Hecho cuando:** cambiar un campo en aliados pone roja una prueba **antes** de romper la
  superapp.

### FASE 3 — El dinero al servidor
*La que de verdad convierte esto en un software que puede cobrar.*
- Clasificar las **150 escrituras**: cuáles son datos propios y cuáles deciden.
- Mover al servidor las que deciden, empezando por el total del pedido.
- **Hecho cuando:** un celular modificado no puede pedir a otro precio, y se demuestra
  intentándolo.

### FASE 4 — Aliados como producto
- Suscripción y licencia. Alta de un negocio de punta a punta.
- Aislamiento entre aliados, probado ejecutando.
- Lo de **rentar** (arriendos), que hoy no existe.

### FASE 5 — Transporte, lo que queda
- Verificación del conductor.
- De dónde salió la coordenada del viaje.
- Las deudas ya anotadas del pánico, los estados y los historiales.

### FASE 6 — La deuda medida que ya está escrita
La tabla de deuda de `CLAUDE.md` con ~30 filas vivas. **No se atiende antes**: casi todas se
tocan solas al hacer las fases de arriba, y las que no, se harán con el ambiente de pruebas ya
puesto, que es más barato y más seguro.
