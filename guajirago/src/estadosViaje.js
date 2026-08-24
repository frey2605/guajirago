/**
 * LOS ESTADOS DEL MERCADO — UN SOLO SITIO
 *
 * SEGUNDA LEY del proyecto: «La información que se supone deben compartir debe
 * salir de los mismos archivos.»
 *
 * Esta lista dice qué viajes están BUSCANDO CONDUCTOR. Sirve para dos cosas que
 * tienen que decir exactamente lo mismo:
 *
 *   1. La app del conductor la usa para pedir el mercado (AppConductor.js).
 *   2. `firestore.rules` la usa para DEJAR ver esos viajes a cualquier conductor
 *      (REGLA 6: un viaje es de quien viaja, salvo los que buscan taxi).
 *
 * EL PELIGRO SI SE SEPARAN: si mañana se añade un estado a la app y no a las
 * reglas, el conductor pide viajes que las reglas no le dejan ver — y **no sale
 * ningún error**: sale una lista vacía. El mercado se queda mudo y nadie sabe por
 * qué. Al revés es peor todavía: las reglas enseñarían viajes que no tocan.
 *
 * LAS REGLAS DE FIRESTORE NO SON JAVASCRIPT: no pueden importar este archivo. Por
 * eso hay una PRUEBA que lee los dos y falla si dejan de coincidir
 * (pruebas/reglas.test.js). Es el único amarre posible, y es de verdad: si alguien
 * cambia uno solo de los dos, la prueba se pone roja antes de llegar al servidor.
 *
 * SI HAY QUE AÑADIR UN ESTADO: se añade aquí Y en firestore.rules, en la función
 * enElMercado(). La prueba no deja hacerlo a medias.
 */

export const ESTADOS_MERCADO = ['esperando', 'en_negociacion', 'confirmando', 'contraoferta'];
