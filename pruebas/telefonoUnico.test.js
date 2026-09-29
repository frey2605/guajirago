/**
 * G42 · ¿QUÉ ES UN TELÉFONO VÁLIDO, Y CÓMO SE GUARDA? — una sola regla y un solo formato (28-sep-2026)
 *
 * Antes cada formulario decidía a su manera («no vacío», «10 después de quitar lo que no es cifra», «+57» delante)
 * y se guardaba en 5 formas. El servidor (`celularDisponible`, el que protege el crédito de bienvenida) comparaba
 * letra por letra, así que «300 123 4567» y «3001234567» eran «distintos».
 *
 * Esta prueba EJECUTA, sacado de cada archivo:
 *   1. la copia del servidor (functions/telefonoValido.cjs) contra la de la app, con los mismos textos;
 *   2. `celularDisponible` de functions/index.js con fichas de mentira (el mismo número escrito distinto);
 *   3. CADA formulario que guarda un teléfono, en las tres apps: con un número bueno escrito de cualquier manera
 *      guarda las 10 cifras limpias; con uno que no sirve no guarda nada;
 *   4. la máscara de los campos (`cifrasMientrasEscribe`): pegar «+57 300 123 4567» deja el número, no «5730012345»;
 *   5. y que nadie vuelva a escribir la regla a mano (`'+57' +`, `.length === 10`, `.slice(-10)`).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, cargarDeLaApp, cuerpoDeLaFuncion, soloCodigo, sinTextos } = require('./cargar.cjs');
const { celularDisponibleDe, CASOS } = require('../scripts/medir-telefono-guardado.cjs');

const APP = cargarDeLaApp('guajirago/src/telefonoValido.js');
const PANEL = cargarDeLaApp('guajirago-admin/src/telefonoValido.js');
const ALIADOS = cargarDeLaApp('guajirago-aliados/src/telefonoValido.js');
const SERVIDOR = require('../guajirago/functions/telefonoValido.cjs');

const MUESTRAS = ['3001234567', '300 123 4567', '300-123-4567', '(300) 123.4567', '+57 3001234567', '+573001234567',
  '57 300 123 4567', '  3001234567  ', '5712345678', '', '   ', 'abc', '1', '300 123 45', '30012345678',
  '+1 3001234567', '573001234', '300123456x', '++573001234567', 'quien@correo.co', null, undefined];

// Saca `const <nombre> = …` (o lo que empiece en `desde`) del archivo y lo corre con un ámbito de mentira. Lo que
// no se le dé revienta —así no se inventa nada—, salvo los `setX` de React, que no hacen nada.
function laFuncion(archivo, nombre) {
  const codigo = leer(archivo);
  const marca = 'const ' + nombre + ' = ';
  const desde = codigo.indexOf(marca);
  assert.ok(desde >= 0, 'no está `' + marca + '` en ' + archivo);
  assert.strictEqual(codigo.indexOf(marca, desde + 1), -1, 'hay DOS `' + marca + '` en ' + archivo);
  const cuerpo = cuerpoDeLaFuncion(codigo, desde);
  assert.ok(cuerpo, 'no pude sacar el cuerpo de ' + nombre);
  // eslint-disable-next-line no-new-func
  const f = new Function('ambito', 'with (ambito) { return (async () => {' + cuerpo.texto + '\n})(); }');
  return (dados) => f(new Proxy(dados, {
    has: (d, k) => typeof k === 'string' && ((k in d) || /^set[A-Z]/.test(k) || !(k in globalThis)),
    get: (d, k) => {
      if (k in d) return d[k];
      if (typeof k !== 'string') return undefined;
      if (/^set[A-Z]/.test(k)) return () => {};
      if (k in globalThis) return globalThis[k];
      throw new Error(archivo + ' · ' + nombre + ' usa «' + k + '» y la prueba no se lo dio');
    },
  }));
}

// Lo que se escribe en la base, apuntado.
function base() {
  const escritos = [];
  return {
    escritos,
    db: {}, storage: {},
    doc: (...a) => a.slice(1).join('/'),
    collection: (_db, c) => c,
    setDoc: async (ref, datos) => { escritos.push({ ref, datos }); },
    updateDoc: async (ref, datos) => { escritos.push({ ref, datos }); },
    addDoc: async (ref, datos) => { escritos.push({ ref, datos }); return { id: 'nuevo12345' }; },
  };
}

describe('G42 · la copia del servidor dice lo mismo que la app', () => {
  it('functions/telefonoValido.cjs · celularDiezCifras da lo mismo que la app con ' + MUESTRAS.length + ' textos', () => {
    for (const m of MUESTRAS) assert.strictEqual(SERVIDOR.celularDiezCifras(m), APP.celularDiezCifras(m), 'se separan con «' + m + '»');
  });
  it('panel y aliados (copias byte a byte, atadas en numeroWhatsApp.test.js) también dan lo mismo, incluida la máscara', () => {
    for (const m of MUESTRAS) {
      for (const otra of [PANEL, ALIADOS]) {
        assert.strictEqual(otra.celularDiezCifras(m), APP.celularDiezCifras(m));
        assert.strictEqual(otra.cifrasMientrasEscribe(m), APP.cifrasMientrasEscribe(m));
      }
    }
  });
  it('formasGuardadas: todas son el MISMO número, caben en un «in» (máx. 30) y traen las formas medidas', () => {
    const formas = SERVIDOR.formasGuardadas('300 123 4567');
    assert.ok(formas.length > 1 && formas.length <= 30, 'formas: ' + formas.length);
    for (const f of formas) assert.strictEqual(APP.celularDiezCifras(f), '3001234567', '«' + f + '» no es el mismo número');
    for (const medida of ['3001234567', '300 123 4567', '+573001234567', '+57 3001234567', '573001234567'])
      assert.ok(formas.includes(medida), 'falta la forma «' + medida + '»');
    assert.deepStrictEqual(SERVIDOR.formasGuardadas('abc'), []);
  });
  it('index.js carga la copia del servidor (y no otra)', () => {
    const codigo = soloCodigo(leer('guajirago/functions/index.js'));
    assert.match(codigo, /const \{ celularDiezCifras, formasGuardadas \} = require\('\.\/telefonoValido\.cjs'\);/);
  });
});

describe('G42 · celularDisponible compara por las 10 cifras (corrido, sacado de index.js)', () => {
  const correr = celularDisponibleDe(leer('guajirago/functions/index.js'));
  for (const [nombre, fichas, celular, bueno] of CASOS) {
    it(nombre + ' → ' + bueno, async () => {
      assert.strictEqual(await correr(fichas, celular), bueno);
    });
  }
  it('un celular que no sirve se rechaza (no se busca «abc» en la base)', async () => {
    assert.match(await correr([], 'abc'), /^rechaza \(invalid-argument\)/);
  });
});

describe('G42 · cada formulario guarda las 10 cifras limpias, y no guarda lo que no sirve', () => {
  it('app · registro (Login.js `registrarse`): celular y contacto en 10 cifras; al servidor le pregunta por las 10', async () => {
    const registrarse = laFuncion('guajirago/src/Login.js', 'registrarse');
    const armar = (celular, r) => ({
      ...APP, ...r.b,
      nombre: 'Ana', email: 'a@b.co', emailConfirm: 'a@b.co', celular, diaNac: '1', mesNac: '2', anioNac: '1990',
      password: 'secreta1', passwordConfirm: 'secreta1', contactoNombre: 'Mamá', contactoNumero: '+57 311 222 3344',
      aceptaTerminos: true, setError: (t) => { r.error = t; },
      auth: { signOut: async () => {} },
      createUserWithEmailAndPassword: async () => { r.creo = true; return { user: { uid: 'u1', delete: async () => {} } }; },
      getFunctions: () => ({}),
      httpsCallable: (_f, que) => async (datos) => { r.llamadas.push([que, datos]); return { data: { disponible: true, valor: 0 } }; },
      sendEmailVerification: async () => {}, obtenerIP: async () => '', obtenerDeviceId: () => 'aparato',
      onEntrar: (...a) => { r.entro = a; },
    });
    const bien = { b: base(), llamadas: [] };
    await registrarse(armar('300 123 4567', bien));
    assert.deepStrictEqual(bien.llamadas[0], ['celularDisponible', { celular: '3001234567' }]);
    const ficha = bien.b.escritos.find((e) => e.ref === 'usuarios/u1').datos;
    assert.strictEqual(ficha.celular, '3001234567');
    assert.strictEqual(ficha.contactoConfianzaNumero, '3112223344');
    assert.strictEqual(bien.entro[2], '3001234567', 'a la app le entrega el número limpio');
    for (const malo of ['1', 'abc', '300 123 45']) {
      const r = { b: base(), llamadas: [] };
      await registrarse(armar(malo, r));
      assert.strictEqual(r.creo, undefined, 'el registro creó la cuenta con el celular «' + malo + '»');
      assert.match(r.error || '', /10 cifras/);
    }
  });

  it('app · Mi perfil (MiPerfil.js `guardar`)', async () => {
    const guardar = laFuncion('guajirago/src/MiPerfil.js', 'guardar');
    const correr = async (telefono) => {
      const r = { b: base() };
      await guardar({ ...APP, ...r.b, nombre: 'Ana', telefono, fotoNueva: null, foto: null, auth: { currentUser: { uid: 'u1' } },
        setError: (t) => { r.error = t; } });
      return r;
    };
    assert.strictEqual((await correr('+57 300 123 4567')).b.escritos[0].datos.telefono, '3001234567');
    for (const malo of ['1', 'abc']) {
      const r = await correr(malo);
      assert.strictEqual(r.b.escritos.length, 0, 'Mi perfil guardó «' + malo + '»');
      assert.match(r.error || '', /10 cifras/);
    }
  });

  it('app · alta del conductor (App.js `guardar` de PantallaDatosConductor)', async () => {
    const guardar = laFuncion('guajirago/src/App.js', 'guardar');
    const correr = async (telefono) => {
      const r = { b: base() };
      // G45: el alta decide la placa y arma el vehículo con vehiculoConductor.js; se le da tal cual.
      await guardar({ ...APP, ...cargarDeLaApp('guajirago/src/vehiculoConductor.js'), ...r.b, tipoVehiculo: 'carro', telefono, placa: 'ABC123', marca: 'Kia', marcaOtra: '', modelo: '2020',
        color: 'Rojo', documento: '123', fotoConductor: {}, fotosDocs: {}, documentoQueFalta: () => null, nombreDelDocumento: () => '',
        DOCUMENTOS_CONDUCTOR: [], auth: { currentUser: { uid: 'c1' } }, subirFoto: async () => 'url',
        getFunctions: () => ({}), httpsCallable: () => async () => ({ data: { creditos: 0 } }),
        onGuardar: (...a) => { r.entrego = a; }, setError: (t) => { r.error = t; } });
      return r;
    };
    const bien = await correr('300-123-4567');
    assert.strictEqual(bien.b.escritos[0].datos.telefono, '3001234567');
    assert.strictEqual(bien.entrego[2], '3001234567');
    const mal = await correr('1');
    assert.strictEqual(mal.b.escritos.length, 0, 'el alta guardó el teléfono «1»');
    assert.match(mal.error || '', /10 cifras/);
  });

  it('app · pedido a domicilio (Restaurantes.js `enviarPedido`)', async () => {
    const enviar = laFuncion('guajirago/src/Restaurantes.js', 'enviarPedido');
    const correr = async (telefono) => {
      const r = { b: base() };
      await enviar({ ...APP, ...r.b, carrito: [{ precio: 1000, cantidad: 1 }], direccion: 'Calle 1', telefono, metodoPago: 'efectivo',
        correr: async (fn) => fn(), restauranteActivo: { id: 'r1', nombre: 'R', promociones: [] }, auth: { currentUser: { uid: 'u1' } },
        nombre: 'Ana', totalCarrito: 1000, serverTimestamp: () => 'ahora', prepararTokenDeAvisos: () => () => {},
        guardarMiPedidoId: () => {}, usosPromo: {} });
      return r;
    };
    assert.strictEqual((await correr('300 123 4567')).b.escritos.find((e) => e.ref === 'pedidos').datos.telefono, '3001234567');
    for (const malo of ['1', 'abc', '']) assert.strictEqual((await correr(malo)).b.escritos.length, 0, 'se guardó un pedido con «' + malo + '»');
  });

  it('app · reserva de tour (Turismo.js `enviarReserva`): antes «+57…», ahora 10 cifras', async () => {
    const enviar = laFuncion('guajirago/src/Turismo.js', 'enviarReserva');
    const correr = async (telefono) => {
      const r = { b: base() };
      await enviar({ ...APP, ...r.b, fecha: '2026-10-01', cliente: 'Ana', telefono, personas: '1', notas: '', auth: { currentUser: { uid: 'u1' } },
        agenciaActiva: { id: 'a1', nombre: 'A' }, tourReserva: { id: 't1', nombre: 'T', precio: 1, unidadPrecio: 'persona' },
        totalReserva: () => 1, prepararTokenDeAvisos: () => () => {}, guardarReserva: () => {}, setAviso: (t) => { r.aviso = t; } });
      return r;
    };
    assert.strictEqual((await correr('+57 300 123 4567')).b.escritos[0].datos.telefono, '3001234567');
    const mal = await correr('abc');
    assert.strictEqual(mal.b.escritos.length, 0);
    assert.match(String(mal.aviso), /10 n[uú]meros/);
  });

  it('app · mandado (Solicitar.js `solicitarViaje`): la regla decide si falta el teléfono de quien recibe', async () => {
    const solicitar = laFuncion('guajirago/src/Solicitar.js', 'solicitarViaje');
    const correr = async (recibeTel) => {
      const r = {};
      await solicitar({ ...APP, esMensajeria: true, origen: '', destino: '', queEnvia: '', recibeNombre: '', recibeTel, notaEnvio: '',
        setAviso: (a) => { r.aviso = a; } });
      return r.aviso.texto;
    };
    assert.match(await correr('1'), /Teléfono de quien recibe/);
    assert.doesNotMatch(await correr('3001234567'), /Teléfono de quien recibe/);
    // Y lo que se guarda en el viaje sale de la regla (el resto de solicitarViaje necesita el mapa: aquí se lee).
    assert.match(soloCodigo(leer('guajirago/src/Solicitar.js')), /recibeTel: celularDiezCifras\(recibeTel\),/);
  });

  it('aliados · registro (Login.js `validarRegistro` y `registrar`): antes «+57…», ahora 10 cifras', async () => {
    const validar = laFuncion('guajirago-aliados/src/Login.js', 'validarRegistro');
    const datos = (telefono) => ({ ...ALIADOS, nombreRestaurante: 'R', nombreDueno: 'D', telefono, correo: 'a@b.co', confirmarCorreo: 'a@b.co',
      clave: 'secreta1', confirmarClave: 'secreta1', tipoNegocio: 'restaurante' });
    assert.strictEqual(await validar(datos('3001234567')), '');
    assert.match(await validar(datos('300123')), /10 numeros/);
    const registrar = laFuncion('guajirago-aliados/src/Login.js', 'registrar');
    const b = base();
    await registrar({ ...datos('300 123 4567'), ...b, validarRegistro: () => '', auth: {},
      createUserWithEmailAndPassword: async () => ({ user: { uid: 'n1' } }), sinLoPrivado: (d) => d, soloLoPrivado: (d) => d,
      COLECCION_PRIVADA: 'negociosPrivado', onEntrar: () => {} });
    assert.strictEqual(b.escritos.find((e) => e.ref === 'negociosPrivado/n1').datos.duenoTelefono, '3001234567');
  });

  it('aliados · perfil de la agencia (PerfilAgencia.js `guardar`): antes «+57…», ahora 10 cifras', async () => {
    const guardar = laFuncion('guajirago-aliados/src/PerfilAgencia.js', 'guardar');
    const correr = async (telefono) => {
      const r = { b: base() };
      await guardar({ ...ALIADOS, ...r.b, logo: 'x', descripcion: 'd', direccion: 'd', telefono, categorias: ['tour'], restauranteId: 'r1',
        ubicacion: null, horarioApertura: '8', horarioCierre: '18', esEdicion: true, onCompleto: () => {}, setError: (t) => { r.error = t; } });
      return r;
    };
    assert.strictEqual((await correr('+57 300 123 4567')).b.escritos[0].datos.telefono, '3001234567');
    assert.strictEqual((await correr('300123')).b.escritos.length, 0);
  });

  it('panel · editar conductor (Conductores.js `guardarEdicion`)', async () => {
    const guardar = laFuncion('guajirago-admin/src/Conductores.js', 'guardarEdicion');
    const { telefonoDe } = cargarDeLaApp('guajirago-admin/src/telefonoUsuario.js');
    const correr = async (datosEdit) => {
      const r = { b: base() };
      await guardar({ ...PANEL, ...r.b, telefonoDe, seleccionado: { id: 'c1' }, datosEdit, cargarTodo: () => {},
        setAviso: (a) => { r.aviso = a; } });
      return r;
    };
    assert.strictEqual((await correr({ telefono: '300 123 4567' })).b.escritos[0].datos.telefono, '3001234567');
    const mal = await correr({ telefono: '1' });
    assert.strictEqual(mal.b.escritos.length, 0, 'el panel guardó el teléfono «1»');
    assert.match(mal.aviso.texto, /10 cifras/);
    assert.deepStrictEqual((await correr({ nombre: 'PEDRO' })).b.escritos[0].datos, { nombre: 'PEDRO' }, 'sin teléfono, se guarda como antes');
  });
});

describe('G42 · la máscara de los campos no cambia el número al pegarlo', () => {
  it('cifrasMientrasEscribe', () => {
    assert.strictEqual(APP.cifrasMientrasEscribe('+57 300 123 4567'), '3001234567', 'antes quedaba «5730012345»');
    assert.strictEqual(APP.cifrasMientrasEscribe('300 123 4567'), '3001234567');
    assert.strictEqual(APP.cifrasMientrasEscribe('300a'), '300');
    assert.strictEqual(APP.cifrasMientrasEscribe('30012345678'), '3001234567');
    // Tecleando «573001234567» cifra a cifra, al llegar a 11 suelta el 57 y termina en el número.
    let campo = '';
    for (const c of '573001234567') campo = APP.cifrasMientrasEscribe(campo + c);
    assert.strictEqual(campo, '3001234567');
  });
});

describe('G42 · nadie vuelve a escribir la regla del teléfono a mano', () => {
  const fs = require('fs');
  const path = require('path');
  const { RAIZ } = require('./cargar.cjs');
  const archivos = ['guajirago/src', 'guajirago-admin/src', 'guajirago-aliados/src'].flatMap((c) =>
    fs.readdirSync(path.join(RAIZ, c)).filter((f) => f.endsWith('.js') && !f.endsWith('.test.js') && f !== 'telefonoValido.js')
      .map((f) => c + '/' + f));
  const A_MANO = [
    ['«+57» pegado al guardar', /['"`]\+57['"`]\s*\+/],
    ['«tiene 10» contado a mano', /\.length\s*[!=]==?\s*10\b/],
    ['las 10 últimas cifras', /\.slice\(\s*-10\s*\)/],
    ['la máscara de 10 cifras a mano', /replace\(\/(?:\\D|\[\^0-9\])\/g,\s*''\)\.slice\(0,\s*10\)/],
  ];
  for (const [que, re] of A_MANO) {
    it(que + ': en ningún archivo de las tres apps', () => {
      const donde = archivos.filter((a) => re.test(sinTextos(soloCodigo(leer(a)))) || re.test(soloCodigo(leer(a))));
      assert.deepStrictEqual(donde, [], 'la regla del teléfono está escrita a mano en: ' + donde.join(', ') + ' — usa telefonoValido.js');
    });
  }
});
