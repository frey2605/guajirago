// El gancho de LA LEY DEL BOTÓN (src/candado.js): TODA pantalla que guarda, envía o cambia algo usa esto, nunca un
// «guardando» hecho a mano.
//   const { ocupado, correr, texto, aviso, cerrarAviso } = useAccion();
//   <button disabled={!!ocupado} onClick={() => correr(() => guardar(...), 'guardar', 'Quedó guardado.', 'guardar el cambio')}>
//     {texto('guardar', 'Guardando…', 'Guardar')}
//   </button>
//   {aviso && <AvisoModal aviso={aviso} onCerrar={cerrarAviso} />}
// «ocupado» es el nombre de la acción que corre (o false): deshabilita los botones y el «Cancelar» del diálogo.
// «aviso» es la verdad del final ({ ok, titulo, texto, icono }), lista para la ventanita, DENTRO del diálogo abierto.
// El motivo de un fallo lo pone motivoDeRechazo (avisoRechazo.js), la única pieza que lo sabe decir (SEGUNDA LEY).
import { useRef, useState } from 'react';
import { crearCandado } from './candado';
import { motivoDeRechazo, apuntarRechazo } from './avisoRechazo';

const traducir = (e, accion) => {
  apuntarRechazo('useAccion (' + (accion || 'guardar el cambio') + ')', e);
  return motivoDeRechazo(e, accion);
};

export function useAccion() {
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState(null);
  const candado = useRef(null);
  if (!candado.current) candado.current = crearCandado({ alCambiar: setOcupado, alAviso: setAviso, traducir });
  // La palabra del botón: «Guardando…» mientras ESA acción trabaja, su nombre si no.
  const texto = (cual, trabajando, normal) => (ocupado === cual ? trabajando : normal);
  const cerrarAviso = () => setAviso(null);
  return { ocupado, correr: candado.current.correr, texto, aviso, cerrarAviso };
}
