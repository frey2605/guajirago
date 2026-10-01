/**
 * 🟢 EL CONDUCTOR SIN SALDO SE PONE DISPONIBLE Y VE EL MERCADO — pendiente P05 (30-sep-2026).
 *
 * Decisión del dueño: «Que pueda ver: se pone disponible y ve los viajes y sus precios, pero no puede ofertar hasta
 * recargar. Ve lo que se está perdiendo.» Y del aviso al celular: «Que le suene para que se anime a recargar».
 *
 * Esta prueba usa scripts/medir-disponible-sin-saldo.cjs, que SACA del archivo el onClick del interruptor y lo CORRE,
 * PINTA con React la franja `FranjaSinSaldo` y la TOCA, y EJECUTA notificarNuevoViaje con la nube de mentira. Y lo
 * carea con el commit de antes (ANTES): lo que no frenaba hace exactamente lo mismo, y el freno al ofertar (P04) no
 * se movió.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { RAIZ } = require('./cargar.cjs');
const M = require('../scripts/medir-disponible-sin-saldo.cjs');

const ANTES = 'bc7ed15'; // el último commit con el interruptor que frenaba por saldo
const hoy = M.medirCodigo(null);
const antes = M.medirCodigo(ANTES);
const leerApp = () => fs.readFileSync(path.join(RAIZ, M.APP), 'utf8');
/** Mide con AppConductor.js cambiado (una pantalla de mentira). Exige que el cambio calce. */
function conPantalla(de, a) {
  const t = leerApp();
  assert.ok(t.includes(de), 'la pantalla de mentira no calzó: ' + de);
  return M.medirCodigo(null, { [M.APP]: t.replace(de, a) });
}

describe('P05 · el conductor sin saldo se pone disponible, ve el mercado con la franja y sigue sin poder ofertar', () => {
  it('el interruptor se prende con CUALQUIER saldo (antes frenaba 8 de 42 casos)', () => {
    assert.strictEqual(antes.interruptores, 1);
    assert.strictEqual(antes.frena, 8, 'el careo: antes el interruptor frenaba por saldo');
    assert.strictEqual(hoy.interruptores, 1, 'no hay UN interruptor con setActivo(!activo)');
    assert.strictEqual(hoy.frena, 0, 'el interruptor todavía frena por saldo');
    for (const x of hoy.tabla) assert.strictEqual(x.hace, x.activo ? 'apaga' : 'prende', JSON.stringify(x));
  });

  it('con saldo suficiente el interruptor hace EXACTAMENTE lo mismo que antes, caso por caso', () => {
    assert.strictEqual(hoy.tabla.length, antes.tabla.length);
    let iguales = 0;
    for (let i = 0; i < hoy.tabla.length; i += 1) {
      const a = antes.tabla[i];
      if (a.hace.startsWith('frena')) {
        assert.strictEqual(hoy.tabla[i].hace, 'prende', 'el que antes frenaba ahora debe prenderse: ' + JSON.stringify(a));
        continue;
      }
      assert.strictEqual(hoy.tabla[i].hace, a.hace, 'cambió un caso que antes no frenaba: ' + JSON.stringify(a));
      iguales += 1;
    }
    assert.strictEqual(iguales, 34);
  });

  it('la franja «Te falta saldo» se ve justo cuando no le alcanza para ningún viaje, con el texto de la pieza, y tocarla abre Mis créditos', () => {
    assert.strictEqual(antes.franja, null, 'el careo: antes no había franja');
    assert.ok(hoy.franja, 'no existe FranjaSinSaldo en AppConductor.js');
    for (const x of hoy.franja) {
      assert.strictEqual(x.seVe, x.debe, 'la franja ' + (x.debe ? 'no se ve' : 'se ve') + ' con ' + (x.tv || '(sin tipo)') + ' y saldo ' + x.saldo);
      if (x.seVe) {
        assert.ok(x.diceElTexto, 'la franja no dice el título y el texto de AVISO_SIN_SALDO');
        assert.ok(x.tocarAbreCreditos, 'tocar la franja no llama onRecargar');
      }
    }
    assert.strictEqual(hoy.franja.filter((x) => x.seVe).length, 8);
    // Las cifras: con la vara de comisionParaActivarse (la misma que tenía el interruptor), los 8 casos que antes frenaban.
    const frenabanApagado = antes.tabla.filter((x) => !x.activo && x.hace.startsWith('frena')).map((x) => x.tv + '|' + x.saldo).sort();
    const seVe = hoy.franja.filter((x) => x.seVe).map((x) => x.tv + '|' + x.saldo).sort();
    assert.strictEqual(frenabanApagado.length, 8);
    assert.deepStrictEqual(seVe, frenabanApagado);
  });

  it('la pantalla del mercado pone la franja UNA vez, con el saldo, el vehículo, la config y «Mis créditos»', () => {
    assert.deepStrictEqual(hoy.usos, [{
      saldoCreditos: '{saldoCreditos}', tipoVehiculo: '{tipoVehiculo}', configApp: '{configApp}', onRecargar: '{() => setVerCreditos(true)}',
    }]);
  });

  it('el freno al aceptar o contraofertar (P04) NO se movió: misma decisión, caso por caso', () => {
    assert.strictEqual(antes.frenos.length, 2, 'el careo: antes eran el de ofertar y el del interruptor');
    assert.strictEqual(hoy.frenos.length, 1, 'tiene que quedar SOLO el freno al ofertar');
    assert.strictEqual(hoy.frenos[0].huella, antes.frenos[0].huella, 'cambió cuándo frena al ofertar');
    assert.strictEqual(hoy.frenos[0].frena, antes.frenos[0].frena);
  });

  it('el aviso al celular de «viaje nuevo» le sigue sonando al que no tiene saldo (decisión del dueño), igual que antes', async () => {
    const ahora = await M.elAvisoAlCelular(null);
    const antesTok = await M.elAvisoAlCelular(ANTES);
    assert.deepStrictEqual(ahora, ['tok-con-saldo', 'tok-sin-saldo']);
    assert.deepStrictEqual(ahora, antesTok);
  });

  it('el medidor no se deja engañar (pantallas de mentira)', () => {
    // 1 · vuelve el freno al interruptor
    const freno = conPantalla('onClick={() => { desbloquearAudio(); setActivo(!activo); }}',
      'onClick={() => { if (!activo && saldoCreditos !== null && saldoCreditos < comisionParaActivarse(tipoVehiculo, configApp)) { setAviso(AVISO_SIN_SALDO); return; } desbloquearAudio(); setActivo(!activo); }}');
    assert.strictEqual(freno.frena, 8);
    // 2 · la franja se ve siempre
    const siempre = conPantalla('  if (!(saldoCreditos !== null && saldoCreditos < comisionParaActivarse(tipoVehiculo, configApp))) return null;\r\n', '');
    assert.ok(siempre.franja.some((x) => x.seVe && !x.debe), 'no vio una franja que sale con saldo de sobra');
    // 3 · la franja con otro texto
    const otro = conPantalla('{AVISO_SIN_SALDO.texto}</p>', '{\'Recarga ya\'}</p>');
    assert.ok(otro.franja.some((x) => x.seVe && !x.diceElTexto), 'no vio la franja con un texto propio');
    // 4 · la franja no abre Mis créditos
    const muda = conPantalla('<div onClick={onRecargar} style', '<div style');
    assert.ok(muda.franja.some((x) => x.seVe && !x.tocarAbreCreditos), 'no vio una franja que no abre Mis créditos');
    // 5 · la pantalla no la pone
    const sinPoner = conPantalla('<FranjaSinSaldo saldoCreditos={saldoCreditos} tipoVehiculo={tipoVehiculo} configApp={configApp} onRecargar={() => setVerCreditos(true)} />', '');
    assert.strictEqual(sinPoner.usos.length, 0);
  });
});
