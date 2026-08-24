/**
 * LOS AMARRES ENTRE REPOS — PRUEBAS QUE LEEN LOS DOS LADOS
 *
 * El panel (guajirago-admin) y la app de aliados son repositorios APARTE: no
 * pueden importar archivos de la app del pasajero. Todo lo que comparten es
 * contrato invisible de campos y listas en Firestore — y un contrato invisible
 * se rompe en silencio.
 *
 * Pero estas pruebas viven en la carpeta RAÍZ, que en este disco contiene las
 * tres apps. Así que pueden leer los dos lados de cada contrato y ponerse rojas
 * si dejan de decir lo mismo. Es el mismo amarre de estadosViaje.js con las
 * reglas de Firestore, extendido a los otros repos.
 *
 * OJO: estas pruebas necesitan que guajirago-admin/ y guajirago-aliados/ estén
 * en el disco junto a la raíz (así está esta máquina). Si un día faltan, la
 * prueba lo dice con claridad en vez de mentir en verde.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
// El cargador vive en cargar.cjs: un solo sitio para todas las pruebas (SEGUNDA LEY).
const { leer, cargarDeLaApp } = require('./cargar.cjs');

describe('AMARRES · la app y el servidor miden la distancia IGUAL', () => {
  it('las dos calculadoras dan los mismos kilómetros en los mismos puntos', () => {
    // La app (distancia.js) decide qué viajes ve el conductor; el servidor
    // (functions/index.js, distanciaKm) decide a quién se le avisa. Si miden
    // distinto, un conductor ve viajes de los que nunca le avisaron — o le
    // llegan avisos de viajes que su pantalla no enseña. Sin error, solo caos.
    //
    // El servidor no puede importar la de la app (las funciones se despliegan
    // con su propia carpeta), así que aquí se EJECUTAN LAS DOS y se comparan.
    const { calcularDistanciaKm } = cargarDeLaApp('guajirago/src/distancia.js');

    const servidor = leer('guajirago/functions/index.js');
    const trozo = servidor.match(/function distanciaKm\([\s\S]*?\n\}/);
    assert.ok(trozo, 'el servidor ya no tiene la función distanciaKm en functions/index.js');
    // eslint-disable-next-line no-new-func
    const delServidor = new Function(trozo[0] + '\nreturn distanciaKm;')();

    // Puntos de verdad: el centro de Riohacha, el aeropuerto, la salida a
    // Maicao, un punto a medio mundo y el mismo punto dos veces (0 km).
    const PUNTOS = [
      [11.5444, -72.9072], [11.5262, -72.9260], [11.3800, -72.2400],
      [4.6097, -74.0817], [-33.8688, 151.2093], [11.5444, -72.9072],
    ];
    let comparadas = 0;
    for (const [aLat, aLng] of PUNTOS) {
      for (const [bLat, bLng] of PUNTOS) {
        const app = calcularDistanciaKm(aLat, aLng, bLat, bLng);
        const srv = delServidor(aLat, aLng, bLat, bLng);
        assert.ok(Math.abs(app - srv) < 0.000001,
          'La app y el servidor miden DISTINTO entre (' + aLat + ',' + aLng + ') y (' +
          bLat + ',' + bLng + '): app=' + app + ' km, servidor=' + srv + ' km. ' +
          'Hay que dejar las dos fórmulas iguales: distancia.js y functions/index.js.');
        comparadas++;
      }
    }
    assert.strictEqual(comparadas, 36);
    // Y una de cordura: del centro al aeropuerto hay ~3 km, no 30 ni 0,3.
    const alAeropuerto = calcularDistanciaKm(11.5444, -72.9072, 11.5262, -72.9260);
    assert.ok(alAeropuerto > 1 && alAeropuerto < 6,
      'del centro al aeropuerto salió ' + alAeropuerto + ' km: la fórmula está rota');
  });

  it('NINGUNA pantalla vuelve a tener su propia fórmula de distancia', () => {
    const PANTALLAS = ['guajirago/src/AppConductor.js', 'guajirago/src/Solicitar.js', 'guajirago/src/SolicitarMensajeria.js', 'guajirago/src/Home.js'];
    for (const pantalla of PANTALLAS) {
      const fuente = leer(pantalla);
      assert.ok(!fuente.includes('6371'),
        pantalla + ' volvió a tener su propia fórmula de distancia (aparece el radio 6371). ' +
        'La cuenta vive en distancia.js (SEGUNDA LEY).');
    }
  });
});

describe('AMARRES · los colores de aliados salen de flujoPedidos, no se reescriben', () => {
  it('NINGUNA pantalla de aliados vuelve a definir a mano AZUL, AZUL_MEDIO, NARANJA o NARANJA_CLARO', () => {
    // Hasta el 24-ago-2026, 18 pantallas redefinían estos colores aunque
    // flujoPedidos.js ya los exportaba. Si una copia cambia de tono, esa
    // pantalla queda de otro color y nadie se entera hasta verla.
    const fs = require('node:fs');
    const path = require('node:path');
    const carpeta = path.resolve(__dirname, '..', 'guajirago-aliados', 'src');
    const HUELLAS = ['const AZUL =', 'const AZUL_MEDIO =', 'const NARANJA =', 'const NARANJA_CLARO ='];
    for (const archivo of fs.readdirSync(carpeta).filter((f) => f.endsWith('.js') && f !== 'flujoPedidos.js')) {
      const fuente = fs.readFileSync(path.join(carpeta, archivo), 'utf8');
      for (const huella of HUELLAS) {
        assert.ok(!fuente.includes(huella),
          'guajirago-aliados/src/' + archivo + ' volvió a definir «' + huella.slice(6, -2) + '» a mano. ' +
          'Los colores compartidos viven en flujoPedidos.js (SEGUNDA LEY): se importan, no se copian.');
      }
    }
  });
});

describe('AMARRES · el filtro anti-datos juzga IGUAL en la app y en el panel', () => {
  it('las dos copias dan el mismo veredicto con la misma batería de mensajes', () => {
    // La app filtra con filtroChat.js; el panel (Codigos.js, otro repo que no
    // puede importarla) tiene su propia copia. Si divergen, lo que un chat
    // bloquea el otro lo deja pasar — ya pasó: la copia del restaurante dejaba
    // pasar «gmail» y «celular» hasta el 24-ago-2026. Aquí se EJECUTAN las dos.
    const { contieneInfoSensible } = cargarDeLaApp('guajirago/src/filtroChat.js');

    const panel = leer('guajirago-admin/src/Codigos.js');
    const trozo = panel.match(/function contieneInfoSensibleAdmin\([\s\S]*?\n\}/);
    assert.ok(trozo, 'el panel ya no tiene contieneInfoSensibleAdmin en Codigos.js');
    // eslint-disable-next-line no-new-func
    const delPanel = new Function(trozo[0] + '\nreturn contieneInfoSensibleAdmin;')();

    const BATERIA = [
      'llámame al 3001234567', '300 123 4567', '3+0+0+1+2+3+4+5+6+7', 'juan@correo.com',
      'whatsapp', 'whats app', 'wasap', 'wapp', 'instagram', 'facebook',
      'telegram', 'tiktok', 'correo', 'email', 'gmail', 'hotmail',
      'dame tu celular', 'tu numero', 'tu número', 'llamame', 'llámame',
      'ya salió tu pedido', 'la casa de rejas blancas', 'recargué 20 mil', 'el código es 1234',
    ];
    for (const mensaje of BATERIA) {
      assert.strictEqual(contieneInfoSensible(mensaje), delPanel(mensaje),
        'Con «' + mensaje + '» la app dice ' + contieneInfoSensible(mensaje) + ' y el panel ' +
        delPanel(mensaje) + '. Las dos listas se separaron: se cambian LOS DOS lados ' +
        '(filtroChat.js y Codigos.js).');
    }
  });
});

describe('AMARRES · el formateador de pesos escribe IGUAL en las dos apps', () => {
  it('las dos moneda.js (app y aliados) formatean idéntico, incluido el dato vacío', () => {
    // Son gemelas a propósito: los repos no pueden compartir archivo. Este
    // amarre EJECUTA las dos. Si un día una escribe «$ 8.000» y la otra
    // «COP 8.000», el cliente y el restaurante verían la misma plata escrita
    // distinto.
    const app = cargarDeLaApp('guajirago/src/moneda.js').cop;
    const aliados = cargarDeLaApp('guajirago-aliados/src/moneda.js').cop;
    for (const n of [0, 1, 999, 8000, 125500, 1000000, null, undefined]) {
      assert.strictEqual(app(n), aliados(n),
        'con ' + String(n) + ' la app escribe «' + app(n) + '» y aliados «' + aliados(n) + '»');
    }
    // Y el dato vacío se enseña como $ 0, jamás como $ NaN (la mitad de las 13
    // copias viejas escribía NaN en pantalla).
    assert.ok(!app(undefined).includes('NaN'), 'la app volvió a escribir NaN en pantalla');
    assert.ok(app(0).includes('0'));
  });
});

describe('AMARRES · la comisión: el paracaídas del servidor y el de la app son el mismo', () => {
  it('los tres números de respaldo (mototaxi, taxi, domicilio) coinciden con el servidor', () => {
    // El servidor (functions/index.js) es QUIEN COBRA, y si config/global no
    // carga usa sus paracaídas «?? 300/800/1000». La app enseña la comisión con
    // comisiones.js, que tiene los suyos. Las funciones se despliegan con su
    // propia carpeta y no pueden importar comisiones.js — si los números se
    // separan, el conductor vería una comisión y pagaría otra.
    const { COMISIONES_DEFECTO } = cargarDeLaApp('guajirago/src/comisiones.js');
    const servidor = leer('guajirago/functions/index.js');
    const saca = (clave) => {
      const m = servidor.match(new RegExp('cfg\\.' + clave + ' \\?\\? (\\d+)'));
      assert.ok(m, 'el servidor ya no tiene el paracaídas «cfg.' + clave + ' ?? número» en functions/index.js');
      return Number(m[1]);
    };
    assert.strictEqual(saca('comisionMototaxi'), COMISIONES_DEFECTO.comisionMototaxi,
      'el paracaídas de mototaxi del servidor y el de la app se separaron');
    assert.strictEqual(saca('comisionTaxi'), COMISIONES_DEFECTO.comisionTaxi,
      'el paracaídas de taxi del servidor y el de la app se separaron');
    assert.strictEqual(saca('comisionDomicilio'), COMISIONES_DEFECTO.comisionDomicilio,
      'el paracaídas de domicilio del servidor y el de la app se separaron');
  });
});

describe('AMARRES · los estados del PEDIDO de restaurante entre la app del cliente y aliados', () => {
  it('la línea de tiempo del cliente solo usa estados que aliados conoce, y en el mismo orden', () => {
    // Aliados tiene su fuente única (flujoPedidos.js: ORDEN_ESTADOS) — bien
    // hecho. Pero la app del CLIENTE es otro repo y escribe su línea de tiempo
    // a mano en Restaurantes.js. El cliente puede SIMPLIFICAR (no enseña
    // 'empacado' ni 'cerrado': son cocina interna y caja), pero no puede
    // inventar estados ni desordenarlos: un estado inventado jamás se
    // encendería y el cliente vería su pedido congelado para siempre.
    const { ORDEN_ESTADOS } = cargarDeLaApp('guajirago-aliados/src/flujoPedidos.js');
    const CONOCIDOS = ['nuevo', ...ORDEN_ESTADOS];

    const cliente = leer('guajirago/src/Restaurantes.js');
    const bloque = cliente.match(/const ESTADOS = \[[\s\S]*?\];/);
    assert.ok(bloque, 'la app del cliente ya no tiene su línea de tiempo ESTADOS en Restaurantes.js');
    const delCliente = [...bloque[0].matchAll(/id: '([a-z_]+)'/g)].map((m) => m[1]);
    assert.ok(delCliente.length >= 4, 'la línea de tiempo del cliente quedó rara: ' + delCliente.join(', '));

    for (const e of delCliente) {
      assert.ok(CONOCIDOS.includes(e),
        'La app del cliente enseña el estado «' + e + '», que aliados NO conoce ' +
        '(flujoPedidos.js: ' + CONOCIDOS.join(', ') + '). Ese paso jamás se encendería.');
    }
    // El orden relativo es el del flujo: si el cliente pone 'en_camino' antes
    // que 'preparando', la línea de tiempo mentiría.
    const posiciones = delCliente.map((e) => CONOCIDOS.indexOf(e));
    for (let i = 1; i < posiciones.length; i++) {
      assert.ok(posiciones[i] > posiciones[i - 1],
        'La línea de tiempo del cliente va en OTRO ORDEN que el flujo de aliados: ' +
        delCliente.join(' → ') + ' contra ' + CONOCIDOS.join(' → '));
    }
  });
});

describe('AMARRES · los estados de la RESERVA de turismo entre la app y aliados', () => {
  it('los dos lados conocen exactamente los mismos cuatro estados', () => {
    // La app (Turismo.js) le pone nombre y color a cada estado; aliados
    // (ReservasTurismo.js) los usa de filtros y los escribe. Un estado que un
    // lado escriba y el otro no conozca se enseña sin nombre y sin color — o
    // la reserva desaparece de todos los filtros de la agencia.
    const app = leer('guajirago/src/Turismo.js');
    const mapa = app.match(/const estadoTxt = \(e\) => \(\{([\s\S]*?)\}\[e\]/);
    assert.ok(mapa, 'la app ya no tiene el mapa estadoTxt en Turismo.js');
    const delaApp = [...mapa[1].matchAll(/([a-z_]+):/g)].map((m) => m[1]);

    const aliados = leer('guajirago-aliados/src/ReservasTurismo.js');
    const filtros = aliados.match(/const FILTROS = \[[\s\S]*?\];/);
    assert.ok(filtros, 'aliados ya no tiene los FILTROS en ReservasTurismo.js');
    // eslint-disable-next-line no-new-func
    const FILTROS = new Function(filtros[0] + '\nreturn FILTROS;')();
    const deAliados = FILTROS.flatMap((f) => f[2]);

    assert.deepStrictEqual([...delaApp].sort(), [...deAliados].sort(),
      'La app y aliados conocen estados DISTINTOS de la reserva.\n' +
      '   app (Turismo.js):              ' + [...delaApp].sort().join(', ') + '\n' +
      '   aliados (ReservasTurismo.js):  ' + [...deAliados].sort().join(', ') + '\n' +
      'Se cambian LOS DOS lados a la vez.');
  });
});

describe('AMARRES · el respaldo del panel y el de la app son el MISMO número a número', () => {
  it('cada número que ambos conocen vale lo mismo en los dos lados', () => {
    // El panel (Superadmin.js, CONFIG_POR_DEFECTO) tiene su propia copia del
    // respaldo y NO puede importar los archivos de la app: es otro repositorio.
    // Su copia pesa más que ninguna: si config/global no existiera, el panel la
    // ESCRIBE ENTERA como configuración inicial (Superadmin.js ~192). Un número
    // distinto ahí se convertiría en la configuración real del negocio.
    const { CONFIG_TARIFAS_DEFECTO } = cargarDeLaApp('guajirago/src/tarifas.js');
    const { COMISIONES_DEFECTO } = cargarDeLaApp('guajirago/src/comisiones.js');
    const { CONFIG_COMPARTIDA } = cargarDeLaApp('guajirago/src/configApp.js');
    const delaApp = { ...CONFIG_TARIFAS_DEFECTO, ...COMISIONES_DEFECTO, ...CONFIG_COMPARTIDA };

    const panel = leer('guajirago-admin/src/Superadmin.js');
    const bloque = panel.match(/const CONFIG_POR_DEFECTO = \{[\s\S]*?\n\};/);
    assert.ok(bloque, 'el panel ya no tiene CONFIG_POR_DEFECTO en Superadmin.js');
    // Es un objeto de puros números y verdadero/falso: se puede ejecutar tal cual.
    // eslint-disable-next-line no-new-func
    const delPanel = new Function(bloque[0] + '\nreturn CONFIG_POR_DEFECTO;')();

    const comunes = Object.keys(delaApp).filter((k) => k in delPanel);
    // EXACTAMENTE 15: si baja, alguien renombró una clave (y salió de la
    // comparación en silencio); si sube, ambos lados ganaron una clave común y
    // este número se sube A PROPÓSITO, mirando que valga lo mismo en los dos.
    assert.strictEqual(comunes.length, 15,
      'hay ' + comunes.length + ' números en común entre panel y app, y deben ser 15. ' +
      'Si se renombró o añadió una clave compartida, se actualizan los dos lados y este número.');
    for (const k of comunes) {
      assert.strictEqual(delPanel[k], delaApp[k],
        'El respaldo de «' + k + '» vale ' + delPanel[k] + ' en el panel y ' + delaApp[k] +
        ' en la app. Dos paracaídas distintos = dos verdades el día que la config no cargue. ' +
        'Se cambia en LOS DOS lados: Superadmin.js y el archivo de la app (tarifas.js / ' +
        'comisiones.js / configApp.js).');
    }
  });

  it('NINGUNA pantalla de la app vuelve a escribir esos números a mano', () => {
    const PANTALLAS = ['guajirago/src/Solicitar.js', 'guajirago/src/SolicitarMensajeria.js', 'guajirago/src/AppConductor.js'];
    const HUELLAS = ['incrementoTarifa:', 'radioBusquedaInicial:', 'radioBusquedaAmpliado:', 'maximoFavoritos:', 'tiempoEsperaConductor:', 'duracionContraoferta:'];
    for (const pantalla of PANTALLAS) {
      const fuente = leer(pantalla);
      for (const huella of HUELLAS) {
        assert.ok(!fuente.includes(huella),
          pantalla + ' volvió a escribir «' + huella.slice(0, -1) + '» a mano. ' +
          'Ese respaldo vive en configApp.js (SEGUNDA LEY).');
      }
    }
  });
});

describe('AMARRES · el panel y la app dicen lo mismo', () => {
  it('la lista de VIAJES EN CURSO del panel contiene TODO el mercado de la app, y nada inventado', () => {
    // El panel enseña "viajes activos" con una lista escrita a mano en
    // guajirago-admin/src/Viajes.js. Esa lista tiene que ser: los estados del
    // MERCADO (los que buscan conductor, de estadosViaje.js) MÁS los dos de
    // viaje andando ('aceptado' y 'confirmado').
    //
    // EL PELIGRO: si mañana se añade un estado al mercado en la app y no aquí,
    // el panel deja de ver esos viajes — sin error, solo una lista más corta.
    const { ESTADOS_MERCADO } = cargarDeLaApp('guajirago/src/estadosViaje.js');
    const EN_MARCHA = ['aceptado', 'confirmado']; // el viaje ya tiene conductor

    const panel = leer('guajirago-admin/src/Viajes.js');
    const consulta = panel.match(/where\('estado',\s*'in',\s*\[([^\]]+)\]/);
    assert.ok(consulta, 'el panel ya no consulta los viajes en curso con where(estado, in, [...])');
    const delPanel = consulta[1].replace(/['"\s]/g, '').split(',').filter(Boolean);

    assert.deepStrictEqual(
      [...delPanel].sort(),
      [...ESTADOS_MERCADO, ...EN_MARCHA].sort(),
      'La lista del panel y la de la app se separaron.\n' +
      '   app (mercado + en marcha): ' + [...ESTADOS_MERCADO, ...EN_MARCHA].sort().join(', ') + '\n' +
      '   panel (Viajes.js):         ' + [...delPanel].sort().join(', ') + '\n' +
      'Si el cambio es a propósito, se cambian LOS DOS LADOS: estadosViaje.js (y ' +
      'firestore.rules, que tiene su propio amarre) y guajirago-admin/src/Viajes.js.'
    );
  });
});

// ── SEGUNDA LEY · QUÉ ES PRIVADO DE UN NEGOCIO, UNA SOLA LISTA ──────────────
// «No se pueden usar dos calculadoras para un mismo proceso.»
//
// Qué campos son privados lo tienen que saber CUATRO sitios que no pueden
// compartir un archivo entre ellos: el registro de aliados, el panel de admin,
// las funciones del servidor y firestore.rules (que ni siquiera es JavaScript).
//
// Si esa lista se escribe cuatro veces, tres se quedan viejas. Y el fallo NO
// avisa: alguien añade un campo nuevo al registro de un negocio, se olvida de
// una copia, y ese dato acaba en el escaparate que se descarga cualquier
// cliente. Nadie ve un error — simplemente se publica.
//
// Estas pruebas EJECUTAN el archivo bueno y lo carean contra los otros lados.

describe('SEGUNDA LEY · el cuarto privado del negocio, una sola lista', () => {
  const modulo = () => cargarDeLaApp('guajirago-aliados/src/negocioPrivado.js');

  it('la colección que dice el archivo es la que protegen las reglas', () => {
    const { COLECCION_PRIVADA } = modulo();
    const reglas = leer('firestore.rules');
    assert.ok(reglas.includes('match /' + COLECCION_PRIVADA + '/'),
      'negocioPrivado.js dice que lo privado vive en «' + COLECCION_PRIVADA + '», pero ' +
      'firestore.rules no tiene bloque para esa colección. Firestore niega por defecto lo que ' +
      'no está escrito, así que el registro de un negocio nuevo fallaría ENTERO.');
  });

  // La lista se compara EXACTA, no con «incluye». Y es a propósito, aunque
  // obligue a tocar esta prueba cada vez que se añada un campo — precisamente
  // por eso: es una lista de verificación con acuse de recibo.
  //
  // Antes esto usaba includes(), y con eso el archivo negocioPrivado.js le
  // estaba MINTIENDO al programador nuevo: le dice «añade el campo, corre las
  // pruebas, y si falta un sitio se pondrá roja». No se ponía. Se podía añadir
  // 'cuentaBancaria' a la lista, ver todo verde, y publicarla en el escaparate
  // que se descarga cualquier cliente. Lo cazó la segunda opinión del
  // 24-ago-2026 plantando ese mutante exacto.
  it('la lista de campos privados es EXACTAMENTE esta', () => {
    const { CAMPOS_PRIVADOS } = modulo();
    // Medidos en el servidor el 24-ago-2026 dentro del documento público.
    assert.deepStrictEqual([...CAMPOS_PRIVADOS].sort(), [
      'creditos', 'duenoNombre', 'duenoTelefono', 'email', 'fcmToken',
    ], [
      'La lista de campos privados cambió.',
      '',
      'Si QUITASTE uno: ese campo vuelve al escaparate y se lo lleva cualquier',
      'cliente registrado. Casi seguro que es un error.',
      '',
      'Si AÑADISTE uno a propósito, esta prueba es tu lista de verificación.',
      'Antes de añadirlo aquí, comprueba los otros lados:',
      '  · firestore.rules — ¿hay que congelarlo también?',
      '  · guajirago-admin — ¿alguna pantalla lo lee del documento público?',
      '  · guajirago/functions/index.js — ¿lo lee el servidor?',
      'Cuando estén los cuatro, añádelo aquí y esta prueba vuelve a verde.',
    ].join('\n'));
  });

  it('el dinero lo protegen los DOS lados: la lista y las reglas', () => {
    const { COLECCION_PRIVADA } = modulo();
    const reglas = leer('firestore.rules');
    const desde = reglas.split('match /' + COLECCION_PRIVADA + '/')[1];
    assert.ok(desde, 'no está el bloque de ' + COLECCION_PRIVADA + ' en las reglas');
    const bloque = desde.split('match /')[0];
    // Mirar el bloque entero NO vale: la palabra sale tambien en un comentario y
    // en la comprobacion del create, asi que la prueba pasaba aunque los creditos
    // se cayeran de la lista congelada. Lo cazo un mutante. Hay que mirar DENTRO
    // de camposDelPanel(), que es la lista que de verdad los protege.
    const lista = (bloque.split('camposDelPanel()')[1] || '').split('}')[0];
    assert.ok(lista.includes("'creditos'"),
      'Las reglas del cuarto privado ya no congelan «creditos». El negocio podría escribirse ' +
      'su propio saldo — que es justo lo que la REGLA 7 cerró para las personas.');
  });

  it('repartir los datos no pierde ni duplica ningún campo', () => {
    const { soloLoPrivado, sinLoPrivado } = modulo();
    const datos = {
      nombre: 'X', duenoNombre: 'Y', duenoTelefono: '1', email: 'a@b',
      creditos: 0, fcmToken: 't', menu: [], aprobado: false, rol: 'dueno',
    };
    const privado = soloLoPrivado(datos);
    const publico = sinLoPrivado(datos);
    assert.deepStrictEqual(
      [...Object.keys(privado), ...Object.keys(publico)].sort(),
      Object.keys(datos).sort(),
      'repartir el negocio pierde o duplica campos');
    Object.keys(privado).forEach((campo) => {
      assert.ok(!(campo in publico), '«' + campo + '» sale por los dos lados');
    });
  });

  it('lo privado NO se queda en el reparto público, campo por campo', () => {
    const { CAMPOS_PRIVADOS, sinLoPrivado } = modulo();
    const todos = {};
    CAMPOS_PRIVADOS.forEach((c) => { todos[c] = 'algo'; });
    todos.nombre = 'EL NEGOCIO';
    assert.deepStrictEqual(Object.keys(sinLoPrivado(todos)), ['nombre']);
  });

  // Se mira el archivo SIN COMENTARIOS y se busca la escritura ENTERA. Con la
  // cadena suelta, comentar la línea dejaba la prueba verde —el texto seguía en
  // el archivo— y el negocio nuevo nacía sin cuarto sin que nada avisara. Es la
  // misma trampa de buscar una palabra que aparece en un comentario, mudada de
  // firestore.rules a Login.js. La cazó la segunda opinión del 24-ago-2026.
  it('el registro de aliados ESCRIBE el cuarto usando esa lista, no una copia', () => {
    const vivo = leer('guajirago-aliados/src/Login.js').replace(/\/\/.*$/gm, '');
    assert.ok(vivo.includes("from './negocioPrivado'"),
      'aliados/Login.js dejó de importar negocioPrivado.js: o hizo su propia copia de la ' +
      'lista, o dejó de escribir el cuarto privado.');
    assert.ok(vivo.includes('COLECCION_PRIVADA, uid), soloLoPrivado(datos)'),
      'aliados/Login.js ya no escribe el cuarto privado con la lista compartida. O se ' +
      'comentó la línea, o se cambió la colección, o alguien repartió los campos a mano. ' +
      'El negocio nuevo nacería sin cuarto — y la tanda 2, que vacía el escaparate, le ' +
      'borraría los datos del dueño sin tenerlos guardados en ningún sitio.');
  });
});
