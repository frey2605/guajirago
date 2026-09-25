> Parte del **plan general** de GuajiraGo. La puerta de entrada y el índice están en
> [`plan/00-INDICE.md`](00-INDICE.md). Este archivo se puede actualizar solo, sin tocar
> los demás — para eso se partió.

# 📎 ANEXO E — QUÉ HAY QUE SEPARAR DE LA APP DE TRANSPORTE

> **Esto NO es separar el proyecto Firebase.** Eso ya se decidió que no
> ([`02-DECISIONES.md`](02-DECISIONES.md)): el pasajero y el conductor escriben el mismo documento
> en vivo. Lo que se separa aquí es **el paquete que se descarga cada uno**.

---

## E.1 · Lo que pasa hoy

La app del pasajero y la del conductor **se compilan y se publican juntas**, en un solo paquete.

| Consecuencia | Por qué importa |
|---|---|
| El pasajero **se descarga el código del conductor** | 1.686 renglones que no va a usar nunca — y que incluyen cómo se calculan las comisiones |
| Tocar una pantalla del conductor **republica la app del cliente** | cada arreglo del conductor es un riesgo para el pasajero, y al revés |
| Un fallo que tumbe el arranque **los tumba a los dos** | hoy son la misma página |
| No se puede publicar un arreglo urgente de uno **sin publicar el otro** | y el otro puede estar a medias |

## E.2 · Lo medido: qué es de quién

`AppConductor` 1.686 renglones · `Solicitar` 1.853 · y en medio, lo que comparten.

| | Cuántos | Cuáles |
|---|---|---|
| **Solo del conductor** | **4** | ganancias, comisiones, distancia, estados del viaje |
| **Solo del pasajero** | **6** | solicitar, restaurantes, código de seguridad, descuentos, mensaje de emergencia, viaje nuevo |
| **Los DOS** | **18** | avisos, ayuda, calificación, configuración, créditos, llamada, logo, menú, perfil, notificaciones, promociones, seguridad, aviso de rechazo, config, firebase, riohacha, tarifas, textos del viaje |

### 🔴 El número que manda: **18 de 28 son compartidos**

**Separar no es cortar por la mitad.** Dos tercios del código lo usan los dos, así que lo primero
no es partir: es **sacar lo común a un sitio propio** y que las dos apps lo usen desde ahí.

Si se parte sin hacer eso, nacen **dos copias de 18 archivos** — y eso es la SEGUNDA LEY rota
dieciocho veces de golpe, con el agravante de que una de las copias se quedaría vieja sin que
nadie mire.

## E.3 · Cómo queda

```
   común/                 los 18 que usan los dos. UN solo sitio.
     ├── pasajero/        solicitar, restaurantes, descuentos… + los 18
     └── conductor/       ganancias, comisiones, distancia… + los 18

   → dos paquetes que se publican por separado
   → UN solo proyecto Firebase, UN solo documento de viaje
```

## E.4 · El orden, y por qué éste

| | Qué se hace | Por qué antes que lo siguiente |
|---|---|---|
| **E1** | **Sacar los 18 comunes a su sitio**, sin partir nada todavía | Es el único paso que se puede hacer **sin romper nada**: hoy ya funcionan, solo cambian de carpeta. Y sin esto, partir fabrica 18 gemelos |
| **E2** | **Partir el paquete en dos**, cada uno con su publicación | Ya se puede: lo común está fuera |
| **E3** | **Que cada uno se despliegue solo** | Los botones ya existen; hay que enseñarles que ahora son dos |

## E.5 · Lo que esto NO cambia

- **El proyecto Firebase es el mismo.** Un solo `viajes`, un solo `usuarios`, unas solas reglas.
- **El documento del viaje es el mismo.** El pasajero y el conductor lo siguen escribiendo los dos,
  en vivo. Eso es lo que hace al transporte una sola cosa.
- **La cuenta es la misma.** Un conductor que además pide taxis sigue siendo una persona.

## E.6 · Lo que hay que vigilar mientras se hace

| Riesgo | Cómo se controla |
|---|---|
| **Que nazcan gemelos** al mover los 18 | el guardián detecta código movido, **también cuando va a un archivo nuevo**: ese hueco (N1 en [`D-PENDIENTES.md`](D-PENDIENTES.md)) se cerró el 24-sep-2026, commit `19e671b`, con su prueba en `pruebas/elGuardian.test.js` |
| **Que se rompa lo que funciona** | mover no es reescribir. Ni un renglón cambia de contenido en E1 |
| **Que las pruebas dejen de encontrar los archivos** | 23 archivos de `pruebas/` leen rutas de la app. Se miden **antes** de mover |

✅ ~~**E1 no puede empezar hasta que el detector de código movido esté arreglado.**~~ Arreglado el
24-sep-2026 (`19e671b`). Mover 18 archivos con el candado abierto era exactamente el escenario que
ese candado existe para vigilar; ya no está abierto.
