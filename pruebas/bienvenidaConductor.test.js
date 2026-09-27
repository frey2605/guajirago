// ═══════════════════════════════════════════════════════════════════════════
//  EL BOTÓN DE LA BIENVENIDA DEL CONDUCTOR SE VE · 27-sep-2026
//
//  Lo encontró el robot probador en su primera visita de usuario: al terminar el registro, el
//  conductor ve «¡Bienvenido, conductor!» y un botón «¡A rodar!» BLANCO sobre fondo BLANCO — no
//  sabe dónde tocar para seguir. Venía del tema oscuro de antes del 4-jul-2026. La bienvenida del
//  pasajero (Login.js) es su gemela y ya tenía el degradado cálido con letra blanca.
//
//  Se prueba por FORMA (es JSX): el botón de cada bienvenida no es blanco, lleva el degradado de
//  los botones principales y los dos gemelos se ven igual. Las dos pantallas siguen siendo dos
//  (gemelo anotado como deuda, no unificado aquí).
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, soloCodigo } = require('./cargar.cjs');

const DEGRADADO = "linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)";

/** El `style` del botón que llama a onContinuar dentro de la función `nombre` del archivo. */
function estiloDelBoton(archivo, nombre) {
  const t = soloCodigo(leer(archivo));
  const i = t.indexOf('function ' + nombre);
  assert.ok(i >= 0, 'no encuentro ' + nombre + ' en ' + archivo);
  const fin = t.indexOf('\nfunction ', i + 10);
  const cuerpo = t.slice(i, fin < 0 ? undefined : fin);
  const m = cuerpo.match(/<button onClick=\{onContinuar\} style=\{\{([^}]*)\}\}/);
  assert.ok(m, 'no encuentro el botón de continuar en ' + nombre);
  const valor = (k) => (m[1].match(new RegExp('\\b' + k + ":\\s*'([^']*)'")) || [])[1];
  return { background: valor('background'), color: valor('color') };
}

describe('LA BIENVENIDA · el botón para seguir se ve', () => {
  const conductor = estiloDelBoton('guajirago/src/App.js', 'CelebracionBienvenidaConductor');

  it('el del conductor lleva el degradado cálido, con letra blanca, y no es blanco', () => {
    assert.strictEqual(conductor.background, DEGRADADO, '⛔ el botón «¡A rodar!» no lleva el degradado de los botones principales');
    assert.notStrictEqual(conductor.background.toUpperCase(), '#FFFFFF', '⛔ botón blanco sobre fondo blanco: no se ve');
    assert.strictEqual(conductor.color, '#FFFFFF');
  });

  it('enseña el dibujo del vehículo del conductor (al mototaxi, la moto), y la app se lo pasa', () => {
    const t = soloCodigo(leer('guajirago/src/App.js'));
    const i = t.indexOf('function CelebracionBienvenidaConductor');
    const cuerpo = t.slice(i, t.indexOf('\nfunction ', i + 10));
    assert.match(cuerpo, /function CelebracionBienvenidaConductor\(\{[^}]*\btipoVehiculo\b[^}]*\}\)/);
    assert.match(cuerpo, /\{iconoDelVehiculo\(tipoVehiculo\)\}💰/, '⛔ la bienvenida enseña un carro fijo');
    assert.match(t, /<CelebracionBienvenidaConductor[^>]*tipoVehiculo=\{tipoVehiculoUsuario\}/, '⛔ la app no le pasa el vehículo a la bienvenida');
  });

  it('la tarjeta del bono usa los mismos colores que la del pasajero (título, número y texto)', () => {
    const colores = (archivo, desde) => {
      const t = soloCodigo(leer(archivo));
      const i = desde ? t.indexOf(desde) : 0;
      const j = t.indexOf("background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', borderRadius: '28px'", i);
      assert.ok(j >= 0, 'no encuentro la tarjeta del bono en ' + archivo);
      const tarjeta = t.slice(j, t.indexOf('</div>', j));
      return [...tarjeta.matchAll(/<p style=\{\{ color: '([^']+)'/g)].map((m) => m[1]);
    };
    const pasajero = colores('guajirago/src/Login.js');
    const conductor = colores('guajirago/src/App.js', 'function CelebracionBienvenidaConductor');
    assert.strictEqual(pasajero.length, 3, 'la tarjeta del pasajero tiene título, número y texto');
    assert.deepStrictEqual(conductor, pasajero, '⛔ las dos tarjetas del bono se pintan distinto: ' + JSON.stringify({ conductor, pasajero }));
  });

  it('se ve igual que su gemelo, el del pasajero', () => {
    const t = soloCodigo(leer('guajirago/src/Login.js'));
    const m = t.match(/<button onClick=\{onContinuar\} style=\{\{([^}]*)\}\}/);
    assert.ok(m, 'no encuentro el botón de la bienvenida del pasajero');
    const pas = { background: (m[1].match(/background:\s*'([^']*)'/) || [])[1], color: (m[1].match(/\bcolor:\s*'([^']*)'/) || [])[1] };
    assert.deepStrictEqual(conductor, pas, '⛔ las dos bienvenidas se separaron');
  });
});
