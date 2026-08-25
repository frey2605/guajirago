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

  // ── LA TANDA 2: LO QUE NO PUEDE VOLVER AL ESCAPARATE ─────────────────────
  // El bloque de `restaurantes` tiene ahora su propia camposPrivados(), que es
  // lo que impide que los datos del dueño reaparezcan en la colección que la app
  // del pasajero se descarga entera. Esa lista y la de negocioPrivado.js tienen
  // que decir lo MISMO: si a las reglas se les cae un campo, ese vuelve al
  // escaparate el día que alguien lo escriba, y no falla nada al hacerlo.
  //
  // Se mira DENTRO de camposPrivados() y no en el bloque entero, por lo de
  // siempre: los nombres de los campos salen también en los comentarios, y una
  // prueba que los encuentre ahí pasa aunque la lista esté vacía. Ya lo cazó un
  // mutante una vez, en el amarre del dinero de aquí abajo.
  it('las reglas del ESCAPARATE prohíben exactamente los campos privados', () => {
    const { CAMPOS_PRIVADOS } = modulo();
    const reglas = leer('firestore.rules');
    const desde = reglas.split('match /restaurantes/{restauranteId}')[1];
    assert.ok(desde, 'no está el bloque de restaurantes en las reglas');
    const bloque = desde.split('match /')[0];
    const lista = (bloque.split('function camposPrivados()')[1] || '').split('}')[0];
    assert.ok(lista.trim(),
      'firestore.rules ya no tiene camposPrivados() en el bloque de restaurantes. Sin esa ' +
      'lista, cualquier pantalla puede devolver el nombre, el teléfono o el correo del dueño ' +
      'al escaparate — y no falla nada al hacerlo, el dato simplemente reaparece.');
    // Se busca con expresión regular, no con la cadena entre comillas simples. Con
    // includes("'" + campo + "'") bastaba escribir la lista de las reglas con
    // comillas dobles —código válido, funciona igual— para que esto se pusiera rojo
    // DICIENDO QUE FALTA UN CAMPO QUE SÍ ESTÁ. Eso es peor que no avisar: manda a
    // buscar un agujero que no existe.
    //
    // Es la TERCERA vez que este archivo tropieza con las comillas (mira el amarre
    // del token y el de las tres pantallas). Por eso queda escrito aquí también.
    CAMPOS_PRIVADOS.forEach((campo) => {
      assert.ok(new RegExp("['\"\\x60]" + campo + "['\"\\x60]").test(lista),
        'A camposPrivados() de firestore.rules le falta «' + campo + '», que negocioPrivado.js ' +
        'sí declara privado. Ese campo podría volver a escribirse en restaurantes/{id}, que es ' +
        'la colección que la app del pasajero se descarga ENTERA.');
    });
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
      'El negocio nuevo nacería SIN cuarto, y como el escaparate ya no lleva los datos del ' +
      'dueño, no quedarían guardados en ningún sitio.');

    // La otra mitad, desde la tanda 2 (24-ago-2026): el escaparate se escribe con
    // sinLoPrivado(). Con setDoc(..., datos) a secas, el negocio nuevo nacería con
    // el nombre, el teléfono y el correo de su dueño dentro de la colección que la
    // app del pasajero se descarga entera — o sea, deshaciendo la tanda 2 entera
    // para cada negocio que se registre, y sin que nada avise.
    assert.ok(vivo.includes("'restaurantes', uid), sinLoPrivado(datos)"),
      'aliados/Login.js volvió a escribir el escaparate con los datos del dueño dentro. ' +
      'Tiene que ser sinLoPrivado(datos): lo privado va SOLO al cuarto.');

    // Y UNA SOLA VEZ. Aquí no se puede usar el «no nombres el escaparate» de los
    // otros amarres, porque este archivo SÍ tiene que nombrarlo: es quien crea el
    // documento. Así que se cuenta. Sin esto, dejar la escritura buena y añadir
    // otra detrás —un setDoc con merge devolviendo el teléfono del dueño— pasaba
    // sin que nada saltara. Lo cazó la segunda opinión del 24-ago-2026.
    //
    // Hoy eso lo negarían las REGLAS (affectedKeys().hasAny(camposPrivados())), o
    // sea que el cinturón fallaba y aguantaban los tirantes. Se arregla el cinturón:
    // una fuga que solo para el servidor es una fuga que el programador no ve.
    // Se cuentan solo las ESCRITURAS. La otra vez que restaurantes/{uid} aparece en
    // este archivo es el getDoc de iniciarSesion, que es legítimo y tiene que estar.
    const veces = (vivo.match(/setDoc\(doc\(db, 'restaurantes', uid\)/g) || []).length;
    assert.strictEqual(veces, 1,
      'aliados/Login.js ESCRIBE en restaurantes/{uid} ' + veces + ' veces, y tiene que ser ' +
      'UNA. Si se añadió otra, mírala: lo más fácil que puede haber pasado es que alguien ' +
      'devolviera al escaparate un dato del dueño «para que el panel lo vea», sin saber que ' +
      'esa colección se la descarga entera cualquier cliente de la app del pasajero.');
  });

  // ── EL TOKEN DE AVISOS, LOS TRES SITIOS ─────────────────────────────────
  //
  // Se miran los archivos SIN COMENTARIOS, por lo de siempre: buscando una
  // cadena suelta, comentar la línea deja la prueba verde porque el texto sigue
  // estando en el archivo.
  //
  // DOS LECCIONES QUE ESTAS PRUEBAS APRENDIERON A GOLPES (24-ago-2026):
  //
  // 1. Hay que comprobar la ESCRITURA ENTERA, no solo de dónde sale el nombre de
  //    la colección. La primera versión miraba el import y el ternario y se
  //    quedaba ahí: se podía BORRAR el setDoc entero —o mandarlo a 'empleados'—
  //    y seguía verde. Es la MISMA lección del amarre de Login.js, doce renglones
  //    más arriba, que ya la había aprendido. Se repite aquí escrita para que no
  //    haya que aprenderla una tercera vez.
  //
  // 2. Los «no» van con expresión regular, no con includes(). Buscando la cadena
  //    "'restaurantes'" solo se ve la comilla SIMPLE: con comilla doble la fuga
  //    se reabría entera y la prueba seguía afirmando por escrito que no podía
  //    pasar. Y en guajirago/functions/ no hay ni .eslintrc que obligue a un
  //    estilo de comillas.
  //
  // (\x60 es la comilla invertida. Se escribe así para no tener que escapar
  // acentos graves dentro de una expresión regular.)
  const NOMBRA_EL_ESCAPARATE = /['"\x60]restaurantes['"\x60]/;
  const LEE_DEL_ESCAPARATE = /collection\(\s*['"\x60]restaurantes['"\x60]\s*\)/;

  it('la app de aliados guarda el token del dueño en el cuarto, no en el escaparate', () => {
    const vivo = leer('guajirago-aliados/src/Notificaciones.js').replace(/\/\/.*$/gm, '');
    assert.ok(vivo.includes("from './negocioPrivado'"),
      'aliados/Notificaciones.js dejó de importar negocioPrivado.js: o escribió el nombre ' +
      'de la colección a mano, o volvió a guardar el token en el escaparate.');
    assert.ok(/dueno['"\x60]\s*\?\s*COLECCION_PRIVADA\s*:/.test(vivo),
      'aliados/Notificaciones.js ya no elige COLECCION_PRIVADA para el dueño. Si el token ' +
      'vuelve a restaurantes/{uid}, viaja dentro del escaparate que se descarga cualquier ' +
      'cliente registrado — y con él se le pueden mandar al dueño avisos falsos con la ' +
      'cara de GuajiraGo.');
    assert.ok(vivo.includes('doc(db, col, user.uid), { fcmToken: token }'),
      'aliados/Notificaciones.js ya no GUARDA el token, o lo guarda de otra forma. Elegir ' +
      'bien la colección no sirve de nada si la escritura desapareció: el dueño no ' +
      'recibiría ni un aviso y nada fallaría. Si de verdad cambió la forma de escribirlo, ' +
      'cambia también esta prueba — pero cámbiala a mano, mirando lo que hace el código.');
    assert.ok(!NOMBRA_EL_ESCAPARATE.test(vivo),
      'aliados/Notificaciones.js volvió a nombrar la colección «restaurantes». El token del ' +
      'dueño no puede acabar ahí, ni por el camino principal ni por uno añadido al lado.');
  });

  // LAS FUNCIONES NO PUEDEN IMPORTAR NADA DE ALIADOS: son otro repo y otro
  // runtime. El nombre del cuarto está escrito en TRES sitios que no se pueden
  // importar entre ellos —negocioPrivado.js, firestore.rules y functions/index.js—
  // y estos amarres son lo único que los mantiene juntos.
  //
  // Importa más de lo que parece, porque si se separan NO FALLA NADA: la función
  // buscaría el token en una colección que no existe, no lo encontraría, y se iría
  // sin mandar el aviso. El dueño dejaría de enterarse de sus pedidos sin un solo
  // error en ningún registro. Por eso se comprueban las DOS funciones por dentro,
  // y no basta con que la constante esté bien escrita arriba.
  //
  // ANOTADO (24-ago-2026): pruebas/funciones.test.js no EJECUTA estas dos
  // funciones. Este amarre de texto es lo único que las vigila, y por eso se le
  // pide tanto. Ejecutarlas de verdad es trabajo aparte.
  it('las funciones buscan el token en el MISMO cuarto que la app de aliados', () => {
    const { COLECCION_PRIVADA } = modulo();
    const vivo = leer('guajirago/functions/index.js').replace(/\/\/.*$/gm, '');

    // Se LEE el nombre declarado y se compara con la fuente única, en vez de
    // buscar el renglón entero letra por letra. Así cambiar el tipo de comillas
    // no pone la prueba roja sin motivo, y el error dice qué dice cada lado.
    const declara = vivo.match(/const NEGOCIO_PRIVADO\s*=\s*['"\x60]([^'"\x60]+)['"\x60]\s*;/);
    assert.ok(declara,
      'functions/index.js ya no declara NEGOCIO_PRIVADO como un texto suelto. Tiene que ' +
      'serlo: es otro repo y no puede importar la lista buena, así que esta prueba lo lee ' +
      'del archivo. Si se arma con trozos o sale de una variable, nadie puede comprobar ' +
      'que sigue diciendo lo mismo que negocioPrivado.js.');
    assert.strictEqual(declara[1], COLECCION_PRIVADA,
      'Las funciones y negocioPrivado.js dejaron de decir lo mismo: negocioPrivado.js dice ' +
      '«' + COLECCION_PRIVADA + '» y functions/index.js dice «' + declara[1] + '». Los ' +
      'avisos de pedidos y reservas dejarían de llegarle al dueño EN SILENCIO: no falla ' +
      'nada, simplemente no se encuentra el token.');

    ['notificarNuevoPedidoRestaurante', 'notificarNuevaReserva'].forEach((nombre) => {
      const desde = vivo.split('exports.' + nombre + ' =')[1];
      assert.ok(desde, 'ya no existe la función ' + nombre + ' en functions/index.js. Si se ' +
        'le cambió el nombre, cámbialo también aquí: esta prueba es lo único que vigila que ' +
        'siga leyendo el token del sitio bueno.');
      const cuerpo = desde.split(/\r?\nexports\./)[0];
      assert.ok(cuerpo.includes('collection(NEGOCIO_PRIVADO)'),
        nombre + ' ya no busca el token en el cuarto privado del negocio.');
      assert.ok(!LEE_DEL_ESCAPARATE.test(cuerpo),
        nombre + ' volvió a leer de la colección «restaurantes», que es EL ESCAPARATE: la ' +
        'app del pasajero se la descarga entera. Un token guardado ahí se lo lleva ' +
        'cualquiera con una cuenta. Ojo: esto salta también si la lectura buena sigue ahí ' +
        'y alguien añadió otra al lado, que es justo como se cuela una fuga.');
    });
  });
});

describe('SEGUNDA LEY · el panel y aliados leen el cuarto privado por el MISMO nombre', () => {
  const deAliados = () => cargarDeLaApp('guajirago-aliados/src/negocioPrivado.js');
  const delPanel = () => cargarDeLaApp('guajirago-admin/src/negocioPrivado.js');

  // EL PANEL ES OTRO REPO. No puede importar de aliados —no hay forma—, así que el
  // nombre del cuarto está escrito DOS veces y esto es lo único que las junta.
  //
  // Si se separan NO FALLA NADA con estruendo: el panel pide una colección que no
  // existe, le llega vacía, y las fichas salen con «—» donde va el nombre y el
  // teléfono del dueño. Parecería que los negocios no tienen datos, no que el panel
  // esté roto. Nadie miraría el código durante semanas.
  it('el panel y aliados nombran el MISMO cuarto', () => {
    assert.strictEqual(delPanel().COLECCION_PRIVADA, deAliados().COLECCION_PRIVADA,
      'guajirago-admin/src/negocioPrivado.js y guajirago-aliados/src/negocioPrivado.js ' +
      'dejaron de decir lo mismo. El que MANDA es el de aliados. Cambia el del panel y ' +
      'esto vuelve a verde — si no, el panel se queda sin los datos del dueño y no avisa.');
  });

  it('y traen la MISMA lista de campos privados', () => {
    assert.deepStrictEqual([...delPanel().CAMPOS_PRIVADOS].sort(), [...deAliados().CAMPOS_PRIVADOS].sort(),
      'Las dos listas de campos privados se separaron. La del panel decide QUÉ acepta el ' +
      'panel del cuarto del negocio: si le falta un campo, deja de enseñarlo; y si le ' +
      'sobra uno, acepta del negocio algo que no le corresponde. El que manda es aliados.');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // EL ATAQUE QUE ESTA PRUEBA EXISTE PARA IMPEDIR (24-ago-2026)
  //
  // La primera versión de conSuCuarto() hacía { ...negocio, ...cuarto }: volcaba
  // el cuarto ENTERO. La segunda opinión lo rompió EJECUTÁNDOLO contra el
  // emulador, y esto es lo que consiguió entrando como el negocio:
  //
  //   escribir en restaurantes/r1        {aprobado:true}  -> NEGADO   (REGLA 9-C)
  //   escribir en restaurantesPrivado/r1 {aprobado:true}  -> ACEPTADO
  //   ...y el panel veía aprobado:true, y el negocio DESAPARECÍA de la bandeja
  //   de pendientes, que lista los que tienen aprobado === false.
  //
  // O sea: la puerta de atrás a una regla que ya estaba cerrada por delante. En
  // el escaparate el negocio no puede tocar esos campos; en su cuarto sí, porque
  // allí las reglas solo congelan 'creditos'.
  // ─────────────────────────────────────────────────────────────────────────
  it('EL ATAQUE · lo que el negocio escriba de MÁS en su cuarto, el panel NO lo mira', () => {
    const { conSuCuarto } = delPanel();
    const [visto] = conSuCuarto(
      [{ id: 'r1', nombre: 'EL NEGOCIO', aprobado: false, estadoAprobacion: 'pendiente', duenoNombre: 'VIEJO' }],
      { r1: {
        duenoNombre: 'MECHE',
        // lo que un negocio se escribiría en su propio cuarto para colarse:
        aprobado: true, estadoAprobacion: 'aprobado', activo: true, rol: 'admin',
        nombre: 'NOMBRE FALSO', logo: 'otro.jpg',
      } },
    );
    assert.strictEqual(visto.duenoNombre, 'MECHE', 'lo privado sí tiene que llegar');
    assert.strictEqual(visto.aprobado, false,
      'EL PANEL SE TRAGÓ UN «aprobado» ESCRITO POR EL NEGOCIO. Con eso un restaurante se ' +
      'borra a sí mismo de la bandeja de pendientes y sale como aprobado sin que nadie lo ' +
      'revise. conSuCuarto() tiene que copiar SOLO los campos de CAMPOS_PRIVADOS.');
    assert.strictEqual(visto.estadoAprobacion, 'pendiente', 'igual con estadoAprobacion');
    assert.strictEqual(visto.nombre, 'EL NEGOCIO',
      'el negocio le enseñó al panel un nombre que el escaparate nunca aceptó');
    assert.strictEqual(visto.rol, undefined, 'ni un rol inventado');
    assert.strictEqual(visto.logo, undefined, 'ni un logo inventado');
  });

  // conSuCuarto() se EJECUTA, no se lee: es la calculadora que junta el escaparate
  // con el cuarto, y la usan las TRES pantallas del panel. Una sola por proceso
  // (SEGUNDA LEY) — si cada pantalla juntara a su manera, dos se quedarían viejas.
  it('al juntar, MANDA lo del cuarto sobre lo del escaparate', () => {
    const { conSuCuarto } = delPanel();
    const juntos = conSuCuarto(
      [{ id: 'r1', nombre: 'EL NEGOCIO', duenoNombre: 'LO VIEJO DEL ESCAPARATE' }],
      { r1: { duenoNombre: 'MECHE', duenoTelefono: '+573001112233' } },
    );
    assert.deepStrictEqual(juntos, [{
      id: 'r1', nombre: 'EL NEGOCIO', duenoNombre: 'MECHE', duenoTelefono: '+573001112233',
    }], 'Si mandara lo del escaparate, el panel enseñaría el dato viejo y la tanda 2 ' +
      '—que vacía el escaparate— dejaría las fichas en blanco de golpe.');
  });

  it('un negocio sin cuarto no revienta la lista', () => {
    const { conSuCuarto } = delPanel();
    assert.deepStrictEqual(conSuCuarto([{ id: 'r9', nombre: 'SIN CUARTO' }], {}),
      [{ id: 'r9', nombre: 'SIN CUARTO' }]);
    assert.deepStrictEqual(conSuCuarto(null, null), [],
      'Antes de que llegue nada, el panel llama a esto con las manos vacías. Si reventara ' +
      'aquí, la pantalla se quedaría en blanco al abrirla.');
  });

  // Que el módulo exista no significa que nadie lo use. Aquí se mira que las TRES
  // pantallas lo PIDAN de verdad y lo JUNTEN — es el mutante de «borrar el
  // useEffect y dejar el import», que si no sobrevive tan tranquilo.
  // El import se busca con expresión regular y no con la cadena suelta: con
  // includes("from './negocioPrivado'") bastaba cambiar a comillas dobles —código
  // perfectamente correcto, compila igual— para poner esto rojo. Un amarre que
  // castiga código bueno enseña a la gente a ignorar los amarres. Lo cazó la
  // segunda opinión del 24-ago-2026, y es la MISMA lección de las comillas que ya
  // se había aprendido en el amarre del token, unos renglones más arriba.
  const IMPORTA_EL_MODULO = /from\s*['"]\.\/negocioPrivado['"]/;

  it('las TRES pantallas del panel piden el cuarto, lo guardan y lo juntan', () => {
    ['Restaurantes', 'Turismo', 'AliadosPendientes'].forEach((pantalla) => {
      const donde = 'guajirago-admin/src/' + pantalla + '.js';
      const vivo = leer(donde).replace(/\/\/.*$/gm, '');
      assert.ok(IMPORTA_EL_MODULO.test(vivo),
        donde + ' dejó de importar negocioPrivado.js: o escribió el nombre de la colección ' +
        'a mano, o volvió a sacar los datos del dueño del escaparate.');
      assert.ok(vivo.includes('collection(db, COLECCION_PRIVADA)'),
        donde + ' ya no PIDE el cuarto privado. Importarlo no basta: sin esta consulta la ' +
        'pantalla enseñaría lo que quede en el escaparate, y el día que la tanda 2 lo vacíe ' +
        'se quedaría sin nombre ni teléfono del dueño sin que nada avisara.');
      // Pedirlo tampoco basta: se puede pedir y tirar a la basura. Este mutante
      // —porId[d.id] = {}— sobrevivió a la primera versión de esta prueba.
      assert.ok(vivo.includes('porId[d.id] = d.data();'),
        donde + ' pide el cuarto pero NO se queda con lo que llega. La pantalla se vería ' +
        'perfecta hoy —el escaparate todavía tiene los datos— y quedaría vacía el día que ' +
        'la tanda 2 lo vacíe, sin que nada hubiera avisado en medio.');
      assert.ok(vivo.includes('conSuCuarto(negocios, privados)'),
        donde + ' ya no junta el negocio con su cuarto usando la calculadora compartida. ' +
        'Si se junta a mano, esa pantalla se queda vieja el día que esto cambie — y sin la ' +
        'lista de campos, se tragaría lo que el negocio le escriba en su cuarto.');
    });
  });

  // En la app de aliados el dueño ve su propio nombre en el saludo. Salía del
  // escaparate, que es de donde se lo llevaba cualquier cliente.
  // Aquí NO basta con mirar que se pida el cuarto. Dos mutantes de la segunda
  // opinión (24-ago-2026) sobrevivieron a la primera versión de esta prueba:
  //   · nombreDueno: d['duenoNombre']       — con corchetes, no con punto.
  //   · nombreDueno: snap.data().duenoNombre — se pide el cuarto Y se usa el
  //     escaparate. La lectura buena sigue ahí, y la fuga entra al lado.
  // Por eso ahora se mira DE DÓNDE SALE el valor que va a la sesión, no solo que
  // el cuarto se pida. Es la misma forma de colarse que en las funciones.
  const SALE_DEL_CUARTO = /nombreDueno:\s*p\.duenoNombre/;
  const SALE_DEL_ESCAPARATE = /nombreDueno:\s*(d|snap)\b/;

  it('la app de aliados saca el nombre del dueño del cuarto, no del escaparate', () => {
    ['App', 'Login'].forEach((pantalla) => {
      const donde = 'guajirago-aliados/src/' + pantalla + '.js';
      const vivo = leer(donde).replace(/\/\/.*$/gm, '');
      assert.ok(vivo.includes('doc(db, COLECCION_PRIVADA'),
        donde + ' ya no lee el cuarto privado del negocio.');
      assert.ok(SALE_DEL_CUARTO.test(vivo),
        donde + ' pide el cuarto pero el nombre que mete en la sesión ya no sale de ahí. ' +
        'Pedirlo y no usarlo se ve exactamente igual que hacerlo bien, hasta que la tanda 2 ' +
        'vacíe el escaparate y el saludo se quede en blanco.');
      assert.ok(!SALE_DEL_ESCAPARATE.test(vivo),
        donde + ' vuelve a sacar el nombre del dueño del documento del ESCAPARATE, que la ' +
        'app del pasajero se descarga entero. Salta también si la lectura buena sigue ahí ' +
        'y alguien puso la mala al lado.');
    });
  });
});
