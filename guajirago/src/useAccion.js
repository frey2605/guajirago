// El gancho de LA LEY DEL BOTÓN (src/candado.js): TODA pantalla que guarda, envía o cambia algo usa esto, nunca un
// «guardando» hecho a mano.
//   const { ocupado, correr, texto, aviso, cerrarAviso } = useAccion();
//   <button disabled={!!ocupado} onClick={() => correr(() => guardar(...), 'guardar', 'Quedó guardado.')}>
//     {texto('guardar', 'Guardando…', 'Guardar')}
//   </button>
// «ocupado» es el nombre de la acción que corre (o false): deshabilita los botones y el «Cancelar» del diálogo.
// «aviso» es la verdad del final ({ ok, texto }); la pantalla lo pinta en una ventanita, DENTRO del diálogo abierto.
import { useRef, useState } from 'react';
import { crearCandado } from './candado';

export function useAccion() {
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState(null);
  const candado = useRef(null);
  if (!candado.current) candado.current = crearCandado({ alCambiar: setOcupado, alAviso: setAviso });
  // La palabra del botón: «Guardando…» mientras ESA acción trabaja, su nombre si no.
  const texto = (cual, trabajando, normal) => (ocupado === cual ? trabajando : normal);
  const cerrarAviso = () => setAviso(null);
  return { ocupado, correr: candado.current.correr, texto, aviso, cerrarAviso };
}
