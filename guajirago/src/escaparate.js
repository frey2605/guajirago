// ─────────────────────────────────────────────────────────────────────────────
// EL ESCAPARATE · LA ÚNICA RESPUESTA A «¿QUIÉN SALE EN LA APP?»
// ─────────────────────────────────────────────────────────────────────────────
//
// SEGUNDA LEY. Hasta el 7-sep-2026 esta pregunta se contestaba en DOS sitios, y
// no decían lo mismo:
//
//     Restaurantes.js:114   tipoNegocio !== 'turismo' && aprobado !== false
//     Turismo.js:45         tipoNegocio === 'turismo' && aprobado !== false
//                                                     && perfilCompleto === true
//
// O sea: un restaurante con la ficha a medio llenar SÍ salía, y una agencia con
// la ficha a medio llenar NO. Nadie decidió eso — son dos listas escritas por
// separado que se fueron separando más.
//
// EL DUEÑO LO DECIDIÓ el 7-sep-2026, con las tres opciones delante: se le exige
// la ficha llena A LOS DOS. Un cliente nuevo que paga y no llena su ficha no
// aparece en la app a medio hacer, con el nombre puesto y lo demás en blanco.
//
//
// ── EL INTERRUPTOR, Y POR QUÉ «!== false» Y NO «=== true» ───────────────────
//
// `visibleEnEscaparate` es la llave que contesta «¿sale este negocio en la app
// de clientes?». Es la que hace posible venderle el programa a un restaurante de
// otra ciudad: paga, lo usa, y NO sale en la app — porque allí no hay
// conductores que lleven el domicilio.
//
// La llave se creó el 6-sep-2026 y el panel ya la mueve (admin/Cobros.js:603),
// pero HASTA HOY NADIE LA MIRABA: el dueño la apagaba, el botón cambiaba, y el
// negocio seguía saliendo igual. Un interruptor con el cable cortado — el mismo
// error que tuvo `activo` y que se cerró el día anterior.
//
// MEDIDO EN LA BASE VIVA antes de escribir esto (scripts/medir-escaparate.cjs):
// NINGUNO de los 3 negocios tiene el campo. Así que:
//
//     si se exigiera  visibleEnEscaparate === true   → LOS TRES DESAPARECEN
//     como está aquí  visibleEnEscaparate !== false  → los tres siguen saliendo
//
// Por eso es `!== false`, y no es descuido: **un campo que falta no apaga a
// nadie**. El riesgo caro de todo este trabajo es dejar fuera a un negocio QUE SÍ
// PAGÓ, y así no puede pasar. Es la misma decisión que se tomó en firestore.rules
// el 6-sep con las tres llaves, y por el mismo motivo.
//
//
// ── VA SIN IMPORTS A PROPÓSITO ──────────────────────────────────────────────
// `pruebas/cargar.cjs` solo sabe EJECUTAR archivos sin imports. Manteniéndolo
// puro, las pruebas corren este archivo tal cual está en el disco, y no una copia
// de su lógica escrita a mano — que es como se rompen los contratos sin que nadie
// se entere.

// Las tres preguntas que hay que pasar para salir en la app, en orden de lo que
// más manda a lo que menos:
//
//   1. ¿lo aprobó el panel?      `aprobado` — ausente NO frena (2 de 3 negocios
//                                 medidos no tienen el campo y salen hoy).
//   2. ¿está encendido?          `visibleEnEscaparate` — ausente NO frena.
//   3. ¿tiene la ficha llena?    `perfilCompleto` — este SÍ hay que tenerlo
//                                 puesto en `true`. Es el único de los tres que
//                                 se exige en positivo, porque una ficha a medias
//                                 se le nota al cliente en la pantalla.
export function saleEnElEscaparate(negocio) {
  if (!negocio) return false;
  return negocio.aprobado !== false
    && negocio.visibleEnEscaparate !== false
    && negocio.perfilCompleto === true;
}

// Los negocios de comida que se le enseñan al cliente.
export function losDeComida(negocios) {
  return (negocios || []).filter((n) => n && n.tipoNegocio !== 'turismo' && saleEnElEscaparate(n));
}

// Las agencias de turismo que se le enseñan al cliente.
export function lasDeTurismo(negocios) {
  return (negocios || []).filter((n) => n && n.tipoNegocio === 'turismo' && saleEnElEscaparate(n));
}
