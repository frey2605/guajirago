> Parte del **plan general** de GuajiraGo. La puerta de entrada y el índice están en
> [`plan/00-INDICE.md`](00-INDICE.md). Este archivo se puede actualizar solo, sin tocar
> los demás — para eso se partió.

## 2 · LA ESTRUCTURA OBJETIVO

### Las cuatro capas

```
   ┌─────────────────────────────────────────────────────────────┐
   │  APPS            pasajero · conductor · aliados · panel      │
   │                  ENSEÑAN. No deciden dinero ni permisos.     │
   ├─────────────────────────────────────────────────────────────┤
   │  CONTRATOS       los datos que cruzan de una app a otra.     │
   │                  Un dueño, una forma, un amarre que los ata. │
   ├─────────────────────────────────────────────────────────────┤
   │  SERVIDOR        decide. Cobra, cambia estados, autoriza.    │
   │                  Se salta las reglas: es el que manda.       │
   ├─────────────────────────────────────────────────────────────┤
   │  DATOS           Firestore + Almacén, con reglas que niegan  │
   │                  por defecto y abren por excepción.          │
   └─────────────────────────────────────────────────────────────┘
```

### La frontera entre los dos negocios

Hoy comparten **5 colecciones**. Ésa es la frontera, y hoy no está dibujada en ninguna parte.

| Colección | Quién la ESCRIBE | Quién la LEE | Qué hay que decidir |
|---|---|---|---|
| `negocios` | aliados, panel | superapp | **el catálogo público**: qué campos ve el cliente y cuáles son privados del negocio |
| `pedidos` | superapp (cliente), aliados (negocio) | los dos | **quién manda el precio** — hoy lo manda el celular del cliente |
| `reservasTurismo` | superapp, aliados | los dos | lo mismo |
| `calificaciones` | superapp | aliados, panel | quién puede calificar y cuántas veces |
| `rechazos` | los dos | los dos | qué es un rechazo y quién lo puede escribir |

**Cada una de estas cinco es un plan de trabajo aparte.** Ninguna se toca "de paso".
