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
 * La vigila pruebas/horarioNegocio.test.js.
 *
 * ── G47 (29-sep-2026): «¿ME PUEDEN PEDIR AHORA?» — la pregunta ENTERA, también aquí ──────────────────────────────
 * Hasta el 29-sep-2026 la contestaban tres pantallas, cada una a su manera: el cliente (escaparate + pausa + horario),
 * el dueño en aliados (solo la pausa: «🟢 Abierto · Los clientes pueden pedirte» a las 3 de la mañana) y el panel
 * («ABIERTOS AHORA» = aprobado + pausa). Y ninguna miraba el candado que el servidor sí mira al crear el pedido.
 * Ahora es UNA regla, `motivoParaNoPedir`, y se contesta en este orden (el primero que falle es el motivo):
 *   1. el candado del negocio (`activo`, `estadoComercial`) — lo mismo que `negocioPuedeOperar` en firestore.rules;
 *   2. que salga en la app de clientes — `saleEnElEscaparate` (aprobado, visible, ficha llena);
 *   3. que no lo hayan pausado a mano — `abierto`;
 *   4. que esté dentro de su horario, en hora de Colombia — `dentroDelHorario`.
 * La usan la lista de restaurantes, el menú, la lista de agencias, la bienvenida del dueño en aliados y el panel.
 * Aliados y el panel no pueden importar este archivo: tienen una COPIA IGUAL (con escaparate.js y reglaPromocion.js),
 * y pruebas/pedirAhora.test.js exige que sean iguales letra por letra y las corre.
 */
import { hoyEnColombia } from './reglaPromocion';
import { saleEnElEscaparate } from './escaparate';

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

/**
 * El candado del negocio: lo MISMO que pregunta el servidor al crear el pedido (firestore.rules, `puedeOperarEn`).
 * Un campo que falta no frena: `activo` ausente = true, `estadoComercial` ausente = 'alDia'.
 */
export function negocioPuedeOperar(negocio) {
  return !!negocio && negocio.activo !== false && negocio.estadoComercial !== 'bloqueado';
}

/** Por qué NO se le puede pedir ahora a este negocio (null = sí se puede). */
export function motivoParaNoPedir(negocio, ahora) {
  if (!negocio) return 'no-existe';
  if (!negocioPuedeOperar(negocio)) return 'bloqueado';
  if (!saleEnElEscaparate(negocio)) return 'no-sale-en-la-app';
  if (negocio.abierto === false) return 'pausado';
  if (!dentroDelHorario(negocio, ahora)) return 'fuera-de-horario';
  return null;
}

/** ¿Se le puede pedir (o reservar) ahora? La respuesta del cliente, del dueño y del panel. */
export function sePuedePedirAhora(negocio, ahora) {
  return motivoParaNoPedir(negocio, ahora) === null;
}

/** Cómo se dice cada motivo: `corto` para el panel, `alDueno` para la bienvenida de aliados. */
export const MOTIVO_PARA_NO_PEDIR = {
  'no-existe': { corto: 'Cerrado', alDueno: 'No encontramos tu negocio: los clientes no pueden pedirte' },
  bloqueado: { corto: 'Bloqueado', alDueno: 'Tu negocio está suspendido: los clientes no pueden pedirte' },
  'no-sale-en-la-app': { corto: 'No sale en la app', alDueno: 'No sales en la app de clientes: no pueden pedirte' },
  pausado: { corto: 'Pausado', alDueno: 'Lo pausaste: no apareces para pedir' },
  'fuera-de-horario': { corto: 'Fuera de horario', alDueno: 'Estás fuera de tu horario: ahora no pueden pedirte' },
};
