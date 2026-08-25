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
    // El negocio r1 tiene que EXISTIR: desde el 25-ago-2026 un cliente no puede
    // crear un pedido contra un restauranteId que no es un negocio de verdad.
    await setDoc(doc(db, 'restaurantes/r1'), { nombre: 'La Guajira', activo: true });
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

  // ESTA PRUEBA DABA SEGURIDAD FALSA. Escribía `{ estrellas: 5, deQuien: ... }`,
  // que NO es lo que escribe ninguna de las dos pantallas de calificar: ni lleva
  // firma, ni viaje, ni pedido, y `deQuien` no existe en el proyecto. Así que
  // decía «se sigue pudiendo calificar» sin ejercitar el camino de verdad.
  // Se cambia por las dos formas REALES, y viven ahora en su propio bloque más
  // abajo (REGLA 10 · una calificación la firma quien la escribe).
  it('se sigue pudiendo calificar un viaje, como lo hace la app', async () => {
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const { doc, setDoc } = FS;
      await setDoc(doc(ctx.firestore(), 'viajes/vcal'), {
        pasajeroId: 'pasajero1', conductorId: 'conductor1', estado: 'finalizado',
      });
    });
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(setDoc(doc(como('pasajero1'), 'calificaciones/cal2'), {
      viajeId: 'vcal', quienCalifica: 'pasajero',
      calificadoId: 'conductor1', estrellas: 5, comentario: '', fecha: '2026-08-25T00:00:00.000Z',
    }));
  });

  // Corregida el 24-ago-2026 (REGLA 9): decia { total: 25000 } y nada mas. Eso NO
  // es lo que hace la app — Restaurantes.js:322 escribe 15 campos y SIEMPRE el
  // restaurante. Un pedido sin restaurante no lo puede atender nadie ni reclamar
  // nadie: la prueba estaba dando por bueno un pedido huerfano.
  // Lleva estado 'nuevo' porque es lo que escribe la app: Restaurantes.js:337 no
  // pone otra cosa nunca. Antes esta prueba lo omitia y pasaba igual; desde el
  // 25-ago-2026 el pedido del cliente tiene que NACER 'nuevo'.
  it('un restaurante sigue pudiendo recibir un pedido', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(
      setDoc(doc(como('pasajero1'), 'pedidosRestaurantes/ped2'), { restauranteId: 'r1', clienteId: 'pasajero1', estado: 'nuevo', total: 25000 })
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
  //
  // ESTA PRUEBA DECÍA LO CONTRARIO, y llevaba dos días dando seguridad falsa.
  // Se escribió el 23-ago-2026 para defender que el canje siguiera funcionando,
  // cuando `Creditos.js:111` PEDÍA el documento del código desde la app. Pero la
  // REGLA 7 (24-ago) movió el canje a la función `canjearCodigoRecarga`, y desde
  // entonces la app ya NO lee esta colección: solo llama a la función, que corre
  // con el SDK de administrador y se salta estas reglas.
  //
  // O sea que desde el 24-ago esta prueba defendía un camino que ya no existe —
  // y de paso justificaba tener el `get` abierto. Se le da la vuelta.
  it('NADIE fuera del panel puede pedir un código, ni sabiéndoselo', async () => {
    const { doc, getDoc } = FS;
    await RUT.assertFails(getDoc(doc(como('conductor1'), 'codigos/cod1')),
      'Un código lleva dentro cuentaDestino, banco, numComprobante y el teléfono del ' +
      'conductor que hizo la recarga. Quien acertara el código se los llevaba.');
    await RUT.assertFails(getDoc(doc(como('pasajero1'), 'codigos/cod1')));
  });

  it('el canje NO se rompe: lo hace la función, no la app', async () => {
    // La app solo llama a canjearCodigoRecarga (guajirago/src/Creditos.js:111).
    // Esa función usa el SDK de administrador, que no pasa por estas reglas. Aquí
    // se deja constancia de que el camino del cliente está cerrado A PROPÓSITO y
    // de que el panel sí puede — que es quien los crea y los anula.
    const { doc, getDoc } = FS;
    await RUT.assertSucceeds(getDoc(doc(como('eladmin'), 'codigos/cod1')));
  });

  // ── LO GORDO: EL DINERO DE LA NADA ───────────────────────────────────────
  // Hasta el 25-ago-2026 `create, update` estaba abierto a cualquiera con cuenta.
  // La función del canje está bien hecha, pero se FÍA de `valor` y `usado`, y
  // esos dos los escribía el cliente. Nadie lo probaba: las 7 pruebas del canje
  // (pruebas/funciones.test.js) siembran el código saltándose las reglas, así que
  // ninguna llegaba a preguntar si el usuario podía crearlo él mismo.
  it('EL DINERO DE LA NADA · nadie se fabrica un código de cinco millones', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('conductor1'), 'codigos/GGO-INVENTADO'), {
      valor: 5000000, usado: false,
    }), 'Con esto se crea el código y se canja: saldo de la nada, sin tope y en bucle.');
  });

  it('EL DINERO DE LA NADA · ni revive uno ya gastado para cobrarlo otra vez', async () => {
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const { doc, setDoc } = FS;
      await setDoc(doc(ctx.firestore(), 'codigos/GGO-GASTADO'), { valor: 50000, usado: true });
    });
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('conductor1'), 'codigos/GGO-GASTADO'), { usado: false }));
  });

  it('EL DINERO DE LA NADA · ni le sube el valor a uno de verdad', async () => {
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('conductor1'), 'codigos/cod1'), { valor: 9000000 }));
  });

  it('pero el PANEL sí los crea y los anula (Codigos.js:208 y :266)', async () => {
    const { doc, setDoc, updateDoc } = FS;
    await RUT.assertSucceeds(setDoc(doc(como('eladmin'), 'codigos/GGO-NUEVO'), {
      valor: 50000, usado: false, fechaCreacion: '2026-08-25T00:00:00.000Z', creadoPor: 'eladmin',
    }));
    await RUT.assertSucceeds(updateDoc(doc(como('eladmin'), 'codigos/cod1'), { anulado: true }));
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

  // ── EL COMPROBANTE LO TIENE QUE FIRMAR EL OTRO (25-ago-2026) ─────────────
  // La segunda puerta por la que se fabricaba el comprobante de una calificacion.
  // La primera -el viaje- se cerro por la manana, y la segunda opinion volvio a
  // reproducir el MISMO ataque por aqui, con aquel arreglo puesto: otra vez 15 de
  // 15 estrellas de una y la media de la victima en 1.0.
  it('EL ATAQUE · un pedido NO se puede crear contra alguien que no es un negocio', async () => {
    const { collection, addDoc } = FS;
    await RUT.assertFails(addDoc(collection(como('pasajero1'), 'pedidosRestaurantes'), {
      restauranteId: 'conductor1', clienteId: 'pasajero1', estado: 'nuevo', total: 30000,
    }), 'Asi se le colgaban estrellas de una a un CONDUCTOR, que ni siquiera es un negocio.');
  });

  // EL ATAQUE CONTRA UN RIVAL, que es el que se cuela si solo se mira el flujo:
  // el restaurante de al lado SI existe, asi que el candado del exists() no lo
  // para. Lo que lo para es que el pedido tenga que NACER 'nuevo'. Sin esta
  // prueba, un mutante que borraba esa linea sobrevivia a las 382: el atacante se
  // creaba el pedido YA entregado y lo calificaba de una.
  it('EL ATAQUE · ni creando el pedido YA entregado contra un rival', async () => {
    const { collection, addDoc } = FS;
    await RUT.assertFails(addDoc(collection(como('pasajero1'), 'pedidosRestaurantes'), {
      restauranteId: 'r1', clienteId: 'pasajero1', estado: 'entregado', total: 30000,
    }), 'Nacer entregado es fabricarse el comprobante de una sola vez.');
    await RUT.assertFails(addDoc(collection(como('pasajero1'), 'pedidosRestaurantes'), {
      restauranteId: 'r1', clienteId: 'pasajero1', estado: 'cerrado', total: 30000,
    }));
    // Y tampoco a medio camino del flujo, que seria el paso previo.
    await RUT.assertFails(addDoc(collection(como('pasajero1'), 'pedidosRestaurantes'), {
      restauranteId: 'r1', clienteId: 'pasajero1', estado: 'confirmado', total: 30000,
    }));
  });

  // ── CINCO ESTRELLAS A SI MISMO · POR LA PUERTA DEL PEDIDO ────────────────
  // La rama esDelNegocio() del create NO le exige al negocio que el pedido nazca
  // 'nuevo' ni le mira el clienteId: el dueno se hacia un pedido a si mismo ya
  // 'entregado' y se ponia las estrellas. Medido: 15 de 15, media 5.0. Y con el uid
  // compartido entre restaurantes/usuarios/conductores, un CONDUCTOR se registraba
  // un negocio con su propio uid y las estrellas caian sobre su media DE CONDUCTOR.
  // Sin calificadoId no entra: lo para el PAR (las estrellas tienen que ir para el
  // otro). La version anterior de esta prueba sembraba sobre 'ped1', que no tiene
  // ni clienteId ni restauranteId, asi que la negaba el PAR pasara lo que pasara:
  // sobrevivia a los SEIS mutantes, incluido quitar el candado entero. Lo cazo la
  // segunda opinion. Ahora el pedido es de verdad -del cliente, entregado, de un
  // negocio real-, o sea que lo unico que falta es el calificadoId.
  it('una calificacion SIN calificadoId no entra, aunque el pedido sea de verdad', async () => {
    const { doc, setDoc, addDoc, collection } = FS;
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'pedidosRestaurantes/pbueno'), {
        restauranteId: 'r1', clienteId: 'pasajero1', estado: 'entregado', total: 30000,
      });
    });
    // Con el calificadoId bueno SI entra: la semilla es valida.
    await RUT.assertSucceeds(addDoc(collection(como('pasajero1'), 'calificaciones'), {
      pedidoId: 'pbueno', calificadoId: 'r1', estrellas: 5,
    }));
    // Sin el campo, no.
    await RUT.assertFails(addDoc(collection(como('pasajero1'), 'calificaciones'), {
      pedidoId: 'pbueno', estrellas: 5,
    }));
    // Y vacio, tampoco.
    await RUT.assertFails(addDoc(collection(como('pasajero1'), 'calificaciones'), {
      pedidoId: 'pbueno', calificadoId: '', estrellas: 5,
    }));
  });

  it('EL ATAQUE · el negocio NO se pone estrellas a si mismo', async () => {
    const { doc, setDoc, addDoc, collection } = FS;
    // El negocio SI puede hacerse el pedido (es su rama), pero no calificarlo.
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'pedidosRestaurantes/pyo'), {
        restauranteId: 'r1', clienteId: 'r1', estado: 'entregado', total: 30000,
      });
    });
    await RUT.assertFails(addDoc(collection(como('r1'), 'calificaciones'), {
      pedidoId: 'pyo', calificadoId: 'r1', estrellas: 5,
    }), 'El que califica y el calificado son la misma persona.');
  });

  // ── Y EL TERCER CAMINO: LA SEGUNDA CUENTA PUESTA DE EMPLEADA ─────────────
  // «Nadie se califica a si mismo» NO bastaba, y lo midio la segunda opinion con
  // ese candado ya puesto: 15 de 15, media 5.0. La cadena era de UNA persona con
  // dos cuentas: A se registra un negocio con su propio uid (nadie tiene que
  // aprobarlo), nombra empleada a B, y B -que ya es «del negocio»- se fabrica el
  // pedido entregado y lo califica. El candado de auto-calificarse ni lo roza,
  // porque B no es A. Lo para !esDelNegocio(), que cubre las dos caras.
  it('EL ATAQUE · un EMPLEADO no le pone estrellas al negocio donde trabaja', async () => {
    const { doc, setDoc, addDoc, collection } = FS;
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      // La cuenta B, empleada activa de r1.
      await setDoc(doc(db, 'empleados/empleadoDeR1'), { restauranteId: 'r1', activo: true });
      // El pedido que B se fabrica a su propio nombre, ya entregado.
      await setDoc(doc(db, 'pedidosRestaurantes/pemp'), {
        restauranteId: 'r1', clienteId: 'empleadoDeR1', estado: 'entregado', total: 30000,
      });
    });
    await RUT.assertFails(addDoc(collection(como('empleadoDeR1'), 'calificaciones'), {
      pedidoId: 'pemp', calificadoId: 'r1', estrellas: 5,
    }), 'Quien trabaja en el negocio no le pone la nota al negocio.');
  });

  // Y un empleado DESPEDIDO (activo:false) ya no es del negocio, asi que SI puede
  // calificarlo como cualquier cliente. Es lo correcto y conviene fijarlo.
  it('pero un empleado despedido SI puede calificar como cualquier cliente', async () => {
    const { doc, setDoc, addDoc, collection } = FS;
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'empleados/exempleado'), { restauranteId: 'r1', activo: false });
      await setDoc(doc(db, 'pedidosRestaurantes/pex'), {
        restauranteId: 'r1', clienteId: 'exempleado', estado: 'entregado', total: 30000,
      });
    });
    await RUT.assertSucceeds(addDoc(collection(como('exempleado'), 'calificaciones'), {
      pedidoId: 'pex', calificadoId: 'r1', estrellas: 4,
    }));
  });

  // Y AL CLIENTE DE VERDAD no le quita nada: no trabaja donde pide.
  it('y el cliente de siempre sigue calificando su restaurante', async () => {
    const { doc, setDoc, addDoc, collection } = FS;
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'pedidosRestaurantes/pnormal'), {
        restauranteId: 'r1', clienteId: 'pasajero1', estado: 'entregado', total: 30000,
      });
    });
    await RUT.assertSucceeds(addDoc(collection(como('pasajero1'), 'calificaciones'), {
      pedidoId: 'pnormal', calificadoId: 'r1', estrellas: 5,
    }), 'Restaurantes.js:425. Si esto se cae, nadie puede calificar un restaurante.');
  });

  // LA CADENA ENTERA CONTRA UN RIVAL, de punta a punta.
  it('LA CADENA · contra un rival tampoco: ni naciendo entregado, ni moviendolo', async () => {
    const { doc, setDoc, updateDoc, addDoc, collection } = FS;
    // 1 - no puede nacer entregado
    await RUT.assertFails(addDoc(collection(como('pasajero1'), 'pedidosRestaurantes'), {
      restauranteId: 'r1', clienteId: 'pasajero1', estado: 'entregado', total: 30000,
    }));
    // 2 - naciendo 'nuevo' (lo unico que puede), no lo puede mover
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'pedidosRestaurantes/prival'), {
        restauranteId: 'r1', clienteId: 'pasajero1', estado: 'nuevo', total: 30000,
      });
    });
    await RUT.assertFails(updateDoc(doc(como('pasajero1'), 'pedidosRestaurantes/prival'), { estado: 'entregado' }));
    // 3 - y sin comprobante, la estrella de una no entra
    await RUT.assertFails(addDoc(collection(como('pasajero1'), 'calificaciones'), {
      pedidoId: 'prival', calificadoId: 'r1', estrellas: 1,
    }), 'Este es el ataque del informe: 15 de 15 y la media del rival en 1.0.');
  });

  it('EL ATAQUE · el cliente NO mueve su pedido por el flujo del restaurante', async () => {
    const { doc, setDoc, updateDoc } = FS;
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'pedidosRestaurantes/pmio'), {
        restauranteId: 'r1', clienteId: 'pasajero1', estado: 'nuevo', total: 30000,
      });
    });
    await RUT.assertFails(updateDoc(doc(como('pasajero1'), 'pedidosRestaurantes/pmio'), {
      estado: 'entregado',
    }), 'Marcarselo entregado uno mismo es fabricarse el comprobante para calificar.');
    await RUT.assertFails(updateDoc(doc(como('pasajero1'), 'pedidosRestaurantes/pmio'), {
      estado: 'cerrado',
    }));
    await RUT.assertFails(updateDoc(doc(como('pasajero1'), 'pedidosRestaurantes/pmio'), {
      estado: 'confirmado',
    }));
  });

  // LA CADENA ENTERA: sin poder fabricar el comprobante, la calificacion se cae.
  it('LA CADENA · un pedido que el cliente no puede entregar no sirve para calificar', async () => {
    const { doc, setDoc, updateDoc, addDoc, collection } = FS;
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'pedidosRestaurantes/pfalso'), {
        restauranteId: 'r1', clienteId: 'pasajero1', estado: 'nuevo', total: 30000,
      });
    });
    // 1 - no lo puede marcar entregado
    await RUT.assertFails(updateDoc(doc(como('pasajero1'), 'pedidosRestaurantes/pfalso'), { estado: 'entregado' }));
    // 2 - y por eso la calificacion tampoco entra
    await RUT.assertFails(addDoc(collection(como('pasajero1'), 'calificaciones'), {
      pedidoId: 'pfalso', calificadoId: 'r1', estrellas: 1,
    }), 'Un pedido en nuevo no es comprobante de nada.');
  });

  // Y LO QUE SI TIENE QUE SEGUIR PASANDO, que es todo lo que la app hace hoy.
  it('el cliente SI puede cancelar su pedido (Restaurantes.js:370)', async () => {
    const { doc, setDoc, updateDoc } = FS;
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'pedidosRestaurantes/pcanc'), {
        restauranteId: 'r1', clienteId: 'pasajero1', estado: 'nuevo', total: 30000,
      });
    });
    await RUT.assertSucceeds(updateDoc(doc(como('pasajero1'), 'pedidosRestaurantes/pcanc'), {
      estado: 'cancelado', canceladoPor: 'cliente',
    }));
  });

  it('y SI puede escribir en el chat y marcar que califico, sin tocar el estado', async () => {
    const { doc, setDoc, updateDoc, arrayUnion } = FS;
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'pedidosRestaurantes/pchat'), {
        restauranteId: 'r1', clienteId: 'pasajero1', estado: 'entregado', total: 30000,
      });
    });
    // Restaurantes.js:404 - el chat
    await RUT.assertSucceeds(updateDoc(doc(como('pasajero1'), 'pedidosRestaurantes/pchat'), {
      mensajesPedido: arrayUnion({ de: 'cliente', texto: 'ya llego?', fecha: '2026-08-25T12:00:00.000Z' }),
    }));
    // Restaurantes.js:435 - la marca de calificado
    await RUT.assertSucceeds(updateDoc(doc(como('pasajero1'), 'pedidosRestaurantes/pchat'), {
      calificado: true, estrellas: 5,
    }));
  });

  it('y EL RESTAURANTE sigue moviendo el pedido por su flujo (PedidosDomicilio.js:138)', async () => {
    const { doc, setDoc, updateDoc } = FS;
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'pedidosRestaurantes/pflujo'), {
        restauranteId: 'r1', clienteId: 'pasajero1', estado: 'nuevo', total: 30000,
      });
    });
    for (const e of ['confirmado', 'preparando', 'empacado', 'en_camino', 'entregado', 'cerrado']) {
      await RUT.assertSucceeds(updateDoc(doc(como('r1'), 'pedidosRestaurantes/pflujo'), { estado: e }));
    }
  });

  it('y el restaurante SI crea un pedido de mesa ya tomado (Mesero.js:295)', async () => {
    const { collection, addDoc } = FS;
    await RUT.assertSucceeds(addDoc(collection(como('r1'), 'pedidosRestaurantes'), {
      restauranteId: 'r1', tipo: 'local', estado: 'tomado', mesa: 4, total: 45000,
    }), 'Es su propio trabajo: el mesero toma la mesa y el pedido nace tomado.');
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

// ═══════════════════════════════════════════════════════════════════════════
// REGLA 10 · LA LLAMADA ES DE LOS DOS QUE VIAJAN
// ═══════════════════════════════════════════════════════════════════════════
// Dentro de `llamadas/{viajeId}` va la negociación de la llamada de voz:
// quien escriba primero la respuesta, HABLA. Hasta el 24-ago-2026 podía
// escribirla cualquiera con una cuenta, así que un extraño podía tumbar la
// llamada de una pasajera en marcha y contestar antes que su conductor.
//
// El id del documento ES el id del viaje. Medido ese día en el servidor: la
// única llamada que existe tiene por id un viaje de verdad.
describe('REGLA 10 · la llamada es de los dos que viajan', () => {
  const sembrarLlamadas = async () => {
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const { doc, setDoc } = FS;
      // Un viaje YA ASIGNADO: tiene pasajero y conductor. Su llamada existe.
      await setDoc(doc(db, 'viajes/v10'), {
        pasajeroId: 'pasajero1', conductorId: 'conductor1', estado: 'aceptado',
      });
      await setDoc(doc(db, 'llamadas/v10'), { estado: 'sonando', inicio: '2026-08-24T00:00:00.000Z' });
      // Otro viaje asignado, SIN llamada todavía: para probar quién la abre.
      await setDoc(doc(db, 'viajes/v11'), {
        pasajeroId: 'pasajero1', conductorId: 'conductor1', estado: 'aceptado',
      });
      // Un viaje que todavía NO tiene conductor.
      await setDoc(doc(db, 'viajes/v12'), { pasajeroId: 'pasajero1', estado: 'esperando' });
      await setDoc(doc(db, 'llamadas/v12'), { estado: 'sonando' });
    });
  };

  // ── LO QUE SE CIERRA ─────────────────────────────────────────────────────
  it('LA FUGA · un extraño NO puede oír la llamada de un viaje ajeno', async () => {
    await sembrarLlamadas();
    const { doc, getDoc } = FS;
    await RUT.assertFails(getDoc(doc(como('conductor2'), 'llamadas/v10')));
  });

  // ESTA ES LA GRAVE. No es privacidad: quien escribe la respuesta, habla. Un
  // extraño que gane la carrera se pone a hablar con la pasajera haciéndose
  // pasar por su conductor, con el viaje en marcha.
  it('LA FUGA · ni escribir encima — que es como se suplanta al conductor', async () => {
    await sembrarLlamadas();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('conductor2'), 'llamadas/v10'), {
      respuesta: { sdp: 'la del impostor' },
    }));
  });

  it('LA FUGA · ni abrirle una llamada nueva a un viaje que no es suyo', async () => {
    await sembrarLlamadas();
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('conductor2'), 'llamadas/v11'), { estado: 'sonando' }));
  });

  it('LA FUGA · ni pedir la lista de llamadas', async () => {
    await sembrarLlamadas();
    const { collection, getDocs } = FS;
    await RUT.assertFails(getDocs(collection(como('pasajero1'), 'llamadas')));
  });

  it('y sin sesión, nada', async () => {
    await sembrarLlamadas();
    const { doc, getDoc } = FS;
    await RUT.assertFails(getDoc(doc(sinCuenta(), 'llamadas/v10')));
  });

  // ── LO QUE NO SE PUEDE ROMPER ────────────────────────────────────────────
  it('EL PASAJERO de ese viaje sí puede oírla y contestar', async () => {
    await sembrarLlamadas();
    const { doc, getDoc, updateDoc } = FS;
    await RUT.assertSucceeds(getDoc(doc(como('pasajero1'), 'llamadas/v10')));
    await RUT.assertSucceeds(updateDoc(doc(como('pasajero1'), 'llamadas/v10'), { estado: 'hablando' }));
  });

  // LA MITAD QUE SE QUEDA MUDA SI ESTO SE ESCRIBE MAL. En Llamada.js llaman LOS
  // DOS, y los dos escriben este mismo documento. Una regla que solo mirara
  // `pasajeroId` dejaría sin voz al conductor — y en silencio, porque el catch
  // de Llamada.js:206 y :212 se traga el error y la llamada solo «no suena».
  it('Y EL CONDUCTOR TAMBIÉN — es la mitad que se queda muda', async () => {
    await sembrarLlamadas();
    const { doc, getDoc, updateDoc } = FS;
    await RUT.assertSucceeds(getDoc(doc(como('conductor1'), 'llamadas/v10')));
    await RUT.assertSucceeds(updateDoc(doc(como('conductor1'), 'llamadas/v10'), {
      candidatosOferente: ['uno', 'dos'],
    }));
  });

  it('los dos pueden ABRIR la llamada de su viaje', async () => {
    await sembrarLlamadas();
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(setDoc(doc(como('conductor1'), 'llamadas/v11'), { estado: 'sonando' }));
  });

  it('el panel puede mirarlas todas', async () => {
    await sembrarLlamadas();
    const { doc, getDoc, collection, getDocs } = FS;
    await RUT.assertSucceeds(getDoc(doc(como('eladmin'), 'llamadas/v10')));
    await RUT.assertSucceeds(getDocs(collection(como('eladmin'), 'llamadas')));
  });

  // ── LOS BORDES ───────────────────────────────────────────────────────────
  // Un viaje al que todavía no le han asignado conductor no tiene ese campo. El
  // defecto vacío de .get('conductorId','') hace que la comparación falle en vez
  // de reventar — y la cadena vacía no es el uid de nadie, así que es seguro.
  it('un viaje SIN conductor: su pasajero sí, un conductor cualquiera no', async () => {
    await sembrarLlamadas();
    const { doc, getDoc } = FS;
    await RUT.assertSucceeds(getDoc(doc(como('pasajero1'), 'llamadas/v12')));
    await RUT.assertFails(getDoc(doc(como('conductor1'), 'llamadas/v12')));
  });

  // `llamadas/lla1` la siembra la suite arriba y su id NO es ningún viaje: una
  // llamada huérfana, que en la base de verdad puede existir. No la abre nadie.
  //
  // OJO: esta prueba sigue VERDE aunque se quite el exists() de la regla —
  // comprobado plantando ese mutante el 24-ago-2026. No es que la prueba sea
  // floja: es que ahí no hay nada que cerrar, porque el error de preguntarle a un
  // viaje que no existe ya niega por su cuenta. Se deja porque alguien tiene que
  // decir qué pasa con ese estado, y porque el día que la regla cambie de forma
  // esta es la que avisa si empieza a dejar pasar huérfanas.
  it('una llamada huérfana, cuyo viaje no existe, no la abre nadie', async () => {
    const { doc, getDoc } = FS;
    await RUT.assertFails(getDoc(doc(como('pasajero1'), 'llamadas/lla1')));
    await RUT.assertFails(getDoc(doc(como('conductor1'), 'llamadas/lla1')));
  });

  it('y nadie la borra, ni sus dueños (REGLA 12)', async () => {
    await sembrarLlamadas();
    const { doc, deleteDoc } = FS;
    await RUT.assertFails(deleteDoc(doc(como('pasajero1'), 'llamadas/v10')));
    await RUT.assertFails(deleteDoc(doc(como('eladmin'), 'llamadas/v10')));
  });

  // El panel puede MIRAR, no meterse dentro. Si algún día hace falta cortar una
  // llamada en curso desde el panel, se abre a propósito y con su prueba — no
  // por descuido. (Este mutante sobrevivía: nadie lo comprobaba.)
  it('el panel puede mirarla pero NO escribir dentro', async () => {
    await sembrarLlamadas();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('eladmin'), 'llamadas/v10'), { estado: 'cortada' }));
  });

  // Un viaje sin pasajeroId no debe abrirle la puerta a NADIE. Sin esta, el
  // mutante que cambia el defecto de .get('pasajeroId','') por el uid de quien
  // pregunta sobrevive: en todas las demás semillas ese campo siempre está.
  it('un viaje SIN dueños no le abre la llamada a nadie', async () => {
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const { doc, setDoc } = FS;
      await setDoc(doc(ctx.firestore(), 'viajes/v13'), { estado: 'esperando' });
      await setDoc(doc(ctx.firestore(), 'llamadas/v13'), { estado: 'sonando' });
    });
    const { doc, getDoc } = FS;
    await RUT.assertFails(getDoc(doc(como('pasajero1'), 'llamadas/v13')));
    await RUT.assertFails(getDoc(doc(como('conductor1'), 'llamadas/v13')));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// REGLA 10 · EL VIAJE ES LA LLAVE DE TODO LO DEMÁS
// ═══════════════════════════════════════════════════════════════════════════
// El bloque de arriba le pregunta AL VIAJE quién va dentro. Mientras el viaje lo
// pudiera escribir cualquiera, ese candado tenía la llave puesta: bastaba con
// escribirse `conductorId` encima. Lo demostró la segunda opinión del
// 24-ago-2026 ejecutándolo, y por eso las dos cosas van juntas.
// ═══════════════════════════════════════════════════════════════════════════
// REGLA 10 · NO SE PUEDE SEGUIR A LA FLOTA
// ═══════════════════════════════════════════════════════════════════════════
// La ficha de `conductores/{uid}` lleva `ubicacion` —lat y lng, refrescada
// mientras trabaja—, `telefono`, `placa` y `vehiculo`. Medido el 25-ago-2026: 8
// fichas. Con `read` abierto se descargaban las 8 con una cuenta gratis.
//
// Y el `list` cerrado no basta solo: los números de los conductores se cosechan
// en las ofertas de cualquier viaje, donde el id de cada oferta ES el número del
// conductor. Por eso las dos puertas van juntas.
describe('REGLA 10 · no se puede seguir a la flota', () => {
  const sembrarFlota = async () => {
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const { doc, setDoc } = FS;
      await setDoc(doc(db, 'conductores/conductor1'), {
        nombre: 'Luis', telefono: '3160000000', placa: 'ABC123', activo: true,
        ubicacion: { lat: 11.54, lng: -72.90 }, fcmToken: 'tok-de-luis',
      });
      await setDoc(doc(db, 'conductores/conductor2'), {
        nombre: 'Otro', telefono: '3161111111', placa: 'XYZ789', activo: true,
        ubicacion: { lat: 11.55, lng: -72.91 },
      });
      // Un viaje con ofertas de dos conductores. El id de cada oferta es su uid.
      await setDoc(doc(db, 'viajes/vf'), { pasajeroId: 'pasajero1', estado: 'esperando' });
      await setDoc(doc(db, 'viajes/vf/contraofertas/conductor1'), { monto: 11000, conductorTelefono: '3160000000' });
      await setDoc(doc(db, 'viajes/vf/contraofertas/conductor2'), { monto: 12000, conductorTelefono: '3161111111' });
    });
  };

  // ── LA COSECHA, QUE ES EL ATAQUE DE VERDAD ───────────────────────────────
  it('LA FLOTA · nadie se descarga la lista de conductores', async () => {
    await sembrarFlota();
    const { collection, getDocs } = FS;
    await RUT.assertFails(getDocs(collection(como('pasajero1'), 'conductores')),
      'Con una cuenta gratis se bajaba la ubicación EN VIVO de los 8 conductores, con su ' +
      'nombre, teléfono y placa al lado.');
    await RUT.assertFails(getDocs(collection(como('conductor1'), 'conductores')));
  });

  // Sin esta, cerrar la lista no sirve: se sacan los números de aquí y luego se
  // pide la ficha de cada uno, de una en una.
  it('LA COSECHA · un extraño NO puede leer las ofertas de un viaje ajeno', async () => {
    await sembrarFlota();
    const { collection, getDocs, doc, getDoc } = FS;
    await RUT.assertFails(getDocs(collection(como('conductor2'), 'viajes/vf/contraofertas')),
      'El id de cada oferta ES el número del conductor. Con la lista de ofertas se cosechan ' +
      'los conductores y después se les mira la ubicación uno por uno.');
    await RUT.assertFails(getDoc(doc(como('conductor2'), 'viajes/vf/contraofertas/conductor1')));
  });

  // ── LO QUE NO SE PUEDE ROMPER ────────────────────────────────────────────
  it('el PASAJERO de ese viaje sigue viendo las ofertas (Solicitar.js:649)', async () => {
    await sembrarFlota();
    const { collection, getDocs } = FS;
    const r = await RUT.assertSucceeds(getDocs(collection(como('pasajero1'), 'viajes/vf/contraofertas')));
    assert.strictEqual(r.size, 2, 'tiene que ver LAS DOS ofertas para poder escoger');
  });

  it('y el conductor sigue viendo y ajustando la SUYA', async () => {
    await sembrarFlota();
    const { doc, getDoc } = FS;
    await RUT.assertSucceeds(getDoc(doc(como('conductor1'), 'viajes/vf/contraofertas/conductor1')));
  });

  // Así es como el pasajero ve moverse el carro en el mapa. Si esto se pusiera
  // rojo, el mapa se queda quieto y en silencio: ese onSnapshot no tiene manejo
  // de error (Solicitar.js:688).
  it('el pasajero sigue viendo dónde va su conductor (Solicitar.js:688)', async () => {
    await sembrarFlota();
    const { doc, getDoc } = FS;
    await RUT.assertSucceeds(getDoc(doc(como('pasajero1'), 'conductores/conductor1')));
  });

  it('y el conductor sigue leyendo y escribiendo la suya', async () => {
    await sembrarFlota();
    const { doc, getDoc, setDoc } = FS;
    await RUT.assertSucceeds(getDoc(doc(como('conductor1'), 'conductores/conductor1')));
    await RUT.assertSucceeds(setDoc(doc(como('conductor1'), 'conductores/conductor1'), {
      ubicacion: { lat: 11.56, lng: -72.92 },
    }, { merge: true }));
  });

  it('el panel sí puede con la lista y con las ofertas', async () => {
    await sembrarFlota();
    const { collection, getDocs } = FS;
    await RUT.assertSucceeds(getDocs(collection(como('eladmin'), 'conductores')));
    await RUT.assertSucceeds(getDocs(collection(como('eladmin'), 'viajes/vf/contraofertas')));
  });

  it('y sin sesión, nada de nada', async () => {
    await sembrarFlota();
    const { doc, getDoc, collection, getDocs } = FS;
    await RUT.assertFails(getDoc(doc(sinCuenta(), 'conductores/conductor1')));
    await RUT.assertFails(getDocs(collection(sinCuenta(), 'conductores')));
  });
});

describe('REGLA 10 · un viaje no lo toca cualquiera', () => {
  const sembrarViajes = async () => {
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const { doc, setDoc } = FS;
      // Ya aceptado: FUERA del mercado. Aquí es donde vive la llamada.
      await setDoc(doc(db, 'viajes/va'), {
        pasajeroId: 'pasajero1', conductorId: 'conductor1', estado: 'aceptado', tarifaValor: 12000,
      });
      await setDoc(doc(db, 'llamadas/va'), { estado: 'sonando' });
      // Todavía buscando conductor: DENTRO del mercado.
      await setDoc(doc(db, 'viajes/vm'), { pasajeroId: 'pasajero1', estado: 'esperando', tarifaValor: 9000 });
      // DENTRO del mercado y CON conductor: 'confirmando' entra en enElMercado().
      // Aquí es donde un extraño puede echar al conductor de verdad.
      await setDoc(doc(db, 'viajes/vc'), {
        pasajeroId: 'pasajero1', conductorId: 'conductor1', estado: 'confirmando', tarifaValor: 11000,
      });
    });
  };

  // ── LA CADENA DEL ATAQUE, PASO POR PASO ──────────────────────────────────
  // Esta es LA prueba de esta tanda. Si se pone verde por el sitio equivocado,
  // todo lo demás es decoración.
  it('EL ATAQUE · un extraño NO se puede escribir como conductor de un viaje ajeno', async () => {
    await sembrarViajes();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('conductor2'), 'viajes/va'), { conductorId: 'conductor2' }),
      'Con esto, el extraño pasa a ser «de los dos» del viaje: entra en la llamada, contesta ' +
      'antes que nadie, y al conductor DE VERDAD se le niega la suya. Sin carrera.');
  });

  it('EL ATAQUE · y por eso sigue sin poder entrar en la llamada', async () => {
    await sembrarViajes();
    const { doc, getDoc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('conductor2'), 'viajes/va'), { conductorId: 'conductor2' }));
    await RUT.assertFails(getDoc(doc(como('conductor2'), 'llamadas/va')));
    await RUT.assertFails(updateDoc(doc(como('conductor2'), 'llamadas/va'), { respuesta: 'la del impostor' }));
  });

  it('EL ATAQUE · ni ponerse de pasajero, ni siquiera el pasajero de verdad', async () => {
    await sembrarViajes();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('conductor2'), 'viajes/va'), { pasajeroId: 'conductor2' }));
    // Congelado del todo: un viaje no cambia de dueño NUNCA.
    await RUT.assertFails(updateDoc(doc(como('pasajero1'), 'viajes/va'), { pasajeroId: 'otro' }));
  });

  it('EL ATAQUE · ni tocarle la tarifa a un viaje ajeno ya aceptado', async () => {
    await sembrarViajes();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('conductor2'), 'viajes/va'), { tarifaValor: 1 }));
  });

  it('EL ALTA · un viaje nace a nombre de quien lo pide, no de otro', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('pasajero1'), 'viajes/nv1'), {
      pasajeroId: 'conductor1', estado: 'esperando',
    }));
    await RUT.assertFails(setDoc(doc(como('pasajero1'), 'viajes/nv2'), { estado: 'esperando' }));
  });

  // ── LO QUE NO SE PUEDE ROMPER ────────────────────────────────────────────
  // ── EL CONDUCTOR NO SE LO PONE EL PASAJERO ───────────────────────────────
  // Esta es LA cadena: sin ella, la regla de calificaciones no vale nada, porque
  // el atacante se fabrica el viaje que ella consulta. Medido por la segunda
  // opinion: 15 de 15 estrellas coladas y la media de la victima en 1.0.
  it('EL ATAQUE · un viaje NO puede nacer con un conductor puesto', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('pasajero1'), 'viajes/falso1'), {
      pasajeroId: 'pasajero1', conductorId: 'conductor1', estado: 'finalizado',
    }), 'Con esto se fabrica un viaje falso con la victima de conductor y se le cuelgan ' +
       'las calificaciones que se quiera.');
  });

  it('EL ATAQUE · ni ponerselo despues a un viaje suyo', async () => {
    await sembrarViajes();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('pasajero1'), 'viajes/vm'), {
      conductorId: 'conductor1',
    }));
  });

  it('EL ATAQUE · ni cambiarselo al que ya lo tiene, ni ponerselo al que no', async () => {
    await sembrarViajes();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('pasajero1'), 'viajes/va'), {
      conductorId: 'conductor2',
    }));
    await RUT.assertFails(updateDoc(doc(como('conductor2'), 'viajes/vm'), {
      conductorId: 'conductor2',
    }));
  });

  // LA CADENA ENTERA, de punta a punta: sin viaje falso no hay calificacion falsa.
  it('LA CADENA · sin poder fabricar el viaje, la calificacion falsa se cae', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('pasajero1'), 'viajes/falso2'), {
      pasajeroId: 'pasajero1', conductorId: 'conductor2', estado: 'finalizado',
    }));
    // Y como el viaje no existe, la calificacion tampoco entra.
    await RUT.assertFails(setDoc(doc(como('pasajero1'), 'calificaciones/falsa'), {
      viajeId: 'falso2', calificadoId: 'conductor2', estrellas: 1,
    }));
  });

  // ── LO QUE NO SE PUEDE ROMPER ────────────────────────────────────────────
  // Los tres sitios que SI escriben ese campo, y todos escriben null: el
  // conductor soltando los viajes que no gano (AppConductor.js:619) y el pasajero
  // cancelando (Solicitar.js:966, SolicitarMensajeria.js:980). Los tres llevan un
  // .catch(()=>{}) vacio: si esto se negara, los viajes se quedarian pegados a un
  // conductor que ya no los lleva, sin que nada fallara a la vista.
  it('SOLTAR un viaje sigue funcionando: conductorId a null', async () => {
    await sembrarViajes();
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('conductor1'), 'viajes/va'), {
      conductorId: null, conductorNombre: null, estado: 'esperando',
    }));
  });

  it('y el pasajero tambien puede soltarlo al cancelar', async () => {
    await sembrarViajes();
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('pasajero1'), 'viajes/va'), {
      conductorId: null, estado: 'cancelado',
    }));
  });

  it('reenviar el MISMO conductor no molesta', async () => {
    await sembrarViajes();
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('conductor1'), 'viajes/va'), {
      conductorId: 'conductor1', estado: 'en_camino',
    }));
  });

  it('y un viaje nuevo sigue naciendo bien, sin ese campo (viajeNuevo.js)', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(setDoc(doc(como('pasajero1'), 'viajes/nv9'), {
      pasajeroId: 'pasajero1', estado: 'esperando', tipo: 'Taxi', tarifaValor: 9000,
    }));
  });

  // ── EL CENTINELA ERA UNA PUERTA ──────────────────────────────────────────
  // La primera version comparaba .get('conductorId', 'ninguno') a los dos lados.
  // Como 'ninguno' es un texto ESCRIBIBLE, a un viaje del mercado -que no tiene
  // el campo- cualquiera le escribia conductorId: 'ninguno' y los dos lados daban
  // 'ninguno', o sea igual, o sea permitido. Un mutante que lo cambiaba por ''
  // sobrevivio a las 357 pruebas: ninguna miraba que pasa si alguien ESCRIBE el
  // centinela. Estas cuatro son esas.
  it('EL ATAQUE · nadie puede escribir el valor del centinela como si fuera un conductor', async () => {
    await sembrarViajes();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('conductor2'), 'viajes/vm'), {
      conductorId: 'ninguno',
    }), 'Si el centinela se puede escribir, deja de ser centinela: es una llave.');
    await RUT.assertFails(updateDoc(doc(como('pasajero1'), 'viajes/vm'), {
      conductorId: 'ninguno',
    }));
    // Y con cualquier otro texto, tampoco. El campo no es del cliente.
    await RUT.assertFails(updateDoc(doc(como('conductor2'), 'viajes/vm'), {
      conductorId: '',
    }));
    await RUT.assertFails(updateDoc(doc(como('conductor2'), 'viajes/vm'), {
      conductorId: 0,
    }));
  });

  // El dano de verdad del centinela no era teorico: 'ninguno' es VERDADERO en
  // JavaScript, y Solicitar.js:588 saca la tarjeta de confirmacion cuando
  // estado === 'confirmando' && data.conductorId. Con el centinela escribible, un
  // impostor le sacaba a la pasajera una tarjeta con SU nombre y SU telefono.
  // OJO CON EL NOMBRE DE ESTA PRUEBA: cierra UNA de las dos rutas a la tarjeta
  // falsa -la del centinela-, no la tarjeta falsa entera. La otra sigue abierta y
  // esta anotada en firestore.rules: conductorNombre, conductorPlaca,
  // conductorVehiculo y conductorTelefono NO estan protegidos, y cualquiera del
  // mercado los reescribe en un viaje ajeno sin tocar conductorId.
  it('EL ATAQUE · por la ruta del centinela ya no se monta una tarjeta falsa', async () => {
    await sembrarViajes();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('conductor2'), 'viajes/vm'), {
      estado: 'confirmando',
      conductorId: 'ninguno',
      conductorNombre: 'El impostor',
      conductorTelefono: '3001234567',
    }), 'Con esto la pasajera se sube al carro del impostor creyendo que la app se lo mando.');
  });

  // ── LA REGRESION QUE METIO EL PRIMER INTENTO ─────────────────────────────
  // El primer arreglo escribio `allow update: if esAdmin() || (...)`, y con eso
  // saco a esAdmin() de la cadena de &&: el panel quedaba exento del congelado de
  // pasajeroId y podia cambiarle el DUENO a un viaje. Lo cazo la segunda opinion
  // careando las dos versiones. pasajeroId es el campo del que cuelgan el chat, la
  // llamada, el codigo de seguridad y el cobro.
  it('NI EL PANEL le cambia el dueno a un viaje', async () => {
    await sembrarViajes();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('eladmin'), 'viajes/va'), {
      pasajeroId: 'conductor2',
    }), 'Un viaje no cambia de dueno nunca, y el panel no es una excepcion.');
    await RUT.assertFails(updateDoc(doc(como('eljefe'), 'viajes/va'), {
      pasajeroId: 'conductor2',
    }));
  });

  it('pero el panel sigue pudiendo tocar el viaje para lo demas', async () => {
    await sembrarViajes();
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('eladmin'), 'viajes/va'), {
      estado: 'cancelado', motivoAdmin: 'reclamo del pasajero',
    }));
  });

  // ── EL UNICO TRABAJO VIVO DEL esMio() DE DENTRO DE conductorIntacto() ────
  // Ese esMio() se puso para parar a un extraño, pero esa puerta se tapio esa
  // misma tarde al sacar enElMercado() del update: ahora al extraño lo para el
  // (esMio() || esAdmin()) de fuera, antes de llegar. Lo unico que sigue haciendo
  // es que EL PANEL no pueda soltar a un conductor -el panel pasa el filtro de
  // fuera por esAdmin() y llegaria hasta ahi-. Y eso no lo probaba NADIE: un
  // mutante que borra ese esMio() sobrevivia a la suite entera, 0 rojas de 297.
  // Lo cazo la segunda opinion. Esta es la prueba que faltaba.
  it('ni el panel suelta al conductor de un viaje', async () => {
    await sembrarViajes();
    const { doc, updateDoc, deleteField } = FS;
    await RUT.assertFails(updateDoc(doc(como('eladmin'), 'viajes/va'), {
      conductorId: null,
    }), 'Mover un conductor se hace por el sitio bueno: la funcion del servidor.');
    await RUT.assertFails(updateDoc(doc(como('eladmin'), 'viajes/va'), {
      conductorId: deleteField(),
    }), 'Y borrar el campo es la misma jugada por la puerta de al lado.');
    await RUT.assertFails(updateDoc(doc(como('eljefe'), 'viajes/va'), {
      conductorId: null,
    }), 'El superadmin tampoco.');
  });

  // ── BORRAR EL CAMPO ES OTRA FORMA DE ESCRIBIRLO ──────────────────────────
  // deleteField() borra el campo, asi que DESAPARECE de request.resource.data
  // .keys(). La segunda version del candado preguntaba por las claves y lo leia
  // como «no lo tocas»: cualquiera le borraba el conductor a un viaje ajeno. No
  // habia ni una prueba con deleteField() en las 361, asi que las dos conductas
  // pasaban la suite igual. Estas son esas pruebas.
  it('EL ATAQUE · un extrano NO puede BORRARLE el conductor a un viaje ajeno', async () => {
    await sembrarViajes();
    const { doc, updateDoc, deleteField } = FS;
    await RUT.assertFails(updateDoc(doc(como('conductor2'), 'viajes/va'), {
      conductorId: deleteField(),
    }), 'Borrar el campo y escribirlo son la misma escritura: si una se niega, la otra tambien.');
  });

  it('EL ATAQUE · ni borrarlo para poder poner otro despues', async () => {
    await sembrarViajes();
    const { doc, updateDoc, deleteField } = FS;
    await RUT.assertFails(updateDoc(doc(como('conductor2'), 'viajes/va'), {
      conductorId: deleteField(),
    }));
    // Y aunque lo hubiera conseguido, el segundo paso tampoco entra.
    await RUT.assertFails(updateDoc(doc(como('conductor2'), 'viajes/vm'), {
      conductorId: 'conductor2',
    }));
  });

  // Y la otra cara: quien SI puede soltar el viaje, lo puede soltar de las dos
  // formas. Ninguna de las tres apps usa deleteField() hoy -se busco en los tres
  // repos, en las funciones y en pruebas: cero apariciones-, pero el candado tiene
  // que tratar las dos igual, porque las dos significan lo mismo.
  it('el conductor SI puede soltar su viaje borrando el campo', async () => {
    await sembrarViajes();
    const { doc, updateDoc, deleteField } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('conductor1'), 'viajes/va'), {
      conductorId: deleteField(), estado: 'esperando',
    }));
  });

  it('y el pasajero tambien, al rechazar la tarjeta del conductor', async () => {
    await sembrarViajes();
    const { doc, updateDoc, deleteField } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('pasajero1'), 'viajes/va'), {
      conductorId: deleteField(), estado: 'esperando',
    }));
  });

  // Un viaje que NUNCA tuvo conductor: poner null no es un cambio, y tiene que
  // pasar. Una version que se probo comparando la PRESENCIA de la clave a los dos
  // lados cerraba el borrado pero NEGABA esto, y habria roto rechazarConfirmacion
  // en silencio si el campo ya estuviera limpio (esos updateDoc llevan .catch()).
  it('poner null en un viaje que nunca tuvo conductor sigue pasando', async () => {
    await sembrarViajes();
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('pasajero1'), 'viajes/vm'), {
      conductorId: null, estado: 'esperando',
    }));
  });

  // ── ECHAR AL CONDUCTOR DE VERDAD ─────────────────────────────────────────
  // 'confirmando' esta DENTRO del mercado, asi que un conductor cualquiera llega
  // a ese viaje por enElMercado(). Sin este candado le quitaba el conductor a un
  // viaje ajeno que estaba esperando el si de la pasajera, y echaba al conductor
  // de verdad. Es el mismo ataque de las llamadas por la otra cara: alli se metia
  // uno, aqui se saca al otro. Un mutante que devolvia la version sin esMio()
  // sobrevivio a las 366 pruebas: ninguna miraba este caso.
  it('EL ATAQUE · un extrano NO echa al conductor de un viaje en confirmando', async () => {
    await sembrarViajes();
    const { doc, updateDoc, deleteField } = FS;
    await RUT.assertFails(updateDoc(doc(como('conductor2'), 'viajes/vc'), {
      conductorId: null, estado: 'esperando',
    }), 'Con esto el impostor echa al conductor que la pasajera estaba a punto de aceptar.');
    await RUT.assertFails(updateDoc(doc(como('conductor2'), 'viajes/vc'), {
      conductorId: deleteField(), estado: 'esperando',
    }), 'Borrar el campo es la misma jugada por la puerta de al lado.');
  });

  it('EL ATAQUE · ni echarlo para colarse el despues', async () => {
    await sembrarViajes();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('conductor2'), 'viajes/vc'), { conductorId: null }));
    await RUT.assertFails(updateDoc(doc(como('conductor2'), 'viajes/vc'), { conductorId: 'conductor2' }));
  });

  // Y LOS DOS QUE SI: el conductor de ese viaje y su pasajera. Son los tres sitios
  // reales. limpiarViajesOtrosConductor (AppConductor.js:612) busca con
  // where('conductorId','==',miId), o sea SOLO viajes donde el ya es el conductor.
  it('el conductor DE ESE VIAJE si lo suelta, aunque este en el mercado', async () => {
    await sembrarViajes();
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('conductor1'), 'viajes/vc'), {
      estado: 'esperando', conductorId: null, conductorNombre: null,
      conductorPlaca: null, conductorVehiculo: null, conductorTelefono: null,
    }));
  });

  it('y la pasajera tambien, que es rechazarConfirmacion (Solicitar.js:960)', async () => {
    await sembrarViajes();
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('pasajero1'), 'viajes/vc'), {
      estado: 'esperando', conductorId: null, conductorNombre: null,
      conductorPlaca: null, conductorVehiculo: null, conductorTelefono: null,
      nuevaOferta: '2026-08-25T12:00:00.000Z',
    }));
  });

  // ── LA TARJETA FALSA · UN CONDUCTOR DEL MERCADO NO ESCRIBE EN EL VIAJE ───
  // Esta prueba decia lo contrario hasta el 25-ago-2026 por la tarde: afirmaba
  // que un conductor cualquiera SIGUE pudiendo tocar el viaje del mercado «para lo
  // suyo». Se midio enumerando TODAS las escrituras al documento del viaje en las
  // tres apps: no hay ninguna. La oferta va a la subcoleccion contraofertas/{uid}
  // (AppConductor.js:353), que tiene sus propias reglas. Asi que no.
  it('un conductor del mercado NO escribe en el documento del viaje', async () => {
    await sembrarViajes();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('conductor2'), 'viajes/vm'), {
      estado: 'en_negociacion', nuevaOferta: '2026-08-25T12:00:00.000Z',
    }), 'Su oferta va a la subcoleccion, no al viaje. Aqui no tiene nada que escribir.');
  });

  // EL ATAQUE DE LA TARJETA, que es el daño fisico mas grave de la auditoria: la
  // pasajera se sube al carro equivocado. Solicitar.js:588-599 saca el nombre, la
  // placa, el vehiculo y el telefono DEL DOCUMENTO DEL VIAJE. Sin tocar
  // conductorId ni una vez, se le reescribian los cuatro.
  // ── CINCO ESTRELLAS A SI MISMO · LA ULTIMA PUERTA (25-ago-2026) ──────────
  // Tenia dos caminos y los dos acaban igual: el que califica y el calificado son
  // la MISMA persona. Se corta ahi, y ademas en el primer paso de cada camino.
  it('EL ATAQUE · un pasajero NO se puede ofertar a si mismo su propio viaje', async () => {
    await sembrarViajes();
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('pasajero1'), 'viajes/vm/contraofertas/pasajero1'), {
      conductorId: 'pasajero1', conductorNombre: 'Yo mismo', montoValor: 9000, vigente: true,
    }), 'Primer paso de las cinco estrellas a si mismo: y ademas le descuenta comision sin suelo a alguien.');
  });

  it('LA CADENA · sin oferta propia no hay conductor propio, y sin eso no hay estrella propia', async () => {
    await sembrarViajes();
    const { doc, setDoc, addDoc, collection } = FS;
    // 1 - no se puede ofertar a si mismo
    await RUT.assertFails(setDoc(doc(como('pasajero1'), 'viajes/vm/contraofertas/pasajero1'), {
      conductorId: 'pasajero1', montoValor: 9000, vigente: true,
    }));
    // 2 - y aunque el viaje acabara con el de conductor, la estrella no entra
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'viajes/vyo'), {
        pasajeroId: 'pasajero1', conductorId: 'pasajero1', estado: 'finalizado',
      });
    });
    await RUT.assertFails(addDoc(collection(como('pasajero1'), 'calificaciones'), {
      viajeId: 'vyo', calificadoId: 'pasajero1', estrellas: 5,
    }), 'Nadie se califica a si mismo.');
  });

  // Y LO QUE SI: un conductor DE VERDAD sigue ofertando en el viaje de otro.
  it('un conductor SI oferta en el viaje de otro, como siempre', async () => {
    await sembrarViajes();
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(setDoc(doc(como('conductor2'), 'viajes/vm/contraofertas/conductor2'), {
      conductorId: 'conductor2', conductorNombre: 'Luis', montoValor: 12000, vigente: true,
    }), 'AppConductor.js:353. Si esto se cae, el conductor no puede trabajar.');
  });

  it('EL ATAQUE · nadie le cambia el nombre, la placa ni el telefono al conductor', async () => {
    await sembrarViajes();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('conductor2'), 'viajes/vc'), {
      conductorNombre: 'El impostor', conductorTelefono: '3001234567',
      conductorPlaca: 'XXX-999', conductorVehiculo: 'Moto roja',
    }), 'La pasajera veria un conductor legitimo con el telefono y la placa del impostor.');
  });

  it('EL ATAQUE · ni le baja la tarifa, ni le mata el viaje', async () => {
    await sembrarViajes();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('conductor2'), 'viajes/vm'), {
      tarifa: '$1', tarifaValor: 1,
    }), 'Por la misma puerta se le bajaba la tarifa a 1 peso.');
    await RUT.assertFails(updateDoc(doc(como('conductor2'), 'viajes/vm'), {
      estado: 'vencido',
    }), 'Y se le mataba el viaje a otro.');
  });

  // Y LO QUE SI TIENE QUE SEGUIR PASANDO: el conductor ofertando por su sitio.
  it('pero SI puede dejar su oferta, que va a la subcoleccion', async () => {
    await sembrarViajes();
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(setDoc(doc(como('conductor2'), 'viajes/vm/contraofertas/conductor2'), {
      conductorId: 'conductor2', conductorNombre: 'Luis', montoValor: 12000, vigente: true,
    }), 'AppConductor.js:353. Si esto se cae, el conductor no puede trabajar.');
  });

  it('el PASAJERO sigue llevando su viaje', async () => {
    await sembrarViajes();
    const { doc, setDoc, updateDoc } = FS;
    await RUT.assertSucceeds(setDoc(doc(como('pasajero1'), 'viajes/nv3'), {
      pasajeroId: 'pasajero1', estado: 'esperando', tarifaValor: 10000,
    }));
    await RUT.assertSucceeds(updateDoc(doc(como('pasajero1'), 'viajes/va'), { estado: 'cancelado' }));
  });

  it('el CONDUCTOR de ese viaje también', async () => {
    await sembrarViajes();
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('conductor1'), 'viajes/va'), { estado: 'en_camino' }));
  });

  // LA QUE SE ROMPE EN SILENCIO SI ESTO SE ESCRIBE MAL. Mientras el viaje busca
  // conductor, los conductores lo tocan aunque todavía no sea suyo:
  // ESTA PRUEBA ESTUVO MAL DESDE QUE SE ESCRIBIO, y daba una seguridad falsa.
  // Decia: «un conductor SI puede tocar un viaje que esta EN EL MERCADO», y lo
  // justificaba con que AppConductor.js:619 suelta los viajes que no gano y lleva
  // un .catch(()=>{}) vacio. El .catch es cierto; el razonamiento no:
  // limpiarViajesOtrosConductor busca con where('conductorId','==',miId), o sea
  // SOLO viajes donde el YA es el conductor. Entra por esMio(), no por
  // enElMercado(). Se comprobo enumerando las escrituras una por una.
  // Asi que la prueba dice ahora lo que de verdad tiene que pasar.
  it('el conductor suelta los viajes QUE YA SON SUYOS (AppConductor.js:612)', async () => {
    await sembrarViajes();
    const { doc, updateDoc } = FS;
    // vc: en el mercado Y con conductor1. Es el caso exacto de esa funcion.
    await RUT.assertSucceeds(updateDoc(doc(como('conductor1'), 'viajes/vc'), {
      estado: 'esperando', conductorId: null, conductorNombre: null,
    }));
    // Y un conductor que NO es el de ese viaje, no.
    await RUT.assertFails(updateDoc(doc(como('conductor2'), 'viajes/vc'), {
      estado: 'esperando', conductorId: null, conductorNombre: null,
    }));
  });

  it('el panel puede con todos', async () => {
    await sembrarViajes();
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('eladmin'), 'viajes/va'), { estado: 'finalizado' }));
  });

  it('reenviar pasajeroId con SU MISMO valor no rompe nada', async () => {
    await sembrarViajes();
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('pasajero1'), 'viajes/va'), {
      pasajeroId: 'pasajero1', estado: 'llegue',
    }));
  });

  it('y sigue sin poder borrarse (REGLA 12)', async () => {
    await sembrarViajes();
    const { doc, deleteDoc } = FS;
    await RUT.assertFails(deleteDoc(doc(como('pasajero1'), 'viajes/va')));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// REGLA 10 · UNA CALIFICACIÓN LA ESCRIBE QUIEN ESTUVO AHÍ
// ═══════════════════════════════════════════════════════════════════════════
// LO QUE ATA ESTO ES EL PAR, no una firma. La primera versión de este arreglo
// añadía un campo `autorId` a la app y comprobaba que fuera de quien escribía. La
// segunda opinión demostró EJECUTANDO que no cerraba nada: comprobaba que el
// autor estuviera en ALGÚN viaje, pero nunca miraba a quién se le ponían las
// estrellas. Con UN viaje propio se le colgaban calificaciones a cualquiera.
//
// Las pruebas de aquí abajo son esos ataques, uno por uno.
describe('REGLA 10 · una calificación la escribe quien estuvo ahí', () => {
  const sembrar = async () => {
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const { doc, setDoc } = FS;
      await setDoc(doc(db, 'viajes/vc1'), {
        pasajeroId: 'pasajero1', conductorId: 'conductor1', estado: 'finalizado',
      });
      await setDoc(doc(db, 'pedidosRestaurantes/pc1'), {
        clienteId: 'pasajero1', restauranteId: 'r1', total: 30000, estado: 'entregado',
      });
      await setDoc(doc(db, 'calificaciones/hecha'), {
        pedidoId: 'pc1', restauranteId: 'r1', calificadoId: 'r1',
        quienCalifica: 'cliente', estrellas: 1, comentario: 'INSULTO',
      });
    });
  };
  const delViaje = (extra) => Object.assign({
    viajeId: 'vc1', quienCalifica: 'pasajero', calificadoId: 'conductor1',
    estrellas: 5, comentario: '', fecha: '2026-08-25T00:00:00.000Z',
  }, extra || {});
  const delRestaurante = (extra) => Object.assign({
    pedidoId: 'pc1', restauranteId: 'r1', quienCalifica: 'cliente', calificadoId: 'r1',
    estrellas: 4, comentario: '', fecha: '2026-08-25T00:00:00.000Z',
  }, extra || {});

  // ── LAS DOS FORMAS TIENEN QUE SEGUIR FUNCIONANDO ─────────────────────────
  it('el PASAJERO califica a SU conductor (Calificacion.js)', async () => {
    await sembrar();
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(setDoc(doc(como('pasajero1'), 'calificaciones/n1'), delViaje()));
  });

  it('y el CONDUCTOR a SU pasajero — la mitad que se cae si se olvida', async () => {
    await sembrar();
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(setDoc(doc(como('conductor1'), 'calificaciones/n2'), delViaje({
      quienCalifica: 'conductor', calificadoId: 'pasajero1',
    })));
  });

  it('el CLIENTE califica SU restaurante (Restaurantes.js)', async () => {
    await sembrar();
    const { doc, setDoc } = FS;
    await RUT.assertSucceeds(setDoc(doc(como('pasajero1'), 'calificaciones/n3'), delRestaurante()));
  });

  // ── LOS ATAQUES QUE LA PRIMERA VERSIÓN DEJABA PASAR ──────────────────────
  it('EL ATAQUE · con MI viaje, NO puedo calificar a un conductor con el que no fui', async () => {
    await sembrar();
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('pasajero1'), 'calificaciones/a1'), delViaje({
      calificadoId: 'conductor2', estrellas: 1,
    })), 'Colgando la calificación de un viaje propio se le hundía la media a cualquiera.');
  });

  it('EL ATAQUE · ni a un restaurante rival colgándolo de mi viaje de taxi', async () => {
    await sembrar();
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('pasajero1'), 'calificaciones/a2'), delViaje({
      calificadoId: 'r1', estrellas: 1,
    })));
  });

  it('EL ATAQUE · ni ponerme cinco estrellas a MÍ MISMO en mi propio viaje', async () => {
    await sembrar();
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('pasajero1'), 'calificaciones/a5'), delViaje({
      calificadoId: 'pasajero1',
    })));
  });

  // Mandando LAS DOS claves se entraba por la rama más floja: pedido propio,
  // viaje ajeno. Por eso se exige UNA, no las dos.
  it('EL ATAQUE · ni mandando viaje Y pedido a la vez para colarse por la floja', async () => {
    await sembrar();
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('pasajero1'), 'calificaciones/a4'), {
      pedidoId: 'pc1', restauranteId: 'r1', viajeId: 'vajeno',
      calificadoId: 'conductor2', estrellas: 1,
    }));
  });

  it('EL ATAQUE · ni un pedido de restaurante que no es mío', async () => {
    await sembrar();
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('conductor2'), 'calificaciones/a6'), delRestaurante({
      estrellas: 1,
    })));
  });

  // MI pedido, pero las estrellas para OTRO. Sin esta, el mutante que quita el par
  // del pedido sobrevive: la de arriba lo niega por ser de otro cliente, no por el
  // par. Lo cazó la segunda opinión.
  it('EL ATAQUE · con MI pedido, las estrellas tienen que ir para MI restaurante', async () => {
    await sembrar();
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('pasajero1'), 'calificaciones/a14'), delRestaurante({
      calificadoId: 'conductor2', estrellas: 1,
    })));
    await RUT.assertFails(setDoc(doc(como('pasajero1'), 'calificaciones/a15'), delRestaurante({
      calificadoId: 'r2', estrellas: 1,
    })));
  });

  // Con las dos claves, y un calificadoId que SÍ encaja con la rama del pedido: sin
  // el candado de «una sola», entra por ahí y se cuelga de un viaje ajeno. La
  // versión anterior de esta prueba pasaba por el motivo equivocado.
  it('EL ATAQUE · ni con las dos claves aunque el calificadoId encaje con una', async () => {
    await sembrar();
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('pasajero1'), 'calificaciones/a16'), {
      pedidoId: 'pc1', restauranteId: 'r1', calificadoId: 'r1',
      viajeId: 'vajeno', estrellas: 1,
    }));
  });

  it('EL ATAQUE · ni inventándose un viaje que no existe', async () => {
    await sembrar();
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('pasajero1'), 'calificaciones/a7'), delViaje({
      viajeId: 'no-existe',
    })));
  });

  it('EL ATAQUE · ni una calificación suelta, sin viaje ni pedido', async () => {
    await sembrar();
    const { doc, setDoc } = FS;
    const suelta = delViaje(); delete suelta.viajeId;
    await RUT.assertFails(setDoc(doc(como('pasajero1'), 'calificaciones/a8'), suelta));
  });

  it('EL ATAQUE · ni doscientas estrellas, ni cero, ni con coma', async () => {
    await sembrar();
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('pasajero1'), 'calificaciones/a9'), delViaje({ estrellas: 200 })));
    await RUT.assertFails(setDoc(doc(como('pasajero1'), 'calificaciones/a10'), delViaje({ estrellas: 0 })));
    await RUT.assertFails(setDoc(doc(como('pasajero1'), 'calificaciones/a11'), delViaje({ estrellas: 4.5 })));
  });

  // Un pedido sin dueño no se puede calificar: no hay forma de saber quién estuvo
  // ahí. Los 29 pedidos viejos están así (el dueño se lo puso la REGLA 9-A a los
  // nuevos), y no se pierde nada: el dueño del proyecto confirmó el 25-ago-2026
  // que NINGÚN dato de esta base es real, son todos de prueba.
  it('un pedido SIN dueño no se puede calificar', async () => {
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('pasajero1'), 'calificaciones/a12'), {
      pedidoId: 'ped1', restauranteId: 'r1', calificadoId: 'r1', estrellas: 5,
    }));
  });

  // ── LOS DEFECTOS, QUE SON CARGA ──────────────────────────────────────────
  // Sin estas tres, los mutantes que cambian el defecto de .get(campo, 'sin-X')
  // por el uid de quien pregunta SOBREVIVEN: en el sembrado normal esos campos
  // siempre están. Las cazó la segunda opinión del 25-ago-2026. Y no es
  // hipotético: las propias reglas dicen que hay 13 viajes sin conductorId.
  it('un viaje SIN conductor no deja calificar a nadie', async () => {
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const { doc, setDoc } = FS;
      await setDoc(doc(ctx.firestore(), 'viajes/vsin'), { pasajeroId: 'pasajero1', estado: 'esperando' });
    });
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('pasajero1'), 'calificaciones/d1'), {
      viajeId: 'vsin', calificadoId: 'pasajero1', estrellas: 5,
    }), 'Con el defecto mal puesto, el pasajero de un viaje sin conductor se pone cinco a sí mismo.');
    await RUT.assertFails(setDoc(doc(como('pasajero1'), 'calificaciones/d2'), {
      viajeId: 'vsin', calificadoId: 'conductor1', estrellas: 1,
    }));
  });

  it('un viaje SIN pasajero tampoco', async () => {
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const { doc, setDoc } = FS;
      await setDoc(doc(ctx.firestore(), 'viajes/vsp'), { conductorId: 'conductor1', estado: 'aceptado' });
    });
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('conductor1'), 'calificaciones/d3'), {
      viajeId: 'vsp', calificadoId: 'conductor1', estrellas: 5,
    }));
  });

  it('un pedido SIN restaurante tampoco', async () => {
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const { doc, setDoc } = FS;
      await setDoc(doc(ctx.firestore(), 'pedidosRestaurantes/psr'), { clienteId: 'pasajero1', total: 100 });
    });
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('pasajero1'), 'calificaciones/d4'), {
      pedidoId: 'psr', calificadoId: 'pasajero1', estrellas: 5,
    }));
  });

  // Con las dos claves y un calificadoId que encaja con la rama del VIAJE. La otra
  // prueba de las dos claves solo mataba el candado de la rama del pedido.
  it('EL ATAQUE · ni con las dos claves encajando por la rama del viaje', async () => {
    await sembrar();
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(como('pasajero1'), 'calificaciones/d5'), {
      viajeId: 'vc1', pedidoId: 'pc1', calificadoId: 'conductor1', estrellas: 1,
    }));
  });

  // Sin sesión no se crea, y tiene que negarlo la COMPROBACIÓN, no un error de
  // evaluación. Con `allow create: if true` esto se pone rojo.
  it('sin sesión no se crea una calificación', async () => {
    await sembrar();
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(sinCuenta(), 'calificaciones/d6'), delViaje()));
  });

  // ── REESCRIBIR LAS MALAS ─────────────────────────────────────────────────
  it('LA FUGA · nadie reescribe una calificación para borrar la mala', async () => {
    await sembrar();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('r1'), 'calificaciones/hecha'), { estrellas: 5 }),
      'Borrarla no podía (REGLA 12), pero reescribirla dejaba el mismo resultado.');
    await RUT.assertFails(updateDoc(doc(como('pasajero1'), 'calificaciones/hecha'), { estrellas: 5 }));
    await RUT.assertFails(updateDoc(doc(como('conductor2'), 'calificaciones/hecha'), { comentario: 'otro' }));
  });

  // ── EL REPORTE, QUE POR POCO SE ROMPE ────────────────────────────────────
  // El restaurante reporta los comentarios insultantes desde
  // aliados/CalificacionesRestaurante.js:38. Esa pantalla pinta «Reportado» ANTES
  // de saber si se guardó y se traga el error con un catch vacío: si la regla lo
  // negara, quedaría un botón que dice que sí y no hace nada, y la cola de
  // moderación del panel vacía para siempre. Se me había escapado — mi búsqueda
  // de escritores llevaba un `head` que cortó justo esas líneas.
  it('EL NEGOCIO puede reportar un comentario suyo (aliados:38)', async () => {
    await sembrar();
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('r1'), 'calificaciones/hecha'), {
      reportado: true, motivoReporte: 'Insultos', estadoReporte: 'pendiente',
      fechaReporte: '2026-08-25T00:00:00.000Z',
    }));
  });

  it('pero reportando NO le puede tocar las estrellas', async () => {
    await sembrar();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('r1'), 'calificaciones/hecha'), {
      reportado: true, estrellas: 5,
    }));
  });

  // Autorizar por `calificadoId` en vez de por `restauranteId` pasaba todas las
  // pruebas, porque en el sembrado los dos valen 'r1'. Aquí se separan: si mañana
  // alguien cambia el campo, el CALIFICADO podría tapar su propia mala nota.
  it('el reporte se autoriza por el NEGOCIO, no por a quién califican', async () => {
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const { doc, setDoc } = FS;
      await setDoc(doc(ctx.firestore(), 'calificaciones/cruzada'), {
        pedidoId: 'pc1', restauranteId: 'r1', calificadoId: 'r2', estrellas: 1,
      });
    });
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('r2'), 'calificaciones/cruzada'), { reportado: true }));
    await RUT.assertSucceeds(updateDoc(doc(como('r1'), 'calificaciones/cruzada'), { reportado: true }));
  });

  // El comodín: una calificación de VIAJE no tiene restauranteId, así que
  // esDelNegocio('') dejaba entrar a un empleado con la ficha incompleta.
  it('una calificación de VIAJE no la puede reportar ningún negocio', async () => {
    await sembrar();
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const { doc, setDoc } = FS;
      await setDoc(doc(ctx.firestore(), 'calificaciones/deviaje'), {
        viajeId: 'vc1', calificadoId: 'conductor1', estrellas: 1,
      });
      await setDoc(doc(ctx.firestore(), 'empleados/empsin'), { nombre: 'SIN NEGOCIO', activo: true });
    });
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('empsin'), 'calificaciones/deviaje'), { reportado: true }),
      'Reportar es ESCONDER: las pantallas filtran las reportadas. Con el comodín, esa ' +
      'persona apagaba la calificación de quien quisiera.');
    await RUT.assertFails(updateDoc(doc(como('r1'), 'calificaciones/deviaje'), { reportado: true }));
  });

  it('ni reportar la de OTRO negocio', async () => {
    await sembrar();
    const { doc, updateDoc } = FS;
    await RUT.assertFails(updateDoc(doc(como('r2'), 'calificaciones/hecha'), { reportado: true }));
  });

  it('y el PANEL sigue moderando (admin/ComentariosReportados.js:28 y :35)', async () => {
    await sembrar();
    const { doc, updateDoc } = FS;
    await RUT.assertSucceeds(updateDoc(doc(como('eladmin'), 'calificaciones/hecha'), {
      reportado: false, estadoReporte: 'restaurado',
    }));
  });

  // ── LEER ─────────────────────────────────────────────────────────────────
  // Abierto a propósito: guajirago/src/Restaurantes.js:121 pide la colección
  // ENTERA para las medias. Se puede dejar así porque el documento NO dice quién
  // lo escribió — si algún día se le añade ese dato, esto hay que cerrarlo.
  it('LEER sigue abierto a quien tenga cuenta', async () => {
    await sembrar();
    const { collection, getDocs } = FS;
    await RUT.assertSucceeds(getDocs(collection(como('conductor2'), 'calificaciones')));
  });

  // Sin esta, el mutante de abrirlo al mundo entero (allow read: if true) pasaba
  // con todo en verde. Lo cazó la segunda opinión.
  it('pero SIN SESIÓN no, ni leer ni escribir', async () => {
    await sembrar();
    const { collection, getDocs, doc, setDoc } = FS;
    await RUT.assertFails(getDocs(collection(sinCuenta(), 'calificaciones')));
    await RUT.assertFails(setDoc(doc(sinCuenta(), 'calificaciones/a13'), delViaje()));
  });
});
