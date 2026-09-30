/**
 * P03 (30-sep-2026) · LA TARJETA DEL CONDUCTOR QUE LLEVA EL VIAJE SALE DE SU FICHA, NO DE SU OFERTA
 *
 * `confirmarConductor` (guajirago/functions/index.js) escribe en el viaje el nombre, teléfono, placa, vehículo, foto y
 * color del conductor —lo que ve el pasajero y va en su mensaje de emergencia—. Hasta P03 los copiaba de la oferta que
 * escribe el teléfono del conductor. Esta prueba:
 *   1. ata la pieza del servidor (functions/conductorDeLaFicha.cjs) a la app: sus claves son CAMPOS_DEL_CONDUCTOR
 *      (G59) menos conductorId, y sus copias de telefonoDe / fotoDe dicen lo mismo que las de la app;
 *   2. exige que la oferta HONRADA —el objeto que arma AppConductor.js, con los datos que App.js saca de la ficha
 *      (datosDeLaFicha), los dos EJECUTADOS— diga lo mismo que la pieza: así el viaje de un conductor honrado no cambia;
 *   3. EJECUTA confirmarConductor (scripts/medir-tarjeta-del-conductor.cjs con la nube de mentira): con oferta honrada
 *      todo igual, con oferta mentirosa todo de la ficha, con ficha vieja lo que falta se queda vacío; y el careo con el
 *      código de antes (609a6ef): el viaje honrado es IDÉNTICO, y el de antes copiaba la mentira (el medidor la ve);
 *   4. le da datos de mentira al medidor de producción y exige que vea las diferencias.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, soloCodigo, sinTextos, cargarDeLaApp } = require('./cargar.cjs');
const { evaluarObjeto } = require('../scripts/medir-conductor-soltado.cjs');
const M = require('../scripts/medir-tarjeta-del-conductor.cjs');
const pieza = require('../guajirago/functions/conductorDeLaFicha.cjs');

const ANTES = '609a6ef';
const app = {
  ...cargarDeLaApp('guajirago/src/telefonoUsuario.js'),
  ...cargarDeLaApp('guajirago/src/fotoUsuario.js'),
};
const { CAMPOS_DEL_CONDUCTOR } = cargarDeLaApp('guajirago/src/conductorDelViaje.js');

const FICHAS = [
  { nombre: 'LUIS PEREZ', telefono: '3001234567', celular: '3009999999', placa: 'ABC123', vehiculo: 'Chevrolet 2015',
    fotoConductor: 'https://fotos/luis.jpg', color: 'Blanco' },
  { nombre: 'ANA', celular: '3005556677', placa: 'XYZ12D', vehiculo: 'Yamaha 2020', foto: 'https://fotos/vieja.jpg', color: 'Rojo' },
  { nombre: '', telefono: '', placa: 'QWE456', vehiculo: 'Kia 2018' },
  {},
  null,
];

/** Desde la llave en `pos` hasta la que la cierra, en el código sin textos. */
function hastaLaQueCierra(seguro, pos) {
  let hondo = 0;
  for (let k = pos; k < seguro.length; k++) {
    if (seguro[k] === '{') hondo++;
    else if (seguro[k] === '}' && --hondo === 0) return k + 1;
  }
  throw new Error('llave sin cerrar');
}

/** El texto de la primera `{ … }` después de `ancla` en un archivo (sin comentarios). */
function objetoTras(ruta, ancla) {
  const codigo = soloCodigo(leer(ruta).replace(/\r\n/g, '\n'));
  const i = codigo.indexOf(ancla);
  if (i < 0) throw new Error(ruta + ': ya no encuentro «' + ancla + '»');
  const desde = codigo.indexOf('{', i + ancla.length - 1);
  return codigo.slice(desde, hastaLaQueCierra(sinTextos(codigo), desde));
}

/** La oferta que manda la app de verdad: App.js `datosDeLaFicha` + el setDoc de AppConductor.js, los dos ejecutados. */
function ofertaDeLaApp(ficha) {
  const cuerpo = objetoTras('guajirago/src/App.js', 'function datosDeLaFicha(f) {\n  return {');
  const datos = evaluarObjeto(cuerpo, { f: ficha || {}, telefonoDe: app.telefonoDe, fotoDe: app.fotoDe });
  const oferta = objetoTras('guajirago/src/AppConductor.js', "setDoc(doc(db, 'viajes', idViaje, 'contraofertas', user.uid), {");
  return evaluarObjeto(oferta, {
    nombre: datos.nombre, telefono: datos.telefonoActual, placa: datos.placa, vehiculo: datos.vehiculo,
    // AppConductor.js (cargarSaldo) saca la foto y el color de la ficha: fotoDe(snap.data()) y snap.data().color || ''.
    fotoConductor: app.fotoDe(ficha), colorConductor: (ficha && ficha.color) || '',
    user: { uid: 'C1' },
  });
}

describe('P03 · la pieza del servidor está atada a la app', () => {
  it('sus claves son CAMPOS_DEL_CONDUCTOR menos conductorId (G59)', () => {
    assert.deepStrictEqual(Object.keys(pieza.tarjetaDelConductor({})).sort(),
      CAMPOS_DEL_CONDUCTOR.filter((c) => c !== 'conductorId').sort());
  });

  it('telefonoDe y fotoDe dicen lo mismo que las de la app (G08, G43)', () => {
    for (const f of FICHAS) {
      assert.strictEqual(pieza.telefonoDe(f), app.telefonoDe(f), JSON.stringify(f));
      assert.strictEqual(pieza.fotoDe(f), app.fotoDe(f), JSON.stringify(f));
    }
  });

  it('la oferta HONRADA que arma la app dice lo mismo que la tarjeta de la ficha', () => {
    for (const f of FICHAS) {
      const oferta = ofertaDeLaApp(f);
      const t = pieza.tarjetaDelConductor(f);
      for (const k of Object.keys(t)) assert.strictEqual(oferta[k], t[k], k + ' con la ficha ' + JSON.stringify(f));
    }
  });

  it('confirmarConductor usa la pieza (y no la oferta) para cada campo de la tarjeta', () => {
    const codigo = soloCodigo(leer('guajirago/functions/index.js'));
    assert.match(codigo, /require\(['"]\.\/conductorDeLaFicha\.cjs['"]\)/);
    assert.ok(!/conductor(Nombre|Telefono|Placa|Vehiculo|Foto|Color)\s*:\s*of\./.test(codigo),
      'confirmarConductor vuelve a copiar la tarjeta de la oferta');
  });
});

describe('P03 · confirmarConductor EJECUTADO: la tarjeta sale de la ficha', () => {
  it('oferta honrada: los seis iguales; mentirosa: los seis de la ficha; ficha vieja: lo que falta, vacío', async () => {
    const r = await M.medirCodigo(null);
    const de = (i) => M.TARJETA.map((c) => r[i].origen[c].de);
    for (const x of r) assert.deepStrictEqual(x.respuesta, { ok: true }, x.caso);
    assert.deepStrictEqual(de(0), M.TARJETA.map(() => 'igual'), 'la oferta honrada no deja el viaje igual');
    assert.deepStrictEqual(de(1), M.TARJETA.map(() => 'ficha'), 'la oferta mentirosa se coló en el viaje');
    assert.strictEqual(r[2].viaje.conductorFoto, null);
    assert.strictEqual(r[2].viaje.conductorColor, '');
    assert.strictEqual(r[2].viaje.conductorPlaca, 'ABC123');
  });

  it('careo con el código de antes: con oferta honrada el viaje es IDÉNTICO', async () => {
    const caso = M.CASOS[0];
    const antes = await M.correrCaso(caso, ANTES);
    const ahora = await M.correrCaso(caso, null);
    const sinHora = (v) => { const { fechaAceptacion, ...resto } = v; return resto; };
    assert.deepStrictEqual(sinHora(ahora.viaje), sinHora(antes.viaje));
  });

  it('el medidor no se puede ablandar: con el código de antes ve la mentira copiada', async () => {
    const r = await M.medirCodigo(ANTES);
    assert.deepStrictEqual(M.TARJETA.map((c) => r[1].origen[c].de), M.TARJETA.map(() => 'oferta'));
  });
});

describe('P03 · el medidor de producción ve las diferencias', () => {
  it('cuenta el viaje con otra placa, la ficha a la que le falta un dato y la oferta que no cuadra', () => {
    const ficha = { id: 'C1', tipo: 'conductor', ...FICHAS[0] };
    const bueno = { id: 'V1', estado: 'finalizado', conductorId: 'C1', ...pieza.tarjetaDelConductor(ficha) };
    const malo = { ...bueno, id: 'V2', estado: 'aceptado', conductorPlaca: 'XYZ999' };
    const d = M.revisarDatos({
      viajes: [bueno, malo, { id: 'V3', estado: 'esperando' }],
      usuarios: [ficha, { id: 'C2', tipo: 'conductor', nombre: 'SIN COLOR', placa: 'AAA111' }],
      ofertas: [{ conductorId: 'C1', ...pieza.tarjetaDelConductor(ficha), conductorNombre: 'OTRO' }],
    });
    assert.strictEqual(d.conConductor.length, 2);
    assert.deepStrictEqual(d.difieren.map((x) => [x.id, x.campos]), [['V2', ['conductorPlaca']]]);
    assert.strictEqual(d.faltan.color, 1);
    assert.strictEqual(d.faltan.foto, 1);
    assert.strictEqual(d.ofertasQueNoCuadran.length, 1);
  });
});
