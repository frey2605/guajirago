/**
 * LA FECHA DEL VIAJE Y EL CONTADOR m:ss — UN SOLO SITIO (gemelo G95, 30-sep-2026)
 *
 * SEGUNDA LEY. Estaban escritos a mano:
 *   · la fecha del viaje («20 sept 2026») en los TRES historiales (Home.js, MisViajes.js y AppConductor.js), con
 *     `new Date(v.fechaSolicitud).toLocaleDateString(...)`: el día en la zona horaria DEL TELÉFONO. Un viaje pedido
 *     a las 8 p. m. en Riohacha salía con el día siguiente en un teléfono con la hora de Londres o de Madrid;
 *   · el contador «1:05» en CUATRO sitios: la cuenta atrás de la oferta (conductor y pasajero), el tiempo buscando
 *     conductor (Solicitar.js) y la duración de la llamada (Llamada.js).
 *
 * `fechaDelViaje(v)`   → el DÍA EN COLOMBIA de esa fecha, en español: «20 sept 2026». No convierte nada por su cuenta:
 *                        el día lo saca diaEnColombiaDe (fechaGuardada.js, que entiende texto y Timestamp) y lo pinta
 *                        fechaDeCalendario (fechaCalendario.js), las piezas de G48 y G11/G16. Sin fecha, o una que no
 *                        se puede leer, da '' (nunca «Invalid Date»).
 * `minutosSegundos(s)` → «m:ss» de un número de segundos: 65 → «1:05».
 *
 * Lo vigila pruebas/tiempoDelViaje.test.js, que ejecuta cada sitio con scripts/medir-tiempo-del-viaje.cjs.
 */
import { diaEnColombiaDe } from './fechaGuardada';
import { fechaDeCalendario } from './fechaCalendario';

export const fechaDelViaje = (v) => fechaDeCalendario(diaEnColombiaDe(v), { day: 'numeric', month: 'short', year: 'numeric' });

export const minutosSegundos = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
