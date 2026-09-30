// G97 (30-sep-2026): EL estilo del campo de los formularios — la cajita blanca de borde gris claro donde va cada campo
// (un ícono y lo que se escribe) y el del texto de dentro. Estaba copiado letra por letra en Login.js (crear cuenta y
// entrar) y en App.js (los datos del conductor). Los colores salen de la paleta (theme.js, G90).
// Lo vigila pruebas/estiloCampo.test.js con scripts/medir-estilo-campo.cjs: nadie vuelve a escribir la caja a mano, y
// las pantallas se pintan con React igual que antes.
import { T } from './theme';

// La caja del campo.
export const estiloCampo = { background: T.tarjeta, border: '1.5px solid ' + T.borde, borderRadius: '16px', padding: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' };

// El texto que se escribe dentro de la caja (input o select).
export const estiloInput = { background: 'none', border: 'none', outline: 'none', color: T.tinta, fontSize: '16px', width: '100%' };
