// ⭐ LAS ESTRELLAS DE UN NEGOCIO — qué calificaciones cuentan y cuánto da el promedio (G83, 29-sep-2026).
//
// PIEZA COMPARTIDA. Hay una copia IDÉNTICA en guajirago-aliados/src/estrellasNegocio.js (otro repo, no puede
// importarla): las ata byte a byte pruebas/promedioRestaurante.test.js del repo raíz. Si cambias una, cambia la otra.
//
// Antes el promedio se calculaba en TRES sitios con filtros distintos: la lista de restaurantes de la app contaba
// solo las que pone un cliente; el menú del restaurante y la pantalla «Calificaciones» de aliados contaban TODAS las
// que llevan el id del negocio. Y el id del negocio es el uid de su dueño (aliados/Login.js), así que si el dueño
// también maneja o viaja en GuajiraGo, las estrellas que le ponen COMO PERSONA se mezclaban con las del restaurante.
//
// Cuentan para el promedio de un negocio las calificaciones que:
//   · puso un CLIENTE (quienCalifica 'cliente': la única que se escribe desde un pedido, Restaurantes.js);
//   · van para ESE negocio (calificadoId);
//   · no están reportadas (dadas de baja mientras el panel las revisa);
//   · tienen de 1 a 5 estrellas enteras (lo mismo que exige firestore.rules; una sin estrellas no es una opinión).
// El redondeo es cosa de la pantalla (una cifra decimal); aquí se da el número sin redondear.

export function calificaAlNegocio(c, negocioId) {
  return !!c && c.quienCalifica === 'cliente' && !!c.calificadoId && c.calificadoId === negocioId;
}

export function estrellasValidas(c) {
  return !!c && Number.isInteger(c.estrellas) && c.estrellas >= 1 && c.estrellas <= 5;
}

export function cuentaParaElPromedio(c, negocioId) {
  return calificaAlNegocio(c, negocioId) && !c.reportado && estrellasValidas(c);
}

// Las calificaciones de la lista que cuentan para el negocio, en el mismo orden.
export function lasQueCuentan(calificaciones, negocioId) {
  return (calificaciones || []).filter((c) => cuentaParaElPromedio(c, negocioId));
}

// { promedio, total } de las que cuentan. Sin ninguna: { promedio: 0, total: 0 }.
export function promedioDelNegocio(calificaciones, negocioId) {
  const cuentan = lasQueCuentan(calificaciones, negocioId);
  const total = cuentan.length;
  const suma = cuentan.reduce((s, c) => s + c.estrellas, 0);
  return { promedio: total > 0 ? suma / total : 0, total };
}

// Para la lista de negocios: { [negocioId]: { promedio, total } }, solo de los que tienen alguna que cuente.
export function promediosPorNegocio(calificaciones) {
  const ids = [];
  for (const c of calificaciones || []) {
    if (c && c.calificadoId && !ids.includes(c.calificadoId)) ids.push(c.calificadoId);
  }
  const m = {};
  for (const id of ids) {
    const r = promedioDelNegocio(calificaciones, id);
    if (r.total > 0) m[id] = r;
  }
  return m;
}
