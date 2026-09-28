// ═══════════════════════════════════════════════════════════════════════════
//  ¿EL VIAJE YA SE ACABÓ? · gemelo G20, 28-sep-2026
//
//  La rutina del servidor cierra los viajes que nadie cerró (`vencido`, `expirado`) y escribe el porqué en
//  `motivoExpiracion`. Hasta hoy ni el conductor ni el pasajero se enteraban: se quedaban dentro de un viaje que ya
//  no existía. Ahora los dos salen con una ventanita que dice qué pasó, y el texto sale de UNA pieza
//  (`avisoDelCierre` en estadosViaje.js).
//
//  Esta prueba no lee el código buscando palabras: SACA los vigilantes del viaje de las dos pantallas y los CORRE
//  (con `scripts/medir-viaje-cerrado.cjs`, el mismo contador del paso 1 y del 12) con un viaje en cada final.
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, soloCodigo, cargarDeLaApp } = require('./cargar.cjs');
const { medirPantallas, correrVigilante, queHizo } = require('../scripts/medir-viaje-cerrado.cjs');
const { queHacerConElViaje, MINUTOS } = require('../guajirago/functions/viajesColgados.cjs');

const { ESTADOS_TERMINADOS, ESTADOS_QUE_CIERRA_EL_SERVIDOR, avisoDelCierre }
  = cargarDeLaApp('guajirago/src/estadosViaje.js');

describe('G20 · la ventanita del cierre (avisoDelCierre)', () => {
  it('solo habla de los finales que pone el servidor', () => {
    for (const e of ['finalizado', 'cancelado', 'cancelado_conductor', 'esperando', 'aceptado', undefined]) {
      assert.strictEqual(avisoDelCierre({ estado: e }, 'pasajero'), null, e + ' no lo cierra el servidor');
    }
    assert.strictEqual(avisoDelCierre(null, 'conductor'), null);
  });

  it('dice el porqué que escribió el servidor, y qué puede hacer cada uno', () => {
    const v = { estado: 'expirado', motivoExpiracion: 'lo aceptaron hace 75 min y el conductor nunca llegó a recoger' };
    const c = avisoDelCierre(v, 'conductor');
    const p = avisoDelCierre(v, 'pasajero');
    assert.strictEqual(c.titulo, 'Este viaje ya se cerró');
    assert.strictEqual(c.texto, 'El sistema lo cerró: lo aceptaron hace 75 min y el conductor nunca llegó a recoger.'
      + ' Ya quedaste libre para recibir viajes nuevos.');
    assert.strictEqual(p.texto, 'El sistema lo cerró: lo aceptaron hace 75 min y el conductor nunca llegó a recoger.'
      + ' Si todavía lo necesitas, pide uno nuevo.');
  });

  it('sin motivo (los 8 que hay en producción no lo tienen) dice lo que se sabe por el estado, sin inventar', () => {
    assert.strictEqual(avisoDelCierre({ estado: 'expirado' }, 'pasajero').texto,
      'Pasó demasiado tiempo sin que se terminara y el sistema lo cerró. Si todavía lo necesitas, pide uno nuevo.');
    assert.strictEqual(avisoDelCierre({ estado: 'vencido', motivoExpiracion: '  ' }, 'conductor').texto,
      'Nadie lo tomó a tiempo y el sistema lo cerró. Ya quedaste libre para recibir viajes nuevos.');
  });
});

describe('G20 · la lista de los finales del servidor está atada al servidor', () => {
  it('son finales de verdad (están en ESTADOS_TERMINADOS)', () => {
    for (const e of ESTADOS_QUE_CIERRA_EL_SERVIDOR) assert.ok(ESTADOS_TERMINADOS.includes(e), e);
  });

  it('son EXACTAMENTE los que puede devolver la rutina queHacerConElViaje', () => {
    const ahora = '2026-09-28T12:00:00.000Z';
    const hace = (min) => new Date(Date.parse(ahora) - min * 60000).toISOString();
    const salen = new Set();
    for (const estado of ['esperando', 'aceptado', 'finalizado', 'cancelado', 'vencido', 'expirado', undefined]) {
      for (const fase of [undefined, 'en_punto', 'en_viaje', 'finalizado']) {
        for (const min of [1, MINUTOS.buscando + 1, MINUTOS.noRecogio + 1, MINUTOS.rodando + 1, 10000]) {
          const d = queHacerConElViaje({ estado, fase, fechaSolicitud: hace(min), fechaAceptacion: hace(min) }, ahora);
          if (d.cerrar) salen.add(d.estado);
        }
      }
    }
    assert.deepStrictEqual([...salen].sort(), [...ESTADOS_QUE_CIERRA_EL_SERVIDOR].sort(),
      'la rutina del servidor cierra con otros finales que los que las pantallas saben leer: el que falte deja a la '
      + 'persona dentro de un viaje que ya no existe.');
  });

  it('la copia de los finales en functions/index.js (onViajeCerrado) dice lo mismo que la app', () => {
    // functions es otro paquete npm y no puede importar la app: la copia se queda, y se ATA aquí.
    const t = soloCodigo(leer('guajirago/functions/index.js'));
    const i = t.indexOf('exports.onViajeCerrado');
    assert.ok(i >= 0, 'no encuentro exports.onViajeCerrado en functions/index.js');
    const m = /const\s+terminales\s*=\s*\[([^\]]*)\]/.exec(t.slice(i, i + 1500));
    assert.ok(m, 'onViajeCerrado ya no tiene su lista `terminales`: hay que mirar a mano con qué decide soltar al conductor');
    const suya = m[1].replace(/['"\s]/g, '').split(',').filter(Boolean);
    assert.deepStrictEqual([...suya].sort(), [...ESTADOS_TERMINADOS].sort(),
      'la lista de finales del servidor (onViajeCerrado) y la de la app se separaron: el final que falte no suelta '
      + 'al conductor, y queda «ocupado» sin recibir viajes.');
  });
});

describe('G20 · las pantallas, corridas de verdad', () => {
  it('ningún final deja a nadie dentro de un viaje que ya se acabó', async () => {
    const filas = await medirPantallas();
    assert.ok(filas.length >= 40, 'el medidor corrió solo ' + filas.length + ' casos');
    const ciegos = filas.filter((f) => f.ciego).map((f) => f.vigilante + ' ' + f.pantalla + ' ' + f.estado);
    assert.deepStrictEqual(ciegos, [], 'estas pantallas no se enteran de que el viaje se acabó');
  });

  it('cuando lo cerró el servidor, las dos personas salen CON la ventanita del porqué', async () => {
    const filas = (await medirPantallas()).filter((f) => ESTADOS_QUE_CIERRA_EL_SERVIDOR.includes(f.estado)
      && f.vigilante !== 'conductorOfertas');
    assert.ok(filas.length >= 14, 'solo ' + filas.length + ' casos del servidor');
    for (const f of filas) {
      const quien = f.vigilante.startsWith('conductor') ? 'conductor' : 'pasajero';
      assert.deepStrictEqual(f.aviso, avisoDelCierre(f.viaje, quien),
        f.vigilante + ' ' + f.pantalla + ' ' + f.estado + ': no sale la ventanita de avisoDelCierre');
    }
  });

  it('lo que la persona hizo ella misma NO le saca una ventanita ni la saca del viaje por esta puerta', async () => {
    const filas = (await medirPantallas()).filter((f) => f.loHizoEl);
    assert.ok(filas.length >= 10);
    for (const f of filas) {
      assert.strictEqual(f.aviso, null, f.vigilante + ' ' + f.pantalla + ' ' + f.estado + ' sacó una ventanita');
      assert.strictEqual(f.seEntera, false, f.vigilante + ' ' + f.pantalla + ' ' + f.estado + ' sacó a la persona');
    }
  });

  it('mientras el pasajero BUSCA, el `vencido` es de su propio teléfono y no lo saca (tiene su «seguir buscando»)', async () => {
    for (const vig of ['pasajeroEnVivo', 'pasajeroRespaldo']) {
      const ll = await correrVigilante(vig, { estado: 'vencido' }, 'esperando');
      assert.strictEqual(ll.filter((l) => l[0] === 'setViajeCerrado').length, 0, vig + ' sacó al pasajero mientras buscaba');
    }
  });

  it('el conductor, al salir, suelta el contador de espera y no escribe nada (al conductor lo soltó el servidor)', async () => {
    const ll = await correrVigilante('conductorEnCurso', { estado: 'expirado' }, 'en_punto');
    assert.ok(ll.some((l) => l[0] === 'clearInterval' && l[1] === 7), 'no soltó el contador');
    assert.deepStrictEqual(ll.filter((l) => ['updateDoc', 'setDoc'].includes(l[0])), []);
    assert.ok(queHizo('conductorEnCurso', ll).seEntera);
  });

  it('el pasajero, al salir, apaga el respaldo de 5 s (si no, la ventanita vuelve a abrirse sola cada 5 s)', async () => {
    for (const vig of ['pasajeroEnVivo', 'pasajeroRespaldo']) {
      const ll = await correrVigilante(vig, { estado: 'expirado' }, 'fase1');
      assert.ok(ll.some((l) => l[0] === 'clearInterval' && l[1] === 9), vig + ': no apagó el respaldo de 5 s');
      assert.ok(ll.some((l) => l[0] === 'clearInterval' && l[1] === 7), vig + ': no soltó el contador');
    }
  });

  it('el pasajero sale del viaje: su pantalla dice el porqué, lleva «Volver al inicio» y la ventanita', () => {
    const t = soloCodigo(leer('guajirago/src/Solicitar.js')).replace(/\r\n/g, '\n');
    const i = t.indexOf('if (viajeCerrado) {');
    assert.ok(i >= 0, 'no encuentro la pantalla del viaje cerrado');
    const fin = t.indexOf('\n  }\n', i);
    assert.ok(fin > i, 'no encuentro dónde acaba la pantalla del viaje cerrado');
    const trozo = t.slice(i, fin);
    assert.match(trozo, /\{viajeCerrado\.texto\}/, 'la pantalla no dice el porqué');
    assert.match(trozo, /<button onClick=\{onVolver\}[^>]*>Volver al inicio<\/button>/, 'la pantalla no deja volver al inicio');
    assert.match(trozo, /<AvisoModal aviso=\{aviso\} onCerrar=\{\(\) => setAviso\(null\)\} \/>/, 'la pantalla no pinta la ventanita');
    // Y va ANTES de las pantallas del viaje: si fuera después, fase1/fase2 la taparían.
    assert.ok(i < t.indexOf("if (pantalla === 'fase1')"), 'la pantalla del cierre queda detrás de fase1');
  });

  it('el medidor no se puede ablandar: con el arreglo quitado de cada sitio vuelve a ver ciegos', async () => {
    const cond = leer('guajirago/src/AppConductor.js');
    const pas = leer('guajirago/src/Solicitar.js');
    const sinArreglo = [
      ['guajirago/src/AppConductor.js', cond.replace('if (ESTADOS_QUE_CIERRA_EL_SERVIDOR.includes(data.estado)) {', 'if (false) {')],
      ['guajirago/src/AppConductor.js', cond.replace('if (ESTADOS_TERMINADOS.includes(data.estado)) {\r\n        cerrarEsteVigilante();',
        "if (data.estado === 'cancelado' || data.estado === 'cancelado_conductor') {\r\n        cerrarEsteVigilante();")],
      ['guajirago/src/Solicitar.js', pas.replace("if (pantallaRef.current !== 'fase1' && pantallaRef.current !== 'fase2') return false;",
        'return false;')],
    ];
    for (const [archivo, codigo] of sinArreglo) {
      assert.notStrictEqual(codigo, archivo.endsWith('AppConductor.js') ? cond : pas, 'el sabotaje de ' + archivo + ' no calzó');
      const ciegos = (await medirPantallas({ [archivo]: codigo })).filter((f) => f.ciego);
      assert.ok(ciegos.length > 0, 'con el arreglo quitado de ' + archivo + ' el medidor sigue sin ver ciegos');
    }
  });
});
