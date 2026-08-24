/**
 * EL FORMATEADOR DE PESOS — UN SOLO SITIO (en esta app)
 *
 * SEGUNDA LEY. Este renglón estaba copiado 13 veces en el proyecto: 2 en esta
 * app y 11 en la app de aliados. La mitad de las copias escribía «$ NaN» en la
 * pantalla si le llegaba un dato vacío; la otra mitad escribía «$ 0». Trece
 * copias, dos comportamientos — el ejemplo de manual de la ley.
 *
 * Al unificar se eligió A PROPÓSITO el comportamiento cuidadoso: un dato vacío
 * se enseña como $ 0, nunca como $ NaN.
 *
 * ALIADOS ES OTRO REPOSITORIO y no puede importar este archivo: tiene su propia
 * copia en guajirago-aliados/src/moneda.js. Un amarre (pruebas/amarres.test.js)
 * ejecuta las dos y comprueba que formatean igual.
 */
export const cop = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
