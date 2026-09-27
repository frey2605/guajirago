// ═══════════════════════════════════════════════════════════════════════════
//  LOS DOCUMENTOS DEL CONDUCTOR · 27-sep-2026
//
//  Decisión del dueño: el conductor sube sus fotos al registrarse (cédula, tarjeta de
//  propiedad y el vehículo por cada costado, de frente y por detrás) y trabaja de una
//  vez, sin esperar aprobación. El dueño las revisa en el panel cuando pueda.
//
//  Se prueba EJECUTANDO la lista (guajirago/src/documentosConductor.js), su copia del
//  panel atada byte a byte, y el medidor con fichas de mentira. Y por FORMA, porque es
//  JSX: que el registro no deje entrar sin las fotos y suba TODAS con el nombre que el
//  panel lee, y que el panel las enseñe desde la misma lista.
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, cargarDeLaApp, soloCodigo } = require('./cargar.cjs');
const { contar } = require('../scripts/medir-documentos-conductor.cjs');

const D = cargarDeLaApp('guajirago/src/documentosConductor.js');
const todas = () => Object.fromEntries(D.DOCUMENTOS_CONDUCTOR.map((d) => [d.campo, 'x.jpg']));

describe('LOS DOCUMENTOS DEL CONDUCTOR · la lista', () => {
  it('son los seis que pidió el dueño (sin licencia de conducción), cada uno con su campo y su carpeta, sin repetir', () => {
    const campos = D.DOCUMENTOS_CONDUCTOR.map((d) => d.campo);
    assert.deepStrictEqual(campos, ['fotoCedula', 'fotoTarjetaPropiedad',
      'fotoVehiculoIzquierdo', 'fotoVehiculoDerecho', 'fotoVehiculoFrente', 'fotoVehiculoAtras']);
    assert.strictEqual(new Set(D.DOCUMENTOS_CONDUCTOR.map((d) => d.carpeta)).size, 6, '⛔ dos documentos irían al mismo archivo');
  });

  it('la cédula conserva su campo y su carpeta de siempre: los 7 conductores que ya la subieron no la pierden', () => {
    assert.deepStrictEqual([D.DOCUMENTOS_CONDUCTOR[0].campo, D.DOCUMENTOS_CONDUCTOR[0].carpeta], ['fotoCedula', 'cedula']);
  });

  it('dice cuál falta, en orden, y nada cuando están todas', () => {
    assert.strictEqual(D.documentoQueFalta({}).campo, 'fotoCedula');
    assert.strictEqual(D.documentoQueFalta(undefined).campo, 'fotoCedula');
    const f = todas(); delete f.fotoVehiculoAtras;
    assert.strictEqual(D.documentoQueFalta(f).campo, 'fotoVehiculoAtras');
    assert.strictEqual(D.documentoQueFalta(todas()), null);
  });

  it('al mototaxi no se le pide la placa en la foto de frente (las motos solo la llevan atrás)', () => {
    const frente = D.DOCUMENTOS_CONDUCTOR.find((d) => d.campo === 'fotoVehiculoFrente');
    const atras = D.DOCUMENTOS_CONDUCTOR.find((d) => d.campo === 'fotoVehiculoAtras');
    assert.ok(!/placa/.test(D.nombreDelDocumento(frente, 'Mototaxi')));
    assert.ok(/placa/.test(D.nombreDelDocumento(frente, 'Taxi')));
    assert.ok(/placa/.test(D.nombreDelDocumento(atras, 'Mototaxi')));
  });

  it('al mototaxi se le habla de «moto» y se le enseña la moto; al taxi, igual que antes', () => {
    for (const d of D.DOCUMENTOS_CONDUCTOR) {
      assert.ok(!/veh[ií]culo/i.test(D.nombreDelDocumento(d, 'Mototaxi')), '⛔ al mototaxi le sale «vehículo» en: ' + D.nombreDelDocumento(d, 'Mototaxi'));
      assert.notStrictEqual(D.iconoDelDocumento(d, 'Mototaxi'), '🚘', '⛔ al mototaxi le sale un carro en: ' + d.nombre);
      assert.strictEqual(D.nombreDelDocumento(d, 'Taxi'), d.nombre, 'al taxi no le cambia nada');
      assert.strictEqual(D.iconoDelDocumento(d, 'Taxi'), d.icono, 'al taxi no le cambia nada');
    }
    assert.strictEqual(D.iconoDelVehiculo('Mototaxi'), '🏍️');
    assert.strictEqual(D.iconoDelVehiculo('Taxi'), '🚗');
    assert.strictEqual(D.iconoDelVehiculo(''), '🚗', 'antes de escoger vehículo se ve el carro, como antes');
  });

  it('el panel lleva la MISMA lista, byte a byte', () => {
    assert.strictEqual(leer('guajirago-admin/src/documentosConductor.js'), leer('guajirago/src/documentosConductor.js'),
      '⛔ la lista del panel se separó de la del registro: el panel enseñaría huecos');
  });
});

describe('LOS DOCUMENTOS DEL CONDUCTOR · el registro y el panel', () => {
  const app = soloCodigo(leer('guajirago/src/App.js'));
  const i = app.indexOf('function PantallaDatosConductor');
  const reg = app.slice(i, app.indexOf('function PantallaMantenimiento', i));

  it('el registro no deja seguir sin las fotos, y lo mira ANTES de subir nada', () => {
    const iFalta = reg.indexOf('documentoQueFalta(fotosDocs)');
    const iSubir = reg.indexOf('subirFoto(fotosDocs[d.campo]');
    assert.ok(i >= 0 && iFalta > 0, '⛔ el registro ya no pregunta qué documento falta');
    assert.match(reg.slice(iFalta, iFalta + 200), /if\s*\(falta\)\s*\{[^}]*return;\s*\}/, '⛔ si falta un documento, el registro tiene que pararse');
    assert.ok(iSubir > iFalta, '⛔ las fotos se suben DESPUÉS de comprobar que están todas');
  });

  it('sube TODAS las de la lista, cada una a su carpeta, y guarda cada dirección en su campo', () => {
    assert.match(reg, /for\s*\(\s*const\s+d\s+of\s+DOCUMENTOS_CONDUCTOR\s*\)\s*urlsDocs\[d\.campo\]\s*=\s*await\s+subirFoto\(fotosDocs\[d\.campo\],\s*d\.carpeta,\s*user\.uid\)/);
    assert.match(reg, /setDoc\(doc\(db,\s*'usuarios',\s*user\.uid\),\s*\{[^}]*\.\.\.urlsDocs,/, '⛔ las direcciones de las fotos no se guardan en la ficha');
  });

  it('el formulario enseña el dibujo del vehículo escogido, en la cabecera y en cada foto', () => {
    assert.match(reg, /fontSize:\s*'48px'\s*\}\}>\{iconoDelVehiculo\(tipoVehiculo\)\}<\/span>/, '⛔ la cabecera del formulario tiene el carro fijo');
    assert.match(reg, /\{iconoDelDocumento\(d,\s*tipoVehiculo\)\}/, '⛔ las fotos no enseñan el dibujo del vehículo escogido');
  });

  it('la marca y el color escogidos se ven: texto oscuro, no blanco sobre el fondo blanco (27-sep-2026)', () => {
    const marca = reg.match(/<span style=\{\{ color: marca \? '([^']+)'/);
    assert.ok(marca, 'no encuentro la casilla de la marca');
    assert.strictEqual(marca[1], '#1A1A1E', '⛔ la marca escogida se pinta en ' + marca[1] + ' sobre fondo blanco: no se ve');
    assert.match(reg, /<span style=\{\{ color: '#1A1A1E', fontSize: '16px' \}\}>\{color\}<\/span>/, 'el color escogido tiene que seguir viéndose');
  });

  it('pinta un campo de foto por cada documento de la lista', () => {
    assert.match(reg, /DOCUMENTOS_CONDUCTOR\.map\(\(d,\s*i\)\s*=>\s*\(\s*<label key=\{d\.campo\}/);
    assert.match(reg, /setFotosDocs\(prev\s*=>\s*\(\{\s*\.\.\.prev,\s*\[d\.campo\]:\s*f\s*\}\)\)/);
    assert.ok(!/setFotoCedula|urlFotoCedula/.test(reg), '⛔ quedó el camino viejo de la cédula al lado del nuevo');
  });

  it('el panel enseña cada documento de la lista, y dice «Falta» cuando no está', () => {
    const t = soloCodigo(leer('guajirago-admin/src/Conductores.js'));
    assert.match(t, /import\s*\{\s*DOCUMENTOS_CONDUCTOR,\s*nombreDelDocumento\s*\}\s*from\s*'\.\/documentosConductor'/);
    assert.match(t, /DOCUMENTOS_CONDUCTOR\.map\(d\s*=>[\s\S]{0,200}c\[d\.campo\]\s*\?[\s\S]{0,900}Falta/);
  });
});

describe('LOS DOCUMENTOS DEL CONDUCTOR · el medidor', () => {
  it('cuenta solo conductores, documento por documento, y los completos', () => {
    const r = contar([
      { tipo: 'conductor', ...todas() },
      { tipo: 'conductor', fotoCedula: 'x' },
      { tipo: 'pasajero', ...todas() },
    ]);
    assert.strictEqual(r.conductores, 2);
    assert.strictEqual(r.completos, 1);
    assert.strictEqual(r.porDocumento.find((d) => d.campo === 'fotoCedula').tienen, 2);
    assert.strictEqual(r.porDocumento.find((d) => d.campo === 'fotoVehiculoIzquierdo').tienen, 1);
  });
});
