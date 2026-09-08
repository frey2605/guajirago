/**
 * PRUEBAS-CONSTITUCIÓN DE LAS REGLAS DEL ALMACÉN (Storage)
 *
 * EJECUTAN las reglas reales contra el emulador. No leen su texto: lo corren.
 * Una prueba que no puede fallar no protege nada.
 *
 *   npm test   (arranca los emuladores y luego esto)
 *
 * QUÉ SE VINO A TAPAR, medido el 6-sep-2026 desde fuera y SIN CREDENCIALES:
 * las reglas decían `allow read: if true`, se podía LISTAR el bucket entero y
 * se bajaron 105 kB de la foto de una cédula real. Había 16 cédulas y 16 caras
 * de 15 conductores, públicas para cualquiera que pidiera la lista.
 * La primera prueba de aquí abajo es exactamente esa puerta.
 */
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { leer, soloCodigo } = require('./cargar.cjs');

const RAIZ = path.resolve(__dirname, '..');
const PROYECTO = 'demo-guajirago';

let RUT;    // @firebase/rules-unit-testing
let ST;     // firebase/storage
let FS;     // firebase/firestore
let entorno;

/** Una "foto" de mentira, con su tipo. Lo que miran las reglas es el tipo y el tamaño. */
const foto = (kb = 4) => new Uint8Array(kb * 1024).fill(7);
const COMO_FOTO = { contentType: 'image/jpeg' };

// ── UN NOMBRE NUEVO EN CADA CORRIDA, y hace falta de verdad ─────────────────
//  En el chat de un pedido la regla prohíbe SOBRESCRIBIR (`resource == null`).
//  Con nombres fijos, la suite solo pasaba la PRIMERA vez: en la segunda, los
//  archivos de la primera seguían ahí y cuatro pruebas se ponían rojas sin que
//  nada estuviera mal. Se probó `clearStorage()` del propio Firebase y NO vacía
//  el emulador, así que el nombre se hace único aquí.
//  Una prueba que solo pasa la primera vez miente el día que alguien la repita.
const CORRIDA = Date.now();
const nueva = (n) => CORRIDA + '_' + n + '.jpg';

const como = (uid) => entorno.authenticatedContext(uid).storage();
const sinCuenta = () => entorno.unauthenticatedContext().storage();

before(async () => {
  RUT = await import('@firebase/rules-unit-testing');
  ST = await import('firebase/storage');
  FS = await import('firebase/firestore');
  entorno = await RUT.initializeTestEnvironment({
    projectId: PROYECTO,
    storage: {
      rules: fs.readFileSync(path.join(RAIZ, 'storage.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
    firestore: {
      rules: fs.readFileSync(path.join(RAIZ, 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8085,
    },
  });
});

after(async () => { if (entorno) await entorno.cleanup(); });

// Los personajes viven en Firestore, porque las reglas del almacén le PREGUNTAN
// a Firestore quién es admin y quién trabaja en qué negocio.
beforeEach(async () => {
  await entorno.clearFirestore();
  await entorno.withSecurityRulesDisabled(async (ctx) => {
    const { doc, setDoc } = FS;
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios/conductor1'), { nombre: 'Luis', rol: '', tipo: 'conductor' });
    await setDoc(doc(db, 'usuarios/conductor2'), { nombre: 'Ana', rol: '', tipo: 'conductor' });
    await setDoc(doc(db, 'usuarios/eladmin'), { nombre: 'Admin', rol: 'admin' });
    await setDoc(doc(db, 'usuarios/negocio1'), { nombre: 'Restaurante', rol: '' });
    await setDoc(doc(db, 'usuarios/negocio2'), { nombre: 'Otro', rol: '' });
    // Un mesero EN ACTIVO del negocio1, y uno al que ya despidieron.
    await setDoc(doc(db, 'empleados/mesero1'), { restauranteId: 'negocio1', activo: true });
    await setDoc(doc(db, 'empleados/despedido'), { restauranteId: 'negocio1', activo: false });
    // Dos pedidos: uno de HOY, que guarda quién lo pidió; y uno VIEJO de los
    // 29 de julio, que no lo guarda porque es anterior a esa línea del código.
    await setDoc(doc(db, 'pedidosRestaurantes/PED1'), {
      clienteId: 'conductor1', restauranteId: 'negocio1', estado: 'nuevo',
    });
    await setDoc(doc(db, 'pedidosRestaurantes/PEDVIEJO'), {
      restauranteId: 'negocio1', estado: 'cerrado',
    });
    // LOS MISMOS, EN LA CARPETA NUEVA. Así está la nube desde el 7-sep-2026: la
    // colección cambió de nombre (`pedidosRestaurantes` → `pedidos`), los 29 se
    // copiaron, y la vieja se queda de lápida. Sembrar los dos es lo que hace
    // que estas pruebas midan la realidad, y no una foto de ayer.
    await setDoc(doc(db, 'pedidos/PED1'), {
      clienteId: 'conductor1', restauranteId: 'negocio1', estado: 'nuevo',
    });
    await setDoc(doc(db, 'pedidos/PEDVIEJO'), {
      restauranteId: 'negocio1', estado: 'cerrado',
    });
    // Y DOS QUE ESTÁN EN UNA SOLA CARPETA, que son los que de verdad prueban
    // que la regla mira las DOS. Con todo sembrado por duplicado, quitarle
    // cualquiera de las dos consultas seguía encontrando el pedido en la otra:
    // los mutantes sobrevivían y las pruebas no protegían nada.
    //   · SOLOVIEJO: un rezagado, creado entre la mudanza y el despliegue de las
    //     apps. Existe mientras la lápida siga en pie.
    //   · SOLONUEVO: como serán TODOS de aquí en adelante.
    await setDoc(doc(db, 'pedidosRestaurantes/SOLOVIEJO'), {
      clienteId: 'conductor1', restauranteId: 'negocio1', estado: 'nuevo',
    });
    await setDoc(doc(db, 'pedidos/SOLONUEVO'), {
      clienteId: 'conductor1', restauranteId: 'negocio1', estado: 'nuevo',
    });
  });
  // Los archivos que ya existen, sembrados saltándose las reglas.
  await entorno.withSecurityRulesDisabled(async (ctx) => {
    const { ref, uploadBytes } = ST;
    const s = ctx.storage();
    await uploadBytes(ref(s, 'conductores/conductor1/cedula_1.jpg'), foto(), COMO_FOTO);
    await uploadBytes(ref(s, 'recargas/conductor1/comprobante_1.jpg'), foto(), COMO_FOTO);
    await uploadBytes(ref(s, 'comprobantes/negocio1/pago_1.jpg'), foto(), COMO_FOTO);
    await uploadBytes(ref(s, 'restaurantes/negocio1/logo_1.jpg'), foto(), COMO_FOTO);
  });
});

describe('STORAGE · la cédula del conductor deja de ser pública', () => {
  it('EL AGUJERO DE ANTES · SIN CUENTA no se baja la cédula de nadie', async () => {
    const { ref, getBytes } = ST;
    await RUT.assertFails(getBytes(ref(sinCuenta(), 'conductores/conductor1/cedula_1.jpg')),
      'Esto es lo que estaba abierto: 16 cédulas de 15 conductores, para cualquiera '
      + 'que pidiera la lista del bucket. Medido bajando 105 kB de una real.');
  });

  it('su DUEÑO sí la baja', async () => {
    const { ref, getBytes } = ST;
    await RUT.assertSucceeds(getBytes(ref(como('conductor1'), 'conductores/conductor1/cedula_1.jpg')));
  });

  it('OTRO conductor NO la baja', async () => {
    const { ref, getBytes } = ST;
    await RUT.assertFails(getBytes(ref(como('conductor2'), 'conductores/conductor1/cedula_1.jpg')));
  });

  it('la administración SÍ la baja (es quien aprueba al conductor)', async () => {
    const { ref, getBytes } = ST;
    await RUT.assertSucceeds(getBytes(ref(como('eladmin'), 'conductores/conductor1/cedula_1.jpg')));
  });

  it('EL QUE MUERDE · nadie sobrescribe la cédula de otro', async () => {
    const { ref, uploadBytes } = ST;
    await RUT.assertFails(uploadBytes(ref(como('conductor2'), 'conductores/conductor1/cedula_1.jpg'), foto(), COMO_FOTO),
      'Antes cualquiera con cuenta escribía en la carpeta de cualquiera: se le podía '
      + 'cambiar la cédula a un conductor por otra foto.');
  });

  it('y el conductor sí sube la SUYA', async () => {
    const { ref, uploadBytes } = ST;
    await RUT.assertSucceeds(uploadBytes(ref(como('conductor1'), 'conductores/conductor1/cedula_2.jpg'), foto(), COMO_FOTO));
  });
});

describe('STORAGE · el comprobante de la recarga es del que pagó', () => {
  it('otro conductor NO lo mira', async () => {
    const { ref, getBytes } = ST;
    await RUT.assertFails(getBytes(ref(como('conductor2'), 'recargas/conductor1/comprobante_1.jpg')));
  });
  it('su dueño y la administración sí', async () => {
    const { ref, getBytes } = ST;
    await RUT.assertSucceeds(getBytes(ref(como('conductor1'), 'recargas/conductor1/comprobante_1.jpg')));
    await RUT.assertSucceeds(getBytes(ref(como('eladmin'), 'recargas/conductor1/comprobante_1.jpg')));
  });
});

describe('STORAGE · lo del negocio lo tocan el negocio y SUS empleados', () => {
  it('el negocio sube su logo', async () => {
    const { ref, uploadBytes } = ST;
    await RUT.assertSucceeds(uploadBytes(ref(como('negocio1'), 'restaurantes/negocio1/logo_2.jpg'), foto(), COMO_FOTO));
  });

  it('EL QUE MUERDE · un EMPLEADO EN ACTIVO también (el mesero sube comprobantes)', async () => {
    // Si esto se cae, la app de aliados deja de funcionar para todo el que no
    // sea el dueño: los meseros entran con SU cuenta, no con la del negocio.
    const { ref, uploadBytes } = ST;
    await RUT.assertSucceeds(uploadBytes(ref(como('mesero1'), 'comprobantes/negocio1/pago_2.jpg'), foto(), COMO_FOTO));
  });

  it('EL QUE MUERDE · uno al que ya DESPIDIERON, no', async () => {
    const { ref, uploadBytes } = ST;
    await RUT.assertFails(uploadBytes(ref(como('despedido'), 'comprobantes/negocio1/pago_3.jpg'), foto(), COMO_FOTO));
  });

  it('otro negocio NO toca lo ajeno', async () => {
    const { ref, uploadBytes } = ST;
    await RUT.assertFails(uploadBytes(ref(como('negocio2'), 'restaurantes/negocio1/logo_3.jpg'), foto(), COMO_FOTO));
  });

  it('los COMPROBANTES del negocio no los lee cualquiera con sesión', async () => {
    const { ref, getBytes } = ST;
    await RUT.assertFails(getBytes(ref(como('conductor1'), 'comprobantes/negocio1/pago_1.jpg')),
      'son de plata: los mira el negocio y la administración, nadie más.');
    await RUT.assertSucceeds(getBytes(ref(como('negocio1'), 'comprobantes/negocio1/pago_1.jpg')));
    await RUT.assertSucceeds(getBytes(ref(como('eladmin'), 'comprobantes/negocio1/pago_1.jpg')));
  });
});

describe('STORAGE · EL LISTADO, que es por donde entraba cualquiera', () => {
  // ESTA ES LA PRUEBA QUE FALTABA, y es la del agujero de verdad: el problema
  // medido no fue que alguien adivinara la ruta de una cédula, fue que se PEDÍA
  // LA LISTA del bucket y salían las 43. `allow read` a secas incluye el
  // listado, y la primera versión de estas pruebas no listaba nada: se quedaba
  // verde con la puerta abierta.
  it('EL QUE MUERDE · SIN CUENTA no se puede listar nada', async () => {
    const { ref, listAll } = ST;
    await RUT.assertFails(listAll(ref(sinCuenta(), 'conductores')),
      'ASÍ ENTRABAN: se pedía la lista y salían las 16 cédulas, sin adivinar una ruta.');
    await RUT.assertFails(listAll(ref(sinCuenta(), '')));
  });

  it('EL QUE MUERDE · un conductor NO lista la carpeta de otro', async () => {
    const { ref, listAll } = ST;
    await RUT.assertFails(listAll(ref(como('conductor2'), 'conductores/conductor1')));
  });

  it('pero cada quien SÍ lista lo suyo, y la administración también', async () => {
    const { ref, listAll } = ST;
    await RUT.assertSucceeds(listAll(ref(como('conductor1'), 'conductores/conductor1')));
    await RUT.assertSucceeds(listAll(ref(como('eladmin'), 'conductores/conductor1')));
  });

  it('nadie lista los COMPROBANTES de un negocio ajeno', async () => {
    const { ref, listAll } = ST;
    await RUT.assertFails(listAll(ref(como('conductor1'), 'comprobantes/negocio1')));
    await RUT.assertSucceeds(listAll(ref(como('negocio1'), 'comprobantes/negocio1')));
  });
});

describe('STORAGE · la foto de perfil', () => {
  it('cada quien sube la suya y no la de otro', async () => {
    const { ref, uploadBytes } = ST;
    await RUT.assertSucceeds(uploadBytes(ref(como('conductor1'), 'usuarios/conductor1/perfil_1.jpg'), foto(), COMO_FOTO));
    await RUT.assertFails(uploadBytes(ref(como('conductor2'), 'usuarios/conductor1/perfil_2.jpg'), foto(), COMO_FOTO));
  });
});

describe('STORAGE · el chat del pedido: solo sus dos puntas', () => {
  it('EL CLIENTE de ese pedido sube su comprobante Y puede pedir su URL', async () => {
    // Las dos cosas juntas a propósito: las pantallas suben y ACTO SEGUIDO
    // piden la URL con `getDownloadURL`, que exige permiso de LECTURA. Si solo
    // se probara la subida, la foto se subiría y el mensaje se quedaría sin
    // ella, en silencio.
    const { ref, uploadBytes, getBytes } = ST;
    const r = ref(como('conductor1'), 'pedidosRestaurantes/PED1/' + nueva(1000));
    await RUT.assertSucceeds(uploadBytes(r, foto(), COMO_FOTO));
    await RUT.assertSucceeds(getBytes(r));
  });

  it('EL RESTAURANTE del pedido también, y su MESERO en activo', async () => {
    const { ref, uploadBytes, getBytes } = ST;
    const r = ref(como('negocio1'), 'pedidosRestaurantes/PED1/' + nueva(2000));
    await RUT.assertSucceeds(uploadBytes(r, foto(), COMO_FOTO));
    await RUT.assertSucceeds(getBytes(r));
    await RUT.assertSucceeds(uploadBytes(ref(como('mesero1'), 'pedidosRestaurantes/PED1/' + nueva(2001)), foto(), COMO_FOTO));
  });

  it('EL QUE MUERDE · un tercero con cuenta NO entra: ni lista, ni lee, ni sube', async () => {
    // Esto es lo que estaba abierto: cualquiera con una cuenta pedía la lista
    // de pedidos, se bajaba las fotos del chat ajeno y las sobrescribía.
    const { ref, uploadBytes, getBytes, listAll } = ST;
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      await ST.uploadBytes(ST.ref(ctx.storage(), 'pedidosRestaurantes/PED1/9.jpg'), foto(), COMO_FOTO);
    });
    await RUT.assertFails(listAll(ref(como('conductor2'), 'pedidosRestaurantes/PED1')),
      'se podían listar los archivos del chat de un pedido ajeno.');
    await RUT.assertFails(getBytes(ref(como('conductor2'), 'pedidosRestaurantes/PED1/9.jpg')));
    await RUT.assertFails(uploadBytes(ref(como('conductor2'), 'pedidosRestaurantes/PED1/8.jpg'), foto(), COMO_FOTO));
    // Y OTRO NEGOCIO tampoco, que es el vecino con más motivos para mirar.
    await RUT.assertFails(getBytes(ref(como('negocio2'), 'pedidosRestaurantes/PED1/9.jpg')));
  });

  it('EL QUE MUERDE · nadie pide la LISTA DE TODOS LOS PEDIDOS', async () => {
    // ESTA ES LA PUERTA GRANDE, y la primera versión de estas pruebas no la
    // probaba: la de arriba lista los archivos de UN pedido, no los pedidos.
    // Con la regla vieja esto PASABA para cualquiera con cuenta — se pedía la
    // lista de la carpeta madre y salían los números de todos los domicilios.
    // Ni siquiera su propio cliente puede: la lista de todos no es de nadie.
    const { ref, listAll } = ST;
    await RUT.assertFails(listAll(ref(como('conductor2'), 'pedidosRestaurantes')),
      'ASÍ SE ENTRABA: se pedía la lista y salían los pedidos de todo el mundo.');
    await RUT.assertFails(listAll(ref(como('conductor1'), 'pedidosRestaurantes')));
    await RUT.assertFails(listAll(ref(como('negocio1'), 'pedidosRestaurantes')));
    await RUT.assertFails(listAll(ref(sinCuenta(), 'pedidosRestaurantes')));
  });

  it('EL QUE MUERDE · en el chat tampoco entra lo que no es una foto', async () => {
    const { ref, uploadBytes } = ST;
    await RUT.assertFails(uploadBytes(ref(como('conductor1'), 'pedidosRestaurantes/PED1/doc.pdf'),
      foto(), { contentType: 'application/pdf' }));
    await RUT.assertFails(uploadBytes(ref(como('conductor1'), 'pedidosRestaurantes/PED1/gordo.jpg'),
      foto(11 * 1024), COMO_FOTO));
  });

  it('LA ADMINISTRACIÓN mira, pero NO escribe en el chat de un pedido', async () => {
    // La lectura copia entera la regla de la base (firestore.rules:1437), que sí
    // deja al panel ver el pedido. La escritura es más estrecha a propósito: el
    // panel no manda mensajes en ese chat, y no tiene por qué poder escribir
    // encima del comprobante de un pago.
    const { ref, uploadBytes, getBytes } = ST;
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      await ST.uploadBytes(ST.ref(ctx.storage(), 'pedidosRestaurantes/PED1/7.jpg'), foto(), COMO_FOTO);
    });
    await RUT.assertSucceeds(getBytes(ref(como('eladmin'), 'pedidosRestaurantes/PED1/7.jpg')));
    await RUT.assertFails(uploadBytes(ref(como('eladmin'), 'pedidosRestaurantes/PED1/6.jpg'), foto(), COMO_FOTO));
  });

  it('EL QUE MUERDE · una foto que YA ESTÁ no se puede sobrescribir, ni por su dueño', async () => {
    // En ese chat va el comprobante de un pago. Si se pudiera escribir encima,
    // se taparía la prueba con otra imagen y no quedaría rastro.
    const { ref, uploadBytes } = ST;
    const r = ref(como('conductor1'), 'pedidosRestaurantes/PED1/' + nueva(3000));
    await RUT.assertSucceeds(uploadBytes(r, foto(), COMO_FOTO));
    await RUT.assertFails(uploadBytes(r, foto(9), COMO_FOTO),
      'se pudo escribir encima de una foto que ya estaba: se tapa un comprobante y nadie se entera.');
  });

  it('un pedido que NO EXISTE está cerrado, y no revienta', async () => {
    // El `firestore.exists()` va antes del `get()` justo por esto: sin él, un
    // número inventado no da «no puedes», da un error raro.
    const { ref, uploadBytes } = ST;
    await RUT.assertFails(uploadBytes(ref(como('conductor1'), 'pedidosRestaurantes/NOEXISTE/1.jpg'), foto(), COMO_FOTO));
  });

  it('sin cuenta no se entra a ninguno', async () => {
    const { ref, getBytes, uploadBytes } = ST;
    await RUT.assertFails(getBytes(ref(sinCuenta(), 'pedidosRestaurantes/PED1/9.jpg')));
    await RUT.assertFails(uploadBytes(ref(sinCuenta(), 'pedidosRestaurantes/PED1/7.jpg'), foto(), COMO_FOTO));
  });

  // ── EL AGUJERO QUE CASI DEJO ABIERTO, Y AHORA ESTÁ CERRADO CON LLAVE ─────
  //  La colección de pedidos está cambiando de nombre (`pedidosRestaurantes` →
  //  `pedidos`). Se probó a que esta regla mirara LAS DOS colecciones, para
  //  dejar el terreno listo antes de mudar los datos. Parecía inofensivo.
  //
  //  🔴 NO LO ERA, y se reprodujo contra el emulador: como `pedidos` estaba
  //  VACÍA, cualquiera con cuenta podía crear ahí `pedidos/{el número del
  //  pedido de otro}` poniéndose de cliente. Y con eso la regla del almacén lo
  //  daba por dueño: se bajaba el COMPROBANTE DE PAGO de la víctima (2.048
  //  bytes de una foto real) y hasta podía meter fotos en su chat.
  //
  //  Se quitó. Esta prueba es lo que impide que vuelva: mientras la regla mire
  //  SOLO donde de verdad viven los pedidos, fabricar un gemelo no sirve de
  //  nada. El día que se mude, el orden es PRIMERO LOS DATOS —con los números
  //  ya ocupados no se puede crear encima— y solo entonces esta regla.
  it('EL QUE MUERDE · un pedido que solo está en la carpeta NUEVA', async () => {
    // Así serán todos de aquí en adelante. Si la regla dejara de mirar la
    // carpeta nueva, NADIE podría subir el comprobante de un domicilio — y
    // fallaría negando, en silencio.
    const { ref, uploadBytes, getBytes } = ST;
    const r = ref(como('conductor1'), 'pedidosRestaurantes/SOLONUEVO/' + nueva(6000));
    await RUT.assertSucceeds(uploadBytes(r, foto(), COMO_FOTO));
    await RUT.assertSucceeds(getBytes(r));
    await RUT.assertFails(uploadBytes(
      ref(como('conductor2'), 'pedidosRestaurantes/SOLONUEVO/' + nueva(6001)), foto(), COMO_FOTO));
  });

  it('EL QUE MUERDE · un rezagado que solo está en la carpeta VIEJA', async () => {
    // Los que entren entre la mudanza de los datos y el despliegue de las apps.
    // Si la regla dejara de mirar la carpeta vieja, esos se quedarían sin poder
    // mandar su comprobante mientras la lápida siga en pie.
    const { ref, uploadBytes, getBytes } = ST;
    const r = ref(como('conductor1'), 'pedidosRestaurantes/SOLOVIEJO/' + nueva(7000));
    await RUT.assertSucceeds(uploadBytes(r, foto(), COMO_FOTO));
    await RUT.assertSucceeds(getBytes(r));
    await RUT.assertFails(uploadBytes(
      ref(como('conductor2'), 'pedidosRestaurantes/SOLOVIEJO/' + nueva(7001)), foto(), COMO_FOTO));
  });

  it('EL QUE MUERDE · el número YA ESTÁ OCUPADO: no se puede fabricar el gemelo', async () => {
    // ESTO ES LO QUE DE VERDAD CIERRA LA PUERTA, y por eso los datos se mudaron
    // ANTES que esta regla: mientras `pedidos` estuvo vacía, cualquier número
    // estaba libre. Ahora que el pedido existe ahí, crear encima es imposible —
    // lo dice el servidor, no una comprobación de la app.
    const { doc, setDoc } = FS;
    await RUT.assertFails(setDoc(doc(entorno.authenticatedContext('conductor2').firestore(),
      'pedidos/PED1'), { clienteId: 'conductor2', restauranteId: 'negocio1', estado: 'nuevo' }),
    'SE PUDO ESCRIBIR ENCIMA DEL PEDIDO DE OTRO. Con eso, la regla del almacén lo daría '
    + 'por dueño y le abriría el chat: ahí va el comprobante de un pago.');
  });

  it('EL QUE MUERDE · y con el pedido de otro tampoco entra al chat', async () => {
    const { ref, uploadBytes, getBytes } = ST;
    // La víctima sube su comprobante.
    const suya = 'pedidosRestaurantes/PED1/' + nueva(5000);
    await RUT.assertSucceeds(uploadBytes(ref(como('conductor1'), suya), foto(), COMO_FOTO));
    // El extraño no lo baja ni le mete nada, ni por la carpeta vieja ni por la nueva.
    await RUT.assertFails(getBytes(ref(como('conductor2'), suya)),
      'SE ENTRÓ AL CHAT DE OTRO. Ahí va el comprobante de un pago.');
    await RUT.assertFails(uploadBytes(
      ref(como('conductor2'), 'pedidosRestaurantes/PED1/' + nueva(5001)), foto(), COMO_FOTO),
    'se pudo METER una foto en el chat de otro.');
  });

  it('LOS 29 VIEJOS · su restaurante SÍ entra; su cliente no, y está declarado', async () => {
    // Los 29 pedidos de julio son anteriores a la línea que guarda `clienteId`,
    // así que a su cliente esto lo deja fuera. No rompe nada —los 29 están
    // cerrados, entregados o cancelados, y entre todos tienen CERO fotos— y el
    // restaurante, que es quien los conserva, sigue entrando.
    // Si algún día se rellena el `clienteId` de los viejos, esta prueba se pone
    // roja y quien lo haga la cambiará a propósito.
    const { ref, uploadBytes } = ST;
    await RUT.assertSucceeds(uploadBytes(ref(como('negocio1'), 'pedidosRestaurantes/PEDVIEJO/' + nueva(1)), foto(), COMO_FOTO));
    await RUT.assertFails(uploadBytes(ref(como('conductor1'), 'pedidosRestaurantes/PEDVIEJO/2.jpg'), foto(), COMO_FOTO));
  });
});

describe('STORAGE · lo que se puede subir', () => {
  it('EL QUE MUERDE · lo que el navegador SÍ supo nombrar y no es foto, no entra', async () => {
    const { ref, uploadBytes } = ST;
    await RUT.assertFails(uploadBytes(ref(como('conductor1'), 'conductores/conductor1/cosa.pdf'),
      foto(), { contentType: 'application/pdf' }),
    'antes se subía cualquier cosa: las 13 subidas de las tres apps son fotos.');
    await RUT.assertFails(uploadBytes(ref(como('conductor1'), 'conductores/conductor1/video.mp4'),
      foto(), { contentType: 'video/mp4' }));
  });

  it('EL QUE MUERDE · una foto de un celular que NO dice el tipo SÍ entra', async () => {
    // Esto casi rompe la app: NINGUNA de las 13 subidas le pasa el contentType
    // al SDK, y cuando el `File.type` del celular viene vacío el SDK manda
    // `application/octet-stream`. La primera versión de la regla lo rechazaba —
    // medido contra el emulador— y una foto buena se habría quedado fuera, en
    // silencio. Si alguien endurece la regla sin arreglar antes los 13 sitios,
    // esta prueba se pone roja.
    const { ref, uploadBytes } = ST;
    await RUT.assertSucceeds(uploadBytes(ref(como('conductor1'), 'conductores/conductor1/sinTipo.jpg'),
      foto(), undefined));
  });

  it('EL QUE MUERDE · algo enorme tampoco (el almacén se paga por lo que ocupa)', async () => {
    const { ref, uploadBytes } = ST;
    await RUT.assertFails(uploadBytes(ref(como('conductor1'), 'conductores/conductor1/enorme.jpg'),
      foto(11 * 1024), COMO_FOTO),
    'sin tope, cualquiera con cuenta llena el almacén y la factura la paga el dueño.');
  });

  it('una foto normal de celular sí entra (5 MB)', async () => {
    const { ref, uploadBytes } = ST;
    await RUT.assertSucceeds(uploadBytes(ref(como('conductor1'), 'conductores/conductor1/normal.jpg'),
      foto(5 * 1024), COMO_FOTO));
  });
});

describe('STORAGE · lo que nadie puede hacer', () => {
  it('NADIE borra (comprobado: ninguna app llama a deleteObject)', async () => {
    const { ref, deleteObject } = ST;
    await RUT.assertFails(deleteObject(ref(como('conductor1'), 'conductores/conductor1/cedula_1.jpg')));
    await RUT.assertFails(deleteObject(ref(como('eladmin'), 'conductores/conductor1/cedula_1.jpg')));
  });

  it('una carpeta que no existe está CERRADA, no abierta', async () => {
    const { ref, uploadBytes, getBytes } = ST;
    await RUT.assertFails(uploadBytes(ref(como('conductor1'), 'inventada/loquesea.jpg'), foto(), COMO_FOTO),
      'lo que no tiene una regla que lo permita tiene que estar cerrado. Si esto pasa, '
      + 'quedó una regla comodín abierta.');
    await RUT.assertFails(getBytes(ref(sinCuenta(), 'inventada/loquesea.jpg')));
  });

  it('los ANUNCIOS los sube la administración, y solo ella', async () => {
    const { ref, uploadBytes } = ST;
    await RUT.assertFails(uploadBytes(ref(como('conductor1'), 'anuncios/falso.jpg'), foto(), COMO_FOTO));
    await RUT.assertSucceeds(uploadBytes(ref(como('eladmin'), 'anuncios/bueno.jpg'), foto(), COMO_FOTO));
  });
});

// ── EL AMARRE ENTRE LOS DOS ARCHIVOS DE REGLAS ────────────────────────────────
describe('STORAGE · `esDelNegocio` dice lo mismo aquí y en Firestore', () => {
  it('la misma cuenta en los dos sitios: dueño, o empleado suyo EN ACTIVO', () => {
    // Son dos archivos de reglas distintos y ninguno puede importar del otro,
    // así que la cuenta está escrita dos veces. Si se separan, un empleado
    // podría escribir en la base y no en el almacén (o al revés) y nadie
    // avisaría. Se comparan los tres ingredientes, no el texto: la sintaxis es
    // distinta a la fuerza (`$(database)` allá, `(default)` aquí).
    //
    // 🔴 LO QUE ESTE AMARRE **NO** HACE, dicho para que nadie se fíe de más:
    // comprueba que los tres ingredientes ESTÉN, no que la cuenta dé lo mismo.
    // Se queda verde si alguien cambia un `&&` por un `||`, o le añade un
    // `|| true`. Para eso están las pruebas de arriba, que EJECUTAN el candado
    // con un empleado en activo y con uno despedido. Esto solo caza el descuido
    // de quitar un trozo en un archivo y no en el otro.
    const trozo = (texto) => {
      const i = texto.indexOf('function esDelNegocio(');
      assert.ok(i >= 0, 'ya no existe `esDelNegocio`: si se renombró, hay que re-apuntar este amarre.');
      return texto.slice(i, texto.indexOf('\n    }', i));
    };
    const enBase = trozo(leer('firestore.rules'));
    const enAlmacen = trozo(leer('storage.rules'));
    for (const [que, aguja] of [
      ['el propio negocio', /request\.auth\.uid == negocioId/],
      ['mira la ficha del empleado', /empleados\/\$\(request\.auth\.uid\)/],
      ['y que sea de ESE negocio', /restauranteId'?,?\s*''?\)?\s*\)?\s*== negocioId|restauranteId', ''\) == negocioId/],
      ['y que siga EN ACTIVO', /activo'?,?\s*true\)?\s*==\s*true/],
    ]) {
      assert.match(enBase, aguja, 'firestore.rules perdió: ' + que);
      assert.match(enAlmacen, aguja, 'storage.rules perdió: ' + que);
    }
  });

  it('storage.rules ya NO lleva el `allow read: if true` que lo abría todo', () => {
    // SIN COMENTARIOS. La primera versión de esta prueba salía ROJA sobre reglas
    // sanas: la cabecera de `storage.rules` CITA las reglas viejas para explicar
    // qué se vino a tapar, y el buscador encontraba la cita. Es la misma trampa
    // que ya mordió dos veces en este proyecto, pero al revés: en vez de dejar
    // pasar un fallo, acusaba de un fallo que no estaba.
    assert.ok(!/allow read:\s*if true/.test(soloCodigo(leer('storage.rules'))),
      'volvió el agujero: con eso cualquiera sin cuenta baja las cédulas.');
  });

  it('y firebase.json las declara, para que se puedan desplegar', () => {
    const j = JSON.parse(leer('firebase.json'));
    assert.strictEqual(j.storage && j.storage.rules, 'storage.rules',
      'sin esto, `firebase deploy` no sube estas reglas y el archivo es un adorno.');
  });
});
