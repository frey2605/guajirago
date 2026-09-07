/**
 * EL REPARTO DE UNA MESA — PRUEBAS QUE EJECUTAN EL ARCHIVO REAL
 *
 * La cuenta dividida por persona ya estaba construida, pero VIVÍA EN LA MEMORIA
 * DEL NAVEGADOR y se descartaba al cerrar la mesa. Por eso no se podía pagar una
 * parte y dejar la mesa abierta: si el mesero salía de la pantalla, el reparto se
 * perdía entero.
 *
 * Estas pruebas cargan guajirago-aliados/src/repartoMesa.js TAL CUAL ESTÁ EN EL
 * DISCO y comprueban las tres cosas que, si se rompen, rompen el arreglo entero
 * SIN QUE NADA FALLE A LA VISTA:
 *
 *   1. que lo guardado no lleve `undefined` — Firestore rechaza el documento
 *      ENTERO si una sola propiedad vale undefined, y `metodoPago` nace sin
 *      valor. Sin esta limpieza la primera escritura falla, y falla justo al
 *      empezar a repartir.
 *   2. que ir y volver del servidor no cambie el reparto. Si cambiara, la mesa se
 *      vería distinta cada vez que el mesero entra y sale.
 *   3. que la huella de lo que hay en pantalla y la de lo que vuelve del servidor
 *      sean IGUALES. Es lo único que corta el bucle: la pantalla escucha
 *      `mesasInfo` en tiempo real, así que al guardar el servidor se lo devuelve,
 *      y sin la huella se volvería a guardar sin parar.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
// El cargador vive en cargar.cjs: un solo sitio para todas las pruebas (SEGUNDA LEY).
const { leer, cargarDeLaApp } = require('./cargar.cjs');

const { nombreDeComensal, hayReparto, aGuardar, deLoGuardado, huella } =
  cargarDeLaApp('guajirago-aliados/src/repartoMesa.js');

// Como sale de la pantalla: `metodoPago` empieza en null y no hay `nombre`.
const reciénAbierto = () => [{ items: {}, cerrada: false, metodoPago: null }];
const conReparto = () => [
  { items: { 'Sancocho|18000|': 2 }, cerrada: true, metodoPago: 'Efectivo', nombre: 'Ana' },
  { items: { 'Jugo|6000|sin hielo': 1 }, cerrada: false, metodoPago: null },
];

describe('EL REPARTO · el nombre de cada comensal', () => {
  it('si tiene nombre, se usa el nombre', () => {
    assert.strictEqual(nombreDeComensal({ nombre: 'Ana' }, 0), 'Ana');
  });

  it('si no tiene, se sigue llamando «Comensal N» — el nombre es OPCIONAL', () => {
    // Pedirlo obligatorio convertiría una ayuda en un estorbo en mitad del servicio.
    assert.strictEqual(nombreDeComensal({}, 0), 'Comensal 1');
    assert.strictEqual(nombreDeComensal({ nombre: '' }, 2), 'Comensal 3');
    assert.strictEqual(nombreDeComensal({ nombre: '   ' }, 1), 'Comensal 2');
    assert.strictEqual(nombreDeComensal(null, 4), 'Comensal 5');
  });
});

describe('EL REPARTO · qué se guarda y qué no', () => {
  it('una mesa recién abierta NO se guarda', () => {
    // Sin esto quedaría un documento vacío por cada mesa que alguien abre y
    // cierra sin dividir nada.
    assert.strictEqual(hayReparto(reciénAbierto()), false);
    assert.strictEqual(hayReparto([]), false);
    assert.strictEqual(hayReparto(null), false);
  });

  it('en cuanto hay algo repartido, un nombre o una cuenta cerrada, SÍ se guarda', () => {
    assert.strictEqual(hayReparto(conReparto()), true);
    assert.strictEqual(hayReparto([{ items: {}, cerrada: false, nombre: 'Ana' }]), true);
    assert.strictEqual(hayReparto([{ items: {}, cerrada: true }]), true);
  });

  it('EL QUE MUERDE · lo guardado NO lleva ni un `undefined`', () => {
    // Firestore rechaza el documento ENTERO si una sola propiedad vale undefined.
    // `metodoPago` y `comprobante` nacen sin valor, así que sin la limpieza la
    // PRIMERA escritura falla — y falla justo al empezar a repartir.
    const guardado = aGuardar(conReparto());
    const texto = JSON.stringify(guardado);
    assert.ok(!texto.includes('undefined'), 'hay un undefined dentro: ' + texto);
    for (const c of guardado) {
      for (const [k, v] of Object.entries(c)) {
        assert.notStrictEqual(v, undefined, 'la propiedad ' + k + ' vale undefined');
      }
    }
    // Lo que no tiene valor sencillamente NO VIAJA, en vez de viajar en blanco.
    assert.ok(!('metodoPago' in guardado[1]), 'metodoPago null no debería viajar');
    assert.ok(!('nombre' in guardado[1]), 'un nombre vacío no debería viajar');
  });

  it('no se guardan cantidades imposibles', () => {
    const sucio = [{ items: { a: 2, b: 0, c: -1, d: 'tres' }, cerrada: false, metodoPago: null }];
    assert.deepStrictEqual(aGuardar(sucio)[0].items, { a: 2 });
  });

  it('aguanta que no le den nada', () => {
    assert.deepStrictEqual(aGuardar(null), []);
    assert.deepStrictEqual(aGuardar(undefined), []);
  });
});

describe('EL REPARTO · ir y volver del servidor', () => {
  it('EL QUE MUERDE · ir y volver NO cambia el reparto', () => {
    // Si cambiara, la mesa se vería distinta cada vez que el mesero entra y sale.
    const original = conReparto();
    const ida = aGuardar(original);
    const vuelta = deLoGuardado(ida);
    assert.deepStrictEqual(aGuardar(vuelta), ida);
    assert.strictEqual(huella(vuelta), huella(original));
  });

  it('EL QUE MUERDE · las dos huellas coinciden — es lo que corta el bucle', () => {
    // La pantalla escucha mesasInfo en tiempo real: al guardar, el servidor lo
    // devuelve por esa misma escucha. Si las huellas no coincidieran, se volvería
    // a guardar sin parar, y el mesero no vería nada raro: solo la factura.
    const enPantalla = conReparto();
    const loQueDevuelveElServidor = deLoGuardado(aGuardar(enPantalla));
    assert.strictEqual(huella(loQueDevuelveElServidor), huella(enPantalla));
  });

  it('EL QUE MUERDE · pero dos repartos DISTINTOS tienen huellas distintas', () => {
    // La otra mitad, y sin ella la de arriba no vale: una huella que devolviera
    // siempre lo mismo también haría coincidir las dos, y entonces la pantalla
    // creería que TODO viene del servidor y no guardaría NUNCA. Y no se vería
    // nada raro hasta que alguien saliera de la pantalla y perdiera el reparto.
    const a = conReparto();
    const b = conReparto();
    b[0].items['Sancocho|18000|'] = 3;
    assert.notStrictEqual(huella(a), huella(b), 'la huella no distingue cantidades');

    const c = conReparto();
    c[0].nombre = 'Beto';
    assert.notStrictEqual(huella(a), huella(c), 'la huella no distingue nombres');

    const d = conReparto();
    d[1].cerrada = true;
    assert.notStrictEqual(huella(a), huella(d), 'la huella no distingue cuentas cerradas');

    assert.notStrictEqual(huella(a), huella(reciénAbierto()), 'la huella no distingue una mesa vacía');
  });

  it('de una mesa sin reparto vuelve SIEMPRE un comensal, nunca una lista vacía', () => {
    // La pantalla da por hecho que `cuentas[comensalActual - 1]` existe. Una lista
    // vacía la dejaría en blanco sin decir por qué.
    for (const nada of [undefined, null, [], 'roto']) {
      const vuelta = deLoGuardado(nada);
      assert.strictEqual(vuelta.length, 1);
      assert.deepStrictEqual(vuelta[0].items, {});
      assert.strictEqual(vuelta[0].cerrada, false);
    }
  });

  it('lo que vuelve tiene la forma que la pantalla espera', () => {
    const vuelta = deLoGuardado(aGuardar(conReparto()));
    assert.strictEqual(vuelta[0].nombre, 'Ana');
    assert.strictEqual(vuelta[0].cerrada, true);
    assert.strictEqual(vuelta[0].metodoPago, 'Efectivo');
    assert.strictEqual(vuelta[1].metodoPago, null, 'sin método, la pantalla espera null');
    assert.strictEqual(vuelta[1].nombre, '', 'sin nombre, la pantalla espera texto vacío');
  });
});

describe('EL REPARTO · la pantalla lo USA de verdad', () => {
  // Sin esto, alguien podría volver a dejar el reparto en la memoria y todo lo de
  // arriba seguiría verde.
  const fuente = () => leer('guajirago-aliados/src/Mesero.js');

  it('Mesero.js importa repartoMesa.js', () => {
    assert.ok(/from '\.\/repartoMesa'/.test(fuente()),
      'Mesero.js no importa repartoMesa.js: el reparto volvió a vivir suelto.');
  });

  it('EL QUE MUERDE · el reparto se GUARDA en mesasInfo mientras la mesa está abierta', () => {
    // OJO A LA PRECISIÓN DE ESTA PRUEBA, que la primera versión no tenía y lo cazó
    // la cacería de mutantes: decía solo `/reparto: aGuardar\(cuentas\)/`, y ese
    // mismo texto aparece TAMBIÉN en el cierre de la mesa. Así que se podía quitar
    // el guardado de mientras —el arreglo entero— y la prueba seguía verde.
    //
    // Por eso ahora se exige que el `reparto: aGuardar(cuentas)` esté PEGADO a un
    // `mesasInfo`: eso solo lo cumple el guardado de mientras. Es la diferencia
    // entre comprobar que la palabra aparece y comprobar que hace su trabajo.
    const f = fuente();
    assert.ok(/mesasInfo[\s\S]{0,120}reparto: aGuardar\(cuentas\)/.test(f),
      'Mesero.js ya no guarda el reparto EN mesasInfo mientras la mesa está abierta. ' +
      'Vuelve a vivir solo en la memoria del navegador, y se pierde en cuanto el ' +
      'mesero sale de la pantalla — que es justo el fallo que esto arregla.');
    assert.ok(f.includes('deLoGuardado(d.reparto)'),
      'Mesero.js ya no LEE el reparto al abrir la mesa. Se guardaría y no se vería.');
  });

  it('EL QUE MUERDE · y queda en el historial al cerrar', () => {
    // Decisión del dueño: al cerrar, quién comió qué se queda para siempre.
    const f = fuente();
    assert.ok(/hayReparto\(cuentas\)[\s\S]{0,40}reparto: aGuardar\(cuentas\)/.test(f),
      'al cerrar la mesa ya no se copia el reparto al pedido: se pierde quién comió qué.');
  });

  it('la mesa se vacía al cerrarse, para que la siguiente gente no herede la cuenta', () => {
    assert.ok(/comensales: 0, reparto: \[\]/.test(fuente()),
      'al cerrar no se vacía el reparto de mesasInfo: los siguientes que se sienten ' +
      'heredarían la cuenta de los anteriores.');
  });
});
