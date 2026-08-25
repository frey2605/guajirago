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

  // Corregida el 24-ago-2026 (REGLA 9): decia { total: 25000 } y nada mas. Eso NO
  // es lo que hace la app — Restaurantes.js:322 escribe 15 campos y SIEMPRE el
  // restaurante. Un pedido sin restaurante no lo puede atender nadie ni reclamar
  // nadie: la prueba estaba dando por bueno un pedido huerfano.
  it('un restaurante sigue pudiendo recibir un pedido', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(
      setDoc(doc(como('pasajero1'), 'pedidosRestaurantes/ped2'), { restauranteId: 'r1', clienteId: 'pasajero1', total: 25000 })
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

// ───────────────────────────────────────────────────────────────────────────
// REGLA 9 · CADA PEDIDO Y CADA RESERVA SON DE ALGUIEN
// ───────────────────────────────────────────────────────────────────────────
// Hasta el 24-ago-2026 las dos colecciones decían «if request.auth != null»:
// con una cuenta cualquiera se pedía la lista entera. Medido ese día en el
// servidor de verdad: 29 pedidos, 17 con TELÉFONO Y DIRECCIÓN de gente real.
//
// La trampa que casi se me pasa: en un restaurante NO trabaja solo el dueño.
// El empleado entra con SU cuenta —medido: JUAN, 1 empleado real— y su uid no
// se parece en nada al del restaurante. Una regla que preguntara solo «¿tu
// cuenta es el restaurante?» habría dejado al mesero sin poder tomar pedidos,
// y en silencio: la pantalla se queda vacía y nadie sabe por qué. Por eso hay
// dos pruebas del mesero, y son las que más importan de todas estas.

describe('REGLA 9 · los pedidos dejan de ser públicos entre usuarios', () => {
  /** El mundo de dos restaurantes, un empleado y cuatro pedidos. */
  const sembrarPedidos = async () => {
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const { doc, setDoc } = FS;
      // 'emp1' ya viene sembrado arriba como empleado del restaurante 'r1'.
      await setDoc(doc(db, 'pedidosRestaurantes/pedR1cliente'), {
        restauranteId: 'r1', clienteId: 'pasajero1', tipo: 'domicilio',
        estado: 'nuevo', cliente: 'Ana', telefono: '+573001112233',
        direccion: 'Calle 1 #2-3', total: 30000,
      });
      await setDoc(doc(db, 'pedidosRestaurantes/pedR1mesa'), {
        restauranteId: 'r1', tipo: 'local', mesa: 4, estado: 'tomado', total: 18000,
      });
      await setDoc(doc(db, 'pedidosRestaurantes/pedR2'), {
        restauranteId: 'r2', clienteId: 'otroCliente', tipo: 'domicilio',
        estado: 'nuevo', telefono: '+573009998877', direccion: 'Calle 9', total: 25000,
      });
      // Uno de los 29 VIEJOS: tiene restaurante, pero NO tiene dueño.
      await setDoc(doc(db, 'pedidosRestaurantes/pedViejo'), {
        restauranteId: 'r1', tipo: 'domicilio', estado: 'cerrado',
        telefono: '+573005554433', direccion: 'Calle 15', total: 42000,
      });
    });
  };

  // ── LA FUGA QUE SE CIERRA ────────────────────────────────────────────────
  it('un cualquiera YA NO puede pedir la LISTA de pedidos — ahí estaban los 17 teléfonos', async () => {
    await sembrarPedidos();
    const { collection, getDocs } = FS;
    await RUT.assertFails(getDocs(collection(como('pasajero1'), 'pedidosRestaurantes')));
  });

  it('ni filtrando por un restaurante que no es suyo', async () => {
    await sembrarPedidos();
    const { collection, query, where, getDocs } = FS;
    await RUT.assertFails(getDocs(query(
      collection(como('pasajero1'), 'pedidosRestaurantes'), where('restauranteId', '==', 'r1')
    )));
  });

  it('un cualquiera NO puede mirar UN pedido ajeno aunque sepa el número', async () => {
    await sembrarPedidos();
    const { doc, getDoc } = FS;
    await RUT.assertFails(getDoc(doc(como('pasajero1'), 'pedidosRestaurantes/pedR2')));
  });

  // ── LO QUE TIENE QUE SEGUIR FUNCIONANDO ──────────────────────────────────
  it('el DUEÑO del restaurante sigue viendo sus pedidos (App.js:116, PedidosDomicilio.js:101)', async () => {
    await sembrarPedidos();
    const { collection, query, where, getDocs } = FS;
    await RUT.assertSucceeds(getDocs(query(
      collection(como('r1'), 'pedidosRestaurantes'), where('restauranteId', '==', 'r1')
    )));
  });

  it('LA TRAMPA · el EMPLEADO también los ve, aunque su cuenta no sea el restaurante (Mesero.js:90)', async () => {
    await sembrarPedidos();
    const { collection, query, where, getDocs } = FS;
    await RUT.assertSucceeds(getDocs(query(
      collection(como('emp1'), 'pedidosRestaurantes'), where('restauranteId', '==', 'r1')
    )));
  });

  it('LA TRAMPA · pero el empleado NO ve los del restaurante de al lado', async () => {
    await sembrarPedidos();
    const { collection, query, where, getDocs } = FS;
    await RUT.assertFails(getDocs(query(
      collection(como('emp1'), 'pedidosRestaurantes'), where('restauranteId', '==', 'r2')
    )));
  });

  it('el panel sigue pidiendo la colección ENTERA sin filtro (admin/Restaurantes.js:31)', async () => {
    await sembrarPedidos();
    const { collection, getDocs } = FS;
    await RUT.assertSucceeds(getDocs(collection(como('eladmin'), 'pedidosRestaurantes')));
  });

  it('el cliente sigue mirando SU pedido por el número que guarda su teléfono (Restaurantes.js:138)', async () => {
    await sembrarPedidos();
    const { doc, getDoc } = FS;
    await RUT.assertSucceeds(getDoc(doc(como('pasajero1'), 'pedidosRestaurantes/pedR1cliente')));
  });

  it('los 29 VIEJOS sin dueño los sigue viendo su restaurante y el panel', async () => {
    await sembrarPedidos();
    const { doc, getDoc } = FS;
    await RUT.assertSucceeds(getDoc(doc(como('r1'), 'pedidosRestaurantes/pedViejo')));
    await RUT.assertSucceeds(getDoc(doc(como('eladmin'), 'pedidosRestaurantes/pedViejo')));
  });

  it('pero un extraño NO se cuela en un pedido viejo por no tener dueño', async () => {
    await sembrarPedidos();
    const { doc, getDoc } = FS;
    await RUT.assertFails(getDoc(doc(como('pasajero1'), 'pedidosRestaurantes/pedViejo')));
  });

  // ── CREAR: EL PEDIDO SE FIRMA ────────────────────────────────────────────
  it('el cliente crea su pedido FIRMÁNDOLO (Restaurantes.js:322)', async () => {
    const { collection, addDoc } = FS;
    await RUT.assertSucceeds(addDoc(collection(como('pasajero1'), 'pedidosRestaurantes'), {
      restauranteId: 'r1', clienteId: 'pasajero1', tipo: 'domicilio', estado: 'nuevo', total: 30000,
    }));
  });

  it('pero NO puede firmarlo con el nombre de otro', async () => {
    const { collection, addDoc } = FS;
    await RUT.assertFails(addDoc(collection(como('pasajero1'), 'pedidosRestaurantes'), {
      restauranteId: 'r1', clienteId: 'otroCliente', tipo: 'domicilio', estado: 'nuevo', total: 30000,
    }));
  });

  it('ni puede crear uno SIN firma para colarse en un restaurante ajeno', async () => {
    const { collection, addDoc } = FS;
    await RUT.assertFails(addDoc(collection(como('pasajero1'), 'pedidosRestaurantes'), {
      restauranteId: 'r1', tipo: 'local', mesa: 9, estado: 'tomado', total: 5000,
    }));
  });

  it('LA TRAMPA · el MESERO sí crea pedidos de mesa sin cliente (Mesero.js:289)', async () => {
    const { collection, addDoc } = FS;
    await RUT.assertSucceeds(addDoc(collection(como('emp1'), 'pedidosRestaurantes'), {
      restauranteId: 'r1', tipo: 'local', mesa: 4, estado: 'tomado', total: 18000,
    }));
  });

  // ── CAMBIAR ──────────────────────────────────────────────────────────────
  it('el cliente sigue pudiendo cancelar SU pedido (Restaurantes.js:366)', async () => {
    await sembrarPedidos();
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('pasajero1'), 'pedidosRestaurantes/pedR1cliente'), {
      estado: 'cancelado', canceladoPor: 'cliente',
    }));
  });

  it('el restaurante sigue moviendo el estado de sus pedidos (PedidosDomicilio.js:138)', async () => {
    await sembrarPedidos();
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('r1'), 'pedidosRestaurantes/pedR1cliente'), { estado: 'preparando' }));
  });

  it('y el empleado también (es el que está en la cocina)', async () => {
    await sembrarPedidos();
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('emp1'), 'pedidosRestaurantes/pedR1mesa'), { estado: 'cerrado' }));
  });

  it('un extraño NO puede tocar el pedido de otro', async () => {
    await sembrarPedidos();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('pasajero1'), 'pedidosRestaurantes/pedR2'), { estado: 'cancelado' }));
  });

  it('NADIE puede mudar un pedido a otro restaurante — si se pudiera, la firma no valdría nada', async () => {
    await sembrarPedidos();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('pasajero1'), 'pedidosRestaurantes/pedR1cliente'), { restauranteId: 'r2' }));
    await RUT.assertFails(updateDoc(doc(como('r1'), 'pedidosRestaurantes/pedR1cliente'), { restauranteId: 'r2' }));
  });

  it('NADIE puede cambiarle el dueño a un pedido', async () => {
    await sembrarPedidos();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('pasajero1'), 'pedidosRestaurantes/pedR1cliente'), { clienteId: 'otroCliente' }));
    await RUT.assertFails(updateDoc(doc(como('r1'), 'pedidosRestaurantes/pedR1cliente'), { clienteId: 'r1' }));
  });

  // Esta mira el CONGELADO, no al portero. Antes se probaba con un extraño y NO
  // servía de nada: al extraño ya lo para el portero, así que el congelado ni se
  // llegaba a mirar y la prueba pasaba sola — aunque se quitara el congelado
  // entero. Con 'r1' es distinto: el portero SÍ lo deja pasar, es su restaurante.
  // Lo único que puede negarlo es que el dueño esté congelado, que es lo que se
  // quiere probar.
  it('ni el propio restaurante puede REGALARLE un pedido viejo a alguien', async () => {
    await sembrarPedidos();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('r1'), 'pedidosRestaurantes/pedViejo'), { clienteId: 'pasajero1' }));
  });
});

describe('REGLA 9 · las reservas de turismo, igual (y aquí nace limpio)', () => {
  const sembrarReservas = async () => {
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const { doc, setDoc } = FS;
      await setDoc(doc(ctx.firestore(), 'reservasTurismo/resA1'), {
        agenciaId: 'a1', clienteId: 'pasajero1', estado: 'nueva',
        cliente: 'Ana', telefono: '+573001112233', personas: 2, total: 200000,
      });
      await setDoc(doc(ctx.firestore(), 'reservasTurismo/resA2'), {
        agenciaId: 'a2', clienteId: 'otroCliente', estado: 'nueva',
        telefono: '+573009998877', total: 350000,
      });
    });
  };

  it('un cualquiera YA NO puede pedir la LISTA de reservas', async () => {
    await sembrarReservas();
    const { collection, getDocs } = FS;
    await RUT.assertFails(getDocs(collection(como('pasajero1'), 'reservasTurismo')));
  });

  it('un cualquiera NO puede mirar la reserva de otro', async () => {
    await sembrarReservas();
    const { doc, getDoc } = FS;
    await RUT.assertFails(getDoc(doc(como('pasajero1'), 'reservasTurismo/resA2')));
  });

  it('la AGENCIA sigue viendo las suyas (ReservasTurismo.js:26)', async () => {
    await sembrarReservas();
    const { collection, query, where, getDocs } = FS;
    await RUT.assertSucceeds(getDocs(query(
      collection(como('a1'), 'reservasTurismo'), where('agenciaId', '==', 'a1')
    )));
  });

  it('pero NO las de la agencia de al lado', async () => {
    await sembrarReservas();
    const { collection, query, where, getDocs } = FS;
    await RUT.assertFails(getDocs(query(
      collection(como('a1'), 'reservasTurismo'), where('agenciaId', '==', 'a2')
    )));
  });

  it('el panel sigue pidiéndolas todas (admin/Turismo.js:31)', async () => {
    await sembrarReservas();
    const { collection, getDocs } = FS;
    await RUT.assertSucceeds(getDocs(collection(como('eladmin'), 'reservasTurismo')));
  });

  it('el cliente sigue mirando SU reserva por el número guardado (Turismo.js:110)', async () => {
    await sembrarReservas();
    const { doc, getDoc } = FS;
    await RUT.assertSucceeds(getDoc(doc(como('pasajero1'), 'reservasTurismo/resA1')));
  });

  it('el cliente crea su reserva FIRMÁNDOLA (Turismo.js:77)', async () => {
    const { collection, addDoc } = FS;
    await RUT.assertSucceeds(addDoc(collection(como('pasajero1'), 'reservasTurismo'), {
      agenciaId: 'a1', clienteId: 'pasajero1', estado: 'nueva', personas: 2, total: 200000,
    }));
  });

  it('pero NO con el nombre de otro', async () => {
    const { collection, addDoc } = FS;
    await RUT.assertFails(addDoc(collection(como('pasajero1'), 'reservasTurismo'), {
      agenciaId: 'a1', clienteId: 'otroCliente', estado: 'nueva', total: 200000,
    }));
  });

  it('la agencia sigue confirmando y cancelando las suyas (ReservasTurismo.js:37 y :54)', async () => {
    await sembrarReservas();
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('a1'), 'reservasTurismo/resA1'), { estado: 'confirmada' }));
  });

  it('una agencia NO puede tocar la reserva de otra agencia', async () => {
    await sembrarReservas();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('a1'), 'reservasTurismo/resA2'), { estado: 'cancelada' }));
  });

  it('NADIE puede mudar una reserva a otra agencia ni cambiarle el dueño', async () => {
    await sembrarReservas();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('a1'), 'reservasTurismo/resA1'), { agenciaId: 'a2' }));
    await RUT.assertFails(updateDoc(doc(como('pasajero1'), 'reservasTurismo/resA1'), { clienteId: 'otroCliente' }));
  });
});

// ───────────────────────────────────────────────────────────────────────────
// REGLA 9 (2/2) · LA FICHA DE EMPLEADO ERA LA LLAVE FALSIFICABLE
// ───────────────────────────────────────────────────────────────────────────
// El candado de arriba pregunta «¿eres de este negocio?» y se fía de la ficha
// 'empleados/{uid}'. Pero ese bloque decía «allow create, update: if
// request.auth != null»: cualquiera con cuenta se escribía su propia ficha y se
// nombraba empleado del negocio que quisiera. Un revisor independiente lo
// ejecutó contra el emulador el 24-ago-2026 y los cuatro pasos pasaron —
// incluido sacar el teléfono y la dirección de un cliente.
//
// Y había una segunda puerta en la misma pared: quien miraba si el empleado
// seguía 'activo' era la APP, o sea el lado de fuera. Al despedido no se le
// caía la llave.
//
// La primera prueba de este bloque es EL ATAQUE ENTERO, de principio a fin.
// Antes de este arreglo se ponía verde, que es justo lo que la hace valer.

describe('REGLA 9 · la ficha de empleado ya no se la escribe cualquiera', () => {
  const sembrarMundo = async () => {
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const { doc, setDoc } = FS;
      await setDoc(doc(db, 'pedidosRestaurantes/pedR1cliente'), {
        restauranteId: 'r1', clienteId: 'pasajero1', tipo: 'domicilio',
        estado: 'nuevo', telefono: '+573001112233', direccion: 'Calle 1 #2-3', total: 30000,
      });
      // Un empleado al que ya despidieron.
      await setDoc(doc(db, 'empleados/despedido'), {
        restauranteId: 'r1', nombre: 'PEDRO', rol: 'empleado', activo: false,
      });
    });
  };

  // ── EL ATAQUE, ENTERO ────────────────────────────────────────────────────
  it('EL ATAQUE · un cliente cualquiera NO puede nombrarse empleado de un negocio', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('pasajero1'), 'empleados/pasajero1'), { restauranteId: 'r1' }));
  });

  it('EL ATAQUE · y por eso ya no puede leer los pedidos de ese negocio', async () => {
    await sembrarMundo();
    const { doc, setDoc, collection, query, where, getDocs } = FS;
    // Paso 1: intenta hacerse el carnet. Se le niega.
    await RUT.assertFails(setDoc(doc(como('pasajero1'), 'empleados/pasajero1'), { restauranteId: 'r1' }));
    // Paso 2: sin carnet, la lista con los teléfonos le sigue cerrada.
    await RUT.assertFails(getDocs(query(
      collection(como('pasajero1'), 'pedidosRestaurantes'), where('restauranteId', '==', 'r1')
    )));
  });

  // El nombre de antes prometía algo que la regla NO comprueba, y daba seguridad
  // falsa: escribir la ficha de OTRA cuenta sí se puede, y hace falta — cuando el
  // dueño contrata, la cuenta del empleado es nueva y su id no es el del dueño.
  // Lo que de verdad da poder es a QUÉ negocio apunta la ficha, y eso es lo único
  // que hay que cerrar. Es lo que se prueba aquí, por los dos lados.
  it('la ficha solo puede apuntar a TU negocio, tenga el id que tenga', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('pasajero1'), 'empleados/comparsa'), { restauranteId: 'r1' }));
    await RUT.assertFails(setDoc(doc(como('pasajero1'), 'empleados/pasajero1'), { restauranteId: 'r2' }));
  });

  // ── LOS AVISOS DEL EMPLEADO ──────────────────────────────────────────────
  // Esto es lo que este arreglo estuvo a punto de romper, y en silencio.
  it('EL AVISO · el empleado guarda su token en SU ficha (aliados/Notificaciones.js:22)', async () => {
    await sembrarMundo();
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(setDoc(doc(como('emp1'), 'empleados/emp1'), { fcmToken: 'tok123' }, { merge: true }));
  });

  it('EL AVISO · pero SOLO el token: no cuela otro campo de paso', async () => {
    await sembrarMundo();
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('emp1'), 'empleados/emp1'),
      { fcmToken: 'tok123', roles: { administrador: true } }, { merge: true }));
    await RUT.assertFails(setDoc(doc(como('despedido'), 'empleados/despedido'),
      { fcmToken: 'tok123', activo: true }, { merge: true }));
  });

  it('EL AVISO · ni el token de un compañero', async () => {
    await sembrarMundo();
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('emp1'), 'empleados/despedido'), { fcmToken: 'tok123' }, { merge: true }));
  });

  it('una ficha SIN restaurante no se queda congelada para siempre', async () => {
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const { doc, setDoc } = FS;
      await setDoc(doc(ctx.firestore(), 'empleados/rota'), { nombre: 'SIN NEGOCIO' });
    });
    // Con acceso directo esto daba «Null value error» y negaba a todos, hasta al
    // panel — y borrarla está prohibido. Con el defecto, el panel puede repararla.
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('eladmin'), 'empleados/rota'), { activo: false }));
  });

  // ── EL DESPEDIDO ─────────────────────────────────────────────────────────
  it('EL DESPEDIDO · con la ficha desactivada ya no ve los pedidos del negocio', async () => {
    await sembrarMundo();
    const { collection, query, where, getDocs } = FS;
    await RUT.assertFails(getDocs(query(
      collection(como('despedido'), 'pedidosRestaurantes'), where('restauranteId', '==', 'r1')
    )));
  });

  it('EL DESPEDIDO · y no puede reactivarse él solo', async () => {
    await sembrarMundo();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('despedido'), 'empleados/despedido'), { activo: true }));
  });

  it('una ficha SIN el campo activo sigue valiendo — las viejas no se quedan fuera', async () => {
    await sembrarMundo();
    // 'emp1' se siembra arriba sin 'activo'. Debe seguir entrando.
    const { collection, query, where, getDocs } = FS;
    await RUT.assertSucceeds(getDocs(query(
      collection(como('emp1'), 'pedidosRestaurantes'), where('restauranteId', '==', 'r1')
    )));
  });

  // ── LO QUE EL DUEÑO TIENE QUE PODER SEGUIR HACIENDO ──────────────────────
  it('el DUEÑO sigue nombrando a su gente (aliados/Empleados.js:102)', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(setDoc(doc(como('r1'), 'empleados/nuevoEmp'), {
      restauranteId: 'r1', nombre: 'MARIA', email: 'maria@ejemplo.com',
      roles: { mesero: true }, rol: 'empleado', activo: true,
    }));
  });

  it('pero NO puede nombrar gente en el negocio de al lado', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('r1'), 'empleados/coladoEnR2'), {
      restauranteId: 'r2', nombre: 'MARIA', rol: 'empleado', activo: true,
    }));
  });

  it('el dueño sigue editando y desactivando a los suyos (Empleados.js:79 y :126)', async () => {
    await sembrarMundo();
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('r1'), 'empleados/emp1'), { nombre: 'JUANITO' }));
    await RUT.assertSucceeds(updateDoc(doc(como('r1'), 'empleados/despedido'), { activo: true }));
  });

  it('el empleado sigue leyendo SU ficha para poder entrar (aliados/Login.js:88)', async () => {
    await sembrarMundo();
    const { doc, getDoc } = FS;
    await RUT.assertSucceeds(getDoc(doc(como('emp1'), 'empleados/emp1')));
  });

  it('el dueño sigue pidiendo la lista de SU equipo (Empleados.js:46)', async () => {
    await sembrarMundo();
    const { collection, query, where, getDocs } = FS;
    await RUT.assertSucceeds(getDocs(query(
      collection(como('r1'), 'empleados'), where('restauranteId', '==', 'r1')
    )));
  });

  // ── LO QUE SE CIERRA ─────────────────────────────────────────────────────
  it('un empleado NO puede subirse los permisos a sí mismo', async () => {
    await sembrarMundo();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('emp1'), 'empleados/emp1'), {
      roles: { administrador: true },
    }));
  });

  it('un cualquiera NO puede pedir la LISTA de empleados', async () => {
    await sembrarMundo();
    const { collection, getDocs } = FS;
    await RUT.assertFails(getDocs(collection(como('pasajero1'), 'empleados')));
  });

  it('un extraño NO puede leer la ficha de un empleado ajeno', async () => {
    await sembrarMundo();
    const { doc, getDoc } = FS;
    await RUT.assertFails(getDoc(doc(como('pasajero1'), 'empleados/emp1')));
  });

  it('una ficha NO puede mudarse a otro negocio', async () => {
    await sembrarMundo();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('r1'), 'empleados/emp1'), { restauranteId: 'r2' }));
  });

  it('el panel sigue pudiendo mirar los empleados', async () => {
    await sembrarMundo();
    const { doc, getDoc, collection, getDocs } = FS;
    await RUT.assertSucceeds(getDoc(doc(como('eladmin'), 'empleados/emp1')));
    await RUT.assertSucceeds(getDocs(collection(como('eljefe'), 'empleados')));
  });
});

// ───────────────────────────────────────────────────────────────────────────
// REGLA 9 (C) · UN NEGOCIO NO SE APRUEBA A SÍ MISMO
// ───────────────────────────────────────────────────────────────────────────
// El alta está bien: nace con `aprobado: false`. El agujero era lo de después —
// la regla dejaba al negocio escribir cualquier campo del suyo, así que se
// aprobaba solo con una escritura y salía en la app del cliente. Y encima
// desaparecía de la bandeja de pendientes del dueño, que solo enseña los que
// tienen `aprobado === false`: se colaba sin que nadie lo viera pasar.
//
// En el mismo documento vive `creditos`, que es dinero y que el panel enseña.
// También se lo escribía el propio negocio.

describe('REGLA 9 · un negocio no se aprueba a sí mismo', () => {
  const sembrarNegocios = async () => {
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const { doc, setDoc } = FS;
      await setDoc(doc(db, 'restaurantes/r1'), {
        nombre: 'DONDE MECHE', duenoNombre: 'MECHE', duenoTelefono: '+573001112233',
        email: 'meche@ejemplo.com', rol: 'dueno', activo: true,
        aprobado: false, estadoAprobacion: 'pendiente', creditos: 0,
        menu: [], abierto: true, perfilCompleto: true,
      });
      await setDoc(doc(db, 'restaurantes/r2'), {
        nombre: 'EL OTRO', rol: 'dueno', activo: true,
        aprobado: true, estadoAprobacion: 'aprobado', creditos: 50000, menu: [],
      });
    });
  };

  // ── EL ATAQUE ────────────────────────────────────────────────────────────
  it('EL ATAQUE · el negocio NO puede ponerse aprobado él solo', async () => {
    await sembrarNegocios();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('r1'), 'restaurantes/r1'), { aprobado: true }));
  });

  it('EL ATAQUE · ni colándolo de paso junto a un cambio legítimo', async () => {
    await sembrarNegocios();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('r1'), 'restaurantes/r1'), {
      nombre: 'DONDE MECHE 2', aprobado: true,
    }));
  });

  it('EL ATAQUE · ni por la puerta de al lado, cambiando estadoAprobacion', async () => {
    await sembrarNegocios();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('r1'), 'restaurantes/r1'), { estadoAprobacion: 'aprobado' }));
  });

  it('LA PLATA · el negocio NO puede escribirse créditos (lo que la REGLA 7 cerró para las personas)', async () => {
    await sembrarNegocios();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('r1'), 'restaurantes/r1'), { creditos: 900000 }));
  });

  it('tampoco activo, rol ni las fechas de aprobación', async () => {
    await sembrarNegocios();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('r1'), 'restaurantes/r1'), { activo: false }));
    await RUT.assertFails(updateDoc(doc(como('r1'), 'restaurantes/r1'), { rol: 'admin' }));
    await RUT.assertFails(updateDoc(doc(como('r1'), 'restaurantes/r1'), { fechaAprobacion: '2026-01-01' }));
  });

  // ── EL ALTA, QUE NO SE PUEDE ROMPER ──────────────────────────────────────
  // Esto es EXACTAMENTE lo que escribe aliados/Login.js desde la tanda 2: el
  // resultado de sinLoPrivado(datos). Ya no lleva duenoNombre, duenoTelefono,
  // email ni creditos — esos van al cuarto, en el segundo setDoc del registro.
  // Si esta prueba se pusiera roja, un negocio nuevo no podría darse de alta.
  it('el alta de un negocio sigue funcionando tal cual (aliados/Login.js)', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(setDoc(doc(como('nuevo1'), 'restaurantes/nuevo1'), {
      nombre: 'NUEVO', rol: 'dueno', tipoNegocio: 'restaurante',
      activo: true, aprobado: false, estadoAprobacion: 'pendiente',
      menu: [], tours: [], fechaCreacion: '2026-08-24T00:00:00.000Z',
    }));
  });

  // ── LA TANDA 2: EL ESCAPARATE NO VUELVE A LLENARSE ───────────────────────
  // Vaciar los 3 documentos no sirve de nada si la próxima pantalla que guarde
  // el perfil los mete otra vez. Y no fallaría nada al hacerlo: el dato
  // simplemente reaparecería en la colección que se descarga cualquier cliente.
  it('EL ESCAPARATE · un negocio NO puede nacer con los datos del dueño dentro', async () => {
    const { doc, setDoc } = FS;
    const base = { nombre: 'NUEVO', rol: 'dueno', activo: true, aprobado: false, estadoAprobacion: 'pendiente' };
    await RUT.assertFails(setDoc(doc(como('nv2'), 'restaurantes/nv2'), { ...base, duenoNombre: 'ANA' }));
    await RUT.assertFails(setDoc(doc(como('nv3'), 'restaurantes/nv3'), { ...base, duenoTelefono: '+573009998877' }));
    await RUT.assertFails(setDoc(doc(como('nv4'), 'restaurantes/nv4'), { ...base, email: 'ana@ejemplo.com' }));
    await RUT.assertFails(setDoc(doc(como('nv5'), 'restaurantes/nv5'), { ...base, fcmToken: 'tok' }));
  });

  it('EL ESCAPARATE · ni devolverlos después', async () => {
    await sembrarNegocios();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('r1'), 'restaurantes/r1'), { duenoTelefono: '+570000000000' }));
    await RUT.assertFails(updateDoc(doc(como('r1'), 'restaurantes/r1'), { email: 'otro@ejemplo.com' }));
    await RUT.assertFails(updateDoc(doc(como('r1'), 'restaurantes/r1'), { fcmToken: 'tok9' }));
  });

  // Y ESTA es la que permite hacer el vaciado y el despliegue en cualquier orden.
  // El sembrado de arriba deja a r1 con los datos del dueño DENTRO, como están
  // los 3 documentos de verdad antes de vaciarlos. Si la regla mirase keys() en
  // vez de affectedKeys(), ese negocio no podría ni guardar su perfil hasta que
  // pasara el script — una ventana en la que la app queda rota sin avisar.
  it('EL ESCAPARATE · un negocio TODAVÍA sin vaciar sigue guardando su perfil', async () => {
    await sembrarNegocios();
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('r1'), 'restaurantes/r1'), {
      descripcion: 'La mejor comida', horarioApertura: 7, perfilCompleto: true,
    }));
  });

  // Ojo con esta: antes ponia DOS sellos a la vez (aprobado y estadoAprobacion).
  // La cazeria de mutantes lo delato — al quitar el candado de aprobado, la
  // prueba seguia verde porque la negaba el OTRO candado. Aqui va el sello solo,
  // con el estado en pendiente, para que lo unico que pueda negarla sea el
  // candado que dice probar.
  it('pero NO puede nacer ya aprobado', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('nuevo2'), 'restaurantes/nuevo2'), {
      nombre: 'TRAMPOSO', rol: 'dueno', activo: true,
      aprobado: true, estadoAprobacion: 'pendiente',
    }));
  });

  // CAMBIÓ EN LA TANDA 2 (24-ago-2026). Antes 'creditos' podía venir en el alta,
  // valiendo cero, y lo que se negaba era traerlo con plata dentro. Ahora el
  // escaparate no lleva créditos EN ABSOLUTO —viven en el cuarto—, así que se
  // niegan los dos casos. Se comprueban los dos a propósito: si mañana alguien
  // sacara 'creditos' de camposPrivados(), el de cero volvería a colarse.
  it('ni nacer con plata en el bolsillo — ni con la cartera vacía', async () => {
    const { doc, setDoc } = FS;
    const base = { nombre: 'TRAMPOSO', rol: 'dueno', activo: true, aprobado: false, estadoAprobacion: 'pendiente' };
    await RUT.assertFails(setDoc(doc(como('nuevo3'), 'restaurantes/nuevo3'), { ...base, creditos: 900000 }));
    await RUT.assertFails(setDoc(doc(como('nuevo4'), 'restaurantes/nuevo4'), { ...base, creditos: 0 }));
  });

  it('ni con el sello de aprobado puesto por otro lado', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('nuevo4'), 'restaurantes/nuevo4'), {
      nombre: 'TRAMPOSO', rol: 'dueno', aprobado: false, estadoAprobacion: 'aprobado',
    }));
  });

  // Antes NO sembraba, así que 'r1' no existía y esto no era una suplantación:
  // era un alta en un id libre. Ahora el negocio existe de verdad.
  it('y nadie puede registrarse con el id de otro', async () => {
    await sembrarNegocios();
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('nuevo5'), 'restaurantes/r1'), {
      nombre: 'SUPLANTADOR', rol: 'dueno', aprobado: false,
    }));
  });

  // ── EL ATAQUE POR OMISIÓN ────────────────────────────────────────────────
  // El que casi se cuela. No se trata de poner `aprobado: true`, sino de NO PONER
  // el campo. Antes pasaba, y el resultado era idéntico: el cliente lo enseña
  // (filtra `aprobado !== false`, y «no existe» no es «false») y la bandeja de
  // pendientes del panel no lo ve (busca `aprobado == false`, y un campo ausente
  // no cuadra). Las cinco pruebas de alta que había mandaban SIEMPRE los campos,
  // así que ninguna tocaba esta rama: probaban solo lo que no podía fallar.
  it('EL ATAQUE POR OMISIÓN · no puede registrarse SIN el campo aprobado', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('fantasma1'), 'restaurantes/fantasma1'), {
      nombre: 'FANTASMA', tipoNegocio: 'restaurante', rol: 'dueno',
      perfilCompleto: true, menu: [], estadoAprobacion: 'pendiente',
    }));
  });

  // AQUÍ YA NO SE PRUEBA «ni sin creditos», y es a propósito (tanda 2,
  // 24-ago-2026): desde que el escaparate se vació, registrarse SIN créditos es
  // el camino NORMAL, no un ataque — el campo ni siquiera puede venir. El dinero
  // se vigila ahora en el cuarto privado, y allí «sin creditos» significa «sin
  // dinero», que es el estado seguro. Los dos casos que quedan sí siguen siendo
  // ataques: un negocio sin estado de aprobación no sale en pendientes, y uno sin
  // rol no se sabe qué es.
  it('EL ATAQUE POR OMISIÓN · ni sin estadoAprobacion, ni sin rol', async () => {
    const { doc, setDoc } = FS;
    const base = { nombre: 'FANTASMA', rol: 'dueno', aprobado: false, estadoAprobacion: 'pendiente' };
    const sin = (campo) => { const c = { ...base }; delete c[campo]; return c; };
    await RUT.assertFails(setDoc(doc(como('fantasma2'), 'restaurantes/fantasma2'), sin('estadoAprobacion')));
    await RUT.assertFails(setDoc(doc(como('fantasma4'), 'restaurantes/fantasma4'), sin('rol')));
  });

  it('EL ATAQUE POR OMISIÓN · un negocio VACÍO del todo tampoco entra', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('fantasma5'), 'restaurantes/fantasma5'), { nombre: 'FANTASMA' }));
  });

  it('ni puede nacer nombrándose admin, ni con la fecha de aprobación puesta', async () => {
    const { doc, setDoc } = FS;
    const base = { nombre: 'X', aprobado: false, estadoAprobacion: 'pendiente' };
    await RUT.assertFails(setDoc(doc(como('fant6'), 'restaurantes/fant6'), { ...base, rol: 'admin' }));
    await RUT.assertFails(setDoc(doc(como('fant7'), 'restaurantes/fant7'), { ...base, rol: 'dueno', fechaAprobacion: '2026-01-01' }));
  });

  it('y el sello de texto no cuela: aprobado "true" no es aprobado false', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('fant8'), 'restaurantes/fant8'), {
      nombre: 'X', rol: 'dueno', aprobado: 'true', estadoAprobacion: 'pendiente',
    }));
  });

  // ── EL MISMO VALOR NO CUENTA COMO CAMBIO ─────────────────────────────────
  // Firestore solo mira los campos que CAMBIAN de valor. Reenviar un congelado
  // con el valor que ya tenía NO cuenta como tocarlo — comprobado. Importa
  // porque una pantalla que lea el negocio y lo reescriba entero seguiría
  // funcionando: no se rompe nada por reenviar de más.
  it('reenviar un campo congelado con SU MISMO valor no rompe nada', async () => {
    await sembrarNegocios();
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('r1'), 'restaurantes/r1'), {
      nombre: 'OTRO NOMBRE', aprobado: false, creditos: 0, rol: 'dueno',
    }));
  });

  it('pero cambiarlo aunque sea un poco, sí', async () => {
    await sembrarNegocios();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('r1'), 'restaurantes/r1'), {
      nombre: 'OTRO NOMBRE', aprobado: false, creditos: 1, rol: 'dueno',
    }));
  });

  // ── LO QUE EL NEGOCIO TIENE QUE SEGUIR PUDIENDO HACER ────────────────────
  it('el negocio sigue mandando en LO SUYO: menú, horario, logo, nombre', async () => {
    await sembrarNegocios();
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('r1'), 'restaurantes/r1'), {
      menu: [{ id: 1, nombre: 'Arepa', precio: 5000 }],
      nombre: 'DONDE MECHE', horarioApertura: '08:00', logo: 'x.png',
    }));
  });

  it('y sigue abriendo, cerrando y poniendo la demora (aliados/App.js:171 y :179)', async () => {
    await sembrarNegocios();
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('r1'), 'restaurantes/r1'), { abierto: false }));
    await RUT.assertSucceeds(updateDoc(doc(como('r1'), 'restaurantes/r1'), { demoraMin: 30 }));
  });

  it('la agencia sigue guardando sus tours (aliados/Tours.js:88)', async () => {
    await sembrarNegocios();
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('r1'), 'restaurantes/r1'), {
      tours: [{ id: 1, nombre: 'Cabo de la Vela', precio: 150000 }],
    }));
  });

  // ── EL PANEL, QUE ES QUIEN DECIDE ────────────────────────────────────────
  it('el PANEL sigue aprobando (admin/Restaurantes.js:53 y admin/AliadosPendientes.js:26)', async () => {
    await sembrarNegocios();
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('eladmin'), 'restaurantes/r1'), {
      aprobado: true, estadoAprobacion: 'aprobado', activo: true, fechaAprobacion: '2026-08-24',
    }));
  });

  it('el PANEL sigue suspendiendo y rechazando (admin/Restaurantes.js:58 y :63)', async () => {
    await sembrarNegocios();
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('eljefe'), 'restaurantes/r2'), {
      aprobado: false, estadoAprobacion: 'suspendido',
    }));
    await RUT.assertSucceeds(updateDoc(doc(como('eladmin'), 'restaurantes/r2'), {
      aprobado: false, estadoAprobacion: 'rechazado', fechaRechazo: '2026-08-24',
    }));
  });

  // AMARRE · el guardado del perfil es el que más campos manda de una sola vez (12).
  // Se repite aquí TAL CUAL lo escribe la pantalla, campo por campo: si algún día
  // alguien mete en ese guardado un campo del panel, esta prueba se pone roja antes
  // de que el dueño del negocio se quede sin poder guardar su propio perfil.
  it('EL PERFIL ENTERO se sigue guardando igual (aliados/PerfilRestaurante.js:150)', async () => {
    await sembrarNegocios();
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('r1'), 'restaurantes/r1'), {
      descripcion: 'Comida guajira', direccion: 'Cl. 40, Riohacha', ubicacion: null,
      categoria: 'Comida rápida', horarioApertura: 8, horarioCierre: 22,
      pedidoMinimo: 10000, costoDomicilio: 3000, tiempoEntrega: 30,
      logo: 'logo.png', perfilCompleto: true, abierto: true,
    }));
  });

  it('y el de la agencia también (aliados/PerfilAgencia.js:90)', async () => {
    await sembrarNegocios();
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('r1'), 'restaurantes/r1'), {
      descripcion: 'Tours por La Guajira', direccion: 'Riohacha', ubicacion: null,
      telefono: '+573001112233', horarioApertura: 6, horarioCierre: 20,
      categorias: ['tours'], logo: 'logo.png', perfilCompleto: true, abierto: true,
    }));
  });

  // ESTA PRUEBA DECÍA LO CONTRARIO hasta la tanda 2 (24-ago-2026): comprobaba que
  // el dueño SÍ pudiera guardar su token aquí, porque aliados/Notificaciones.js
  // lo escribía en el escaparate. Desde la tanda 1b-2a lo escribe en el cuarto
  // (y allí hay dos pruebas que lo comprueban), así que ahora esto es al revés:
  // el token es una llave para mandarle avisos al teléfono del dueño, y no puede
  // acabar en la colección que se descarga cualquier cliente.
  it('y el token de avisos YA NO puede guardarse aquí (va al cuarto)', async () => {
    await sembrarNegocios();
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('r1'), 'restaurantes/r1'), { fcmToken: 'tok9' }, { merge: true }));
  });

  // OJO: esta NO prueba nada del panel. `allow read` sigue abierto a cualquiera
  // con cuenta, así que pasa con cualquier sesión y seguiría verde aunque
  // esAdmin() se rompiera entero. Se deja porque documenta el estado REAL de la
  // lectura — que sigue abierta, y es la deuda de sacar de aquí el teléfono, el
  // correo y los créditos del dueño. El nombre dice lo que de verdad hace.
  it('la lista de negocios la sigue viendo CUALQUIERA con cuenta (deuda: la lectura sigue abierta)', async () => {
    await sembrarNegocios();
    const { collection, getDocs } = FS;
    await RUT.assertSucceeds(getDocs(collection(como('eladmin'), 'restaurantes')));
  });

  // ── LOS EXTRAÑOS ─────────────────────────────────────────────────────────
  it('un negocio NO puede tocar el de al lado', async () => {
    await sembrarNegocios();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('r1'), 'restaurantes/r2'), { nombre: 'ROBADO' }));
    await RUT.assertFails(updateDoc(doc(como('r1'), 'restaurantes/r2'), { aprobado: false }));
  });

  it('y un cliente cualquiera tampoco', async () => {
    await sembrarNegocios();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('pasajero1'), 'restaurantes/r1'), { aprobado: true }));
  });

  it('el cliente SIGUE viendo la lista para escoger dónde pedir (Restaurantes.js:102)', async () => {
    await sembrarNegocios();
    const { collection, getDocs } = FS;
    await RUT.assertSucceeds(getDocs(collection(como('pasajero1'), 'restaurantes')));
  });
});

// ───────────────────────────────────────────────────────────────────────────
// REGLA 9 · EL CUARTO DE ATRÁS DE CADA NEGOCIO
// ───────────────────────────────────────────────────────────────────────────
// El documento del negocio es el ESCAPARATE: la app del pasajero se descarga la
// colección entera para enseñar dónde pedir. Medido el 24-ago-2026: dentro de
// ese escaparate viajaban el NOMBRE, el TELÉFONO y el CORREO del dueño de los 3
// negocios, más sus créditos. A cualquiera que se registrara le llegaban solos.
//
// Aquí vive lo que no es para el escaparate. El id del documento es el mismo que
// el del negocio, así que «¿es tuyo?» se contesta sin leer nada de nadie.

describe('REGLA 9 · el cuarto de atrás de cada negocio', () => {
  const sembrarCuartos = async () => {
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const { doc, setDoc } = FS;
      await setDoc(doc(ctx.firestore(), 'restaurantesPrivado/r1'), {
        duenoNombre: 'MECHE', duenoTelefono: '+573001112233',
        email: 'meche@ejemplo.com', creditos: 0,
      });
      await setDoc(doc(ctx.firestore(), 'restaurantesPrivado/r2'), {
        duenoNombre: 'EL OTRO', duenoTelefono: '+573009998877',
        email: 'otro@ejemplo.com', creditos: 50000,
      });
    });
  };

  // ── LO QUE SE CIERRA ─────────────────────────────────────────────────────
  it('LA FUGA · un cliente cualquiera NO puede leer los datos del dueño', async () => {
    await sembrarCuartos();
    const { doc, getDoc } = FS;
    await RUT.assertFails(getDoc(doc(como('pasajero1'), 'restaurantesPrivado/r1')));
  });

  it('LA FUGA · ni pedir la lista entera, que era como llegaban solos', async () => {
    await sembrarCuartos();
    const { collection, getDocs } = FS;
    await RUT.assertFails(getDocs(collection(como('pasajero1'), 'restaurantesPrivado')));
  });

  // ── ¿PUEDE EL PANEL PEDIR LA LISTA ENTERA? ───────────────────────────────
  // Esta es LA prueba que decide cómo se puede escribir el panel. Sus tres
  // pantallas (admin/Restaurantes.js, Turismo.js y AliadosPendientes.js) piden la
  // colección de negocios SIN filtro y tienen que juntar cada negocio con su
  // cuarto. Si el panel NO pudiera pedir la lista de cuartos, habría que pedirlos
  // de uno en uno —una consulta más por cada negocio— y el diseño sería otro.
  //
  // Se comprueba EJECUTANDO, no razonando. En una consulta de LISTA las reglas se
  // evalúan de otra manera que al pedir UN documento, y una condición que necesite
  // mirar dentro del documento tumba la consulta entera. Aquí la condición es el
  // id del camino (uid == negocioId) y esAdmin(), que no miran dentro — pero eso
  // hay que VERLO. Es la misma trampa que en la REGLA 6 dejó al panel ciego por el
  // orden de una cláusula, y allí también se descubrió corriéndolo.
  it('EL PANEL · SÍ puede pedir la lista entera de cuartos', async () => {
    await sembrarCuartos();
    const { collection, getDocs } = FS;
    const lista = await RUT.assertSucceeds(getDocs(collection(como('eladmin'), 'restaurantesPrivado')));
    // Se cuentan los dos a propósito, aunque en Firestore una consulta de lista con
    // un solo documento prohibido falla ENTERA — o sea que esto solo puede ser 0 o 2,
    // nunca 1. Se deja escrito porque leer «size, 2» sin saber eso hace pensar que
    // podrían llegar a medias, y no es así.
    assert.strictEqual(lista.size, 2,
      'el panel tiene que ver LOS DOS cuartos: sin ellos, las fichas saldrían sin ' +
      'nombre ni teléfono del dueño.');
  });

  // El negocio no puede pedir la lista NI para sacar el suyo: en una consulta sin
  // filtro, un solo documento que no le toque tumba la consulta entera. Que es lo
  // que se quiere — así no hay forma de barrer la colección.
  it('EL PANEL · pero un negocio NO puede pedirla, ni para sacar el suyo', async () => {
    await sembrarCuartos();
    const { collection, getDocs } = FS;
    await RUT.assertFails(getDocs(collection(como('r1'), 'restaurantesPrivado')));
  });

  it('un negocio NO puede mirar el cuarto del negocio de al lado', async () => {
    await sembrarCuartos();
    const { doc, getDoc } = FS;
    await RUT.assertFails(getDoc(doc(como('r1'), 'restaurantesPrivado/r2')));
  });

  it('ni escribir en él', async () => {
    await sembrarCuartos();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('r1'), 'restaurantesPrivado/r2'), { duenoTelefono: '+570000000000' }));
  });

  it('ni crearle uno a un negocio que no es suyo', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('r1'), 'restaurantesPrivado/r9'), { duenoNombre: 'ROBADO' }));
  });

  // ── LA PLATA ─────────────────────────────────────────────────────────────
  it('LA PLATA · el negocio ve su saldo pero NO se lo escribe', async () => {
    await sembrarCuartos();
    const { doc, getDoc, updateDoc } = FS;
    await RUT.assertSucceeds(getDoc(doc(como('r1'), 'restaurantesPrivado/r1')));
    await RUT.assertFails(updateDoc(doc(como('r1'), 'restaurantesPrivado/r1'), { creditos: 900000 }));
  });

  it('LA PLATA · ni nace con plata en el bolsillo', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('nuevo9'), 'restaurantesPrivado/nuevo9'), {
      duenoNombre: 'TRAMPOSO', creditos: 900000,
    }));
  });

  it('LA PLATA · pero el panel SÍ se la puede poner', async () => {
    await sembrarCuartos();
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('eladmin'), 'restaurantesPrivado/r1'), { creditos: 50000 }));
  });

  // ── LA PUERTA DE ATRÁS A LA REGLA 9-C ────────────────────────────────────
  // El negocio no puede aprobarse solo en el ESCAPARATE: eso lo cerró la REGLA
  // 9-C. Pero hasta el 24-ago-2026 SÍ podía escribir lo que quisiera en su
  // propio cuarto, y desde la tanda 1b-2b el panel lee de ahí. La segunda
  // opinión lo ejecutó: escribiendo {aprobado:true} en su cuarto, el negocio se
  // borraba de la bandeja de pendientes del panel y salía como APROBADO.
  //
  // Nadie lo revisaría nunca. Estas cinco pruebas cierran esa puerta donde nace.
  it('LA PUERTA DE ATRÁS · el negocio NO se aprueba desde su cuarto', async () => {
    await sembrarCuartos();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('r1'), 'restaurantesPrivado/r1'), { aprobado: true }));
  });

  it('LA PUERTA DE ATRÁS · ni cambia su estado de aprobación', async () => {
    await sembrarCuartos();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('r1'), 'restaurantesPrivado/r1'), { estadoAprobacion: 'aprobado' }));
  });

  it('LA PUERTA DE ATRÁS · ni se nombra admin, ni se reactiva', async () => {
    await sembrarCuartos();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('r1'), 'restaurantesPrivado/r1'), { rol: 'admin' }));
    await RUT.assertFails(updateDoc(doc(como('r1'), 'restaurantesPrivado/r1'), { activo: true }));
  });

  // Esta es la que se escapa si solo se congela el UPDATE: no hay ningún campo
  // que cambiar, el cuarto NACE ya con la mentira dentro.
  it('LA PUERTA DE ATRÁS · ni nace el cuarto ya aprobado', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('nuevo8'), 'restaurantesPrivado/nuevo8'), {
      duenoNombre: 'TRAMPOSO', aprobado: true, estadoAprobacion: 'aprobado',
    }));
  });

  // Y que el remate no le quite nada a quien trabaja: el registro escribe los
  // cinco campos privados y ninguno de esos siete. Si esta se pusiera roja, un
  // negocio nuevo no podría ni darse de alta.
  it('LA PUERTA DE ATRÁS · pero el negocio nuevo sigue naciendo bien', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(setDoc(doc(como('nuevo8'), 'restaurantesPrivado/nuevo8'), {
      duenoNombre: 'MERCEDES', duenoTelefono: '+573001112233',
      email: 'meche@ejemplo.com', creditos: 0,
    }));
  });

  // ── LO QUE TIENE QUE FUNCIONAR ───────────────────────────────────────────
  it('el REGISTRO crea el cuarto del negocio (aliados/Login.js)', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(setDoc(doc(como('nuevo8'), 'restaurantesPrivado/nuevo8'), {
      duenoNombre: 'ANA', duenoTelefono: '+573001112233',
      email: 'ana@ejemplo.com', creditos: 0,
    }));
  });

  // LAS DOS DE ABAJO DEFIENDEN UN CAMINO VIVO desde la tanda 1b-2a (24-ago-2026):
  // aliados/Notificaciones.js escribe aquí el token del dueño y las dos funciones
  // de avisos lo leen de aquí.
  //
  // De las dos, la del cuarto que YA EXISTE es el camino normal: el registro crea
  // el cuarto y el token entra después, por update. La del cuarto que NO existe es
  // el repuesto —para cuando el registro no llegó a crearlo—, y es la que justifica
  // que el create tolere que falte 'creditos': ahí el token es el único campo.
  it('EL TOKEN · el dueño guarda su token aunque el cuarto no exista todavía', async () => {
    // El caso que obliga a que el create tolere que falte 'creditos': el cuarto
    // nace con UN solo campo.
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(setDoc(doc(como('nuevo7'), 'restaurantesPrivado/nuevo7'), { fcmToken: 'tok1' }, { merge: true }));
  });

  it('EL TOKEN · y lo actualiza cuando ya existe', async () => {
    await sembrarCuartos();
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(setDoc(doc(como('r1'), 'restaurantesPrivado/r1'), { fcmToken: 'tok2' }, { merge: true }));
  });

  it('el dueño sigue pudiendo corregir su nombre y su teléfono', async () => {
    await sembrarCuartos();
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('r1'), 'restaurantesPrivado/r1'), {
      duenoNombre: 'MERCEDES', duenoTelefono: '+573004445566',
    }));
  });

  it('el PANEL lee el de cualquiera y puede pedir la lista (la necesita para buscar)', async () => {
    await sembrarCuartos();
    const { doc, getDoc, collection, getDocs } = FS;
    await RUT.assertSucceeds(getDoc(doc(como('eladmin'), 'restaurantesPrivado/r1')));
    await RUT.assertSucceeds(getDocs(collection(como('eljefe'), 'restaurantesPrivado')));
  });

  it('nadie borra un cuarto, ni su dueño (REGLA 12)', async () => {
    await sembrarCuartos();
    const { doc, deleteDoc } = FS;
    await RUT.assertFails(deleteDoc(doc(como('r1'), 'restaurantesPrivado/r1')));
    await RUT.assertFails(deleteDoc(doc(como('eladmin'), 'restaurantesPrivado/r1')));
  });

  it('y sin sesión no se entra de ninguna forma', async () => {
    await sembrarCuartos();
    const { doc, getDoc } = FS;
    await RUT.assertFails(getDoc(doc(sinCuenta(), 'restaurantesPrivado/r1')));
  });
});
