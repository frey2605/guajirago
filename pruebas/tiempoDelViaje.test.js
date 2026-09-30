/**
 * G95 · LA FECHA DEL VIAJE Y EL CONTADOR m:ss SALEN DE UNA PIEZA (30-sep-2026)
 *
 * La fecha del viaje (los tres historiales: Home.js, MisViajes.js, AppConductor.js) y el contador «1:05» (cuenta atrás
 * de la oferta del conductor y del pasajero, tiempo buscando conductor, duración de la llamada) estaban escritos a
 * mano. Ahora salen de guajirago/src/tiempoDelViaje.js: `fechaDelViaje` (el día EN COLOMBIA, con diaEnColombiaDe y
 * fechaDeCalendario) y `minutosSegundos`.
 *
 *   1. La pieza, EJECUTADA en varias zonas horarias del teléfono: siempre el día de Colombia.
 *   2. Cada uno de los 7 sitios se saca de su archivo y se EJECUTA con la pieza que importa
 *      (scripts/medir-tiempo-del-viaje.cjs): los 7 usan la pieza, nadie lo escribe a mano, todos dicen lo mismo.
 *   3. CAREO con el código de antes (142a3ae): con el teléfono en Colombia, la misma fecha (salvo las que antes
 *      salían «Invalid Date») y el mismo contador en cada sitio; en otras zonas, antes salía otro día.
 *   4. Pantallas de mentira: si alguien vuelve a escribirlo a mano, o la pieza deja de usar la hora de Colombia,
 *      se pone roja.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, cargarDeLaApp } = require('./cargar.cjs');
const { medir, carear, todoBien, ANTES, PIEZA, ZONAS, FECHAS_DE_PRUEBA, SEGUNDOS_DE_PRUEBA, TS } = require('../scripts/medir-tiempo-del-viaje.cjs');

const OPC = { day: 'numeric', month: 'short', year: 'numeric' };
// El día que DEBE salir, armado sin zona horaria de por medio (año, mes, día en la hora del aparato).
const dia = (a, m, d) => new Date(a, m - 1, d).toLocaleDateString('es-CO', OPC);
const enZona = (zona, fn) => {
  const antes = process.env.TZ;
  process.env.TZ = zona;
  try { return fn(); } finally { if (antes === undefined) delete process.env.TZ; else process.env.TZ = antes; }
};
// Lo que cada fecha de prueba tiene que pintar: el día de COLOMBIA (o nada).
const ESPERADO = {
  '10 a. m. en Colombia': () => dia(2026, 9, 20),
  '7:00 p. m. en Colombia': () => dia(2026, 9, 20),
  '8:30 p. m. en Colombia': () => dia(2026, 9, 20),
  '11:59 p. m. en Colombia': () => dia(2026, 9, 20),
  'medianoche en Colombia': () => dia(2026, 9, 21),
  '00:30 en Colombia (en Los Ángeles aún es el día anterior)': () => dia(2026, 9, 21),
  '31-dic 10 p. m. en Colombia': () => dia(2026, 12, 31),
  'Timestamp de Firestore, 9 p. m. en Colombia': () => dia(2026, 9, 20),
  'sin fecha (vacía)': () => '',
  'sin fecha (no está)': () => '',
  'texto que no es fecha': () => '',
};
const MMSS = { 0: '0:00', 1: '0:01', 9: '0:09', 10: '0:10', 59: '0:59', 60: '1:00', 61: '1:01', 65: '1:05', 119: '1:59', 120: '2:00', 599: '9:59', 600: '10:00', 3599: '59:59', 3600: '60:00', 7325: '122:05' };

const HOME = 'guajirago/src/Home.js';
const SOLICITAR = 'guajirago/src/Solicitar.js';
const LLAMADA = 'guajirago/src/Llamada.js';

describe('G95 · la fecha del viaje y el contador m:ss salen de UNA pieza', () => {
  it('la pieza, ejecutada: el día de COLOMBIA en cualquier zona del teléfono; sin fecha, vacío; m:ss', () => {
    const { fechaDelViaje, minutosSegundos } = cargarDeLaApp(PIEZA);
    for (const zona of ZONAS) {
      enZona(zona, () => {
        for (const [nombre, valor] of FECHAS_DE_PRUEBA) {
          assert.strictEqual(fechaDelViaje(valor), ESPERADO[nombre](), nombre + ' · teléfono en ' + zona);
        }
        // Un Timestamp plano (sin toMillis), como el que llega de la caché, también.
        const plano = TS('2026-09-21T02:00:00.000Z');
        delete plano.toMillis;
        assert.strictEqual(fechaDelViaje(plano), dia(2026, 9, 20), 'Timestamp plano · ' + zona);
        assert.strictEqual(fechaDelViaje(null), '', 'null · ' + zona);
      });
    }
    for (const [s, texto] of Object.entries(MMSS)) assert.strictEqual(minutosSegundos(Number(s)), texto, s + ' segundos');
  });

  it('los 7 sitios usan la pieza, nada está escrito a mano y todos pintan lo mismo (el día de Colombia)', () => {
    const m = medir(null);
    assert.deepStrictEqual(m.problemas, [], m.problemas.join(' · '));
    assert.deepStrictEqual(m.aMano.map((l) => l.archivo + ':' + l.renglon + ' ' + l.que), [], 'escrito a mano (usa tiempoDelViaje.js)');
    assert.strictEqual(m.sitiosFecha.length, 3);
    assert.strictEqual(m.sitiosContador.length, 4);
    for (const s of m.sitiosFecha) {
      assert.strictEqual(s.forma, 'pieza', s.archivo + ':' + s.renglon);
      FECHAS_DE_PRUEBA.forEach(([nombre], i) => {
        const bueno = ESPERADO[nombre]();
        assert.deepStrictEqual(s.pinta[i], ZONAS.map(() => bueno), s.archivo + ' · ' + nombre);
      });
    }
    for (const s of m.sitiosContador) {
      assert.strictEqual(s.forma, 'pieza', s.archivo + ':' + s.renglon);
      assert.deepStrictEqual(s.pinta, SEGUNDOS_DE_PRUEBA.map((n) => MMSS[n]), s.archivo + ':' + s.renglon);
    }
    assert.deepStrictEqual(m.dependeDelTelefono, []);
    assert.ok(todoBien(m));
  });

  it('CAREO · con el código de antes (' + ANTES.raiz + '): con el teléfono en Colombia, lo mismo; fuera, antes salía otro día', () => {
    const antes = medir(ANTES);
    assert.deepStrictEqual(antes.problemas, [], antes.problemas.join(' · '));
    assert.strictEqual(antes.aMano.length, 7, 'el medidor ya no ve los siete sitios a mano de antes');
    assert.ok(antes.dependeDelTelefono.length > 0, 'antes la fecha dependía de la zona del teléfono y el medidor no lo ve');
    const c = carear(antes, medir(null));
    assert.strictEqual(c.comparados, 3 * FECHAS_DE_PRUEBA.length * ZONAS.length + 4 * SEGUNDOS_DE_PRUEBA.length);
    // Los contadores: idénticos.
    assert.deepStrictEqual(c.diferencias.filter((d) => d.tipo === 'contador'), []);
    // Con el teléfono en Colombia solo cambian las fechas que antes salían «Invalid Date».
    const enColombia = c.diferencias.filter((d) => d.zona === 'America/Bogota');
    assert.deepStrictEqual([...new Set(enColombia.map((d) => d.antes))], ['Invalid Date']);
    assert.deepStrictEqual([...new Set(enColombia.map((d) => d.fecha))].sort(), ['Timestamp de Firestore, 9 p. m. en Colombia', 'texto que no es fecha']);
    // Toda diferencia es una CORRECCIÓN: ahora sale el día de Colombia.
    for (const d of c.diferencias) assert.strictEqual(d.ahora, ESPERADO[d.fecha](), JSON.stringify(d));
    // Y el caso del dueño: un viaje de las 8:30 p. m. en un teléfono con la hora de Londres salía al día siguiente.
    assert.ok(c.diferencias.some((d) => d.fecha === '8:30 p. m. en Colombia' && d.zona === 'Europe/London' && d.antes === dia(2026, 9, 21)));
  });

  describe('pantallas de mentira: el medidor no se puede ablandar', () => {
    it('si un historial vuelve a pintar la fecha a mano, se nota (y en Londres sale otro día)', () => {
      const t = leer(HOME);
      const rota = t.replace('const fecha = fechaDelViaje(v.fechaSolicitud);',
        "const fecha = v.fechaSolicitud ? new Date(v.fechaSolicitud).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '';");
      assert.notStrictEqual(rota, t);
      const m = medir(null, { cambios: { [HOME]: rota } });
      assert.deepStrictEqual(m.aMano.map((l) => l.archivo), [HOME]);
      assert.ok(m.dependeDelTelefono.some((d) => d.sitio === HOME));
      assert.ok(!todoBien(m));
    });

    it('si la pieza deja de usar la hora de Colombia, se nota', () => {
      const t = leer(PIEZA);
      const rota = t.replace('fechaDeCalendario(diaEnColombiaDe(v), ', "((x, o) => (x ? new Date(x).toLocaleDateString('es-CO', o) : ''))(v, ");
      assert.notStrictEqual(rota, t);
      const m = medir(null, { cambios: { [PIEZA]: rota } });
      assert.ok(m.dependeDelTelefono.length > 0, 'la pieza pinta con la zona del teléfono y el medidor no lo ve');
    });

    it('si un contador vuelve a escribirse a mano, se nota (aunque dé lo mismo)', () => {
      const t = leer(SOLICITAR);
      const rota = t.replace('{minutosSegundos(tiempoBusqueda)}', "{Math.floor(tiempoBusqueda / 60)}:{String(tiempoBusqueda % 60).padStart(2, '0')}");
      assert.notStrictEqual(rota, t);
      const m = medir(null, { cambios: { [SOLICITAR]: rota } });
      assert.deepStrictEqual(m.aMano.map((l) => l.archivo + ' ' + l.que), [SOLICITAR + ' contador']);
    });

    it('si la llamada cuenta distinto, se nota', () => {
      const t = leer(LLAMADA);
      const rota = t.replace('{minutosSegundos(duracion)}', '{minutosSegundos(duracion + 1)}');
      assert.notStrictEqual(rota, t);
      const m = medir(null, { cambios: { [LLAMADA]: rota } });
      assert.ok(m.contadoresDistintos.length > 0);
    });

    it('si un archivo usa la pieza sin importarla, o un sitio desaparece, se nota', () => {
      const t = leer(SOLICITAR);
      const sinImport = t.replace("import { minutosSegundos } from './tiempoDelViaje';", '');
      assert.notStrictEqual(sinImport, t);
      const m1 = medir(null, { cambios: { [SOLICITAR]: sinImport } });
      assert.ok(m1.problemas.some((p) => /Solicitar\.js: usa minutosSegundos sin importarla/.test(p)), m1.problemas.join(' · '));
      const sinSitio = leer(HOME).replace('const fecha = fechaDelViaje(v.fechaSolicitud);', "const fechaX = '';");
      const m2 = medir(null, { cambios: { [HOME]: sinSitio } });
      assert.ok(m2.problemas.some((p) => /Home\.js: esperaba 1 fecha/.test(p)), m2.problemas.join(' · '));
    });
  });
});
