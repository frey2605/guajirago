import { ambiente } from './firebase';

// Fase 0, regla 4 del ambiente de pruebas: la copia de PRUEBAS se ve a simple
// vista, con un cartel y otro color. En PRODUCCIÓN no pinta nada.
export default function CartelAmbiente() {
  if (ambiente.esProduccion) return null;
  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
        background: ambiente.color, color: '#fff', textAlign: 'center',
        fontSize: 12, fontWeight: 700, letterSpacing: 1, padding: '3px 8px',
      }}
    >
      {ambiente.nombre} · datos de mentira · nada de aquí es real
    </div>
  );
}
