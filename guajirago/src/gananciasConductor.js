/**
 * ¿CUÁNTO GANÉ HOY? — gemelo G23 (28-sep-2026). UNA sola cuenta para el conductor.
 *
 * Hasta el 28-sep-2026 había DOS respuestas: el recuadro «GANANCIAS DE HOY» del historial (AppConductor.js) sumaba
 * solo entre los 50 viajes más recientes que pide el historial y comparaba el día con `toDateString` del teléfono; la
 * pantalla Ganancias (Ganancias.js) leía todos los finalizados y contaba desde la medianoche del teléfono (un viaje
 * fechado en el futuro también entraba). Las dos decidían «hoy» con la zona horaria del TELÉFONO: un celular con la
 * zona mal puesta le cambiaba el día al conductor (medido con scripts/medir-ganancias-hoy.cjs: 3 de 4 días reales
 * cambiaban con el teléfono en UTC).
 *
 * Ahora las dos pantallas piden los viajes con `consultaDeGanancias` (sin tope: desde el primer día de la semana o
 * del mes, lo que sea antes) y los cuentan con `resumenDeGanancias`. El día es el de COLOMBIA (`hoyEnColombia`, la
 * misma pieza de las promociones), no el del teléfono.
 *
 * QUÉ FECHA CUENTA: `fechaSolicitud`, la hora en que se pidió el viaje. Es la ÚNICA que guarda el viaje: al
 * finalizarlo no se escribe ninguna fecha (AppConductor.js solo pone estado y fase), y la hora de aceptación
 * (`fechaAceptacion`, del servidor) no la tienen los viajes viejos. Un viaje pedido a las 11:50 p. m. y terminado
 * pasada la medianoche cuenta en el día en que se pidió. La escribe el celular del pasajero (deuda «Las fechas del
 * celular no deciden»); medido el 15-sep-2026, ninguna se desvía de la hora del servidor.
 */
import { hoyEnColombia } from './reglaPromocion';
import { valorDelViaje } from './valorViaje';
import { comisionDeViaje } from './comisiones';
import { diaEnColombiaDe } from './fechaGuardada';

/** El día (AAAA-MM-DD) en Colombia en que cae una fecha guardada. null si no se puede leer. G48: lo lee la pieza única. */
export function diaEnColombia(fecha) {
  return diaEnColombiaDe(fecha);
}

/** Los tres periodos, como días de Colombia: hoy, el domingo que abre la semana y el día 1 del mes. */
export function periodosDeGanancias(ahora) {
  const hoy = hoyEnColombia(ahora);
  const d = new Date(hoy + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  const semana = d.toISOString().slice(0, 10);
  const mes = hoy.slice(0, 8) + '01';
  return { hoy, semana, mes };
}

/** Desde qué instante hay que leer viajes: la medianoche de Colombia (05:00 UTC) del periodo más largo. */
export function desdeCuandoSeLee(ahora) {
  const p = periodosDeGanancias(ahora);
  return (p.semana < p.mes ? p.semana : p.mes) + 'T05:00:00.000Z';
}

/**
 * La consulta de los viajes que cuentan, la MISMA en las dos pantallas. Recibe las funciones de Firestore para que
 * este archivo no dependa de la conexión. Usa el índice conductorId + estado + fechaSolicitud, que ya está puesto.
 */
export function consultaDeGanancias({ collection, query, where }, db, uid, ahora) {
  return query(collection(db, 'viajes'),
    where('conductorId', '==', uid),
    where('estado', '==', 'finalizado'),
    where('fechaSolicitud', '>=', desdeCuandoSeLee(ahora)));
}

/** Cuánto ganó el conductor hoy, esta semana y este mes (días de Colombia): valor, viajes y comisión. */
export function resumenDeGanancias(viajes, ahora, cfgComisiones) {
  const p = periodosDeGanancias(ahora);
  const vacio = () => ({ total: 0, viajes: 0, comision: 0 });
  const r = { hoy: vacio(), semana: vacio(), mes: vacio() };
  for (const v of viajes || []) {
    if (!v || v.estado !== 'finalizado') continue;
    const dia = diaEnColombia(v.fechaSolicitud);
    if (!dia || dia > p.hoy) continue;
    const sumar = (c) => { c.total += valorDelViaje(v); c.viajes += 1; c.comision += comisionDeViaje(v, cfgComisiones); };
    if (dia >= p.mes) sumar(r.mes);
    if (dia >= p.semana) sumar(r.semana);
    if (dia === p.hoy) sumar(r.hoy);
  }
  return r;
}
