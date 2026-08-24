/**
 * PRUEBAS-CONSTITUCIÓN DE LAS REGLAS DE FIRESTORE
 *
 * Estas pruebas EJECUTAN las reglas reales contra el emulador. No leen el texto
 * del archivo: lo corren. Una prueba que no puede fallar no protege nada.
 *
 * Se corren con:  npm test   (que arranca el emulador y luego esto)
 *
 * REGLA 12 (primera mitad) — el borrado desde el celular queda prohibido.
 * Medido el 23-ago-2026: de las tres apps, SOLO dos sitios borran algo, los dos
 * del panel de admin (Promociones.js:155 y Superadmin.js:541). Por eso prohibir
 * el borrado en los otros 19 bloques no rompe nada.
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');
const PROYECTO = 'demo-guajirago';

let RUT;          // @firebase/rules-unit-testing
let FS;           // firebase/firestore
let entorno;

/** Contexto de un usuario logueado. */
const como = (uid) => entorno.authenticatedContext(uid).firestore();
/** Contexto de alguien sin cuenta. */
const sinCuenta = () => entorno.unauthenticatedContext().firestore();

before(async () => {
  RUT = await import('@firebase/rules-unit-testing');
  FS = await import('firebase/firestore');
  entorno = await RUT.initializeTestEnvironment({
    projectId: PROYECTO,
    firestore: {
      rules: fs.readFileSync(path.join(RAIZ, 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8085,
    },
  });
});

after(async () => {
  if (entorno) await entorno.cleanup();
});

/** Deja la base como la necesitan las pruebas, saltándose las reglas a propósito. */
beforeEach(async () => {
  await entorno.clearFirestore();
  await entorno.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const { doc, setDoc } = FS;

    // Los tres personajes
    await setDoc(doc(db, 'usuarios/pasajero1'), { nombre: 'Ana', rol: '' });
    await setDoc(doc(db, 'usuarios/conductor1'), { nombre: 'Luis', rol: '', tipo: 'conductor' });
    await setDoc(doc(db, 'usuarios/eladmin'), { nombre: 'Admin', rol: 'admin' });
    await setDoc(doc(db, 'usuarios/eljefe'), { nombre: 'Jefe', rol: 'superadmin' });
    // Un conductor castigado: es el que más ganas tiene de tocarse la ficha.
    await setDoc(doc(db, 'usuarios/castigado'), {
      nombre: 'Pedro', rol: '', tipo: 'conductor',
      activo: false,
      sancionHasta: '2026-12-31T00:00:00.000Z',
      sanciones: [{ motivo: 'cobró de más', fecha: '2026-08-01' }],
      creditos: 5000,
    });

    // Lo que se va a intentar borrar
    await setDoc(doc(db, 'viajes/viaje1'), { pasajeroId: 'pasajero1', estado: 'esperando', tarifa: 12000 });
    await setDoc(doc(db, 'viajes/viaje1/contraofertas/conductor1'), { monto: 11000 });
    await setDoc(doc(db, 'viajes/viaje1/mensajes/m1'), { texto: 'voy en camino' });
    await setDoc(doc(db, 'calificaciones/cal1'), { estrellas: 1, deQuien: 'conductor1' });
    await setDoc(doc(db, 'codigos/cod1'), { valor: 50000, usado: false });
    await setDoc(doc(db, 'pedidosRestaurantes/ped1'), { total: 30000 });
    await setDoc(doc(db, 'reservasTurismo/res1'), { total: 200000 });
    await setDoc(doc(db, 'llamadas/lla1'), { de: 'pasajero1' });
    await setDoc(doc(db, 'empleados/emp1'), { restauranteId: 'r1' });
    await setDoc(doc(db, 'promociones/promo1'), { titulo: 'Bienvenida' });
    await setDoc(doc(db, 'anuncios/anun1'), { titulo: 'Aviso' });
  });
});

// ───────────────────────────────────────────────────────────────────────────
// LO QUE ESTE ARREGLO CIERRA — el borrado desde el celular
// ───────────────────────────────────────────────────────────────────────────
// ── SEGUNDA LEY · LO COMPARTIDO SALE DEL MISMO SITIO ────────────────────────
// «La información que se supone deben compartir debe salir de los mismos archivos.»
//
// La lista de estados del MERCADO tiene que decir lo mismo en dos sitios que NO
// pueden compartir un archivo: la app (JavaScript) y firestore.rules (que no es
// JavaScript y no puede importar nada).
//
// Si se separan no salta ningún error: al conductor le sale el mercado VACÍO y
// nadie sabe por qué. Esta prueba es el único amarre posible — y es de verdad:
// se pone roja antes de que nada llegue al servidor.
describe('SEGUNDA LEY · la app y las reglas dicen lo mismo', () => {
  /** Saca la lista de estados de un texto, en el orden en que aparece. */
  const listaDe = (texto, desde) => {
    const trozo = texto.slice(texto.indexOf(desde));
    const entre = trozo.slice(trozo.indexOf('['), trozo.indexOf(']') + 1);
    return entre.replace(/[[\]'"\s]/g, '').split(',').filter(Boolean);
  };

  it('los estados del MERCADO son los mismos en la app y en las reglas', () => {
    const app = fs.readFileSync(path.join(RAIZ, 'guajirago/src/estadosViaje.js'), 'utf8');
    const reglas = fs.readFileSync(path.join(RAIZ, 'firestore.rules'), 'utf8');

    const deLaApp = listaDe(app, 'ESTADOS_MERCADO');
    const deLasReglas = listaDe(reglas, 'function enElMercado()');

    assert.ok(deLaApp.length > 0, 'no se encontró la lista en estadosViaje.js');
    assert.ok(deLasReglas.length > 0, 'no se encontró la lista en enElMercado() de firestore.rules');
    assert.deepStrictEqual(
      [...deLaApp].sort(), [...deLasReglas].sort(),
      'La app pide unos estados y las reglas dejan ver otros.\n' +
      '  app (estadosViaje.js) : ' + deLaApp.join(', ') + '\n' +
      '  reglas (enElMercado)  : ' + deLasReglas.join(', ') + '\n' +
      '  Si se separan, al conductor le sale el mercado VACÍO y sin ningún error.'
    );
  });
});

describe('REGLA 12 · borrar desde el celular queda PROHIBIDO', () => {
  const noSePuedeBorrar = [
    ['un viaje (la prueba legal de que ocurrió)', 'viajes/viaje1'],
    ['una contraoferta de otro conductor', 'viajes/viaje1/contraofertas/conductor1'],
    ['un mensaje del chat del viaje', 'viajes/viaje1/mensajes/m1'],
    ['una calificación mala', 'calificaciones/cal1'],
    ['un código de recarga', 'codigos/cod1'],
    ['un pedido de restaurante', 'pedidosRestaurantes/ped1'],
    ['una reserva de turismo', 'reservasTurismo/res1'],
    ['el registro de una llamada', 'llamadas/lla1'],
    ['un empleado de restaurante', 'empleados/emp1'],
  ];

  for (const [queEs, ruta] of noSePuedeBorrar) {
    it(`un usuario registrado NO puede borrar ${queEs}`, async () => {
      const { doc, deleteDoc } = FS;
      await RUT.assertFails(deleteDoc(doc(como('pasajero1'), ruta)));
    });
  }

  it('un conductor NO puede borrar el viaje que lo delata', async () => {
    const { doc, deleteDoc } = FS;
    await RUT.assertFails(deleteDoc(doc(como('conductor1'), 'viajes/viaje1')));
  });

  it('ni siquiera un ADMIN puede borrar un viaje desde el celular', async () => {
    const { doc, deleteDoc } = FS;
    await RUT.assertFails(deleteDoc(doc(como('eladmin'), 'viajes/viaje1')));
  });

  it('un usuario NO puede borrar su propia ficha (se pierde el rastro)', async () => {
    const { doc, deleteDoc } = FS;
    await RUT.assertFails(deleteDoc(doc(como('pasajero1'), 'usuarios/pasajero1')));
  });

  it('alguien SIN cuenta no puede borrar nada', async () => {
    const { doc, deleteDoc } = FS;
    await RUT.assertFails(deleteDoc(doc(sinCuenta(), 'viajes/viaje1')));
  });
});

// ───────────────────────────────────────────────────────────────────────────
// LO QUE NO SE PUEDE ROMPER — los dos borrados legítimos, medidos en el código
// ───────────────────────────────────────────────────────────────────────────
describe('REGLA 12 · los dos borrados legítimos del panel SIGUEN funcionando', () => {
  it('el admin SÍ puede borrar una promoción (Promociones.js:155)', async () => {
    const { doc, deleteDoc } = FS;
    await RUT.assertSucceeds(deleteDoc(doc(como('eladmin'), 'promociones/promo1')));
  });

  it('el superadmin SÍ puede borrar un anuncio (Superadmin.js:541)', async () => {
    const { doc, deleteDoc } = FS;
    await RUT.assertSucceeds(deleteDoc(doc(como('eljefe'), 'anuncios/anun1')));
  });

  it('un usuario cualquiera NO puede borrar una promoción', async () => {
    const { doc, deleteDoc } = FS;
    await RUT.assertFails(deleteDoc(doc(como('pasajero1'), 'promociones/promo1')));
  });
});

// ───────────────────────────────────────────────────────────────────────────
// LA LIMPIEZA AUTOMÁTICA — corre en el servidor y SE SALTA las reglas a propósito
// ───────────────────────────────────────────────────────────────────────────
describe('REGLA 12 · la limpieza automática del servidor NO se ve afectada', () => {
  it('el servidor (limpiezaDiaria, functions/index.js:403) sigue pudiendo borrar', async () => {
    // withSecurityRulesDisabled es exactamente cómo se comporta el SDK admin,
    // que es con el que corren las Cloud Functions: las reglas no le aplican.
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const { doc, deleteDoc, getDoc } = FS;
      const ref = doc(ctx.firestore(), 'viajes/viaje1');
      await deleteDoc(ref);
      const quedo = await getDoc(ref);
      if (quedo.exists()) throw new Error('el servidor no pudo borrar: la limpieza quedaría rota');
    });
  });
});

// ───────────────────────────────────────────────────────────────────────────
// NO ROMPER LO QUE YA FUNCIONA — el resto de la app sigue igual que antes
// ───────────────────────────────────────────────────────────────────────────
describe('REGLA 12 · lo que la app hace hoy sigue funcionando', () => {
  it('un pasajero sigue pudiendo pedir un viaje', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(
      setDoc(doc(como('pasajero1'), 'viajes/viaje2'), { pasajeroId: 'pasajero1', estado: 'esperando', tarifa: 9000 })
    );
  });

  // Corregida el 23-ago-2026 (REGLA 2): decía contraofertas/conductor2 firmado por
  // conductor1. Eso NO es lo que hace la app — AppConductor.js:353 firma con el uid
  // del propio conductor. La prueba estaba dando por buena la puerta del ataque.
  it('un conductor sigue pudiendo ofertar en un viaje', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(
      setDoc(doc(como('conductor1'), 'viajes/viaje1/contraofertas/conductor1'), { monto: 10500 })
    );
  });

  it('se sigue pudiendo escribir en el chat del viaje', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(
      setDoc(doc(como('pasajero1'), 'viajes/viaje1/mensajes/m2'), { texto: 'te espero en la puerta' })
    );
  });

  it('un usuario sigue pudiendo cambiar el estado de su viaje', async () => {
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('pasajero1'), 'viajes/viaje1'), { estado: 'cancelado' }));
  });

  it('un usuario sigue pudiendo guardar su propia ficha', async () => {
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('pasajero1'), 'usuarios/pasajero1'), { nombre: 'Ana María' }));
  });

  it('se sigue pudiendo calificar', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(
      setDoc(doc(como('pasajero1'), 'calificaciones/cal2'), { estrellas: 5, deQuien: 'conductor1' })
    );
  });

  it('un restaurante sigue pudiendo recibir un pedido', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(
      setDoc(doc(como('pasajero1'), 'pedidosRestaurantes/ped2'), { total: 25000 })
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// REGLA 1 — LA LLAVE MAESTRA
// Nadie puede escribir en SU PROPIA ficha los campos que dan poder.
// Mientras esto estuvo abierto, las otras 12 reglas no protegían nada: preguntaban
// "¿eres admin?" leyendo un campo que el atacante acababa de escribir.
// ═══════════════════════════════════════════════════════════════════════════
describe('REGLA 1 · nadie se da poder a sí mismo', () => {
  it('un pasajero NO puede nombrarse superadmin', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertFails(
      setDoc(doc(como('pasajero1'), 'usuarios/pasajero1'), { rol: 'superadmin' }, { merge: true })
    );
  });

  it('un pasajero NO puede nombrarse admin', async () => {
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('pasajero1'), 'usuarios/pasajero1'), { rol: 'admin' }));
  });

  it('un usuario nuevo NO puede registrarse trayendo un rol dentro', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertFails(
      setDoc(doc(como('nuevo1'), 'usuarios/nuevo1'), { nombre: 'Listo', rol: 'superadmin' })
    );
  });

  it('un conductor castigado NO puede levantarse la sanción', async () => {
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('castigado'), 'usuarios/castigado'), { sancionHasta: null }));
  });

  it('un conductor castigado NO puede reactivarse solo', async () => {
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('castigado'), 'usuarios/castigado'), { activo: true }));
  });

  it('un conductor castigado NO puede borrar su historial de faltas', async () => {
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('castigado'), 'usuarios/castigado'), { sanciones: [] }));
  });

  it('nadie puede darle un rol a OTRA persona sin ser admin', async () => {
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('pasajero1'), 'usuarios/conductor1'), { rol: 'admin' }));
  });
});

describe('REGLA 1 · el panel de admin sigue pudiendo hacer su trabajo', () => {
  it('el superadmin puede nombrar admin a alguien (Superadmin.js:599)', async () => {
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('eljefe'), 'usuarios/pasajero1'), { rol: 'admin' }));
  });

  it('el admin puede sancionar a un conductor (Conductores.js:299)', async () => {
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(
      updateDoc(doc(como('eladmin'), 'usuarios/conductor1'), {
        activo: false,
        sancionHasta: '2026-09-30T00:00:00.000Z',
        sanciones: [{ motivo: 'no recogió', fecha: '2026-08-23' }],
      })
    );
  });

  it('el admin puede levantar la sanción (Conductores.js:307)', async () => {
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(
      updateDoc(doc(como('eladmin'), 'usuarios/castigado'), {
        activo: true, sancionHasta: null, mensajesApelacion: [],
      })
    );
  });
});

// Estas son las que de verdad dan miedo: todas estas pantallas se tragan los
// errores en silencio (catch vacío). Si una regla las bloquea, el dueño no ve un
// error: ve que "no guarda". Cada prueba lleva el archivo:línea que reproduce.
describe('REGLA 1 · lo que la app hace hoy NO se rompe', () => {
  it('el registro de un pasajero nuevo funciona igual (Login.js:145)', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(
      setDoc(doc(como('nuevo1'), 'usuarios/nuevo1'), {
        nombre: 'Ana', email: 'ana@ejemplo.com', celular: '3001234567',
        fechaNacimiento: '1995-04-12',
        contactoConfianzaNombre: 'Mamá', contactoConfianzaNumero: '3007654321',
        tipo: '', placa: '', vehiculo: '',
        fechaRegistro: '2026-08-23T10:00:00.000Z', ipRegistro: '181.0.0.1',
        descuentoPendiente: { promoId: 'BIENVENIDA', valorBeneficio: 8000 },
      })
    );
  });

  it('el alta de conductor funciona igual (App.js:247) — ya SIN créditos dentro', async () => {
    // Hasta el 24-ago-2026 esta escritura llevaba «creditos: 20000» y pasaba:
    // el teléfono se ponía su propio saldo de bienvenida. Con la REGLA 7 el
    // saldo lo da el servidor aparte, así que el alta va sin él y sigue pasando.
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(
      setDoc(doc(como('pasajero1'), 'usuarios/pasajero1'), {
        tipo: 'conductor', tipoVehiculo: 'Taxi', placa: 'ABC123',
        marca: 'Chevrolet', modelo: '2019', color: 'Amarillo',
        documento: '1090123456', vehiculo: 'Taxi', telefono: '3001112233',
        fotoConductor: 'https://x/f.jpg', fotoCedula: 'https://x/c.jpg',
      }, { merge: true })
    );
  });

  it('guardar el perfil funciona igual (MiPerfil.js:86)', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(
      setDoc(doc(como('pasajero1'), 'usuarios/pasajero1'),
        { nombre: 'Ana María', telefono: '3009998877', fotoConductor: 'https://x/n.jpg' },
        { merge: true })
    );
  });

  it('las preferencias de sonido funcionan igual (Configuracion.js:44)', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(
      setDoc(doc(como('pasajero1'), 'usuarios/pasajero1'), { configSonido: false }, { merge: true })
    );
  });

  it('el chat de recargas funciona igual (Creditos.js:59)', async () => {
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(
      updateDoc(doc(como('conductor1'), 'usuarios/conductor1'), {
        mensajesRecarga: [{ texto: 'ya transferí', autor: 'conductor' }],
      })
    );
  });

  it('marcar el aviso del admin como leído funciona igual (Home.js:197)', async () => {
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(
      updateDoc(doc(como('pasajero1'), 'usuarios/pasajero1'), { llamadoPendiente: null })
    );
  });

  it('la apelación del conductor funciona igual (AppConductor.js:540)', async () => {
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(
      updateDoc(doc(como('castigado'), 'usuarios/castigado'), {
        mensajesApelacion: [{ texto: 'no fue así', autor: 'conductor' }],
      })
    );
  });

  // OJO: estas dos SIGUEN abiertas a propósito. Son la REGLA 7 (el dinero), que
  // necesita funciones de servidor. Si algún día se cierran, estas dos pruebas
  // hay que cambiarlas — y eso solo se hace con permiso del dueño.
  it('el canje de un código YA NO lo hace el teléfono (Creditos.js) — REGLA 7 CERRADA', async () => {
    // Esta prueba decía lo contrario hasta el 24-ago-2026: dejaba constancia de
    // que el agujero seguía abierto. Ahora el canje lo hace el servidor
    // (functions: canjearCodigoRecarga) y el teléfono ya no puede escribirse
    // saldo. La prueba se da la vuelta: lo que antes DEBÍA pasar, ahora debe fallar.
    const { doc, setDoc } = FS;
    await RUT.assertFails(
      setDoc(doc(como('conductor1'), 'usuarios/conductor1'), { creditos: 55000 }, { merge: true })
    );
  });

  // OJO — ESTE AGUJERO SIGUE ABIERTO Y ES A PROPÓSITO. La REGLA 7 cerró el
  // SALDO ('creditos'), no el descuento. Congelar 'descuentoPendiente' hoy
  // rompería dos cosas: el registro (Login.js lo escribe al dar el crédito de
  // bienvenida al pasajero nuevo) y, peor, el borrado que hace el propio
  // pasajero cuando el conductor consume el descuento (Solicitar.js:551) — sin
  // ese borrado el descuento se podría volver a usar en otro viaje.
  // Cerrarlo es su propio trabajo, con su foto: mover a servidor el regalo de
  // bienvenida Y el consumo (mejor, un disparador que lo limpie solo cuando el
  // viaje marca 'consumido'). Mientras tanto, esta prueba deja constancia.
  it('aplicar una promoción sigue pudiendo escribir el descuento (Promociones.js:101) — REGLA 7 pendiente', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(
      setDoc(doc(como('pasajero1'), 'usuarios/pasajero1'),
        { descuentoPendiente: { promoId: 'X', valorBeneficio: 5000 } }, { merge: true })
    );
  });
});

// ── EL CORREO SE PONE UNA VEZ Y NO SE MUEVE ─────────────────────────────────
// Por qué importa: el panel busca POR CORREO a quién dar poder (Superadmin.js:581)
// o créditos (Superadmin.js:302) y se queda con el PRIMER resultado sin avisar de
// duplicados. Quien se copiara en su ficha el correo de un jefe podía quedarse con
// el ascenso ajeno. Medido el 23-ago-2026: 3 fichas ya comparten correo.
//
// Estas pruebas no tocan los personajes sembrados: se registran las suyas.
describe('REGLA 1 · el correo se pone una vez y no se mueve', () => {
  it('registrarse CON correo funciona — es la única vez que se escribe (Login.js:146)', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(
      setDoc(doc(como('recien1'), 'usuarios/recien1'), {
        nombre: 'Ana', email: 'ana@ejemplo.com', celular: '3001234567',
      })
    );
  });

  it('ya registrado, NO puede cambiarse el correo desde el celular', async () => {
    const { doc, setDoc, updateDoc } = FS;
    await RUT.assertSucceeds(
      setDoc(doc(como('recien2'), 'usuarios/recien2'), { nombre: 'Ana', email: 'ana@ejemplo.com' })
    );
    await RUT.assertFails(
      updateDoc(doc(como('recien2'), 'usuarios/recien2'), { email: 'otro@ejemplo.com' })
    );
  });

  it('NO puede copiarse el correo de un jefe para robarle el ascenso', async () => {
    const { doc, setDoc, updateDoc } = FS;
    await RUT.assertSucceeds(
      setDoc(doc(como('ladron'), 'usuarios/ladron'), { nombre: 'Pedro', email: 'pedro@ejemplo.com' })
    );
    await RUT.assertFails(
      updateDoc(doc(como('ladron'), 'usuarios/ladron'), { email: 'jefe@guajirago.com' })
    );
  });

  it('NO puede AÑADIR un correo a una ficha que no lo tenía', async () => {
    const { doc, updateDoc } = FS;
    await RUT.assertFails(
      updateDoc(doc(como('pasajero1'), 'usuarios/pasajero1'), { email: 'jefe@guajirago.com' })
    );
  });

  it('NO puede cambiarle el correo a OTRA persona', async () => {
    const { doc, updateDoc } = FS;
    await RUT.assertFails(
      updateDoc(doc(como('pasajero1'), 'usuarios/conductor1'), { email: 'robado@ejemplo.com' })
    );
  });

  it('el superadmin SÍ puede cambiarle el correo a alguien (lo que pidió el dueño)', async () => {
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(
      updateDoc(doc(como('eljefe'), 'usuarios/pasajero1'), { email: 'nuevo@ejemplo.com' })
    );
  });

  it('el admin SÍ puede corregir un correo mal escrito', async () => {
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(
      updateDoc(doc(como('eladmin'), 'usuarios/conductor1'), { email: 'luis@ejemplo.com' })
    );
  });

  it('con correo puesto, guardar el perfil SIGUE funcionando (MiPerfil.js:86)', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(
      setDoc(doc(como('recien3'), 'usuarios/recien3'), { nombre: 'Ana', email: 'ana@ejemplo.com' })
    );
    await RUT.assertSucceeds(
      setDoc(doc(como('recien3'), 'usuarios/recien3'),
        { nombre: 'Ana María', telefono: '3009998877' }, { merge: true })
    );
  });

  it('reenviar el MISMO correo sin cambiarlo no molesta a nadie', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(
      setDoc(doc(como('recien4'), 'usuarios/recien4'), { nombre: 'Ana', email: 'ana@ejemplo.com' })
    );
    await RUT.assertSucceeds(
      setDoc(doc(como('recien4'), 'usuarios/recien4'),
        { nombre: 'Ana', email: 'ana@ejemplo.com', telefono: '3001112233' }, { merge: true })
    );
  });

  it('y el rol sigue cerrado: no se cuela poder junto con el correo', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertFails(
      setDoc(doc(como('recien5'), 'usuarios/recien5'),
        { nombre: 'Ana', email: 'ana@ejemplo.com', rol: 'superadmin' })
    );
  });
});

// ── REGLA 2 · LA OFERTA LA FIRMA SU CONDUCTOR ───────────────────────────────
// Sin esto, cerrar confirmarConductor no basta: el atacante crea SU viaje, escribe
// una oferta a nombre de un conductor cualquiera, confirma su propio viaje y el
// servidor le descuenta la comisión a un conductor que nunca ofertó.
// El viaje sembrado 'viaje1' es de 'pasajero1'.
describe('REGLA 7 · la plata no la escribe el teléfono', () => {
  it('un conductor NO puede subirse el saldo', async () => {
    // Esto es lo gordo: medido el 24-ago-2026, $369.700 en 8 fichas, y la regla
    // dejaba que cualquiera se escribiera su propio saldo. Ni siquiera hacía
    // falta un código de recarga: bastaba con escribir el número.
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('conductor1'), 'usuarios/conductor1'), { creditos: 999999 }));
  });

  it('un conductor NO puede subirse el saldo ni con setDoc + merge', async () => {
    // La app usaba merge, que es la forma que de verdad se intentaría.
    const { doc, setDoc } = FS;
    await RUT.assertFails(
      setDoc(doc(como('conductor1'), 'usuarios/conductor1'), { creditos: 50000 }, { merge: true })
    );
  });

  it('un castigado NO puede recargarse aunque ya tenga saldo', async () => {
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('castigado'), 'usuarios/castigado'), { creditos: 100000 }));
  });

  it('nadie puede tocarle el saldo a OTRO', async () => {
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('pasajero1'), 'usuarios/conductor1'), { creditos: 0 }));
  });

  it('un usuario nuevo NO puede registrarse trayendo saldo dentro', async () => {
    // Por eso el candado va TAMBIÉN en el create: si no, bastaba con borrarse la
    // cuenta y volver a registrarse con el saldo que uno quisiera.
    const { doc, setDoc } = FS;
    await RUT.assertFails(
      setDoc(doc(como('nuevo7'), 'usuarios/nuevo7'), { nombre: 'Vivo', creditos: 80000 })
    );
  });

  it('el PANEL sí puede ajustar el saldo (Superadmin.js:347)', async () => {
    // Es la vía legítima: el dueño regala o corrige créditos desde el panel.
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('eljefe'), 'usuarios/conductor1'), { creditos: 25000 }));
    await RUT.assertSucceeds(updateDoc(doc(como('eladmin'), 'usuarios/conductor1'), { creditos: 30000 }));
  });

  it('lo que la app SÍ hace con su ficha sigue funcionando', async () => {
    // Que el candado no se lleve por delante lo de todos los días: MiPerfil
    // (nombre, teléfono, foto), Seguridad (contacto de confianza) y favoritos.
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('conductor1'), 'usuarios/conductor1'), {
      nombre: 'Luis Pérez', telefono: '3001112233', fotoConductor: 'https://x/y.jpg',
    }));
    await RUT.assertSucceeds(updateDoc(doc(como('pasajero1'), 'usuarios/pasajero1'), {
      contactoConfianzaNumero: '3009998877',
      favoritos: [{ nombre: 'Casa', direccion: 'Calle 15', icono: '🏠' }],
    }));
  });

  it('el alta de conductor (App.js) sigue pasando: ya NO manda créditos', async () => {
    // Así queda la escritura del registro después del arreglo: los créditos de
    // bienvenida los pide aparte al servidor. Si esta prueba se pusiera roja,
    // ningún conductor podría darse de alta.
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(setDoc(doc(como('conductor1'), 'usuarios/conductor1'), {
      tipo: 'conductor', tipoVehiculo: 'Mototaxi', placa: 'ABC12D',
      marca: 'Bajaj', modelo: '2020', color: 'Rojo', documento: '123',
      vehiculo: 'Bajaj 2020', telefono: '3001112233',
      fotoConductor: 'https://x/c.jpg', fotoCedula: 'https://x/d.jpg',
    }, { merge: true }));
  });
});

describe('REGLA 2 · la oferta la firma su conductor', () => {
  it('un conductor SÍ puede dejar su propia oferta (AppConductor.js:353)', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(
      setDoc(doc(como('conductor2'), 'viajes/viaje1/contraofertas/conductor2'),
        { monto: 10500, conductorNombre: 'Luis' })
    );
  });

  it('NO puede firmar una oferta a nombre de OTRO conductor', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertFails(
      setDoc(doc(como('ladron2'), 'viajes/viaje1/contraofertas/conductor2'),
        { monto: 10500, conductorNombre: 'Luis' })
    );
  });

  it('el pasajero del viaje TAMPOCO puede inventar ofertas de conductores', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertFails(
      setDoc(doc(como('pasajero1'), 'viajes/viaje1/contraofertas/conductor2'), { monto: 1 })
    );
  });

  it('el dueño del viaje SÍ puede descartar una oferta (Solicitar.js:1050)', async () => {
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(
      updateDoc(doc(como('pasajero1'), 'viajes/viaje1/contraofertas/conductor1'), { vigente: false })
    );
  });

  it('el conductor SÍ puede retirar su propia oferta (AppConductor.js:635)', async () => {
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(
      updateDoc(doc(como('conductor1'), 'viajes/viaje1/contraofertas/conductor1'), { vigente: false })
    );
  });

  it('un tercero NO puede tocar la oferta de nadie', async () => {
    const { doc, updateDoc } = FS;
    await RUT.assertFails(
      updateDoc(doc(como('castigado'), 'viajes/viaje1/contraofertas/conductor1'), { monto: 99999 })
    );
  });

  it('el pasajero sigue viendo las ofertas que le llegan (Solicitar.js:676)', async () => {
    const { doc, getDoc } = FS;
    await RUT.assertSucceeds(getDoc(doc(como('pasajero1'), 'viajes/viaje1/contraofertas/conductor1')));
  });

  it('el conductor sigue viendo la suya', async () => {
    const { doc, getDoc } = FS;
    await RUT.assertSucceeds(getDoc(doc(como('conductor1'), 'viajes/viaje1/contraofertas/conductor1')));
  });
});

// ── REGLA 6 · CADA QUIEN VE LO SUYO ─────────────────────────────────────────
// Medido el 23-ago-2026: cualquier usuario registrado leía los 91 viajes (con
// nombre, correo, código de seguridad, direcciones y coordenadas del pasajero),
// el chat de cualquier viaje, y la lista entera de códigos de recarga — 3 sin
// usar por $100.800.
describe('REGLA 6 · cada quien ve lo suyo', () => {
  /** Un viaje YA TERMINADO, que no es de nadie de la prueba. */
  const sembrarTerminado = async () => {
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const { doc, setDoc } = FS;
      await setDoc(doc(ctx.firestore(), 'viajes/terminado1'), {
        pasajeroId: 'otraPersona', conductorId: 'otroConductor', estado: 'finalizado',
        pasajeroNombre: 'Ana', pasajeroEmail: 'ana@ejemplo.com',
        codigoSeguridad: '1204', origen: 'Calle 1 #2-3', destino: 'Calle 9',
        pasajeroLat: 11.5, pasajeroLng: -72.9,
      });
    });
  };

  // ── los códigos de recarga ──
  it('el conductor sigue pudiendo canjear UN código (Creditos.js:111)', async () => {
    const { doc, getDoc } = FS;
    await RUT.assertSucceeds(getDoc(doc(como('conductor1'), 'codigos/cod1')));
  });

  it('un cualquiera NO puede pedir la LISTA de códigos', async () => {
    const { collection, getDocs } = FS;
    await RUT.assertFails(getDocs(collection(como('pasajero1'), 'codigos')));
  });

  it('el panel SÍ puede pedir la lista de códigos (Codigos.js:158)', async () => {
    const { collection, getDocs } = FS;
    await RUT.assertSucceeds(getDocs(collection(como('eladmin'), 'codigos')));
  });

  // ── las fichas de personas ──
  it('cada quien SIGUE leyendo su propia ficha (MiPerfil.js:29)', async () => {
    const { doc, getDoc } = FS;
    await RUT.assertSucceeds(getDoc(doc(como('pasajero1'), 'usuarios/pasajero1')));
  });

  it('NO puede leer la ficha de OTRA persona', async () => {
    const { doc, getDoc } = FS;
    await RUT.assertFails(getDoc(doc(como('pasajero1'), 'usuarios/conductor1')));
  });

  it('NO puede pedir la LISTA de fichas — ahí estaban las 7 fotos de cédula', async () => {
    const { collection, getDocs } = FS;
    await RUT.assertFails(getDocs(collection(como('pasajero1'), 'usuarios')));
  });

  it('ni buscando por celular, que era el agujero (Login.js:106)', async () => {
    const { collection, query, where, getDocs } = FS;
    await RUT.assertFails(getDocs(query(
      collection(como('pasajero1'), 'usuarios'), where('celular', '==', '3001234567')
    )));
  });

  it('el panel SÍ puede leer cualquier ficha (Codigos.js:139)', async () => {
    const { doc, getDoc } = FS;
    await RUT.assertSucceeds(getDoc(doc(como('eladmin'), 'usuarios/pasajero1')));
  });

  it('el panel SÍ puede pedir la lista de fichas (App.js:437)', async () => {
    const { collection, getDocs } = FS;
    await RUT.assertSucceeds(getDocs(collection(como('eljefe'), 'usuarios')));
  });

  // ── los viajes ──
  it('el pasajero sigue viendo SU viaje (Solicitar.js:542)', async () => {
    const { doc, getDoc } = FS;
    await RUT.assertSucceeds(getDoc(doc(como('pasajero1'), 'viajes/viaje1')));
  });

  it('un extraño NO puede ver un viaje TERMINADO ajeno', async () => {
    await sembrarTerminado();
    const { doc, getDoc } = FS;
    await RUT.assertFails(getDoc(doc(como('pasajero1'), 'viajes/terminado1')));
  });

  it('un extraño NO puede pedir la lista de TODOS los viajes', async () => {
    await sembrarTerminado();
    const { collection, getDocs } = FS;
    await RUT.assertFails(getDocs(collection(como('pasajero1'), 'viajes')));
  });

  it('el conductor SIGUE viendo el mercado, que es el negocio (AppConductor.js:847)', async () => {
    const { collection, query, where, getDocs } = FS;
    await RUT.assertSucceeds(getDocs(query(
      collection(como('conductor1'), 'viajes'),
      where('estado', 'in', ['esperando', 'en_negociacion', 'confirmando', 'contraoferta'])
    )));
  });

  it('el conductor SIGUE viendo sus propios viajes (AppConductor.js:235)', async () => {
    const { collection, query, where, getDocs } = FS;
    await RUT.assertSucceeds(getDocs(query(
      collection(como('conductor1'), 'viajes'), where('conductorId', '==', 'conductor1')
    )));
  });

  it('el pasajero SIGUE viendo su historial (MisViajes.js:17)', async () => {
    const { collection, query, where, getDocs } = FS;
    await RUT.assertSucceeds(getDocs(query(
      collection(como('pasajero1'), 'viajes'), where('pasajeroId', '==', 'pasajero1')
    )));
  });

  it('el conductor SIGUE viendo sus ganancias (Ganancias.js:32)', async () => {
    const { collection, query, where, getDocs } = FS;
    await RUT.assertSucceeds(getDocs(query(
      collection(como('conductor1'), 'viajes'),
      where('conductorId', '==', 'conductor1'), where('estado', '==', 'finalizado')
    )));
  });

  it('el panel SIGUE viendo todos los viajes (Viajes.js:27)', async () => {
    await sembrarTerminado();
    const { collection, getDocs } = FS;
    await RUT.assertSucceeds(getDocs(collection(como('eladmin'), 'viajes')));
  });

  // El caso que casi se me escapa: el conductor que oferta y PIERDE. Su app vigila
  // el viaje justo para enterarse de que perdió (AppConductor.js:654). Si al perder
  // dejara de poder mirarlo, la tarjeta se le quedaría pegada en la pantalla.
  it('el conductor que ofertó y PERDIÓ sigue pudiendo mirar el viaje', async () => {
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const { doc, setDoc } = FS;
      await setDoc(doc(ctx.firestore(), 'viajes/viaje1'),
        { pasajeroId: 'pasajero1', conductorId: 'otroQueGano', estado: 'aceptado' });
      await setDoc(doc(ctx.firestore(), 'viajes/viaje1/contraofertas/conductor1'), { monto: 11000 });
    });
    const { doc, getDoc } = FS;
    await RUT.assertSucceeds(getDoc(doc(como('conductor1'), 'viajes/viaje1')));
  });

  it('pero un conductor que NUNCA ofertó no puede mirarlo', async () => {
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const { doc, setDoc } = FS;
      await setDoc(doc(ctx.firestore(), 'viajes/viaje1'),
        { pasajeroId: 'pasajero1', conductorId: 'otroQueGano', estado: 'aceptado' });
    });
    const { doc, getDoc } = FS;
    await RUT.assertFails(getDoc(doc(como('castigado'), 'viajes/viaje1')));
  });

  // ── el cajón privado: el código de seguridad (REGLAS 5 y 11) ──
  const sembrarCodigo = async () => {
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const { doc, setDoc } = FS;
      await setDoc(doc(ctx.firestore(), 'viajes/viaje1/privado/seguridad'), { codigo: '4821' });
    });
  };

  it('la pasajera SÍ ve su código, que es quien se lo dice al conductor', async () => {
    await sembrarCodigo();
    const { doc, getDoc } = FS;
    await RUT.assertSucceeds(getDoc(doc(como('pasajero1'), 'viajes/viaje1/privado/seguridad')));
  });

  it('NI SIQUIERA el conductor asignado puede LEER el código', async () => {
    await sembrarCodigo();
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const { doc, setDoc } = FS;
      await setDoc(doc(ctx.firestore(), 'viajes/viaje1'),
        { pasajeroId: 'pasajero1', conductorId: 'conductor1', estado: 'aceptado' });
    });
    const { doc, getDoc } = FS;
    await RUT.assertFails(getDoc(doc(como('conductor1'), 'viajes/viaje1/privado/seguridad')));
  });

  it('un conductor cualquiera del mercado TAMPOCO lo ve — era el agujero', async () => {
    await sembrarCodigo();
    const { doc, getDoc } = FS;
    await RUT.assertFails(getDoc(doc(como('castigado'), 'viajes/viaje1/privado/seguridad')));
  });

  it('la pasajera puede guardar su código al pedir el viaje (Solicitar.js:964)', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(
      setDoc(doc(como('pasajero1'), 'viajes/viaje1/privado/seguridad'), { codigo: '1234' })
    );
  });

  it('nadie puede poner un código en el viaje de otra persona', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertFails(
      setDoc(doc(como('castigado'), 'viajes/viaje1/privado/seguridad'), { codigo: '0000' })
    );
  });

  it('el código no se puede CAMBIAR una vez puesto, ni por la dueña', async () => {
    await sembrarCodigo();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(
      updateDoc(doc(como('pasajero1'), 'viajes/viaje1/privado/seguridad'), { codigo: '0000' })
    );
  });

  // ── el chat del viaje ──
  it('el pasajero SIGUE leyendo su chat (Solicitar.js:740)', async () => {
    const { doc, getDoc } = FS;
    await RUT.assertSucceeds(getDoc(doc(como('pasajero1'), 'viajes/viaje1/mensajes/m1')));
  });

  it('un extraño NO puede leer el chat de un viaje ajeno', async () => {
    const { doc, getDoc } = FS;
    await RUT.assertFails(getDoc(doc(como('castigado'), 'viajes/viaje1/mensajes/m1')));
  });

  it('un extraño NO puede ESCRIBIR en el chat haciéndose pasar por otro', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertFails(
      setDoc(doc(como('castigado'), 'viajes/viaje1/mensajes/falso'),
        { texto: 'soy tu conductor, sal a la calle', autor: 'conductor' })
    );
  });

  it('el pasajero SIGUE pudiendo escribir en su chat (Solicitar.js:752)', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(
      setDoc(doc(como('pasajero1'), 'viajes/viaje1/mensajes/m2'), { texto: 'ya bajo', autor: 'pasajero' })
    );
  });

  it('el conductor asignado SIGUE pudiendo escribir (AppConductor.js:1118)', async () => {
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const { doc, setDoc } = FS;
      await setDoc(doc(ctx.firestore(), 'viajes/viaje1'),
        { pasajeroId: 'pasajero1', conductorId: 'conductor1', estado: 'aceptado' });
    });
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(
      setDoc(doc(como('conductor1'), 'viajes/viaje1/mensajes/m3'), { texto: 'voy llegando', autor: 'conductor' })
    );
  });
});
