// 🧭 ADÓNDE LLEVAN «MIS VIAJES» Y «GANANCIAS» — gemelo G51 (29-sep-2026)
//
// El menú lateral sale en muchas pantallas, y cada una le decía por su cuenta a dónde llevaba cada opción: «Mis
// viajes» abría TRES pantallas distintas según desde dónde se tocara, y «Ganancias» contestaba «estará disponible muy
// pronto» en la pantalla del pasajero, aunque la pantalla existe. Ahora lo decide ESTA tabla, y lo decide por QUIÉN
// ES la persona en ese momento, no por el botón que tocó:
//   · pasajero  → su historial de pasajero (Home.js, `Historial`)
//   · conductor → su historial de conductor, con «GANANCIAS DE HOY» (AppConductor.js, `HistorialConductor`)
//   · sin papel (la ficha no dice qué es y todavía no escogió) → el historial de los dos lados (MisViajes.js)
//   · «Ganancias» → la pantalla Ganancias, para todos (a quien no ha conducido le sale en cero, que es la verdad).
// La usan TODOS los botones: App.js (las pantallas de antes de escoger papel), Home.js (con papel pasajero) y
// AppConductor.js (con papel conductor, también su tarjeta «Mis viajes»). Lo vigila pruebas/menuNavegacion.test.js,
// que corre cada botón con scripts/medir-menu-navegacion.cjs y exige que abra lo que dice esta tabla.

export const PANTALLA_DEL_MENU = {
  viajes: { pasajero: 'historialPasajero', conductor: 'historialConductor', sinPapel: 'misViajes' },
  ganancias: { pasajero: 'ganancias', conductor: 'ganancias', sinPapel: 'ganancias' },
};

// La pantalla que abre `opcion` ('viajes' | 'ganancias') para quien tiene ese `papel` ('pasajero' | 'conductor' | otro).
export function pantallaDelMenu(opcion, papel) {
  const fila = PANTALLA_DEL_MENU[opcion];
  if (!fila) return null;
  return fila[papel === 'pasajero' || papel === 'conductor' ? papel : 'sinPapel'];
}
