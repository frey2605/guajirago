/**
 * ¿ESTÁ ABIERTO AHORA ESTE NEGOCIO? — gemelo G46 (28-sep-2026). UNA sola regla, en hora de COLOMBIA.
 *
 * Hasta el 28-sep-2026 la pregunta tenía DOS respuestas, escritas aparte:
 *   · la lista de restaurantes (Restaurantes.js, `dentroHorario`): abrir y cerrar a la misma hora = abierto 24 horas;
 *   · la lista de agencias (Turismo.js, `abiertaAhora`): abrir y cerrar a la misma hora = CERRADA todo el día.
 * Y las dos miraban la hora del TELÉFONO (`getHours()`): un celular con la zona horaria mal puesta abría o cerraba el
 * negocio a deshoras.
 *
 * LA REGLA (decisión del dueño, 28-sep-2026: la recomendada):
 *   · pausado a mano (`abierto === false`)          → cerrado, a cualquier hora;
 *   · sin horario (falta la hora de abrir o la de cerrar, o no es una hora de 0 a 23) → abierto: un campo que falta
 *     no apaga a nadie (la misma idea que el escaparate);
 *   · abrir y cerrar a la MISMA hora                → abierto LAS 24 HORAS;
 *   · abrir antes que cerrar (8 a 22)               → abierto de 8:00 a 21:59;
 *   · abrir después que cerrar (18 a 2)             → cruza la medianoche: de 18:00 a 1:59 del día siguiente.
 *
 * La hora es la de COLOMBIA, sacada de `hoyEnColombia` (la misma pieza de las promociones y las ganancias): la hora es
 * lo que ha pasado desde la medianoche de ese día. No hay otra cuenta de «qué hora es en Colombia».
 *
 * La usan la lista de restaurantes, el menú del restaurante y la lista de agencias. Es la pieza que tiene que reusar
 * «¿me pueden pedir ahora?» (G47) en la app del negocio y en el panel. La vigila pruebas/horarioNegocio.test.js.
 */
import { hoyEnColombia } from './reglaPromocion';

/** La hora (0 a 23) en Colombia en el instante `ahora` (o ya). */
export function horaEnColombia(ahora) {
  const d = ahora instanceof Date ? ahora : new Date();
  const medianoche = Date.parse(hoyEnColombia(d) + 'T00:00:00-05:00');
  return Math.floor((d.getTime() - medianoche) / 3600000);
}

// Una hora guardada (8, o '8' si alguien la guardó como texto) → 8. Lo que no sea una hora de 0 a 23 → null.
function horaGuardada(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : null;
}

/** ¿La hora de ahora (en Colombia) cae dentro del horario del negocio? Sin horario → sí. */
export function dentroDelHorario(negocio, ahora) {
  const a = horaGuardada(negocio && negocio.horarioApertura);
  const c = horaGuardada(negocio && negocio.horarioCierre);
  if (a === null || c === null) return true;
  if (a === c) return true;                  // abre y cierra a la misma hora: las 24 horas
  const h = horaEnColombia(ahora);
  if (a < c) return h >= a && h < c;         // horario normal
  return h >= a || h < c;                    // cruza la medianoche
}

/** Abierto = no lo pausaron a mano Y está dentro de su horario. */
export function negocioAbiertoAhora(negocio, ahora) {
  if (!negocio || negocio.abierto === false) return false;
  return dentroDelHorario(negocio, ahora);
}
