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
const { RAIZ, leer, cargarDeLaApp, soloCodigo, sinTextos, trozoDelTry, cuerpoDeLaFuncion }
  = require('./cargar.cjs');

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
    const PANTALLAS = ['guajirago/src/AppConductor.js', 'guajirago/src/Solicitar.js', 'guajirago/src/Home.js'];
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
    const PANTALLAS = ['guajirago/src/Solicitar.js', 'guajirago/src/AppConductor.js'];
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
  it('la lista de VIAJES EN CURSO del panel es la MISMA que la de la app', () => {
    // El panel enseña "viajes activos" con una lista escrita a mano en
    // guajirago-admin/src/Viajes.js, porque es otro repo y no puede importar
    // nada de la app. Esto los junta.
    //
    // EL PELIGRO: si mañana se añade un estado vivo en la app y no aquí, el
    // panel deja de ver esos viajes — sin error, solo una lista más corta.
    //
    // SE COMPARA CONTRA `ESTADOS_EN_CURSO`, que es la fuente única, y no contra
    // una lista escrita aquí. Hasta el 12-sep-2026 esta prueba llevaba su propia
    // copia (`EN_MARCHA = ['aceptado','confirmado']`) — una TERCERA definición de
    // «viaje en curso», en el archivo que hace de policía de la SEGUNDA LEY. Lo
    // señaló la segunda opinión del 11-sep. Y `confirmado` llevaba ahí desde
    // siempre sin que nadie lo escribiera nunca.
    const { ESTADOS_EN_CURSO } = cargarDeLaApp('guajirago/src/estadosViaje.js');

    const panel = leer('guajirago-admin/src/Viajes.js');
    const consulta = panel.match(/where\('estado',\s*'in',\s*\[([^\]]+)\]/);
    assert.ok(consulta, 'el panel ya no consulta los viajes en curso con where(estado, in, [...])');
    const delPanel = consulta[1].replace(/['"\s]/g, '').split(',').filter(Boolean);

    assert.deepStrictEqual(
      [...delPanel].sort(),
      [...ESTADOS_EN_CURSO].sort(),
      'La lista del panel y la de la app se separaron.\n' +
      '   app (ESTADOS_EN_CURSO): ' + [...ESTADOS_EN_CURSO].sort().join(', ') + '\n' +
      '   panel (Viajes.js):      ' + [...delPanel].sort().join(', ') + '\n' +
      'Si el cambio es a propósito, se cambian LOS DOS LADOS: estadosViaje.js (y ' +
      'firestore.rules, que tiene su propio amarre) y guajirago-admin/src/Viajes.js.'
    );
  });

  // ── Y LA OTRA PANTALLA DEL PANEL, QUE SE HABÍA ESCAPADO ──────────────────
  //  El amarre de arriba vigilaba `Viajes.js` y nada más. `Mensajeria.js` tenía
  //  su PROPIA copia de la lista —una tercera— con un `'en_viaje'` dentro.
  //  Medido contra la base el 12-sep-2026: 0 viajes con `estado: 'en_viaje'` y
  //  4 con `fase: 'en_viaje'`. O sea que el conteo no salía mal: lo que había
  //  era una copia suelta que nadie vigilaba y una palabra que hacía creer que
  //  una fase es un estado.
  //
  //  Un amarre que cubre una pantalla de dos deja la puerta de al lado abierta.
  it('EL QUE MUERDE · y la de MENSAJERÍA del panel, también', () => {
    const { ESTADOS_EN_CURSO } = cargarDeLaApp('guajirago/src/estadosViaje.js');
    const t = soloCodigo(leer('guajirago-admin/src/Mensajeria.js'));

    const TODAS = /const\s+esEnCurso\s*=\s*\(\w+\)\s*=>\s*\[([^\]]*)\]\.includes/g;
    const halladas = [...t.matchAll(TODAS)];
    assert.ok(halladas.length >= 1, 'guajirago-admin/src/Mensajeria.js ya no decide «en curso» '
      + 'con una lista de estados (`const esEnCurso = (e) => [...].includes(e)`). Si se '
      + 'cambió de forma, hay que mirar a mano que siga diciendo lo mismo que la app.');
    // 🔴 UNA SOLA VEZ. La primera versión cogía la primera que encontraba, y la
    // segunda opinión la burló dejando la buena arriba y metiendo OTRA
    // `esEnCurso` dentro del componente, con `'en_viaje'`: la de dentro hace
    // sombra a la de fuera, la pantalla cuenta con la mala, y las 78 pruebas en
    // verde. Dos definiciones del mismo nombre es una tapando a la otra.
    assert.strictEqual(halladas.length, 1,
      '`esEnCurso` está definida ' + halladas.length + ' veces en Mensajeria.js. La de dentro '
      + 'tapa a la de fuera, así que la pantalla puede estar contando con una lista que este '
      + 'amarre ni siquiera mira.');
    const enCurso = halladas[0];
    const suya = enCurso[1].replace(/['"\s]/g, '').split(',').filter(Boolean);

    assert.deepStrictEqual([...suya].sort(), [...ESTADOS_EN_CURSO].sort(),
      'La lista de «en curso» del panel de MENSAJERÍA y la de la app se separaron.\n'
      + '   app (ESTADOS_EN_CURSO):  ' + [...ESTADOS_EN_CURSO].sort().join(', ') + '\n'
      + '   panel (Mensajeria.js):   ' + [...suya].sort().join(', ') + '\n'
      + 'Si el cambio es a propósito, se cambian LOS DOS LADOS. Y ojo con `en_viaje`: es '
      + 'una FASE, no un estado — ningún viaje lo tiene en `estado`, así que ponerlo aquí no '
      + 'suma nada y hace creer lo contrario.');

    // Y que no vuelva a colarse una FASE en la lista de estados, que es de
    // donde vino el lío. Las fases viven en `FASES_GUARDADAS`, aparte.
    const { FASES_GUARDADAS } = cargarDeLaApp('guajirago/src/estadosViaje.js');
    const colada = suya.filter((e) => FASES_GUARDADAS.includes(e));
    assert.deepStrictEqual(colada, [],
      'en la lista de ESTADOS del panel de mensajería se coló una FASE: ' + colada.join(', ')
      + '. El estado dice en qué punto del trato va el viaje; la fase, en qué punto del '
      + 'recorrido. Un viaje nunca tiene una fase en `estado`, así que eso no cuenta nada — '
      + 'pero el que lo lea creerá que sí.');

    // ── Y QUE LA FASE NO SE CUELE DONDE SE LLAMA ─────────────────────────
    //  La lista puede estar perfecta y colarse la fase en el sitio de la
    //  llamada: `mandados.filter(m => esEnCurso(m.estado) || m.fase === 'en_viaje')`.
    //  La segunda opinión lo probó: 78 pruebas en verde. Es EXACTAMENTE el
    //  fallo del botón de pánico —mirar la fase sin comprobar que el viaje
    //  esté vivo—, que ya costó que 3 de 5 pasajeros recibieran los datos de
    //  un conductor de un viaje terminado.
    const llamadas = t.split('\n').filter((l) => /esEnCurso\s*\(/.test(l)
      && !/const\s+esEnCurso/.test(l));
    const conFase = llamadas.filter((l) => /\.fase\b|\[['"]fase['"]\]/.test(l));
    assert.deepStrictEqual(conFase.map((l) => l.trim().slice(0, 90)), [],
      'donde se llama a `esEnCurso` se está mirando ADEMÁS la fase. El estado dice si el '
      + 'viaje está vivo; la fase, por dónde va. Un viaje cancelado o expirado conserva su '
      + 'fase pegada, así que mirarla sin mirar el estado mete viajes muertos en «en curso» '
      + '— es el mismo fallo que hacía que el botón de pánico mandara la placa de un '
      + 'conductor de un viaje terminado.');
  });

  // ── EL HISTORIAL DEL CONDUCTOR · QUE VEA TODO SU TRABAJO ─────────────────
  //  La pantalla «Mis viajes» del conductor pedía los suyos y se quedaba con
  //  `finalizado || cancelado`. Los que cancelaba él mismo y los que se
  //  quedaban colgados NO APARECÍAN: sin error, sin rojo, no estaban.
  //
  //  Medido el 13-sep-2026 con `node scripts/medir-historial-conductor.cjs`
  //  contra el código de antes: **40 viajes** invisibles entre 5 conductores;
  //  `XfXCz3rgYSXC` veía **16 de sus 47**.
  //
  //  Y hay una SEGUNDA MITAD que va junta: una bandera decide si el viaje sale
  //  verde «Completado» con su tarifa debajo. Decía `estado === 'cancelado'` a
  //  secas, así que arreglar solo el filtro habría metido esos 40 Y LOS HABRÍA
  //  PINTADO VERDES —ninguno de los 40 es `finalizado` ni `cancelado`—: el
  //  conductor viendo un trabajo hecho y cobrado que no lo fue. Peor que el
  //  fallo original. Por eso este amarre vigila LAS DOS.
  //
  //  🔴 EL RECORRIDO NO SE ESCRIBE AQUÍ. Se importa de
  //  `scripts/medir-historial-conductor.cjs`, que es donde vive: el mismo
  //  lector para el paso 1, el paso 12 y cada `npm test`. Estaba copiado con
  //  regex casi calcadas y LOS DOS SE SEPARARON EL MISMO DÍA. SEGUNDA LEY.
  it('EL QUE MUERDE · el conductor ve TODOS sus viajes terminados', () => {
    const { loQueHaceLaPantalla, elTrozoDelResultado } = require('../scripts/medir-historial-conductor.cjs');
    const { ESTADOS_TERMINADOS } = cargarDeLaApp('guajirago/src/estadosViaje.js');
    const p = loQueHaceLaPantalla();

    // Las quejas vienen con su explicación entera desde el guion: aquí no se
    // reescriben, que sería empezar a separarlos otra vez por el otro lado.
    assert.strictEqual(p.quejas.length, 0,
      'la pantalla del historial del conductor no pasa:\n   · ' + p.quejas.join('\n   · '));

    // 🔴 ESTO YA NO ES UNA TAUTOLOGÍA. `p.entran` sale de CORRER el filtro de la
    // pantalla estado por estado, no de copiar la lista porque el nombre esté
    // escrito. Con la versión de antes, esta misma línea comparaba
    // `ESTADOS_TERMINADOS` consigo mismo y no podía ponerse roja nunca — y
    // `.filter(v => v.estado !== 'expirado' && ESTADOS_TERMINADOS.includes(...))`
    // escondía 9 viajes con todo en verde. Lo midió la segunda opinión.
    assert.deepStrictEqual(p.entran, [...ESTADOS_TERMINADOS],
      'corriendo el filtro de la pantalla, los viajes que entran en el historial del conductor '
      + 'ya no son todos los terminados. Lo que se quede fuera NO SALE en su pantalla: no da '
      + 'error, no sale en rojo, no está — y nadie echa de menos lo que nunca vio.');

    assert.deepStrictEqual(p.rojos, ESTADOS_TERMINADOS.filter((e) => e !== 'finalizado'),
      'corriendo la bandera de la tarjeta, los que se pintan de rojo ya no son todos los que '
      + 'no se completaron. Lo que no esté ahí sale VERDE «Completado», con su tarifa debajo.');

    // ── 🔴 Y QUE EL RENDER LO USE ───────────────────────────────────────
    //  Esto es lo que de verdad ve el conductor. Una versión anterior solo
    //  comprobaba que la tabla de nombres ESTUVIERA declarada, así que poner
    //  el verde y «Completado» a pelo en la tarjeta pasaba sin un solo rojo.
    //  Aquí entra también la tabla de nombres en palabras —que cada final diga
    //  CUÁL de las cuatro cosas pasó—, porque vive en el lector: si se
    //  comprobara solo aquí, el guion del paso 1 no la miraría.
    const trozo = elTrozoDelResultado(p);
    assert.ok(!trozo.error, trozo.error);
  });

  // ── 🔴 Y QUIÉN VIGILA AL VIGILANTE ───────────────────────────────────────
  //  El amarre de arriba se cree lo que le diga `medir-historial-conductor.cjs`.
  //  O sea que ablandando ESE archivo —que además está en la foto del guardián,
  //  así que el guardián lo aprueba— se puede dejar la pantalla rota con todo
  //  en verde. Lo probó la segunda opinión: un `if (false)` en el lector y la
  //  pantalla de vuelta a `finalizado || cancelado`, 81 pruebas en verde.
  //
  //  Así que aquí se le da de comer al lector PANTALLAS DE MENTIRA —cada escape
  //  conocido, escrito como texto— y se exige que se queje de todas. Nada se
  //  escribe en disco: el lector acepta la fuente por parámetro.
  //
  //  Cada renglón de esta lista es un escape que alguien encontró de verdad.
  //  Si aparece uno nuevo, se añade aquí y deja de ser gratis para siempre.
  it('EL QUE MUERDE · y el medidor del historial no se puede ablandar', () => {
    const { loQueHaceLaPantalla, elTrozoDelResultado } = require('../scripts/medir-historial-conductor.cjs');
    // Se trabaja sobre el archivo YA SIN COMENTARIOS, que es lo que el lector
    // mira: así los trozos que devuelve se encuentran aquí tal cual.
    const bueno = soloCodigo(leer('guajirago/src/AppConductor.js'));
    const base = loQueHaceLaPantalla(bueno);
    assert.strictEqual(base.quejas.length, 0,
      'el lector se queja de la pantalla BUENA, así que esta prueba no puede saber si ve los '
      + 'escapes:\n   · ' + base.quejas.join('\n   · '));

    // 🔴 LAS ANCLAS SALEN DEL PROPIO ARCHIVO, no copiadas aquí. Con el texto a
    // mano, renombrar la bandera o pasar Prettier ponía ROJA esta prueba sobre
    // código correcto — y su mensaje culpaba a la lista, no al cambio.
    const Z = base.trozos;
    const T = elTrozoDelResultado(base);
    assert.ok(!T.error, T.error);
    const EL_P = T.texto + '</p>';
    const CORTO = ".filter(v => v.estado === 'finalizado' || v.estado === 'cancelado')";
    // Un ancla puede no existir hoy (quitar el `limit`, partir la cadena en dos
    // `const`: los dos son arreglos legítimos, y el segundo lo anuncia esta
    // misma tabla de deuda). Antes se le llamaba `.replace` a `null` AL ARMAR
    // ESTA LISTA y la prueba reventaba con un `TypeError` sin mensaje.
    const ojo = (x, hacer) => (x == null ? [null, null] : [x, hacer(x)]);

    const ESCAPES = [
      ['la lista corta de siempre', Z.filtro, CORTO],
      ['un filtro corto DELANTE del bueno', Z.filtro, CORTO + '\n          ' + Z.filtro],
      ['otro filtro encadenado detrás', Z.filtro,
        Z.filtro + "\n          .filter(x => x.estado !== 'expirado')"],
      ['una condición de más DENTRO del filtro bueno', Z.filtro,
        ".filter(v => v.estado !== 'expirado' && ESTADOS_TERMINADOS.includes(v.estado))"],
      ['el filtro al revés, con un `!`', Z.filtro,
        '.filter(v => !ESTADOS_TERMINADOS.includes(v.estado))'],
      ['un `.slice(0, 20)` detrás', Z.filtro, Z.filtro + '\n          .slice(0, 20)'],
      ['una lista a mano tapa la importada', 'function HistorialConductor',
        "const ESTADOS_TERMINADOS = ['finalizado', 'cancelado'];\nfunction HistorialConductor"],
      ['el import con alias', ...ojo(Z.importe,
        () => "import { ESTADOS_MERCADO as ESTADOS_TERMINADOS } from './estadosViaje'")],
      // Se ancla a la CONSULTA, que siempre está, no al `limit`: quitar el
      // `limit` es un arreglo legítimo —lo anuncia la propia tabla de deuda— y
      // con el ancla en él este escape se saltaba EN SILENCIO.
      ['el filtro mudado al servidor', Z.consulta,
        Z.consulta + ", where('estado', 'in', ['finalizado'])"],
      ['`setViajes` dos veces, la segunda recorta', ...ojo(
        Z.alaPantalla == null ? null : Z.alaPantalla + ';',
        () => Z.alaPantalla + ';\n        ' + Z.alaPantalla.replace(')', '.slice(0, 5))') + ';')],
      ['el `.map` le pone el estado a todos', ...ojo(Z.mapa,
        (x) => x.replace('}))', ", estado: 'finalizado' }))"))],
      ['la bandera vuelve a la lista corta', Z.banderaEntera,
        'const ' + base.bandera + " = v.estado === 'cancelado';"],
      ['la bandera con una condición de más', Z.banderaEntera,
        Z.banderaEntera.replace(';', " && v.estado === 'cancelado';")],
      // 🔴 EL SEÑUELO DE LA BANDERA necesita DOS cambios, Y EN ESTE ORDEN: la
      // MALA en la tarjeta primero, y la buena arriba después. La primera
      // versión los hacía al revés —ponía la buena arriba y luego reemplazaba
      // «la buena», que ya casaba con la de arriba—, así que montaba el señuelo
      // dado la vuelta y el control «una sola bandera» PARECÍA vigilado sin
      // estarlo: se le podía cambiar el `!== 1` por `< 1` y nadie chistaba.
      ['un señuelo de la bandera, arriba', [
        [Z.banderaEntera, 'const ' + base.bandera + " = v.estado === 'cancelado';"],
        ['function HistorialConductor',
          "const v = { estado: '' };\n" + Z.banderaEntera + '\nfunction HistorialConductor'],
      ]],
      ['las tarjetas se recortan al pintarlas', T.tarjetas,
        T.tarjetas.replace('.map(', '.slice(0, 5).map(')],
      // Tres formas de NO pintar la tarjeta. La primera versión buscaba la
      // palabra `null`, así que las otras dos pasaban con todo en verde.
      ['la tarjeta devuelve null para algunos', T.flechaTarjeta,
        T.flechaTarjeta.replace('=> {', "=> { if (v.estado !== 'finalizado') return null;")],
      ['la tarjeta devuelve un hueco', T.flechaTarjeta,
        T.flechaTarjeta.replace('=> {', "=> { if (v.estado !== 'finalizado') return <span key={v.id} />;")],
      ['la tarjeta devuelve `false`', T.flechaTarjeta,
        T.flechaTarjeta.replace('=> {', "=> { if (v.estado !== 'finalizado') return false;")],
      // 🔴 EL COLOR SE ANCLA AL COLOR QUE HAY ESCRITO (`T.color`), no a un texto
      // copiado. Con `"'#FF4444' : '#2ECC71'"` a mano, unas comillas dobles o un
      // espacio de menos —lo que deja Prettier por defecto— ponían esta prueba
      // ROJA acusando al medidor, sobre código correcto.
      ['el color, verde siempre, con un rojo de adorno', T.color,
        'color: ' + base.bandera + " ? '#2ECC71' : '#2ECC71', borderColor: '#FF4444'"],
      ['el color escondido: una tercera pregunta a la bandera', T.color,
        T.color + ', display: ' + base.bandera + " ? 'none' : 'block'"],
      ['el texto a mano, dejando el color bueno', T.elTexto, "'Cancelado'"],
      // Dos formas de esconder la tarjeta entera SIN tocar el color ni la
      // lista. Las dos sacan el uso de la bandera un renglón afuera del `<p>`,
      // que es donde antes se contaba.
      ['la tarjeta no se pinta: `return bandera ? null :`', T.tarjetaVuelve,
        T.tarjetaVuelve.replace('return (', 'return ' + base.bandera + ' ? null : (')],
      ['la tarjeta escondida con `display: none`', T.tarjetaAbre,
        T.tarjetaAbre.replace('style={{ ', 'style={{ display: ' + base.bandera
          + " ? 'none' : 'block', ")],
      ['los nombres, todos vacíos', T.declTabla,
        T.declTabla.replace(/: '[^']*'/g, ": ''")],
      ['los nombres, todos iguales', T.declTabla,
        T.declTabla.replace(/: '[^']*'/g, ": 'Terminado'")],
      ['el resultado, a pelo', EL_P,
        "<p style={{ color: '#2ECC71', fontSize: '13px' }}>{'Completado'}</p>"],
      ['la pantalla apagada desde donde se abre', ...ojo(Z.abreLaPantalla,
        (x) => x.replace('if (', 'if (false && '))],
      ['la pantalla renombrada', 'function HistorialConductor', 'function Historial2'],
    ];

    // Los finales de renglón del archivo, que aquí se escriben con `\n`: los
    // de `guajirago/src` vienen de git en CRLF y una sola ancla de dos
    // renglones no encontraba su sitio. Ya ha mordido varias veces.
    // OJO: se normaliza a `\n` ANTES de convertir. Las anclas que salen del
    // propio archivo ya vienen con `\r\n`, y convertirlas a pelo las dejaba con
    // `\r\r\n` — no encontraban su sitio y la prueba se ponía roja acusando a
    // la lista de estar vieja, sobre código correcto.
    const NL = bueno.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
    const alDelArchivo = (s) => s.split('\r\n').join('\n').split('\n').join(NL);

    const saltados = [];
    for (const entrada of ESCAPES) {
      const nombre = entrada[0];
      // Un escape puede necesitar varios cambios a la vez (el señuelo de la
      // bandera, por ejemplo): se admite un par suelto o una lista de pares.
      const pares = Array.isArray(entrada[1]) ? entrada[1] : [[entrada[1], entrada[2]]];
      // Si un ancla no existe HOY, este escape no se puede montar y se salta.
      // No es dejarlo pasar: es que el sitio ya no está. Antes reventaba con un
      // `TypeError` sin mensaje ante dos arreglos legítimos que la propia tabla
      // de deuda anuncia —partir la cadena en dos `const`, y quitar el
      // `limit(50)`—, y quien lo viera no sabría ni qué le pasó.
      if (pares.some((par) => par[0] == null || par[1] == null)) {
        saltados.push(nombre);
        continue;
      }
      let roto = bueno;
      for (const par of pares) {
        const de = alDelArchivo(par[0]);
        assert.ok(roto.indexOf(de) >= 0,
          'el escape «' + nombre + '» ya no encuentra su sitio en AppConductor.js («'
          + de.slice(0, 50) + '…»). Esta lista se quedó vieja: hay que rehacerla mirando el '
          + 'archivo, no borrarla.');
        roto = roto.replace(de, alDelArchivo(par[1]));
      }
      const q = loQueHaceLaPantalla(roto);
      const seQueja = q.quejas.length > 0
        || !q.entran || q.entran.length !== base.entran.length
        || !q.rojos || q.rojos.length !== base.rojos.length
        || (q.cuerpo ? !!elTrozoDelResultado(q).error : true);
      assert.ok(seQueja,
        '🔴 EL MEDIDOR NO VE EL ESCAPE «' + nombre + '». Con eso puesto, el conductor pierde '
        + 'viajes de su historial —o los ve en verde «Completado» con su tarifa— y tanto este '
        + 'amarre como `node scripts/medir-historial-conductor.cjs` firman que todo está bien. '
        + 'Se arregla el LECTOR (`loQueHaceLaPantalla`), no esta lista.');
    }

    // 🔴 Y UNA LECTURA INDEPENDIENTE, A PROPÓSITO.
    //  Todo lo demás de esta prueba le pregunta al lector si ve los escapes; lo
    //  que no puede es cazarle una MENTIRA SOBRE SÍ MISMO. Con un `const elTope
    //  = null;` en el guion, el tope dejaba de leerse, el `limit` bajaba a 1 y
    //  todo seguía en verde: el amarre no tiene datos para juzgar un tope, y el
    //  guion, que sí los tiene, ya no sabía cuál era.
    //  Así que el tope se lee AQUÍ TAMBIÉN, aparte, y los dos tienen que decir
    //  lo mismo. Sí, es una segunda lectura de lo mismo — es la única que hay, y
    //  está puesta para eso: como cuando se cuenta la caja dos veces.
    const elLimite = /\blimit\(\s*(\d+)\s*\)/.exec(bueno);
    assert.strictEqual(base.tope, elLimite ? Number(elLimite[1]) : null,
      'el guion dice que la pantalla pide «' + base.tope + '» viajes como mucho, y en el '
      + 'archivo pone «' + (elLimite ? elLimite[0] : 'nada') + '». El medidor se equivoca sobre '
      + 'sí mismo: es el conteo «al tope» del paso 1 y del paso 12 el que deja de valer.');

    // 🔴 NI UNO SOLO PUEDE SALTARSE EN SILENCIO.
    //  Todas las anclas salen de trozos que, si faltan, YA son una queja del
    //  lector — así que en una pantalla sana no falta ninguna. La versión
    //  anterior dejaba saltar hasta un tercio sin decir nada, y con eso bastaba
    //  un `const iMap = -1;` en el guion para que el escape que lo vigila
    //  desapareciera de la lista sin ruido, y luego colar el fallo entero.
    assert.deepStrictEqual(saltados, [],
      'se saltaron ' + saltados.length + ' de ' + ESCAPES.length + ' escapes porque su sitio ya '
      + 'no existe en AppConductor.js (' + saltados.join(', ') + '). O la pantalla cambió de '
      + 'forma —y hay que rehacer esta lista mirando el archivo—, o alguien ablandó el lector '
      + 'para que dejara de encontrar ese trozo, que es justo lo que esta prueba vigila.');
  });

  // ── EL TOPE DE LAS CONSULTAS · QUE DIGAN POR DÓNDE EMPEZAR ───────────────
  //  Una consulta con `limit(N)` y SIN `orderBy` no es «casi correcta»: es el
  //  servidor eligiendo qué se ve. Con pocos registros no se nota, y el día que
  //  se note NO HABRÁ AVISO — el mismo silencio de la lista de estados que se
  //  cerró el 13-sep-2026.
  //
  //  El historial del conductor lo tenía así: `limit(50)` a pelo, y el orden por
  //  fecha hecho DESPUÉS, en el teléfono, sobre una lista ya recortada. Medido
  //  el 15-sep-2026: el conductor con más viajes iba por 47 de 50.
  //
  //  🔴 EL RECORRIDO SE IMPORTA de `scripts/medir-tope-historial.cjs`, no se
  //  copia aquí (SEGUNDA LEY). El de los `catch` ya se escribió dos veces y se
  //  separó el mismo día.
  //
  //  Y esta prueba NO vigila solo la que se arregló: cuenta TODAS las consultas
  //  con tope de la app del cliente. Las que siguen sin orden están en una lista
  //  declarada, con su archivo, su cuenta y su motivo — así no se pueden
  //  olvidar, y una consulta NUEVA sin orden se pone roja el mismo día.
  it('EL QUE MUERDE · ninguna consulta con tope elige a ciegas', () => {
    const { lasConsultasConTope } = require('../scripts/medir-tope-historial.cjs');
    const { consultas, PENDIENTES } = lasConsultasConTope();

    assert.ok(consultas.length >= 4,
      'solo encuentro ' + consultas.length + ' consultas con `limit(...)` en `guajirago/src`, y '
      + 'el 15-sep-2026 había 4. O se quitaron topes —bien—, o este recorrido dejó de '
      + 'encontrarlas y esta prueba ya no vigila nada.');

    // Cada archivo de la lista declarada perdona EXACTAMENTE las que dice.
    const quedanPorPerdonar = {};
    for (const [archivo, cuantas] of PENDIENTES) quedanPorPerdonar[archivo] = cuantas;

    const aCiegas = [];
    for (const c of consultas) {
      if (c.ordena) continue;
      if (quedanPorPerdonar[c.archivo] > 0) { quedanPorPerdonar[c.archivo] -= 1; continue; }
      aCiegas.push(c.archivo + ':' + c.renglon + ' (' + c.colecciona + ', tope ' + c.tope + ')');
    }
    assert.deepStrictEqual(aCiegas, [],
      'estas consultas piden un tope SIN decirle al servidor por dónde empezar:\n   · '
      + aCiegas.join('\n   · ') + '\n   Cuando haya más registros que el tope, el servidor '
      + 'manda los que le salgan y al usuario le faltan sin que nada avise. Se arregla con un '
      + '`orderBy`, y eso pide un índice: `node scripts/medir-tope-historial.cjs` dice cuál y '
      + 'comprueba si ya está puesto. Si es a propósito, va a `PENDIENTES` con su motivo.');

    // Y AL REVÉS: una pendiente que ya se arregló tiene que salir de la lista.
    // Si no, la lista se queda perdonando algo que ya no existe — y entonces
    // deja de ser un recordatorio y pasa a ser un agujero.
    const sobran = Object.entries(quedanPorPerdonar).filter(([, n]) => n > 0)
      .map(([a, n]) => a + ' (perdona ' + n + ' de más)');
    assert.deepStrictEqual(sobran, [],
      'la lista `PENDIENTES` de `medir-tope-historial.cjs` perdona consultas que ya no están '
      + 'sin orden:\n   · ' + sobran.join('\n   · ') + '\n   O se arreglaron —enhorabuena, hay '
      + 'que bajarles la cuenta o quitar la fila—, o se movieron a otro archivo. Una lista de '
      + 'perdones que se queda vieja es un agujero: perdona lo siguiente que caiga ahí.');
  });

  // ── EL ÍNDICE QUE LA CONSULTA NECESITA · QUE ESTÉ EN EL REPO ─────────────
  //  Un `orderBy` junto a un `where` pide un índice compuesto en Firestore. Si
  //  no está puesto, la consulta **falla en la cara del usuario** — y el
  //  despliegue de la app no avisa de nada, porque el fallo es del servidor.
  //
  //  🔴 Y los índices de este proyecto vivían SOLO en la consola, sin
  //  historial, igual que las reglas hasta agosto de 2026. Peor: el despliegue
  //  de índices SINCRONIZA, así que un archivo hecho a mano al que le falte uno
  //  de los que ya hay ofrece BORRARLO — y un índice borrado no da error de
  //  despliegue, hace que la consulta que lo usaba deje de funcionar.
  //  Se bajan con `node scripts/bajar-indices.cjs` ANTES de tocar el archivo.
  it('EL QUE MUERDE · el índice que pide el historial del conductor está declarado', () => {
    const { elTopeDeLaPantalla, lasConsultasConTope } = require('../scripts/medir-tope-historial.cjs');
    const p = elTopeDeLaPantalla();

    // 🔴 AQUÍ NO SE HACE `return` EN SILENCIO.
    //  La primera versión decía «sin tope o sin orden no hace falta índice» y se
    //  callaba. Con eso, quitarle el `orderBy` a la pantalla Y meterla en
    //  `PENDIENTES` dejaba los dos amarres mudos: uno perdonaba y el otro se iba
    //  sin decir nada. Un vigilante que no entiende lo que mira tiene que
    //  QUEJARSE, no aprobar. Lo midió la segunda opinión.
    assert.ok(p.tope, 'no encuentro el `limit(...)` de `HistorialConductor`. Si de verdad se '
      + 'quitó el tope —que es un arreglo legítimo— hay que quitar también este amarre y el del '
      + 'índice; si no, es que este recorrido dejó de leer la pantalla.');
    assert.ok(p.ordena, 'la pantalla del conductor pide `limit(' + p.tope + ')` y NO ordena en '
      + 'el servidor. Con más de ' + p.tope + ' viajes, el servidor elige cuáles manda.');

    // Y esta consulta YA está arreglada, así que no puede estar perdonada: una
    // fila de más en `PENDIENTES` taparía su vuelta al fallo.
    const { PENDIENTES } = lasConsultasConTope();
    assert.ok(!PENDIENTES.some(([a]) => a === 'guajirago/src/AppConductor.js'),
      '`AppConductor.js` está en la lista `PENDIENTES` de `medir-tope-historial.cjs`, y su '
      + 'consulta se arregló el 15-sep-2026. Perdonar lo que ya está bien es abrir la puerta a '
      + 'que vuelva el fallo sin que nada chiste.');

    // 🔴 Y UNA LECTURA INDEPENDIENTE, A PROPÓSITO.
    //  El amarre se cree lo que le diga el lector, y el lector está en la foto:
    //  la segunda opinión le añadió «...|| (es AppConductor ? 'fechaSolicitud' :
    //  null)» y, con el `orderBy` quitado de la pantalla, las 84 siguieron en
    //  verde. Así que el orden y su dirección se leen AQUÍ TAMBIÉN, a pelo, y
    //  los dos tienen que decir lo mismo. Es una segunda lectura de lo mismo, sí
    //  — puesta para esto, como contar la caja dos veces.
    const aPelo = /orderBy\(\s*['"]([^'"]+)['"]\s*,\s*['"](\w+)['"]\s*\)[\s\S]{0,80}?limit\(/
      .exec(soloCodigo(leer('guajirago/src/AppConductor.js')));
    assert.ok(aPelo, 'no encuentro en AppConductor.js un `orderBy(campo, direccion)` seguido de '
      + 'un `limit(...)`. El lector dice que ordena por «' + p.ordena + '» ' + p.direccion
      + ', y leyéndolo a pelo no lo veo: uno de los dos se equivoca.');
    assert.strictEqual(aPelo[1], p.ordena,
      'el lector dice que la pantalla ordena por «' + p.ordena + '» y en el archivo pone «'
      + aPelo[1] + '». El medidor se equivoca sobre sí mismo.');
    assert.strictEqual(aPelo[2].toLowerCase() === 'desc' ? 'DESCENDING' : 'ASCENDING', p.direccion,
      'el lector dice que la pantalla ordena «' + p.direccion + '» y en el archivo pone «'
      + aPelo[2] + '». Y la dirección decide qué índice hace falta.');

    const fs = require('fs');
    const path = require('path');
    const archivo = path.join(RAIZ, 'firestore.indexes.json');
    assert.ok(fs.existsSync(archivo),
      'no existe `firestore.indexes.json`. La pantalla del conductor ordena por «' + p.ordena
      + '» en el servidor, y eso pide un índice: sin el archivo, el índice vive solo en la '
      + 'consola y nadie sabe que existe hasta que falta.');
    const dentro = JSON.parse(fs.readFileSync(archivo, 'utf8'));

    // 🔴 EL NOMBRE NO BASTA: LA DIRECCIÓN Y EL ALCANCE TAMBIÉN.
    //  La primera versión solo comparaba los nombres de los campos, y la segunda
    //  opinión la burló TRES veces, cada una dejando el historial del conductor
    //  EN BLANCO con las 84 pruebas en verde:
    //    · el índice con `fechaSolicitud: ASCENDING` (probado contra el
    //      servidor: no sirve para un `orderBy` descendente; aquí no hay lectura
    //      al revés, Firestore pide otro índice distinto),
    //    · el índice con `queryScope: COLLECTION_GROUP` —o sin él—, que no
    //      sirve a un `collection(db, 'viajes')`,
    //    · y la pantalla cambiando `'desc'` por `'asc'`, que pide el otro.
    //  El `--dry-run` del despliegue tampoco los ve: solo lee el archivo.
    const sirve = (dentro.indexes || []).some((i) => {
      const campos = (i.fields || []).filter((f) => f.fieldPath !== '__name__');
      return i.collectionGroup === 'viajes'
        // ESCRITO, no supuesto. El ensayo del despliegue (`--dry-run`) NO valida
        // índices —solo lee el archivo y compila las reglas—, así que no se
        // puede saber con él si un `queryScope` ausente vale. Ante la duda, el
        // lado estricto: el archivo que baja del propio `firebase` siempre lo
        // trae, así que exigirlo no puede dar un rojo falso.
        && i.queryScope === 'COLLECTION'
        && campos.length === 2
        && campos[0].fieldPath === 'conductorId'
        && campos[0].order === 'ASCENDING'
        && campos[1].fieldPath === p.ordena
        && campos[1].order === p.direccion;
    });
    assert.ok(sirve,
      '`firestore.indexes.json` no declara el índice que la pantalla del conductor necesita: '
      + 'viajes (COLLECTION) · conductorId ASCENDING + ' + p.ordena + ' ' + p.direccion
      + '.\n   Los que hay son:\n   · '
      + (dentro.indexes || []).map((i) => i.collectionGroup + ' (' + (i.queryScope || 'COLLECTION')
        + '): ' + (i.fields || []).map((f) => f.fieldPath + ' ' + (f.order || f.arrayConfig))
          .join(' + ')).join('\n   · ')
      + '\n   Sin ese índice —o con la dirección o el alcance cambiados, que es igual de malo— '
      + 'la consulta falla y el conductor ve «Mis viajes» EN BLANCO, sin aviso. El despliegue '
      + 'de la app no avisa: el fallo es del servidor. Primero el índice, después la app.');

    // Y que `firebase.json` sepa de dónde sacarlos: sin esa línea, el archivo
    // puede estar perfecto y el despliegue no mirarlo nunca.
    const config = JSON.parse(fs.readFileSync(path.join(RAIZ, 'firebase.json'), 'utf8'));
    assert.strictEqual((config.firestore || {}).indexes, 'firestore.indexes.json',
      '`firebase.json` no dice `"indexes": "firestore.indexes.json"`, así que `firebase deploy '
      + '--only firestore:indexes` no sabe de dónde sacarlos. El archivo estaría bien y no se '
      + 'desplegaría nunca.');
  });

  // ── LAS PESTAÑAS DEL PANEL DE VIAJES · QUE NO SE PIERDA NINGUNO ──────────
  //  El panel tiene tres pestañas y cada una con su filtro. Un viaje cuyo
  //  estado no esté en ninguno NO APARECE EN NINGÚN SITIO: no da error, no sale
  //  en rojo, simplemente no está. Y nadie echa de menos lo que nunca vio.
  //
  //  Medido el 12-sep-2026 con `scripts/medir-pestanas-viajes.cjs`: NUEVE de
  //  los 91 viajes —los `expirado`— desaparecían del panel, y el porcentaje de
  //  cancelación salía 80% cuando era 82%, calculado sobre una lista a la que
  //  le faltaban esos nueve.
  it('EL QUE MUERDE · todos los estados caben en alguna pestaña del panel', () => {
    const { ESTADOS_EN_CURSO, ESTADOS_TERMINADOS }
      = cargarDeLaApp('guajirago/src/estadosViaje.js');
    const t = soloCodigo(leer('guajirago-admin/src/Viajes.js'));

    // La lista de «no completados», que usan la pestaña y la estadística.
    const m = /const\s+NO_COMPLETADOS\s*=\s*\[([^\]]*)\]/.exec(t);
    assert.ok(m, 'guajirago-admin/src/Viajes.js ya no tiene `NO_COMPLETADOS`. Esa lista es la '
      + 'que recoge todo lo que no acabó bien; sin ella, los estados que no estén en ninguna '
      + 'pestaña desaparecen del panel sin que nada avise.');
    const noCompletados = m[1].replace(/['"\s]/g, '').split(',').filter(Boolean);

    const deberia = ESTADOS_TERMINADOS.filter((e) => e !== 'finalizado');
    assert.deepStrictEqual([...noCompletados].sort(), [...deberia].sort(),
      'La lista de «no completados» del panel y la de la app se separaron.\n'
      + '   app (ESTADOS_TERMINADOS, sin `finalizado`): ' + [...deberia].sort().join(', ') + '\n'
      + '   panel (NO_COMPLETADOS):                     ' + [...noCompletados].sort().join(', ')
      + '\nLo que se quede fuera no sale en NINGUNA pestaña: desaparece del panel.');

    // Y AHORA LO QUE DE VERDAD IMPORTA: que entre las tres pestañas no se
    // quede ningún estado suelto. Se comprueba contra la lista entera de la
    // app, no contra una copia de aquí.
    const enCurso = /where\('estado',\s*'in',\s*\[([^\]]+)\]/.exec(t);
    assert.ok(enCurso, 'el panel ya no consulta los viajes en curso con where(estado, in, [...]).');
    const acogidos = new Set([
      ...enCurso[1].replace(/['"\s]/g, '').split(',').filter(Boolean),
      'finalizado',
      ...noCompletados,
    ]);
    const huerfanos = [...ESTADOS_EN_CURSO, ...ESTADOS_TERMINADOS].filter((e) => !acogidos.has(e));
    assert.deepStrictEqual(huerfanos, [],
      'estos estados NO CABEN EN NINGUNA PESTAÑA del panel: ' + huerfanos.join(', ') + '\n'
      + '   Un viaje en uno de ellos no sale en «en curso», ni en «completados», ni en '
      + '«cancelados». No da error: desaparece. Pasó con los 9 `expirado` hasta el '
      + '12-sep-2026.');

    // ── Y QUE LA LISTA SE LEA DEL CAMPO BUENO ───────────────────────────
    //  La segunda opinión cambió `NO_COMPLETADOS.includes(v.estado)` por
    //  `v.fase` y dejó las 80 pruebas EN VERDE, el guion diciendo «✓ todos
    //  caben» y el 82% intacto — mientras el panel real enseñaba la pestaña
    //  VACÍA y 0% de cancelación. Comprobar la lista sin comprobar de dónde se
    //  lee es vigilar la mitad.
    const ayudante = /const\s+(\w+)\s*=\s*\(\w+\)\s*=>\s*NO_COMPLETADOS\.includes\(\s*(\w+)\.(\w+)\s*\)/
      .exec(t);
    assert.ok(ayudante, 'no encuentro el ayudante `(v) => NO_COMPLETADOS.includes(v.estado)` '
      + 'en el panel de viajes. Si se escribió de otra forma, hay que mirar a mano que lea '
      + 'el ESTADO y no otro campo.');
    assert.strictEqual(ayudante[3], 'estado',
      'el ayudante de «no completados» lee `' + ayudante[2] + '.' + ayudante[3] + '` en vez '
      + 'del ESTADO. La fase se queda pegada a un viaje muerto y no dice si terminó: con '
      + 'esto la pestaña sale VACÍA y el porcentaje de cancelación en 0, sin un solo rojo.');
    const elAyudante = ayudante[1];

    // Y QUE NO HAYA DOS. Una segunda `NO_COMPLETADOS` dentro de un bloque tapa
    // a la de fuera: vuelven las dos calculadoras, cada una con su número, y
    // las dos parecen ciertas. Probado por la segunda opinión: 80 en verde.
    for (const nombre of ['NO_COMPLETADOS', elAyudante]) {
      const veces = (t.match(new RegExp('const\\s+' + nombre + '\\s*=', 'g')) || []).length;
      assert.strictEqual(veces, 1,
        '«' + nombre + '» se declara ' + veces + ' veces en Viajes.js. La de dentro tapa a la '
        + 'de fuera, así que una parte de la pantalla cuenta con una lista y otra con otra.');
    }

    // Y que la lista se use en LOS DOS sitios, no solo en la pestaña: la
    // estadística del porcentaje de cancelación sale de la misma.
    //
    // 🔴 SE CUENTAN LOS USOS SIN LOS COMENTARIOS DE COLA. `soloCodigo` solo
    // quita los `//` que EMPIEZAN el renglón, así que un
    // `... // antes: viajes.filter(noCompleto)` al final de la línea contaba
    // como uso y dejaba el sabotaje en verde. Lo midió la segunda opinión.
    const sinCola = t.split('\n').map((l) => {
      const seguro = sinTextos(l);
      const i = seguro.indexOf('//');
      return i < 0 ? l : l.slice(0, i);
    }).join('\n');
    const USO = new RegExp('viajes\\.filter\\(' + elAyudante + '\\)', 'g');
    const usos = (sinCola.match(USO) || []).length;
    assert.ok(usos >= 2,
      '`' + elAyudante + '` se usa ' + usos + ' vez/veces, y hacen falta DOS: la pestaña de '
      + 'cancelados y la estadística. Si una de las dos vuelve a llevar su propia lista, el '
      + 'porcentaje de cancelación se calcula sobre otra cosa que la pestaña — y las dos '
      + 'parecen ciertas.');

    // Y que nadie le encadene OTRO filtro detrás, que es quitar estados por la
    // puerta de atrás dejando la lista intacta.
    assert.ok(!new RegExp('viajes\\.filter\\(' + elAyudante + '\\)\\s*\\.filter\\(').test(sinCola),
      'hay un `.filter(...)` encadenado detrás de `' + elAyudante + '`. Eso quita viajes de '
      + 'la pestaña sin tocar la lista, así que este amarre no lo ve venir y los viajes '
      + 'vuelven a desaparecer.');

    // Y que cada final tenga nombre en la etiqueta: sin entrada en el mapa
    // salen con el nombre crudo del estado.
    const mapa = /const\s+etiquetaEstado[\s\S]*?const\s+mapa\s*=\s*\{([\s\S]*?)\n {4}\};/.exec(t);
    assert.ok(mapa, 'no encuentro el mapa de `etiquetaEstado` en el panel de viajes.');
    for (const e of ESTADOS_TERMINADOS) {
      assert.ok(new RegExp('\\b' + e + '\\s*:').test(mapa[1]),
        'al mapa de `etiquetaEstado` le falta «' + e + '», así que ese viaje sale con el '
        + 'nombre crudo del estado en vez de en cristiano.');
    }
  });

  // ── Y LA CAJA DE «CANCELADOS», QUE SE DEJABA DOS FUERA ───────────────────
  //  Medido el 12-sep-2026 con `scripts/medir-mandados.cjs`: `esCancelado` solo
  //  conocía `['cancelado', 'vencido']`, así que los mandados en `expirado` y
  //  `cancelado_conductor` NO CABÍAN EN NINGUNA CAJA. Caían en el cajón de
  //  sastre de `etiquetaEstado` y se pintaban «En curso» en naranja — CINCO de
  //  los doce mandados que hay— mientras desaparecían de «CANCELADOS HOY».
  //
  //  Un mandado que terminó mal y se ve como si fuera de camino no es un número
  //  feo: es alguien esperando en la puerta un repartidor que no va a llegar.
  it('EL QUE MUERDE · la caja de CANCELADOS del panel conoce todos los finales', () => {
    const { ESTADOS_TERMINADOS } = cargarDeLaApp('guajirago/src/estadosViaje.js');
    const t = soloCodigo(leer('guajirago-admin/src/Mensajeria.js'));

    const m = /const\s+esCancelado\s*=\s*\(\w+\)\s*=>\s*\[([^\]]*)\]\.includes/.exec(t);
    assert.ok(m, 'guajirago-admin/src/Mensajeria.js ya no decide «cancelado» con una lista '
      + 'de estados. Si se cambió de forma, hay que mirar a mano que no se deje ninguno '
      + 'fuera: los que no caben en ninguna caja se pintan como si el mandado siguiera vivo.');
    const suya = m[1].replace(/['"\s]/g, '').split(',').filter(Boolean);

    // TODOS los finales menos `finalizado`, que tiene su propia caja («Entregado»).
    const deberia = ESTADOS_TERMINADOS.filter((e) => e !== 'finalizado');
    assert.deepStrictEqual([...suya].sort(), [...deberia].sort(),
      'La caja de «cancelados» del panel de mensajería y la lista de finales de la app se '
      + 'separaron.\n'
      + '   app (ESTADOS_TERMINADOS, sin `finalizado`): ' + [...deberia].sort().join(', ') + '\n'
      + '   panel (esCancelado):                        ' + [...suya].sort().join(', ') + '\n'
      + 'Lo que se quede fuera NO cae en ninguna caja: se pinta «En curso» en naranja aunque '
      + 'el mandado esté muerto, y no se cuenta en «CANCELADOS HOY». Si el cambio es a '
      + 'propósito, se cambian LOS DOS LADOS.');

    // Y QUE CADA FINAL TENGA SU NOMBRE EN PALABRAS. Que entren en la caja no
    // basta: si los cuatro dicen «Cancelado», quien mira el panel no sabe si el
    // cliente se arrepintió, si el repartidor lo soltó o si no lo cogió nadie.
    const nombres = /const\s+NOMBRE_DEL_FINAL\s*=\s*\{([\s\S]*?)\}/.exec(t);
    assert.ok(nombres, 'el panel ya no tiene `NOMBRE_DEL_FINAL`, que es lo que pone en '
      + 'palabras cada forma de terminar.');
    for (const e of deberia) {
      assert.ok(new RegExp('\\b' + e + '\\s*:').test(nombres[1]),
        'a `NOMBRE_DEL_FINAL` le falta «' + e + '», así que ese final saldría con el nombre '
        + 'de otro. No es lo mismo que el cliente cancele, que el repartidor suelte el '
        + 'mandado, o que no lo tome nadie.');
    }

    // ── Y EL CAJÓN DE SASTRE NO VUELVE ────────────────────────────────────
    //  Lo que de verdad escondió el fallo no fue la lista corta: fue que lo
    //  desconocido se pintara «En curso». Con eso, cualquier estado que la
    //  pantalla no conozca se disfraza de mandado vivo y nadie se entera.
    //  🔴 LA PRIMERA VERSIÓN DE ESTA COMPROBACIÓN MIRABA EL PENÚLTIMO RENGLÓN
    //  de la función, y buscaba la palabra «En curso» ahí. La segunda opinión
    //  la burló de CINCO formas, todas devolviendo el mismo disfraz: poniendo
    //  el cajón ANTES en vez de al final, partiéndolo en varios renglones,
    //  llamándolo «En camino», metiendo `'En curso'` dentro de
    //  `NOMBRE_DEL_FINAL`, o dejando `NOMBRE_DEL_FINAL` escrito y sin usar.
    //  Un amarre que mira un renglón deja abiertas las otras puertas.
    //
    //  Lo que de verdad define el disfraz no es la palabra: es EL COLOR. El
    //  naranja `#FF7A2F` significa «esto sigue vivo». Así que se mira eso:
    //  solo los estados vivos pueden devolverlo.
    const final = /const\s+etiquetaEstado\s*=[\s\S]*?\n {2}\};/.exec(t);
    assert.ok(final, 'no encuentro `etiquetaEstado` en el panel de mensajería.');
    const cuerpo = final[0];

    const NARANJA = /#FF7A2F/gi;
    const enNaranja = cuerpo.split('\n').filter((l) => NARANJA.test(l));
    NARANJA.lastIndex = 0;
    //  Y TIENE QUE SER UNA COMPARACIÓN POSITIVA, `e === 'esperando'`. Con solo
    //  exigir que la palabra APAREZCA, el sabotaje
    //      if (!['esperando'].includes(e)) return { t: 'En curso', naranja }
    //  pasaba: nombra `esperando` para excluirlo, y pinta de naranja todo lo
    //  demás. Es el cajón de sastre otra vez, puesto al principio en vez de al
    //  final. Mencionar un estado no es lo mismo que ser ese estado.
    for (const l of enNaranja) {
      assert.match(l, /e\s*===\s*['"](esperando|aceptado)['"]/,
        'en `etiquetaEstado` hay un renglón que pinta de NARANJA —el color de «esto sigue '
        + 'vivo»— sin ser un `e === \'esperando\'` o `e === \'aceptado\'`:\n     '
        + l.trim().slice(0, 100) + '\n'
        + '   Ése es el cajón de sastre que tuvo 5 de 12 mandados muertos disfrazados de '
        + 'vivos durante meses. Lo desconocido se dice, no se pinta de naranja.');
    }

    // Y QUE LOS NOMBRES SE USEN, no solo que estén escritos. Dejar la tabla
    // declarada y devolver «Cancelado» a pelo la dejaba de adorno — es la misma
    // lección del amarre que tuvo que mirar el `exports.` de un disparador.
    assert.match(cuerpo, /NOMBRE_DEL_FINAL\s*\[/,
      '`etiquetaEstado` ya no usa `NOMBRE_DEL_FINAL`. La tabla puede estar perfecta y no '
      + 'servir de nada: los cuatro finales volverían a salir con el mismo nombre.');

    // Y que ninguno de los nombres diga que el mandado sigue vivo.
    assert.ok(!/En curso|En camino|Buscando/i.test(nombres[1]),
      'uno de los nombres de `NOMBRE_DEL_FINAL` dice que el mandado sigue vivo. Son los '
      + 'finales: si uno dice «En curso», vuelve el disfraz por la puerta de al lado.');

    // Y que la tarjeta siga preguntándole a `etiquetaEstado`. Si deja de
    // llamarla, todo lo de arriba vigila una función que nadie usa.
    assert.match(t, /etiquetaEstado\s*\(/,
      'nadie llama a `etiquetaEstado` en el panel de mensajería: la etiqueta que ve el dueño '
      + 'sale de otro sitio, y todo lo que vigila este amarre da igual.');

    // Y `esCancelado`, definida UNA vez: una segunda dentro del componente tapa
    // a la de fuera y la pantalla cuenta con la lista vieja, todo en verde.
    const cuantas = (t.match(/const\s+esCancelado\s*=/g) || []).length;
    assert.strictEqual(cuantas, 1,
      '`esCancelado` está definida ' + cuantas + ' veces. La de dentro tapa a la de fuera, '
      + 'así que la pantalla puede estar usando una lista que este amarre ni mira.');
  });

  // ── LOS ESTADOS RETIRADOS NO VUELVEN ─────────────────────────────────────
  //  🔴 ESTE AMARRE EXISTE PORQUE UN SABOTAJE SOBREVIVIÓ (12-sep-2026). Se
  //  cambió `estado === 'aceptado'` por `estado === 'confirmado'` en la app del
  //  conductor —con lo que el conductor deja de reconocer su propio viaje: no
  //  celebra, no entra al mapa, no le sale nada— y las 963 pruebas siguieron
  //  verdes. No falla nada: simplemente el conductor se queda mirando.
  //
  //  Los cuatro estados retirados no los escribe nadie, así que compararse con
  //  ellos es comparar con algo que no puede pasar nunca.
  it('EL QUE MUERDE · ninguna pantalla de VIAJES compara con un estado retirado', () => {
    const { ESTADOS_RETIRADOS } = cargarDeLaApp('guajirago/src/estadosViaje.js');
    // SOLO PANTALLAS DE VIAJES. `confirmado` está retirado como estado de viaje
    // pero VIVO como estado de PEDIDO, así que las pantallas de restaurantes y
    // de aliados no entran aquí — allí es correcto y necesario.
    //
    // `Solicitar.js` NO está en la lista todavía, y es a propósito: le quedan
    // los bloques muertos de `confirmando` y `contraoferta` (~175 renglones que
    // no se pueden ejecutar), y limpiarlos es su propio trabajo. El día que se
    // haga, se añade aquí y esto lo vigila también.
    const PANTALLAS_DE_VIAJES = [
      'guajirago/src/AppConductor.js',
      'guajirago/src/Seguridad.js',
      'guajirago/src/MisViajes.js',
      'guajirago/src/Home.js',
      'guajirago/src/Ganancias.js',
      'guajirago-admin/src/Viajes.js',
      'guajirago-admin/src/Mensajeria.js',
      'guajirago-admin/src/Pasajeros.js',
      'guajirago-admin/src/Conductores.js',
    ];
    for (const archivo of PANTALLAS_DE_VIAJES) {
      const t = soloCodigo(leer(archivo));
      for (const muerto of ESTADOS_RETIRADOS) {
        // SE BUSCA LA COMPARACIÓN, NO LA PALABRA SUELTA: el panel SÍ tiene que
        // seguir pintando las etiquetas de los estados viejos para el historial.
        //
        // Y SE BUSCAN SUS DISFRACES. La primera versión miraba solo
        // `estado === 'x'` con comilla simple, y la segunda opinión la esquivó de
        // SEIS formas distintas escribiendo la misma rotura: comillas dobles,
        // `data['estado']`, al revés (`'x' === data.estado`), con una variable de
        // por medio, con `==` suelto, y metiéndolo en una lista. Aquí se cubren
        // todas las que se pueden cubrir leyendo texto — la de la variable
        // intermedia no, y queda dicho.
        const enComparacion = new RegExp(
          '(?:\\[\\s*[\'"]estado[\'"]\\s*\\]|\\bestado\\b|\\be\\b)\\s*[!=]=+\\s*[\'"]' + muerto + '[\'"]'
          + '|[\'"]' + muerto + '[\'"]\\s*[!=]=+\\s*(?:\\w+\\s*\\[\\s*[\'"]estado[\'"]\\s*\\]|\\w*\\.?\\bestado\\b)');
        assert.ok(!enComparacion.test(t),
          archivo + ' compara el estado del viaje con «' + muerto + '», que está RETIRADO '
          + 'y no lo escribe nadie.\n'
          + '   Si es una comparación que sustituyó a la buena, esa pantalla dejó de '
          + 'reconocer el viaje y no falla nada: simplemente no hace nada.\n'
          + '   Los estados vivos están en guajirago/src/estadosViaje.js.');
        // Y EN UNA LISTA. La primera versión se comía la comilla de apertura, así
        // que un estado retirado en la PRIMERA posición se escapaba:
        //   ['esperando','confirmado'].includes(v.estado)  → lo cazaba
        //   ['confirmado','esperando'].includes(v.estado)  → NO lo cazaba
        // Y tampoco veía `.includes(d.data().estado)`. Las dos las encontró la
        // segunda opinión del 12-sep-2026.
        const enLista = new RegExp(
          '\\[[^\\]]*[\'"]' + muerto + '[\'"][^\\]]*\\]\\s*\\.includes\\s*\\(\\s*[^)]*\\bestado\\b');
        assert.ok(!enLista.test(t),
          archivo + ' volvió a meter «' + muerto + '» en una lista de estados de viaje. '
          + 'Ese estado no lo escribe nadie: la lista lo lleva de adorno, y de adorno '
          + 'engaña al que la lea.');
      }
    }
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
  // LAS DOS CARPETAS, no una (7-sep-2026). El escaparate se está mudando de
  // `restaurantes` a `negocios` y las dos viven a la vez. Mirando solo una, la
  // otra podía quedarse sin la lista y esto seguía verde.
  const LOS_DOS_ESCAPARATES = [
    'match /restaurantes/{restauranteId}',
    'match /negocios/{negocioId}',
  ];
  LOS_DOS_ESCAPARATES.forEach((cabecera) => {
    it('las reglas del ESCAPARATE prohíben exactamente los campos privados · ' + cabecera, () => {
      const { CAMPOS_PRIVADOS } = modulo();
      const reglas = leer('firestore.rules');
      const desde = reglas.split(cabecera)[1];
      assert.ok(desde, 'no está el bloque «' + cabecera + '» en las reglas');
      const bloque = desde.split('match /')[0];
      const lista = (bloque.split('function camposPrivados()')[1] || '').split('}')[0];
      assert.ok(lista.trim(),
        'firestore.rules ya no tiene camposPrivados() en el bloque «' + cabecera + '». Sin esa ' +
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
          'A camposPrivados() de firestore.rules le falta «' + campo + '» en el bloque «' +
          cabecera + '», y negocioPrivado.js sí lo declara privado. Ese campo podría volver ' +
          'a escribirse en el escaparate, que es la colección que la app del pasajero se ' +
          'descarga ENTERA.');
      });
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
    assert.ok(vivo.includes("'negocios', uid), sinLoPrivado(datos)"),
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
    // Se cuentan solo las ESCRITURAS. La otra vez que negocios/{uid} aparece en
    // este archivo es el getDoc de iniciarSesion, que es legítimo y tiene que estar.
    const veces = (vivo.match(/setDoc\(doc\(db, 'negocios', uid\)/g) || []).length;
    assert.strictEqual(veces, 1,
      'aliados/Login.js ESCRIBE en negocios/{uid} ' + veces + ' veces, y tiene que ser ' +
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
  // 3. 🔴 UN «NO» TIENE QUE NOMBRAR LAS DOS CARPETAS mientras las dos vivan
  //    (7-sep-2026). Estos dos son «no»: dicen que este archivo NO nombra el
  //    escaparate. El día que el código pasó de `restaurantes` a `negocios`, un
  //    «no» atado solo al nombre viejo se puso VERDE sin comprobar ya nada — y
  //    habría seguido verde aunque el token del dueño volviera al escaparate
  //    nuevo. Un «no» clavado a un nombre que ya nadie usa no protege: lo
  //    parece, que es peor. Cuando se retire `restaurantes`, se quita de aquí.
  //
  // (\x60 es la comilla invertida. Se escribe así para no tener que escapar
  // acentos graves dentro de una expresión regular.)
  const NOMBRA_EL_ESCAPARATE = /['"\x60](restaurantes|negocios)['"\x60]/;
  const LEE_DEL_ESCAPARATE = /collection\(\s*['"\x60](restaurantes|negocios)['"\x60]\s*\)/;

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
      'aliados/Notificaciones.js volvió a nombrar el escaparate («negocios», o «restaurantes» ' +
      'mientras la vieja siga viva). El token del dueño no puede acabar ahí, ni por el camino ' +
      'principal ni por uno añadido al lado.');
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

    // ── DÓNDE VIVE EL CUERPO DE CADA AVISO ──────────────────────────────────
    //  Antes bastaba partir por `exports.<nombre> =`: cada aviso era una función
    //  exportada con su cuerpo dentro. Desde el 7-sep-2026 el del PEDIDO ya no.
    //  La colección cambió de nombre (`pedidosRestaurantes` → `pedidos`) y un
    //  disparador solo puede escuchar UNA carpeta, así que durante la mudanza
    //  hubo DOS disparadores llamando al MISMO cuerpo, que salió a
    //  `avisarDelPedidoNuevo`. Copiarlo habría sido el gemelo que prohíbe la
    //  SEGUNDA LEY: al cambiar el texto del aviso, una copia se quedaría vieja.
    //  Desde el 9-sep-2026 queda UNA sola puerta, pero el cuerpo se dejó fuera a
    //  propósito: es lo que hizo posible tener dos sin copiarlas, y el día que se
    //  renombre otra colección hace falta otra vez.
    //
    //  ESTA PRUEBA VIGILA EXACTAMENTE LO MISMO QUE ANTES —que el aviso lea el
    //  token del cuarto privado y NUNCA del escaparate—; solo cambia dónde lo
    //  busca. Si algún día el cuerpo vuelve a meterse dentro del `exports`, hay
    //  que devolver este nombre a la forma de la reserva.
    [
      ['avisarDelPedidoNuevo', 'async function ', '('],
      ['notificarNuevaReserva', 'exports.', ' ='],
    ].forEach(([nombre, prefijo, cola]) => {
      const desde = vivo.split(prefijo + nombre + cola)[1];
      assert.ok(desde, 'ya no existe ' + nombre + ' en functions/index.js. Si se ' +
        'le cambió el nombre, cámbialo también aquí: esta prueba es lo único que vigila que ' +
        'siga leyendo el token del sitio bueno.');
      const cuerpo = desde.split(/\r?\n(?:exports\.|async function )/)[0];
      assert.ok(cuerpo.includes('collection(NEGOCIO_PRIVADO)'),
        nombre + ' ya no busca el token en el cuarto privado del negocio.');
      assert.ok(!LEE_DEL_ESCAPARATE.test(cuerpo),
        nombre + ' volvió a leer del ESCAPARATE («negocios», o «restaurantes» mientras la ' +
        'vieja siga viva): la ' +
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

describe('AMARRES · REGLA 9 · las tres apps clasifican IGUAL un rechazo', () => {
  // «Nada se rechaza en silencio» está resuelto en los tres repos, y los tres son
  // repos APARTE: no hay forma de importar de uno a otro. Así que hay copias, y
  // este amarre EJECUTA las tres con los mismos fallos.
  //
  // Lo que se compara es la CLASIFICACIÓN, no el texto: el texto tiene que ser
  // distinto a propósito (a un cliente se le dice que no entró su calificación; a
  // un restaurante, que no se pudo reportar un comentario). Lo que no puede
  // separarse es QUÉ clase de fallo es cada código: si un día una app tratara
  // «sin internet» como «no tienes permiso», le diría a alguien que no puede
  // hacer algo que sí puede.
  const CASOS = [
    { e: { code: 'permission-denied' }, clase: 'permiso' },
    { e: { code: 'unavailable' }, clase: 'sinRed' },
    { e: { code: 'deadline-exceeded' }, clase: 'sinRed' },
    { e: { code: 'algo-que-nadie-ha-visto' }, clase: 'otro' },
    { e: {}, clase: 'otro' },
    { e: null, clase: 'otro' },
  ];

  it('el mismo fallo cae en la misma clase en la app, en aliados y en el panel', () => {
    // La app del pasajero devuelve el objeto de MOTIVOS; los otros dos traen la
    // clase dentro. Se normalizan las dos formas y se comparan.
    const app = cargarDeLaApp('guajirago/src/avisoCalificacion.js');
    const claseEnLaApp = (e) => {
      const m = app.motivoDeRechazo(e);
      for (const k of Object.keys(app.MOTIVOS)) if (app.MOTIVOS[k] === m) return k;
      return '(ninguna)';
    };
    const aliados = cargarDeLaApp('guajirago-aliados/src/avisoRechazo.js');
    const panel = cargarDeLaApp('guajirago-admin/src/avisoRechazo.js');

    // LOS CÓDIGOS NO SE ESCRIBEN A MANO. La primera versión de este amarre solo
    // probaba seis, cada uno contra una respuesta fija, y NUNCA comparaba las tres
    // apps entre sí. La segunda opinión lo rompió: enseñó a los dos gemelos un
    // código nuevo ('resource-exhausted') que la app del pasajero seguía tratando
    // de otra manera, y el amarre pasó en verde. Su propio comentario prometía que
    // «se pone roja si alguno clasifica distinto». No era cierto.
    //
    // Ahora se barren TODOS los códigos que nombra cualquiera de los tres
    // archivos, más los raros de siempre. Si mañana una app aprende un código que
    // las otras no, este barrido lo encuentra solo.
    const nombrados = new Set();
    for (const ruta of ['guajirago/src/avisoCalificacion.js',
      'guajirago-aliados/src/avisoRechazo.js', 'guajirago-admin/src/avisoRechazo.js']) {
      // Se sacan de donde se comparan de verdad —`codigo === '…'`— y no de
      // cualquier texto entrecomillado del archivo: así no entran las claves
      // ('permiso', 'sinRed') ni los trozos de frase.
      for (const m of leer(ruta).matchAll(/codigo === '([^']+)'/g)) nombrados.add(m[1]);
    }
    assert.ok(nombrados.size >= 3,
      'esperaba al menos 3 códigos de fallo entre los tres archivos y encontré '
      + nombrados.size + ': ' + [...nombrados].join(', '));
    const RAROS = [null, undefined, {}, 'un texto suelto', new Error('boom'), { code: 42 }];
    const TODOS = [...[...nombrados].map((code) => ({ code })), ...RAROS];

    for (const e of TODOS) {
      const enApp = claseEnLaApp(e);
      const enAliados = aliados.motivoDeRechazo(e, 'hacer algo').clave;
      const enPanel = panel.motivoDeRechazo(e, 'hacer algo').clave;
      const cual = JSON.stringify(e && e.code ? e.code : e);
      // Las TRES entre sí, que es lo que promete el nombre de esta prueba.
      assert.strictEqual(enAliados, enApp,
        'con ' + cual + ' la app dice «' + enApp + '» y aliados «' + enAliados + '»');
      assert.strictEqual(enPanel, enApp,
        'con ' + cual + ' la app dice «' + enApp + '» y el panel «' + enPanel + '»');
      // Y ninguna se inventa una clase que no esté en la lista compartida.
      assert.ok(aliados.CLAVES.includes(enApp),
        'con ' + cual + ' sale la clase «' + enApp + '», que no está en CLAVES');
    }

    // Y encima, los casos escritos a mano con su respuesta esperada: el barrido
    // de arriba se pondría rojo si las tres se equivocaran IGUAL, pero no si las
    // tres cambiaran a la vez. Esto fija la conducta, no solo el acuerdo.
    for (const c of CASOS) {
      assert.strictEqual(claseEnLaApp(c.e), c.clase,
        'la app clasifica ' + JSON.stringify(c.e) + ' como «' + claseEnLaApp(c.e) + '»');
    }
  });

  it('ninguna de las tres devuelve un aviso vacío, pase lo que pase', () => {
    // De donde venimos es de no avisar NUNCA. Un aviso genérico vale; ninguno, no.
    const app = cargarDeLaApp('guajirago/src/avisoCalificacion.js');
    const aliados = cargarDeLaApp('guajirago-aliados/src/avisoRechazo.js');
    const panel = cargarDeLaApp('guajirago-admin/src/avisoRechazo.js');
    for (const c of CASOS.concat([{ e: 'un texto suelto' }, { e: new Error('boom') }])) {
      for (const [nombre, m] of [
        ['la app', app.motivoDeRechazo(c.e)],
        ['aliados', aliados.motivoDeRechazo(c.e, 'hacer algo')],
        ['el panel', panel.motivoDeRechazo(c.e, 'hacer algo')],
      ]) {
        assert.ok(m && m.titulo && m.texto,
          nombre + ' se quedó sin aviso con ' + JSON.stringify(c.e));
      }
    }
  });

  it('los DOS GEMELOS (aliados y panel) son el mismo archivo, byte a byte', () => {
    // Estos dos sí tienen que ser idénticos: son la misma pieza copiada porque los
    // repos no pueden compartir archivo. El de la app del pasajero NO entra aquí:
    // su texto es distinto a propósito, y lo que lo amarra es la prueba de arriba.
    const a = leer('guajirago-aliados/src/avisoRechazo.js');
    const p = leer('guajirago-admin/src/avisoRechazo.js');
    assert.strictEqual(a, p,
      'avisoRechazo.js se separó entre aliados y el panel. Son gemelos: se tocan los dos ' +
      'o ninguno.');
  });

  it('la acción se mete en la frase: el aviso dice QUÉ falló, no «error» a secas', () => {
    const aliados = cargarDeLaApp('guajirago-aliados/src/avisoRechazo.js');
    const m = aliados.motivoDeRechazo({ code: 'unavailable' }, 'reportar el comentario');
    assert.ok((m.titulo + m.texto).includes('reportar el comentario'),
      'el aviso no dice qué se estaba intentando: «' + m.titulo + ' / ' + m.texto + '»');
  });
});

describe('AMARRES · REGLA 9 · la bandeja de rechazos', () => {
  it('los DOS guardarRechazo.js (app y aliados) son el mismo archivo, byte a byte', () => {
    // Son la misma pieza copiada porque los repos no pueden compartir archivo. Si
    // se separan, una app apunta en la bandeja con un formato y la otra con otro,
    // y el candado anti-vertedero deja de valer en una de las dos.
    const app = leer('guajirago/src/guardarRechazo.js');
    const aliados = leer('guajirago-aliados/src/guardarRechazo.js');
    assert.strictEqual(app, aliados,
      'guardarRechazo.js se separó entre la app del pasajero y aliados. Son gemelos: ' +
      'se tocan los dos o ninguno.');
  });

  it('la etiqueta de la clase dice lo mismo en la app que en aliados', () => {
    // La app del pasajero guarda `motivo.clave` y aliados también. Si una dijera
    // 'sinRed' y la otra 'sin_red', la bandeja del panel pintaría la mitad de los
    // rechazos como «no sabemos por qué» sin que nada fallara a la vista.
    const app = cargarDeLaApp('guajirago/src/avisoCalificacion.js');
    const aliados = cargarDeLaApp('guajirago-aliados/src/avisoRechazo.js');

    // En la app, la etiqueta de cada motivo tiene que ser SU PROPIO nombre: si no,
    // el que lee MOTIVOS.permiso se llevaría una etiqueta que dice otra cosa.
    for (const k of Object.keys(app.MOTIVOS)) {
      assert.strictEqual(app.MOTIVOS[k].clave, k,
        'el motivo «' + k + '» de la app lleva la etiqueta «' + app.MOTIVOS[k].clave + '»');
    }
    // Y las tres etiquetas son exactamente las que aliados declara.
    assert.deepStrictEqual(Object.keys(app.MOTIVOS).sort(), [...aliados.CLAVES].sort(),
      'la app y aliados no manejan las mismas clases de fallo');
  });

  it('la etiqueta que se guarda es la MISMA que la del aviso que ve la persona', () => {
    // Sin esto, el usuario podría ver «sin conexión» en su ventanita y la bandeja
    // apuntar «el servidor dijo que no» del mismo suceso. Dos versiones del mismo
    // hecho, y la del dueño sería la falsa.
    const app = cargarDeLaApp('guajirago/src/avisoCalificacion.js');
    const aliados = cargarDeLaApp('guajirago-aliados/src/avisoRechazo.js');
    for (const code of ['permission-denied', 'unavailable', 'deadline-exceeded', 'vete-a-saber']) {
      assert.strictEqual(
        app.motivoDeRechazo({ code }).clave,
        aliados.motivoDeRechazo({ code }, 'hacer algo').clave,
        'con «' + code + '» la app apunta una clase y aliados otra');
    }
  });

  it('la bandeja del panel entiende las MISMAS clases que las apps escriben', () => {
    // El panel traduce la clase a cristiano con una lista suya. Si una app
    // escribiera una clase que esa lista no conoce, el rechazo se pintaría como
    // «no sabemos por qué» — y sí que se sabe.
    const aliados = cargarDeLaApp('guajirago-aliados/src/avisoRechazo.js');
    const pantalla = leer('guajirago-admin/src/Rechazos.js');
    for (const clave of aliados.CLAVES) {
      assert.ok(new RegExp('\\b' + clave + ':').test(pantalla),
        'la bandeja del panel no sabe pintar la clase «' + clave + '»');
    }
  });
});

describe('AMARRES · REGLA 9 · la bandeja: la lista de sitios y el modo de escribir', () => {
  // LA CUARTA COPIA, que era la que nadie vigilaba. La lista de sitios está en
  // TRES sitios —las reglas, guardarRechazo.js y la tabla del panel— y hasta que
  // se escribió esto, cambiar uno y olvidar los otros no lo cazaba nada: el
  // rechazo se negaba en el servidor, o el panel lo pintaba sin traducir.
  const G = (() => {
    const fuente = leer('guajirago/src/guardarRechazo.js').replace(/^import[^;]+;$/gm, '');
    const nombres = [...fuente.matchAll(/^export\s+(?:const|function|async function)\s+([A-Za-z0-9_]+)/gm)]
      .map((m) => m[1]);
    // eslint-disable-next-line no-new-func
    return new Function(fuente.replace(/^export\s+/gm, '') + '\nreturn { ' + nombres.join(', ') + ' };')();
  })();

  it('los TRES lados conocen exactamente los mismos sitios', () => {
    // 1 · lo que escriben las apps
    const enLaApp = [...G.SITIOS].sort();

    // 2 · lo que aceptan las reglas
    const reglas = leer('firestore.rules');
    const trozo = reglas.match(/function sitios\(\)\s*\{\s*return \[([\s\S]*?)\];/);
    assert.ok(trozo, 'las reglas ya no tienen la lista de sitios');
    const enLasReglas = [...trozo[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();

    // 3 · lo que el panel sabe traducir
    const pantalla = leer('guajirago-admin/src/Rechazos.js');
    const tabla = pantalla.match(/const DONDE_EN_CRISTIANO = \{([\s\S]*?)\};/);
    assert.ok(tabla, 'el panel ya no tiene la tabla de sitios');
    const enElPanel = [...tabla[1].matchAll(/'([^']+)':/g)].map((m) => m[1]).sort();

    assert.deepStrictEqual(enLasReglas, enLaApp,
      'las reglas y la app no conocen los mismos sitios: los rechazos de los que sobren '
      + 'se van a NEGAR en el servidor, en silencio');
    assert.deepStrictEqual(enElPanel, enLaApp,
      'el panel no sabe traducir los mismos sitios que escriben las apps: los que falten '
      + 'se van a pintar con el nombre técnico');
  });

  it('los sitios que se pasan en las pantallas están en la lista', () => {
    // Si una pantalla pasa un sitio que no está en la lista, las reglas niegan el
    // apunte y NADIE se entera: guardarRechazo se traga el fallo a propósito.
    const PANTALLAS = [
      'guajirago/src/Calificacion.js',
      'guajirago/src/Restaurantes.js',
      'guajirago-aliados/src/CalificacionesRestaurante.js',
    ];
    let encontrados = 0;
    for (const p of PANTALLAS) {
      for (const m of leer(p).matchAll(/guardarRechazo\('[^']+',\s*'([^']+)'/g)) {
        assert.ok(G.SITIOS.includes(m[1]),
          p + ' apunta en el sitio «' + m[1] + '», que no está en la lista: el servidor '
          + 'lo va a negar y nadie se va a enterar');
        encontrados += 1;
      }
    }
    assert.strictEqual(encontrados, 4, 'esperaba 4 sitios que apuntan y encontré ' + encontrados);
  });

  it('EL QUE MUERDE · el apunte se escribe como las reglas exigen', () => {
    // Estos cuatro renglones son los que hacen que la bandeja FUNCIONE en
    // producción, y ninguno tenía prueba: la segunda opinión rompió los cuatro y
    // las 65 pruebas siguieron verdes. Cada uno deja la bandeja sin apuntar nada,
    // o apuntando mentiras, sin que nada falle a la vista.
    const t = leer('guajirago/src/guardarRechazo.js');
    assert.ok(/veces:\s*increment\(1\)/.test(t),
      'el contador no sube de UNO en uno: las reglas niegan el apunte y no entra nada');
    assert.ok(/ultima:\s*serverTimestamp\(\)/.test(t),
      'la hora no la pone el SERVIDOR: dependería del reloj del teléfono');
    assert.ok(/\{\s*merge:\s*true\s*\}/.test(t),
      'sin merge cada apunte pisa el anterior y el contador se pierde');
    assert.ok(/quienUid:\s*usuario\.uid/.test(t),
      'la firma no es la del que escribe: las reglas van a negar TODOS los apuntes');
  });

  it('EL QUE MUERDE · la pantalla de la bandeja está enchufada al panel', () => {
    // Es la clase de bicho que ya mordió una vez: una pantalla que existe y no se
    // ve. Aquí serían dos formas — sin el botón del menú no se llega, y sin el
    // renglón del render se llega a una pantalla en blanco.
    const s = leer('guajirago-admin/src/Superadmin.js');
    assert.ok(/import Rechazos from '\.\/Rechazos'/.test(s), 'el panel no importa la pantalla');
    assert.ok(/id: 'rechazos'/.test(s), 'la bandeja no tiene botón en el menú: no se llega');
    assert.ok(/seccion === 'rechazos'\) return <Rechazos \/>/.test(s),
      'el botón está pero no pinta nada');
  });

  it('EL QUE MUERDE · la bandeja lee SU colección, entera y por lo más nuevo', () => {
    const t = leer('guajirago-admin/src/Rechazos.js');
    assert.ok(/collection\(db, 'rechazos'\)/.test(t), 'la pantalla está leyendo otra colección');
    assert.ok(/orderBy\('ultima', 'desc'\)/.test(t),
      'no ordena por lo más nuevo: el dueño vería primero lo viejo');
    const tope = t.match(/limit\((\d+)\)/);
    assert.ok(tope && Number(tope[1]) >= 100,
      'el tope de la consulta es demasiado bajo: el dueño solo vería una parte');
  });

  it('la pantalla NO consulta las tablas por índice directo', () => {
    // Con `tabla[texto]` y texto = '__proto__', React revienta la pantalla entera
    // — y como aquí no se borra nada, se quedaría rota para siempre. Lo midió la
    // segunda opinión pintando el componente de verdad. Las reglas ya no dejan
    // escribir ese sitio; esto es el segundo cerrojo.
    const t = leer('guajirago-admin/src/Rechazos.js');
    for (const tabla of ['DONDE_EN_CRISTIANO', 'EN_CRISTIANO', 'APP_EN_CRISTIANO']) {
      assert.ok(!new RegExp(tabla + '\\[').test(t),
        'la pantalla consulta ' + tabla + ' por índice directo: un sitio llamado '
        + '«__proto__» la revienta para siempre');
    }
    assert.ok(/hasOwnProperty\.call/.test(t), 'no está el traductor seguro');
    assert.ok(/new Map\(\)/.test(t), 'el ranking sigue con un objeto en vez de un Map');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LA MUDANZA DE LOS PEDIDOS · que no se quede nadie atrás
// ─────────────────────────────────────────────────────────────────────────────
//  La colección cambió de nombre el 7-sep-2026: `pedidosRestaurantes` → `pedidos`.
//  Son VEINTE sitios en tres repos que no pueden importarse entre sí, más dos
//  disparadores en el servidor. Si UNO se queda con el nombre viejo, no falla
//  nada: lee una carpeta que ahora es una lápida, no encuentra nada, y esa
//  pantalla se queda vacía sin un solo error. Es la peor forma de romperse.
//
//  Estas pruebas son lo único que vigila eso. Cuando la lápida se retire del
//  todo, se quedan igual: siguen diciendo que nadie puede volver al nombre viejo.
describe('LA MUDANZA DE LOS PEDIDOS · ninguna app se queda con el nombre viejo', () => {
  const PANTALLAS = [
    'guajirago/src/Restaurantes.js',
    'guajirago-admin/src/Restaurantes.js',
    'guajirago-aliados/src/App.js',
    'guajirago-aliados/src/CorteCaja.js',
    'guajirago-aliados/src/HistorialDomicilios.js',
    'guajirago-aliados/src/HistorialMesas.js',
    'guajirago-aliados/src/Mesero.js',
    'guajirago-aliados/src/PedidosDomicilio.js',
    'guajirago-aliados/src/ResumenDia.js',
  ];

  PANTALLAS.forEach((archivo) => {
    it(archivo + ' ya no le pide los pedidos a la carpeta vieja', () => {
      const t = leer(archivo);
      // Solo las lecturas y escrituras a la BASE. La ruta del ALMACÉN sigue
      // llamándose `pedidosRestaurantes/` a propósito: esa carpeta tiene CERO
      // archivos y renombrarla es cosmético, va aparte.
      assert.ok(!/\bdb,\s*'pedidosRestaurantes'/.test(t),
        archivo + ' sigue pidiéndole los pedidos a `pedidosRestaurantes`, que ya es una '
        + 'lápida. No falla: se queda vacía y nadie se entera.');
    });
  });

  it('EL QUE MUERDE · alguna pantalla sí pide los pedidos (no se borró la lectura)', () => {
    // Sin esto, la prueba de arriba se quedaría verde si alguien borrara la
    // lectura entera en vez de cambiarle el nombre.
    // EL SUELO ES **TODAS**, y no es exigente de más: las nueve piden pedidos,
    // por eso están en esta lista. Con un suelo flojo («al menos 8») romper una
    // pasaba desapercibido — se cazó con un mutante que le cambiaba el nombre a
    // la colección de UNA pantalla y la prueba seguía verde.
    const sinLectura = PANTALLAS.filter((a) => !/\bdb,\s*'pedidos'/.test(leer(a)));
    assert.deepStrictEqual(sinLectura, [],
      'estas pantallas ya no le piden los pedidos a `pedidos`: ' + sinLectura.join(', ')
      + '. O se movieron de sitio, o alguien borró la lectura en vez de renombrarla — y una '
      + 'pantalla sin lectura se queda vacía sin que nada falle.');
  });

  // Hasta el 9-sep-2026 aquí se exigían DOS disparadores por aviso, uno por
  // carpeta: mientras la mudanza duró, borrar el de la carpeta vieja demasiado
  // pronto habría dejado sin avisar a NADIE un pedido que aún entrara por ahí.
  // Ya no entra ninguno —medido: el último nació el 5-jul-2026— y los dos viejos
  // se retiraron. Ahora esto vigila lo CONTRARIO: que no vuelvan.
  //
  // Y SE MIRA EL `exports.`, NO SOLO LA CADENA. Lo cazó un sabotaje del
  // 9-sep-2026: quitándole el `exports.` al disparador —dejándolo en el archivo,
  // con su misma ruta— deja de desplegarse y NADIE recibe el aviso del pedido
  // nuevo. La versión que buscaba `onDocumentCreated("pedidos/{id}"` a secas
  // seguía verde con ese sabotaje puesto. Una función que no se exporta no
  // existe para Firebase, por muy escrita que esté.
  it('EL QUE MUERDE · queda UN disparador por aviso, EXPORTADO y en la carpeta buena', () => {
    const t = leer('guajirago/functions/index.js');
    for (const escucha of ['onDocumentCreated', 'onDocumentUpdated']) {
      assert.match(t, new RegExp('exports\\.\\w+\\s*=\\s*' + escucha + '\\("pedidos/\\{id\\}"'),
        'ya no hay disparador (' + escucha + ') EXPORTADO escuchando `pedidos`. Sin él, un '
        + 'pedido entra y no le avisa a nadie: el restaurante no se entera y el cliente '
        + 'esperando. Ojo: puede estar escrito y no exportado, que es lo mismo que no estar.');
      assert.ok(!t.includes(escucha + '("pedidosRestaurantes/{id}"'),
        'volvió un disparador (' + escucha + ') escuchando `pedidosRestaurantes`, que es una '
        + 'lápida cerrada desde el 9-sep-2026. Ahí ya no puede entrar nada, así que ese '
        + 'disparador no se ejecutaría nunca — pero sí confunde a quien lea esto, y cuesta '
        + 'dinero tenerlo desplegado.');
    }
  });

  // EL CUERPO SIGUE SUELTO, aunque ya solo lo llame una puerta. Se deja así a
  // propósito: es lo que permitió tener dos puertas sin dos copias, y el día que
  // se renombre otra colección se vuelve a necesitar. Un disparador con el cuerpo
  // pegado dentro obliga a copiarlo, y copiarlo es el gemelo que prohíbe la
  // SEGUNDA LEY: al cambiar el texto del aviso, una copia se queda vieja.
  it('EL QUE MUERDE · el cuerpo sigue suelto, y su puerta lo llama', () => {
    const t = leer('guajirago/functions/index.js');
    for (const cuerpo of ['avisarDelPedidoNuevo', 'avisarAlClienteDelCambio']) {
      const veces = t.split(cuerpo + '(').length - 1;
      assert.strictEqual(veces, 2,
        cuerpo + ' se nombra ' + veces + ' veces y deberían ser 2: su declaración y la '
        + 'puerta que la llama. Si es 1, alguien borró la puerta y el aviso no sale. Si son '
        + 'más, mira si alguien copió el cuerpo en vez de llamarlo.');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LA RUTINA QUE CIERRA VIAJES · que de verdad OBEDEZCA a la calculadora
// ─────────────────────────────────────────────────────────────────────────────
//  `expirarViajesColgados` es una función PROGRAMADA: no se puede encender desde
//  el emulador, así que no hay forma de EJECUTARLA en una prueba. La decisión se
//  sacó a `viajesColgados.cjs` justo para poder probarla —y allí se prueba caso
//  por caso—, pero queda un trozo que solo se puede vigilar leyéndolo: que la
//  rutina LLAME a la calculadora y HAGA CASO de lo que conteste.
//
//  🔴 ESTE AMARRE EXISTE PORQUE UN SABOTAJE SOBREVIVIÓ (10-sep-2026). Se cambió
//  `if (!decision.cerrar) continue;` por `if (false) continue;` —o sea, la
//  rutina cerrando TODOS los viajes que encontrara, incluidos los que van
//  rodando con el pasajero dentro— y las 935 pruebas siguieron verdes. Es
//  exactamente el fallo que este trabajo vino a arreglar, reabierto sin que
//  nada avisara.
describe('LA RUTINA DE VIAJES COLGADOS · obedece a la calculadora', () => {
  /** El cuerpo de `expirarViajesColgados`, sin comentarios. */
  const laRutina = () => {
    const t = soloCodigo(leer('guajirago/functions/index.js'));
    const i = t.indexOf('exports.expirarViajesColgados');
    assert.ok(i >= 0, 'ya no existe `expirarViajesColgados` en functions/index.js.');
    const fin = t.indexOf('exports.', i + 10);
    return t.slice(i, fin > i ? fin : undefined);
  };

  it('la rutina LLAMA a la calculadora', () => {
    const vivo = soloCodigo(leer('guajirago/functions/index.js'));
    assert.match(vivo, /require\(['"]\.\/viajesColgados\.cjs['"]\)/,
      'functions/index.js dejó de importar `viajesColgados.cjs`.');
    assert.match(laRutina(), /queHacerConElViaje\s*\(/,
      'la rutina ya no le pregunta a la calculadora. Si volvió a decidir por su cuenta, '
      + 'volvió a cerrar por reloj sin mirar la fase — y eso cerró 4 viajes con el '
      + 'pasajero montado antes del 10-sep-2026.');
  });

  it('EL QUE MUERDE · y NO escribe si la calculadora dice que no', () => {
    const cuerpo = laRutina();
    // Lo que se mira es que entre la respuesta y la escritura haya un freno de
    // verdad, no que el texto esté por ahí: `if (false) continue` también
    // contiene la palabra `continue`.
    assert.match(cuerpo, /if\s*\(\s*!\s*decision\.cerrar\s*\)\s*continue\s*;/,
      'la rutina ya no se frena cuando la calculadora dice que NO cierre. Sin ese freno '
      + 'cierra todos los viajes que encuentra, incluidos los que van rodando con el '
      + 'pasajero dentro. Es el fallo que se arregló el 10-sep-2026, reabierto.');
    // Y que el freno esté ANTES de la escritura, no después.
    const freno = cuerpo.search(/if\s*\(\s*!\s*decision\.cerrar\s*\)/);
    const escribe = cuerpo.indexOf('.update(');
    assert.ok(freno >= 0 && escribe > freno,
      'la rutina escribe ANTES de mirar si la calculadora dijo que cerrara. El freno tiene '
      + 'que ir delante de la escritura, o no frena nada.');
  });

  it('los límites viven SOLO en la calculadora, no repetidos aquí', () => {
    // Si los minutos se escriben en los dos sitios, el día que se cambie uno el
    // otro se queda viejo — y nadie mira el que no cambió. SEGUNDA LEY.
    //
    // SE MIRAN LOS NOMBRES, NO LOS NÚMEROS, y es a propósito. La primera versión
    // buscaba los propios minutos (20, 60, 180) dentro de la rutina — y la rutina
    // contiene «every 30 minutes», `timeoutSeconds: 300` y `.limit(400)`. El día
    // que el dueño pusiera `buscando: 30` o `rodando: 300`, esta prueba se ponía
    // ROJA sin que nada estuviera mal, y justo en el momento de tocar el número.
    // Una prueba que estorba cuando haces lo correcto acaba desactivada.
    // Lo cazó la segunda opinión del 10-sep-2026.
    const cuerpo = laRutina();
    assert.ok(!/haceMin|limiteEsperando|limiteEnCurso/.test(cuerpo),
      'volvieron los límites escritos a mano dentro de la rutina. Los minutos los decide '
      + '`viajesColgados.cjs` (MINUTOS), y ahí es donde el dueño los cambia.');
    assert.ok(!/\bMINUTOS\b/.test(cuerpo),
      'la rutina volvió a mirar `MINUTOS` por su cuenta. Los límites no se comparan aquí: '
      + 'se le pregunta a `queHacerConElViaje`, que es quien sabe cuál toca según la fase.');
  });

  // ── LOS DOS QUE SE ESCAPARON ─────────────────────────────────────────────
  //  Estos dos amarres existen porque, en la primera vuelta de sabotajes, DOS
  //  sabotajes de la rutina pasaron por delante de los otros cuatro amarres sin
  //  que nada se pusiera rojo. Los encontró la segunda opinión del 10-sep-2026
  //  probándolos a mano, no leyéndolos.
  it('EL QUE MUERDE · escribe el estado QUE DIJO la calculadora, no uno fijo', () => {
    const cuerpo = laRutina();
    assert.match(cuerpo, /estado:\s*decision\.estado/,
      'la rutina volvió a escribir un estado fijo en vez del que decide la calculadora.\n'
      + '   Si escribe siempre «expirado», una búsqueda colgada se marca `expirado` en vez\n'
      + '   de `vencido` — y `limpiezaDiaria` SOLO borra los `vencido`, así que la base\n'
      + '   deja de limpiarse sola. En silencio, como siempre.');
  });

  it('EL QUE MUERDE · mira los DOS estados, no solo las búsquedas', () => {
    const cuerpo = laRutina();
    const lista = cuerpo.match(/for\s*\(\s*const\s+estado\s+of\s*\[([^\]]*)\]/);
    assert.ok(lista, 'la rutina ya no recorre una lista de estados: mírala entera.');
    const estados = lista[1].replace(/["'\s]/g, '').split(',').filter(Boolean).sort();
    assert.deepStrictEqual(estados, ['aceptado', 'esperando'],
      'la rutina consulta estos estados: ' + estados.join(', ') + '\n'
      + '   y tienen que ser los dos: `esperando` (búsquedas colgadas) y `aceptado`\n'
      + '   (viajes que nadie cerró). Si se cae `aceptado`, se apaga el motivo entero\n'
      + '   por el que existe esta rutina y no falla nada: solo deja de limpiar.');
  });

  it('EL QUE MUERDE · y deja huella de por qué cerró (REGLA 9)', () => {
    const cuerpo = laRutina();
    for (const campo of ['expiradoPor', 'motivoExpiracion', 'fechaExpiracion']) {
      assert.ok(cuerpo.includes(campo),
        'la rutina dejó de escribir `' + campo + '`. Antes del 10-sep-2026 un viaje '
        + '«vencido» se cerraba sin dejar rastro, y no había forma de saber si lo cerró '
        + 'la rutina o la app — `Solicitar.js` también escribe ese estado. Si un pasajero '
        + 'reclama «mi viaje se canceló solo», esto es lo único que lo contesta.');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EL BOTÓN DE PÁNICO · que pregunte quién es el viaje en curso, y no lo adivine
// ─────────────────────────────────────────────────────────────────────────────
//  🔴 POR QUÉ EXISTE (11-sep-2026). `Seguridad.js` llevaba escrita a mano la
//  condición de «viaje en curso», y miraba la FASE sin comprobar que el viaje
//  estuviera vivo. Un viaje cancelado o expirado EN MARCHA se queda con su fase
//  pegada, así que entraba.
//
//  MEDIDO contra el servidor (`scripts/medir-panico.cjs`): TRES DE LOS CINCO
//  la base recibían la ruta y la placa de un conductor de un viaje TERMINADO.
//  Aprietas emergencia sin ir en ningún viaje y a tu familia le llega el carro
//  equivocado — justo lo que avisa `firestore.rules`: «buscan el carro que no es».
//
//  La decisión vive ahora en `guajirago/src/estadosViaje.js` y se prueba
//  ejecutándola en `pruebas/viajeActivo.test.js`. Esto vigila que la pantalla la
//  USE, porque volver a escribirla a mano no falla: solo vuelve a mentir.
/**
 * ── EL LECTOR DE LA LLAMADA AL MENSAJE, para los DOS botones ───────────────
 *
 * Busca `const <algo> = armarMensajeDeEmergencia({ ... });` y devuelve en qué
 * variable cae el texto, en qué posición está la llamada, y QUÉ EXPRESIÓN le
 * llega a cada nombre (`desde`, `ubicacion`, `viaje`, `fallo`).
 *
 * VIVE AQUÍ Y NO DOS VECES porque lo usan los dos amarres —el de Ajustes y el
 * del mapa— y copiarlo sería el gemelo que prohíbe la SEGUNDA LEY. (Lo suyo
 * sería `pruebas/cargar.cjs`, pero eso es de las 23 pruebas y pide permiso
 * aparte; aquí dentro, con un solo dueño, basta.)
 *
 * SE EXIGEN LOS CUATRO NOMBRES. Un nombre que falta llega como `undefined` y el
 * mensaje pierde ese trozo entero sin decir nada — que es la rotura que se
 * colaba cuando los datos iban en fila.
 */
function laLlamadaDelMensaje(t, seguro, donde) {
  // 🔴 SE BUSCA DENTRO DEL TROZO QUE SE PASE, NO EN TODO EL ARCHIVO. Quien
  // llama tiene que recortar el cuerpo de SU función. La primera versión
  // miraba el archivo entero, y la segunda opinión la burló dejando la llamada
  // buena en una función SEÑUELO al final del archivo mientras el botón
  // volvía a armar el texto a mano con la plaza dentro: 90 pruebas en verde y
  // al familiar le llegaba el centro de Riohacha.
  const m = /(?:const|let|var)\s+(\w+)\s*=\s*armarMensajeDeEmergencia\s*\(\s*\{([\s\S]*?)\}\s*\)\s*;/
    .exec(seguro);
  assert.ok(m, 'no encuentro en ' + donde + ' una llamada `const <algo> = '
    + 'armarMensajeDeEmergencia({ desde, ubicacion, viaje, fallo });`. O se armó el texto '
    + 'por otro lado —y entonces no hay forma de probar lo que le llega al familiar— o el '
    + 'texto ya no se guarda para mandarlo.');

  // LA POSICIÓN se busca en el texto SIN CADENAS —así ninguna llave ni coma
  // dentro de un texto descuadra el reparto—, pero LOS VALORES se cortan del
  // ORIGINAL, porque `desde: 'ajustes'` es una cadena y sin cadenas llega como
  // `'xxxxxxx'`. `sinTextos` deja la misma longitud, así que las posiciones
  // valen para los dos. (Esto ya dio un rojo falso una vez.)
  const desdeLlave = m.index + m[0].indexOf('{') + 1;
  const cuerpoObjeto = t.slice(desdeLlave, desdeLlave + m[2].length);

  // Partir el objeto por las comas de PRIMER nivel: dentro puede haber un
  // ternario con paréntesis, o otro objeto.
  const trozos = [];
  let hondo = 0;
  let actual = '';
  for (const c of cuerpoObjeto) {
    if (c === ',' && hondo === 0) { trozos.push(actual); actual = ''; continue; }
    if (c === '(' || c === '{' || c === '[') hondo += 1;
    if (c === ')' || c === '}' || c === ']') hondo -= 1;
    actual += c;
  }
  trozos.push(actual);

  const campos = {};
  for (const trozo of trozos) {
    const limpio = trozo.trim();
    if (!limpio) continue;
    const dosPuntos = limpio.indexOf(':');
    if (dosPuntos < 0) campos[limpio] = limpio;               // forma corta: `fallo`
    else campos[limpio.slice(0, dosPuntos).trim()] = limpio.slice(dosPuntos + 1).trim();
  }

  for (const nombre of ['desde', 'ubicacion', 'viaje', 'fallo']) {
    assert.ok(campos[nombre] !== undefined,
      'la llamada de ' + donde + ' ya no le pasa «' + nombre + '» al mensaje. Lo que falta '
      + 'llega como `undefined` y el mensaje se queda SIN ESE TROZO, sin decirlo: sin '
      + '`viaje` desaparece la ficha del carro entera, y sin `fallo` el mensaje vuelve a '
      + 'callarse cuando no se pudo comprobar nada.');
  }

  // 🔴 Y QUE NO SEAN UN VALOR MUERTO. Que el nombre esté no basta: `viaje: null`
  // y `viaje: {}` pasaban la comprobación de arriba y dejaban al familiar sin
  // ruta y sin ficha del carro, con todo en verde; y `fallo: null` devolvía al
  // mensaje su silencio. Es LA MISMA rotura que se cerró cuando los datos iban
  // en fila —la segunda opinión la metió cambiando el del medio por `null`— y
  // se había reabierto al pasar a nombres. Lo cazó la segunda opinión otra vez.
  for (const nombre of ['viaje', 'fallo', 'ubicacion']) {
    const v = campos[nombre].trim();
    assert.ok(!/^(?:null|undefined|''|""|\{\s*\}|0|false)$/.test(v),
      'la llamada de ' + donde + ' le pasa «' + nombre + ': ' + v + '» al mensaje, que es '
      + 'un valor muerto: el nombre está pero no lleva nada dentro. Sin `viaje` de verdad '
      + 'el familiar se queda sin la ruta y sin la ficha del carro; sin `fallo` de verdad '
      + 'el mensaje vuelve a callarse cuando no se pudo comprobar; sin `ubicacion` no sabe '
      + 'dónde está nadie. Y nada de eso falla con estruendo: el mensaje sale más corto.');
  }
  return { varTexto: m[1], campos, index: m.index, largo: m[0].length };
}

/**
 * ── EL ENVÍO · que el mensaje SALGA, y salga ÉSE ────────────────────────────
 *
 * Las mismas tres comprobaciones para los dos botones. Estaban escritas solo
 * para el de Ajustes, y la segunda opinión del 12-sep-2026 midió lo que eso
 * costaba en el del mapa —el que de verdad se aprieta—: tres roturas de un
 * renglón, las tres con 90 pruebas en verde.
 *   · quitarle la asignación al enlace  → al familiar no le llega NADA
 *   · `?text=hola` en vez del texto      → le llega «hola»
 *   · quitarle la llamada al `onClick`   → el botón no hace nada
 * Copiar las comprobaciones de un botón y no del otro es justo lo que la
 * SEGUNDA LEY avisa que pasa siempre: una de las dos se queda vieja.
 */
function elEnvioDelMensaje(cuerpo, varTexto, donde) {
  const plantillas = (cuerpo.match(/`[^`]*`/g) || []).filter((x) => x.includes('wa.me'));
  assert.ok(plantillas.length >= 1,
    donde + ' no arma ningún enlace de WhatsApp. El mensaje no sale de la pantalla, y las '
    + 'pruebas del texto siguen verdes porque el texto está bien armado: al familiar no le '
    + 'llega NADA.');
  // TODOS los enlaces tienen que llevar ESE texto, no «uno de ellos». El botón
  // del mapa arma DOS a propósito —con destinatario y sin él, según haya
  // contacto guardado—, así que exigir «uno solo» era un rojo falso. Lo que no
  // puede pasar es que alguno lleve otra cosa: `?text=hola` dejaba 90 pruebas
  // en verde y al familiar le llegaba «hola».
  const conElTexto = new RegExp('encodeURIComponent\\s*\\(\\s*' + varTexto + '\\s*\\)');
  plantillas.forEach((plantilla, n) => {
    assert.ok(conElTexto.test(plantilla),
      'el enlace de WhatsApp número ' + (n + 1) + ' de ' + donde + ' no lleva «' + varTexto
      + '», el texto que arma el archivo probado, sino otra cosa: ' + plantilla.slice(0, 70)
      + '… Las pruebas del mensaje seguirían mirando un texto que nadie envía.');
  });
  const abre = (cuerpo.match(/window\.open\s*\(|window\.location\.href\s*=/g) || []).length;
  assert.strictEqual(abre, 1,
    donde + ' abre el enlace ' + abre + ' veces, y debería ser UNA. Si se dejó de abrir '
    + '—guardándolo en una variable, o copiándolo al portapapeles— el familiar NO RECIBE '
    + 'NADA, y las pruebas del texto siguen verdes porque el texto está bien armado.');

  // ── 3 · NADIE REESCRIBE EL TEXTO DESPUÉS DE ARMARLO ──────────────────────
  //  Esta comprobación existía SOLO en el amarre de Ajustes. Sacar la función
  //  compartida y dejarla fuera fue repetir el error que la función venía a
  //  cerrar: la segunda opinión devolvió el fallo original con una línea —
  //  `const` → `let` y detrás `texto = armar({... ubicacion: ubicacionPasajero
  //  ...})`— y al familiar le volvió a llegar la plaza, con todo en verde.
  const laLlamada = new RegExp('=\\s*armarMensajeDeEmergencia');
  const trasArmar = cuerpo.slice(cuerpo.search(laLlamada) + 1);
  assert.ok(!new RegExp('(?:^|[^.\\w=!<>])' + varTexto + '\\s*=[^=]').test(trasArmar),
    'después de armarlo, ' + donde + ' vuelve a escribir «' + varTexto + '». El mensaje que '
    + 'se manda ya no es el que se armó y se probó: con un solo renglón se le puede volver a '
    + 'meter la ubicación sin filtrar —la plaza— o recortarlo entero, y ninguna prueba del '
    + 'texto se entera.');

  // ── 4 · Y LO QUE SE ABRE ES ESE ENLACE, no una cadena pegada a mano ──────
  //  Las plantillas de arriba pueden estar perfectas y no usarse: la segunda
  //  opinión dejó `url` sin tocar y puso
  //  `window.open('https://wa.me/' + numeroFinal + '?text=' + encodeURIComponent('hola'))`.
  //  Al familiar le llegaba «hola». Así que se mira QUÉ RECIBE `window.open`.
  //  Se cuentan paréntesis para sacar el PRIMER argumento entero: cortar en el
  //  primer `)` partía la plantilla de Ajustes por la mitad —lleva un
  //  `encodeURIComponent(...)` dentro— y daba un rojo falso en código bueno.
  const arranque = /window\.(?:open|location\.href)\s*(\(|=)/.exec(cuerpo);
  assert.ok(arranque, 'no pude leer qué abre ' + donde + '.');
  let abierto;
  if (arranque[1] === '=') {
    abierto = cuerpo.slice(arranque.index + arranque[0].length).split(';')[0];
  } else {
    let i = arranque.index + arranque[0].length;
    let hondo = 1;
    let coma = -1;
    for (; i < cuerpo.length && hondo > 0; i += 1) {
      const c = cuerpo[i];
      if (c === '(' || c === '[' || c === '{') hondo += 1;
      else if (c === ')' || c === ']' || c === '}') hondo -= 1;
      else if (c === ',' && hondo === 1 && coma < 0) coma = i;
    }
    const fin = coma > 0 ? coma : i - 1;
    abierto = cuerpo.slice(arranque.index + arranque[0].length, fin);
  }
  abierto = abierto.trim();
  const esUnaVariable = /^\w+$/.test(abierto);
  assert.ok(esUnaVariable || conElTexto.test(abierto),
    donde + ' abre «' + abierto.slice(0, 60) + '», que no es el enlace que armó ni lleva «'
    + varTexto + '» dentro. Las plantillas de arriba pueden estar perfectas y no usarse: se '
    + 'puede dejar el enlace bueno sin tocar y abrir otro pegado a mano con cualquier texto.');
  if (esUnaVariable) {
    // Si abre una variable, se SIGUE LA CADENA hasta el enlace: pasar la URL
    // por una variable intermedia —`const destino = url;`— es código normal, y
    // exigir el `wa.me` pegado a la primera daba rojo falso. Tres saltos bastan
    // y evitan dar vueltas para siempre si alguien escribe `a = b; b = a`.
    let nombre = abierto;
    let llega = false;
    const vistos = new Set();
    for (let salto = 0; salto < 3 && !llega; salto += 1) {
      if (vistos.has(nombre)) break;
      vistos.add(nombre);
      const def = new RegExp('(?:const|let|var)\\s+' + nombre + '\\s*=([\\s\\S]{0,400}?);')
        .exec(cuerpo);
      if (!def) break;
      if (/wa\.me/.test(def[1])) { llega = true; break; }
      const otra = /^\s*([A-Za-z_$][\w$]*)\s*$/.exec(def[1]);
      if (!otra) break;
      nombre = otra[1];
    }
    assert.ok(llega,
      donde + ' abre la variable «' + abierto + '», y siguiéndola no se llega a ningún enlace '
      + 'de WhatsApp. El enlace bueno se queda sin usar y se manda otra cosa: al familiar le '
      + 'puede llegar cualquier texto, o nada.');
  }
}

describe('EL BOTÓN DE PÁNICO · usa la fuente única del viaje en curso', () => {
  const laPantalla = () => soloCodigo(leer('guajirago/src/Seguridad.js'));

  it('Seguridad.js le pregunta a estadosViaje.js', () => {
    const t = laPantalla();
    assert.match(t, /import\s*\{[^}]*elViajeEnCurso[^}]*\}\s*from\s*['"]\.\/estadosViaje['"]/,
      'Seguridad.js dejó de importar `elViajeEnCurso` de estadosViaje.js. Si volvió a '
      + 'decidir por su cuenta qué es un viaje en curso, volvió a poder mandar los datos '
      + 'de un viaje terminado.');
    assert.match(t, /elViajeEnCurso\s*\(/,
      'Seguridad.js importa `elViajeEnCurso` y no la llama.');
  });

  it('EL QUE MUERDE · y NO vuelve a mirar la fase por su cuenta', () => {
    const t = laPantalla();
    // Lo que reventó fue mirar la `fase` para decidir si el viaje estaba vivo.
    //
    // SE PROHÍBE LA PALABRA ENTERA, no «.fase». La primera versión miraba
    // `/\.fase\b/` y se esquivaba escribiendo `v['fase']` — lo mismo con otra
    // ortografía. El revisor lo hizo el 11-sep-2026: metió el fallo original
    // entero y los tres amarres siguieron VERDES. Medido: en el código bueno la
    // palabra `fase` no aparece ni una vez, así que prohibirla entera no da
    // falso rojo. Un amarre que protege la ortografía y no la idea es adorno.
    assert.ok(!/fase/.test(t),
      'Seguridad.js volvió a nombrar la `fase` del viaje. La fase dice en qué PUNTO va un '
      + 'viaje vivo; NO dice si está vivo. Un viaje cancelado en marcha se queda con su '
      + 'fase pegada, y por ahí entraban los 7 viajes terminados que se midieron el '
      + '11-sep-2026. Si de verdad hace falta la fase aquí, mira antes por qué.');
    assert.ok(!/includes\s*\(\s*v\.estado\s*\)/.test(t),
      'Seguridad.js volvió a llevar su propia lista de estados. Esa lista vive en '
      + 'estadosViaje.js, y allí hay pruebas que la ejecutan.');
  });

  // AQUÍ HABÍA UN AMARRE DE TEXTO que buscaba el encabezado «DATOS DEL
  // CONDUCTOR» dentro de `Seguridad.js` y comprobaba que estuviera detrás de un
  // `if (...conductorId)`. El 12-sep-2026 ese texto se mudó al archivo puro
  // `mensajeEmergencia.js`, y allí hay algo MEJOR: una prueba que lo EJECUTA y
  // mira el mensaje que de verdad sale
  // (`pruebas/mensajeEmergencia.test.js`, «sin conductor va la ruta, y NO el
  // encabezado del conductor»).
  //
  // No se deja el de texto además del de ejecución: dos pruebas de la misma cosa
  // es el gemelo que prohíbe la SEGUNDA LEY, y la que sobrevive es la que
  // ejecuta. Lo que sí queda vigilado, más abajo, es que la pantalla SIGA usando
  // ese archivo Y le pase los tres datos, porque volver a armarlo a mano no
  // falla: solo deja la regla sin nadie que la pruebe.
  //
  // (Y aquí puse además un segundo «no vuelva a mirar la fase», copiado del que
  //  está 32 renglones más arriba. Cobertura nueva: CERO — el mismo sabotaje
  //  ponía rojos a los dos. Lo cazó la segunda opinión, y era un gemelo justo
  //  debajo de un comentario que invoca la SEGUNDA LEY para borrar otro gemelo.)

  // ── REGLA 9 · QUE NADA SE CALLE EN ESTA PANTALLA ─────────────────────────
  //  «Nada se rechaza en silencio.» El 12-sep-2026 esta pantalla tenía DOS
  //  `catch` vacíos —cargar el contacto guardado, y buscar el viaje en curso— y
  //  el del viaje era el grave: el mensaje salía sin ruta ni conductor y quien
  //  lo recibía no podía distinguir «no iba en ningún viaje» de «no se pudo
  //  comprobar».
  //
  //  🔴 Y OJO AL NOMBRE, QUE LO TUVE MAL TODO EL DÍA: `Seguridad.js` es el
  //  compartir ubicación de AJUSTES, el preventivo. El botón de pánico de
  //  verdad es el 🚨 rojo del mapa, que arma su propio mensaje a mano en
  //  `Solicitar.js` (`compartirSeguridad`). Llamar «de pánico» a esta
  //  pantalla es lo que mantuvo al otro invisible. Está anotado como deuda.
  it('EL QUE MUERDE · ningún `catch` de la pantalla de Seguridad se queda callado', () => {
    const t = soloCodigo(leer('guajirago/src/Seguridad.js'));
    // Se parte por cada `catch` y se mira si dentro hay algo que avise. Un
    // `catch (e) {}` no avisa a nadie: la pantalla sigue como si todo hubiera
    // ido bien.
    //
    // 🔴 LAS LLAVES SE CUENTAN SOBRE EL TEXTO SIN CADENAS (`sinTextos`), y esto
    // NO es una precaución teórica: la primera versión las contaba a pelo y la
    // segunda opinión la cegó con UN RENGLÓN dentro del catch:
    //       } catch (e) { console.log('no pude leer el contacto {{{'); }
    // Con esas tres llaves sueltas dentro de un texto, el recorrido dejaba de
    // ver TRES catch y veía UNO de 8.456 letras —se tragaba el resto del
    // componente, encontraba allí dentro cualquier `setError` y lo daba por
    // «avisa»—, así que los otros dos, INCLUIDO EL GRAVE, no se miraban nunca.
    // El amarre seguía verde con el arreglo deshecho.
    //
    // `sinTextos` deja la MISMA longitud, así que los índices siguen cuadrando
    // y el cuerpo se corta del original, con sus textos dentro.
    const seguro = sinTextos(t);
    const vacios = [];
    const cuerpos = [];
    // BLOQUES `catch (...) {`, no la palabra a secas: un `.catch(avisar)` no
    // lleva llave, y buscando la palabra el contador se agarraba una llave de
    // más adelante y daba ROJO FALSO en código correcto.
    const BLOQUE = /\bcatch\s*(?:\([^)]*\))?\s*\{/g;
    let m;
    while ((m = BLOQUE.exec(seguro)) !== null) {
      const i = m.index;
      const abre = i + m[0].length - 1;
      let hondo = 0, j = abre;
      for (; j < seguro.length; j++) {
        if (seguro[j] === '{') hondo++;
        else if (seguro[j] === '}') { hondo--; if (hondo === 0) break; }
      }
      const cuerpo = t.slice(abre + 1, j);
      // QUÉ CUENTA COMO «AVISAR», y esto lo apretó la segunda opinión del
      // 12-sep-2026, que encontró TRES formas de callarse con el amarre verde:
      //   · `console.error(e)` — un log NO avisa: el pasajero no abre la
      //     consola. La REGLA 9 dice que se entere el AFECTADO.
      //   · `setError('')` — la cadena vacía no pinta nada (`:181` pinta con
      //     `error &&`). Mudo total.
      //   · `setMensaje('Listo ✅')` — peor: pinta en VERDE DE ÉXITO un fallo.
      // Así que se exige un texto de VERDAD dentro, y que no sea de éxito.
      // Y SE ACEPTA LA VENTANITA, que es como manda avisar el dueño («todos los
      // avisos al usuario son modales»). Exigiendo solo `setError` se daba rojo
      // a un catch que avisa BIEN con un modal. Lo cazó la segunda opinión.
      const avisaAlPasajero = /setError\s*\(\s*['"][^'"]{10,}/.test(cuerpo)
        || /set(?:Aviso|Modal)\s*\(\s*\{[^}]*texto\s*:\s*['"][^'"]{10,}/.test(cuerpo);
      const marcaElFallo = /fallo\s*(?:\|\|)?=[^;]*'[a-z]+'/.test(cuerpo);
      const vaALaBandeja = /guardarRechazo\s*\(/.test(cuerpo);
      if (!(avisaAlPasajero || marcaElFallo || vaALaBandeja)) {
        vacios.push('renglón ~' + t.slice(0, i).split('\n').length);
      }
      cuerpos.push(cuerpo);
      BLOQUE.lastIndex = j + 1;
    }

    // ── Y QUE EL RECORRIDO NO SE HAYA CEGADO ────────────────────────────────
    // Lo de arriba solo vale si el recorrido vio TODOS los catch. Un contador
    // que se sale de sitio no falla: mira menos y sigue verde, que es la peor
    // forma de fallar. Así que se comprueba el propio contador:
    //   · encontró tantos cuerpos como bloques `catch (...) {` hay, y
    //   · ninguno es absurdamente largo (un catch de esta pantalla son 1 o 2
    //     renglones; 1.500 letras significa que se tragó media pantalla).
    const cuantosCatch = (seguro.match(/\bcatch\s*(?:\([^)]*\))?\s*\{/g) || []).length;
    assert.strictEqual(cuerpos.length, cuantosCatch,
      'el recorrido de los `catch` se descuadró: hay ' + cuantosCatch + ' bloques `catch {` '
      + 'y solo se miraron ' + cuerpos.length + ' cuerpos. Un contador que mira de '
      + 'menos SIGUE VERDE con el arreglo roto, así que esto es rojo a propósito.');
    const gordo = cuerpos.find((c) => c.length > 1500);
    assert.strictEqual(gordo, undefined,
      'un `catch` de esta pantalla salió con ' + (gordo || '').length + ' letras dentro. '
      + 'Los de aquí son de uno o dos renglones: esto quiere decir que el contador de llaves '
      + 'se salió del catch y se tragó media pantalla — y entonces los DEMÁS catch ya no se '
      + 'miran. Pasó una vez con tres llaves dentro de un texto.');

    assert.deepStrictEqual(vacios, [],
      'estos `catch` de Seguridad.js no avisan de nada: ' + vacios.join(', ') + '\n'
      + '   Es la pantalla que le manda tu ubicación a tu contacto de confianza. Un fallo '
      + 'callado aquí sale como un mensaje de emergencia incompleto, y quien lo recibe no '
      + 'sabe que falta algo.\n'
      + '   REGLA 9 del dueño: nada se rechaza en silencio.');
  });

  // ── SEGUNDA LEY · EL MISMO CRITERIO, EN LOS DOS SITIOS ───────────────────
  //  El recorrido de arriba está escrito DOS VECES: aquí y en el guion del paso
  //  1/12, `scripts/medir-silencios-seguridad.cjs`. El sitio bueno sería
  //  `pruebas/cargar.cjs` —los dos repos ya lo comparten— pero ese archivo no
  //  estaba en la foto de este trabajo y mudarlo pide permiso aparte. Está
  //  anotado en la tabla de deuda de CLAUDE.md.
  //
  //  Mientras sean dos, esto es lo que los mantiene juntos. Y no es teórico: se
  //  separaron EL MISMO DÍA que nacieron —el guion daba por bueno un
  //  `console.error` y aquí está prohibido—, así que el guion decía «avisa»
  //  donde el amarre decía «MUDO». Un contador que miente en verde es peor que
  //  no tener contador: el paso 12 lo habría dado por bueno. Lo cazó la segunda
  //  opinión del 12-sep-2026.
  it('EL QUE MUERDE · el guion del paso 1 y este amarre miden «avisar» IGUAL', () => {
    const guion = leer('scripts/medir-silencios-seguridad.cjs');
    assert.ok(guion, 'ya no está scripts/medir-silencios-seguridad.cjs, que es el guion del '
      + 'paso 1 y el que vuelve a correr el paso 12.');
    // ── EL CRITERIO · los tres patrones, tal cual están arriba ─────────────
    [
      ["/setError\\s*\\(\\s*['\"][^'\"]{10,}/", 'el texto de verdad en pantalla'],
      ["/set(?:Aviso|Modal)\\s*\\(\\s*\\{[^}]*texto\\s*:\\s*['\"][^'\"]{10,}/", 'la ventanita'],
      ["/fallo\\s*(?:\\|\\|)?=[^;]*'[a-z]+'/", 'la marca del fallo para el mensaje'],
      ['/guardarRechazo\\s*\\(/', 'la bandeja de rechazos'],
    ].forEach(([patron, queEs]) => {
      assert.ok(guion.includes(patron),
        'el guion del paso 1 ya no mide «avisar» como este amarre: le falta el patrón de ' +
        queEs + ' (' + patron + '). Los dos cuentan el MISMO proceso, así que uno de los ' +
        'dos está mintiendo — y el que miente es el que nadie mira. Pon los dos iguales, o ' +
        'saca el recorrido a pruebas/cargar.cjs (pide permiso: lo usan 23 archivos).');
    });

    // ── Y EL RECORRIDO, que es lo que de verdad se separó la segunda vez ────
    //  La primera versión de esta prueba solo miraba los patrones de arriba, y
    //  la segunda opinión lo midió: se le podía quitar el `sinTextos` al guion
    //  —dejándolo ciego a una llave dentro de un texto— y esto seguía verde.
    //  O sea que la prueba escrita para impedir que se separaran no miraba la
    //  mitad que se había separado. Ahora mira las dos.
    [
      ['sinTextos(texto)', 'cuenta las llaves sobre el texto SIN CADENAS (si no, un '
        + '`console.log(\'algo { raro\')` lo ciega y mira de menos)'],
      ['/\\bcatch\\s*(?:\\([^)]*\\))?\\s*\\{/', 'busca BLOQUES `catch {`, no la palabra suelta '
        + '(un `.catch(avisar)` no lleva llave y descuadraba la cuenta)'],
      ['fuera.descuadre', 'avisa cuando su propia cuenta no cuadra, en vez de dar un número '
        + 'más bajo y quedarse tan tranquilo'],
    ].forEach(([trozo, queHace]) => {
      assert.ok(guion.includes(trozo),
        'al guion del paso 1 le falta «' + trozo + '»: ya no ' + queHace + '. Este amarre y '
        + 'ese guion recorren los `catch` de la MISMA pantalla, y si uno se ciega da un '
        + 'número tranquilizador que nadie va a dudar — el paso 12 lo daría por bueno.');
    });
  });

  it('EL QUE MUERDE · el texto del mensaje se arma APARTE, no a mano en la pantalla', () => {
    const t = soloCodigo(leer('guajirago/src/Seguridad.js'));
    assert.match(t, /import\s*\{[^}]*armarMensajeDeEmergencia[^}]*\}\s*from\s*['"]\.\/mensajeEmergencia['"]/,
      'Seguridad.js dejó de importar `armarMensajeDeEmergencia`. Si volvió a armar el '
      + 'texto a mano dentro del componente, ya no hay forma de PROBAR lo que de verdad '
      + 'le llega al familiar: `pruebas/cargar.cjs` no puede cargar un componente de '
      + 'React, y por eso ese texto vive en un archivo puro.');
    assert.ok(!/texto\s*\+=/.test(t),
      'Seguridad.js volvió a pegar trozos del mensaje a mano (`texto +=`). Ese texto se '
      + 'arma en mensajeEmergencia.js, donde hay pruebas que lo ejecutan.');
  });

  it('EL QUE MUERDE · y el mensaje distingue «no hay viaje» de «no se pudo comprobar»', () => {
    // El amarre de verdad está en pruebas/mensajeEmergencia.test.js, que EJECUTA
    // el armado. Esto vigila lo otro: que la pantalla siga PASÁNDOLE el aviso de
    // fallo. Sin eso, el archivo puro nunca se enteraría y el mensaje volvería a
    // callarse — con todas las pruebas del otro archivo en verde.
    // ── SE SIGUE LA TUBERÍA ENTERA, NO SE BUSCAN CADENAS SUELTAS ───────────
    //  La primera versión miraba que ciertos textos ESTUVIERAN en el archivo, y
    //  la segunda opinión del 12-sep-2026 la esquivó TRES veces, cada una
    //  dejando el mensaje otra vez callado con los 67 amarres en verde:
    //    · `fallo = null;` metido en el renglón de ANTES de la llamada.
    //    · `let t2 = armar...(); t2 = t2.split(...)[0]; const texto = t2;`
    //      —la llamada intacta, y al familiar le llega solo el encabezado.
    //    · `fallo = 'nada';` en el catch, y un señuelo `let fallo = 'viaje'`
    //      dentro de otra función para que la cadena siguiera apareciendo.
    //  Lo que las tres tienen en común: la CADENA seguía en el archivo. Así que
    //  esto ya no busca cadenas sueltas. Comprueba SEIS cosas de la plomería:
    //  de dónde salen los tres datos, que el catch que marca el fallo sea el que
    //  envuelve la consulta, que no haya un `try` dentro de ese `try`, que el
    //  mensaje se arme DESPUÉS, que nadie pise el aviso ni el texto en medio, y
    //  que el enlace que se abre lleve ese texto y no otro.
    //
    //  Y lo que NO comprueba, dicho aquí para que nadie se confíe: esto lee el
    //  código, no ejecuta la pantalla. Un React que no llame a esta función, o
    //  un `if` alrededor del botón, se le escapan. Las pruebas que EJECUTAN
    //  están en pruebas/mensajeEmergencia.test.js, y solo ven el texto.
    //
    //  De paso deja de exigir los nombres literales `ubicacion/viajeActivo/
    //  fallo`: los saca del propio código, así que renombrar una variable ya no
    //  da un rojo falso. Lo que se vigila es la PLOMERÍA, no los nombres.
    const archivo = soloCodigo(leer('guajirago/src/Seguridad.js'));
    // SOLO EL CUERPO DE `compartirUbicacion`. Mirar el archivo entero dejaba
    // pasar un señuelo: la llamada perfecta en otra función y el botón armando
    // el texto a mano. Lo midió la segunda opinión en el botón gemelo.
    const arranca = archivo.indexOf('const compartirUbicacion');
    assert.ok(arranca >= 0, 'ya no existe `compartirUbicacion` en Seguridad.js. Si se '
      + 'renombró, hay que cambiarlo aquí, que es lo único que la vigila.');
    const laSuya = cuerpoDeLaFuncion(archivo, arranca);
    assert.ok(laSuya, 'no pude leer el cuerpo de `compartirUbicacion`.');
    const t = laSuya.texto;
    const seguro = sinTextos(t);

    // 1 · LA LLAMADA: de dónde sale cada dato y dónde cae el texto.
    //     Se lee la forma CON NOMBRES —`armar({ desde, ubicacion, viaje, fallo })`—
    //     y se comprueba que estén los cuatro. Un dato que falta llega como
    //     `undefined` y el mensaje pierde ese trozo ENTERO sin decir nada: es
    //     exactamente la rotura que la segunda opinión metió cambiando el
    //     argumento del medio por `null` cuando los datos iban en fila.
    const llamada = laLlamadaDelMensaje(t, seguro, 'Seguridad.js');
    const { varTexto, campos } = llamada;
    const varViaje = campos.viaje;
    const varFallo = campos.fallo;
    assert.strictEqual(campos.desde, "'ajustes'",
      'Seguridad.js ya no dice que su mensaje viene de «ajustes» (dice «' + campos.desde
      + '»). Ese nombre elige el encabezado: al familiar le llegaría el texto del OTRO '
      + 'botón, diciendo EMERGENCIA cuando esto es el compartir preventivo.');
    assert.notStrictEqual(varViaje, varFallo,
      'el viaje y el fallo llegan al mensaje en la MISMA variable. Son las dos cosas que hay '
      + 'que distinguir: «no iba en ningún viaje» y «no se pudo comprobar».');

    // 2 · EL CATCH DEL VIAJE marca ese mismo `fallo`. No vale que la cadena
    //     aparezca en cualquier rincón del archivo: tiene que estar DENTRO.
    // SE BUSCAN BLOQUES `catch (...) {`, NO LA PALABRA A SECAS. Un
    // `.catch(avisarDelFallo)` —estilo legítimo, y cargar.cjs lo documenta en
    // AppConductor.js— no lleva llave detrás, así que buscando `catch` a pelo
    // el contador se iba a agarrar una llave de más adelante y daba ROJO FALSO
    // en código correcto. Un rojo falso se acaba «arreglando» borrando la
    // prueba. Lo cazó la segunda opinión.
    const BLOQUE = /\bcatch\s*(?:\([^)]*\))?\s*\{/g;
    const cuerpos = [];
    let m;
    BLOQUE.lastIndex = 0;
    while ((m = BLOQUE.exec(seguro)) !== null) {
      const abre = m.index + m[0].length - 1;
      let hondo = 0, j = abre;
      for (; j < seguro.length; j++) {
        if (seguro[j] === '{') hondo++;
        else if (seguro[j] === '}') { hondo--; if (hondo === 0) break; }
      }
      cuerpos.push({ desde: m.index, cuerpo: t.slice(abre + 1, j), fin: j });
      BLOQUE.lastIndex = j + 1;
    }
    // EL CENTINELA LO DICE EL ARCHIVO DEL MENSAJE, no esta prueba. Los dos
    // lados tienen que estar de acuerdo en la palabra, y ése es el contrato
    // (SEGUNDA LEY): si uno la cambia, esto se pone rojo. Escrita a mano aquí,
    // se podía marcar `fallo = 'nada'` —que el mensaje no reconoce— y el amarre
    // seguía verde, porque cualquier palabra en minúsculas le valía.
    const puro = soloCodigo(leer('guajirago/src/mensajeEmergencia.js'));
    const centinela = /fallo\s*===\s*'([a-z]+)'/.exec(puro);
    assert.ok(centinela,
      'mensajeEmergencia.js ya no compara `fallo` con ninguna palabra, así que el aviso de '
      + '«no se pudo comprobar» no puede salir nunca, diga lo que diga la pantalla.');
    // Se acepta `= 'viaje'`, `||= 'viaje'` y `= algo ? 'viaje' : null`: las tres
    // marcan el fallo igual, y exigir solo la primera daba rojo falso.
    const marca = new RegExp('(?:^|[^.\\w])' + varFallo + "\\s*(?:\\|\\|)?=[^;]*'"
      + centinela[1] + "'");
    const elDelViaje = cuerpos.find((c) => marca.test(c.cuerpo));
    assert.ok(elDelViaje,
      'ningún `catch` de Seguridad.js marca «' + varFallo + " = '" + centinela[1] + "'», que "
      + 'es la palabra que el mensaje reconoce. La pantalla dejó de avisarle al mensaje que '
      + 'la consulta del viaje se cayó, así que el mensaje vuelve a salir sin ruta ni '
      + 'conductor SIN DECIRLO — el fallo que este trabajo vino a cerrar. (Y se mira DENTRO '
      + 'del catch a propósito: la primera versión aceptaba la cadena en cualquier rincón '
      + 'del archivo.)');

    // 2b · Y ESA VARIABLE SE DECLARA UNA SOLA VEZ. El escape era meter dentro
    //      del catch un señuelo —`const pin = () => { let fallo = 'viaje'; }`—
    //      para que la palabra apareciera mientras el `fallo` de verdad se
    //      marcaba con otra. Dos declaraciones del mismo nombre en una función
    //      son eso: una tapando a la otra.
    const declaraciones = (seguro.match(
      new RegExp('\\b(?:let|const|var)\\s+' + varFallo + '\\b', 'g')) || []).length;
    assert.strictEqual(declaraciones, 1,
      '«' + varFallo + '» se declara ' + declaraciones + ' veces en Seguridad.js, y debería '
      + 'ser una. Una segunda declaración con el mismo nombre tapa a la primera: la de dentro '
      + 'puede llevar la palabra buena mientras la que de verdad viaja al mensaje lleva otra.');

    // 2c · Y ES EL CATCH QUE ENVUELVE LA CONSULTA, no otro cualquiera.
    //      Dos escapes medidos vivían aquí:
    //        · UN `try` DENTRO DEL `try`, con su propio catch que solo hace
    //          `setError`. El catch de fuera —el que marca el fallo— no se
    //          dispara nunca, y el familiar recibe el mensaje de ANTES del
    //          arreglo: sin ruta, sin conductor y sin aviso.
    //        · Mover la marca al catch de cargar el contacto y sacar `fallo` al
    //          módulo, para que siguiera habiendo UNA sola declaración.
    //      Los dos dejaban todo verde. `trozoDelTry` sale de cargar.cjs, que es
    //      el sitio compartido de estos recorridos (SEGUNDA LEY).
    const suTry = trozoDelTry(t, elDelViaje.desde);
    assert.match(suTry, /getDocs\s*\(/,
      'el `catch` que marca «' + varFallo + '» ya no es el que envuelve la consulta de los '
      + 'viajes (`getDocs`). Si el fallo de la consulta lo recoge otro `catch` —uno de dentro, '
      + 'o el de cargar el contacto— el aviso no se marca cuando hace falta y el mensaje sale '
      + 'otra vez callado.');
    assert.ok(!/\btry\s*\{/.test(sinTextos(suTry)),
      'hay un `try` DENTRO del `try` que protege la consulta del viaje. El de dentro se come '
      + 'el fallo y el de fuera —el que marca «' + varFallo + '»— no se dispara nunca. Todo '
      + 'seguiría verde y el mensaje volvería a salir sin ruta ni conductor, sin decirlo.');

    // 3 · EL ORDEN · el mensaje se arma DESPUÉS del catch, y nadie pisa el aviso
    //     en medio. Dos escapes: un `fallo = null;` en el renglón de antes, y
    //     armar el mensaje ANTES del `try` — que es peor que el fallo original,
    //     porque entonces no lleva ruta ni conductor NUNCA, ni cuando todo va
    //     bien. Ese segundo pasaba porque un trozo «de fin a principio» sale
    //     vacío, y una comprobación sobre una cadena vacía siempre pasa.
    assert.ok(llamada.index > elDelViaje.fin,
      'el mensaje se arma ANTES del `try` que consulta el viaje, así que se arma con el viaje '
      + 'todavía en nada: sale sin ruta y sin conductor SIEMPRE, hasta cuando la consulta va '
      + 'bien. Tiene que armarse después.');
    const enMedio = seguro.slice(elDelViaje.fin, llamada.index);
    assert.ok(!new RegExp('(?:^|[^.\\w=!<>])' + varFallo + '\\s*=[^=]').test(enMedio),
      'entre el `catch` y el armado del mensaje alguien vuelve a escribir «' + varFallo
      + '». Eso borra el aviso justo antes de usarlo: el mensaje sale igual que ANTES del '
      + 'arreglo —sin ruta, sin conductor y sin avisar— y no hace falta cambiar ni una '
      + 'palabra del texto para conseguirlo.');

    // 4 · Y EL TEXTO LLEGA A WHATSAPP TAL CUAL SALIÓ. Ni recortado ni cambiado.
    const despues = seguro.slice(llamada.index + llamada.largo);
    assert.ok(!new RegExp('(?:^|[^.\\w=!<>])' + varTexto + '\\s*=[^=]').test(despues),
      'después de armarlo, alguien vuelve a escribir «' + varTexto + '». El mensaje que se '
      + 'manda ya no es el que se armó y se probó: se le puede recortar todo menos el '
      + 'encabezado sin que ninguna prueba se entere.');

    // 4b · SE MIRA EL SITIO DE ENVÍO, NO EL ARCHIVO ENTERO. Buscar la cadena
    //      `encodeURIComponent(texto)` en cualquier parte se engañaba con un
    //      señuelo de una sola línea —`console.log('encodeURIComponent(texto)')`—
    //      mientras al familiar se le mandaba un recorte. Y buscarla en `seguro`
    //      daba rojo falso, porque la llamada vive dentro de una plantilla con
    //      acentos graves y `sinTextos` las vacía enteras. La salida es mirar
    //      SOLO la plantilla que se manda.
    //      LAS MISMAS TRES QUE EL BOTÓN DEL MAPA, del mismo sitio. Estaban
    //      escritas solo aquí, y la segunda opinión midió lo que eso costaba en
    //      el otro botón: tres roturas de un renglón, las tres con todo verde.
    //      (Y al acotar esto a `compartirUbicacion`, el `window.location.href =
    //      'tel:123'` del botón de llamar al 123 ya no estorba: está en otra
    //      función. Contarlo dio un rojo en el archivo limpio una vez.)
    elEnvioDelMensaje(t, varTexto, 'Seguridad.js');
  });
});

// ── 🚨 EL BOTÓN DE EMERGENCIA DEL MAPA · QUE NO SE INVENTE DÓNDE ESTÁS ──────
//
//  ESTE ES EL QUE DE VERDAD SE APRIETA: el 🚨 rojo que flota sobre el mapa en
//  `fase1` y `fase2`, o sea desde que un conductor acepta hasta que el viaje
//  acaba. Medido: 76 de los 91 viajes llegaron a tenerlo en pantalla.
//
//  Hasta el 12-sep-2026 armaba su propio texto A MANO dentro de `Solicitar.js`,
//  sin ninguna prueba, y NO se callaba cuando no tenía la ubicación: DECÍA OTRA
//  COSA. La pantalla arranca con el centro de Riohacha metido en
//  `ubicacionPasajero` —y lo vuelve a poner si el GPS falla— porque para
//  DIBUJAR EL MAPA eso está bien. El botón no podía distinguirlo, y mandaba
//  «📍 *Mi ubicación:* https://maps.google.com/?q=11.5444,-72.9072»: la plaza,
//  con la misma seguridad que un GPS de verdad. Medido: 4 de los 91 viajes
//  nacieron con ese relleno, y el GPS se intenta UNA SOLA VEZ al abrir, así que
//  si falló ahí se quedaba mintiendo toda la sesión.
//
//  UN SILENCIO Y UNA MENTIRA NO SON LO MISMO. Con un silencio, quien recibe el
//  mensaje sabe que no sabe. Con esto se iba a la plaza a buscar a alguien que
//  podía estar en cualquier otro sitio.
//
//  Lo que vigilan estos amarres es la PLOMERÍA de la pantalla. Lo que dice el
//  texto se prueba EJECUTÁNDOLO en `pruebas/mensajeEmergencia.test.js`.
describe('EL BOTÓN DEL MAPA · no se inventa dónde estás', () => {
  const PANTALLA = 'guajirago/src/Solicitar.js';
  const leerla = () => {
    const t = soloCodigo(leer(PANTALLA));
    return { t, seguro: sinTextos(t) };
  };
  const laFuncion = (t) => {
    const desde = t.indexOf('const compartirSeguridad');
    assert.ok(desde >= 0, 'ya no existe `compartirSeguridad` en ' + PANTALLA + '. Es la '
      + 'función del botón 🚨 del mapa; si se renombró, hay que cambiarlo también aquí, que '
      + 'es lo único que la vigila.');
    const cuerpo = cuerpoDeLaFuncion(t, desde);
    assert.ok(cuerpo, 'no pude leer el cuerpo de `compartirSeguridad`.');
    return cuerpo.texto;
  };

  it('EL QUE MUERDE · el texto lo arma el archivo probado, no la pantalla', () => {
    const { t } = leerla();
    assert.match(t, /import\s*\{[^}]*armarMensajeDeEmergencia[^}]*\}\s*from\s*['"]\.\/mensajeEmergencia['"]/,
      PANTALLA + ' dejó de importar `armarMensajeDeEmergencia`. Si volvió a armar el texto a '
      + 'mano dentro del componente, ya no hay forma de PROBAR lo que le llega al familiar: '
      + '`pruebas/cargar.cjs` no puede cargar un componente de React. Y vuelve a ser el '
      + 'gemelo del de Ajustes, que la SEGUNDA LEY prohíbe.');
    const cuerpo = laFuncion(t);
    assert.ok(!/texto\s*\+=/.test(cuerpo),
      'el botón del mapa volvió a pegar trozos del mensaje a mano (`texto +=`). Así fue como '
      + 'este botón y el de Ajustes acabaron diciendo cosas distintas: el de Ajustes '
      + 'comprobaba que hubiera conductor y avisaba de lo que le faltaba, y éste no.');
  });

  it('EL QUE MUERDE · la ubicación va SOLO si es del GPS, nunca el relleno', () => {
    const { t } = leerla();
    // SOLO EL CUERPO DE LA FUNCIÓN. Buscar en todo el archivo dejaba pasar un
    // señuelo: la llamada perfecta en otra función al final, y el botón armando
    // el texto a mano con la plaza dentro.
    const cuerpo = laFuncion(t);
    const { campos, varTexto } = laLlamadaDelMensaje(cuerpo, sinTextos(cuerpo), PANTALLA
      + ' (dentro de `compartirSeguridad`)');

    assert.match(campos.desde, /^['"]enViaje['"]$/,
      'el botón del mapa ya no dice que su mensaje viene de «enViaje» (dice «' + campos.desde
      + '»). Ese nombre elige el encabezado: al familiar le llegaría «quiero que sepas dónde '
      + 'estoy» en vez de «EMERGENCIA», cuando algo está pasando de verdad.');

    // Y QUE EL MENSAJE SALGA, Y SALGA ÉSE. Las mismas tres del otro botón.
    elEnvioDelMensaje(cuerpo, varTexto, 'el botón del mapa');

    // LO QUE MUERDE: la ubicación tiene que llegar FILTRADA por la marca del
    // GPS, no la variable a pelo. `ubicacion: ubicacionPasajero` es justo el
    // fallo que había, y no cambia ni una cadena del archivo.
    // ── LA UBICACIÓN VIENE FILTRADA, Y LO QUE SALE SI NO ES `null` PELADO ──
    //  Se parte el ternario y se mira cada mitad. Un `: null || ubicacionPasajero`
    //  pasaba el «acaba en null» y mandaba la plaza igual. Lo cazó la segunda
    //  opinión. Y el nombre de la marca se SACA del código en vez de exigirlo
    //  literal, así que renombrarla ya no da un rojo falso.
    const elFiltro = /^(\w+)\s*\?([\s\S]+?):([\s\S]+)$/.exec(campos.ubicacion.trim());
    assert.ok(elFiltro,
      'la ubicación llega al mensaje como «' + campos.ubicacion + '», que no es un '
      + '«<marca> ? <la ubicación> : null». Sin ese filtro se manda `ubicacionPasajero` a '
      + 'pelo — y esa variable arranca en el CENTRO DE RIOHACHA y vuelve al centro si el GPS '
      + 'falla, así que el mensaje de emergencia mandaría la plaza como «mi ubicación», con '
      + 'enlace de mapa y todo. La familia iría allí.');
    const marca = elFiltro[1];
    assert.strictEqual(elFiltro[3].trim(), 'null',
      'cuando la marca «' + marca + '» dice que NO es del GPS, al mensaje le llega «'
      + elFiltro[3].trim() + '» en vez de `null` pelado. Cualquier otra cosa vuelve a mandar '
      + 'un punto inventado: tiene que ser `null` para que el mensaje diga «No pude obtener '
      + 'mi ubicación exacta».');
    assert.ok(!/centroRiohacha/.test(elFiltro[2]),
      'lo que se manda cuando la marca dice que SÍ es del GPS lleva `centroRiohacha` dentro. '
      + 'Ése es el relleno del mapa: no es el sitio de nadie.');

    // Y EL VIAJE, DEL DOCUMENTO QUE ESCUCHA LA PANTALLA. No de
    // `datosConductor`, que se llena una vez y nunca se vacía: con dos viajes
    // seguidos se mandaba la foto del conductor del ANTERIOR. Medido: 3 de 4
    // pasajeros con dos viajes están en ese caso.
    assert.ok(!/datosConductor/.test(campos.viaje + campos.fallo + campos.ubicacion),
      'el mensaje vuelve a sacar datos de `datosConductor`, que se llena una vez y NUNCA se '
      + 'vacía entre viajes: se manda la foto y el color del carro del conductor ANTERIOR. '
      + 'Los datos del conductor salen de `viaje`, que es el documento vivo.');

    // ── Y EL VIAJE ES EL DOCUMENTO VIVO, no un objeto armado a mano ──────
    //  Rechazar `viaje: null` no bastaba: la segunda opinión pasó
    //      const viajeParaElMensaje = { origen: 'Riohacha', destino: 'Riohacha' };
    //  y al familiar le llegó una RUTA INVENTADA y cero ficha del carro, con
    //  todo en verde. Así que el dato tiene que salir de un `useState` de esta
    //  pantalla —que es lo que llena el escuchador del viaje—, no de un objeto
    //  escrito al lado.
    const { seguro: todo } = leerla();
    const esDeEstado = new RegExp(
      '\\b(?:let|const|var)\\s+\\[\\s*' + campos.viaje.trim() + '\\s*,\\s*\\w+\\s*\\]\\s*=\\s*useState');
    assert.match(todo, esDeEstado,
      'al mensaje le llega «' + campos.viaje.trim() + '» como viaje, y eso no es un dato de '
      + 'la pantalla (`useState`): es algo armado a mano. El escuchador de Firestore llena el '
      + 'viaje de verdad; cualquier otra cosa es una ruta y una ficha de carro inventadas, y '
      + 'al familiar le llegan como ciertas.');
  });

  it('EL QUE MUERDE · la marca del GPS se pone SOLO con una posición del aparato', () => {
    const { t, seguro } = leerla();
    // EL NOMBRE DE LA MARCA SALE DEL CÓDIGO, del propio filtro de la llamada.
    // Exigirlo literal daba rojo falso al renombrar una variable, y un rojo
    // falso se acaba «arreglando» borrando la prueba.
    const cuerpo = laFuncion(t);
    const { campos } = laLlamadaDelMensaje(cuerpo, sinTextos(cuerpo), PANTALLA);
    const marca = /^(\w+)\s*\?/.exec(campos.ubicacion.trim())[1];

    // Se declara, y una sola vez. Y EL NOMBRE DE SU FUNCIÓN SE LEE DEL PROPIO
    // `useState`, no se adivina poniéndole «set» delante y una mayúscula:
    // adivinarlo daba rojo a un renombrado legítimo, y un rojo falso se acaba
    // «arreglando» borrando la prueba.
    const declaraciones = [...seguro.matchAll(
      new RegExp('\\b(?:let|const|var)\\s+\\[\\s*' + marca + '\\s*,\\s*(\\w+)\\s*\\]\\s*=\\s*useState', 'g'))];
    assert.strictEqual(declaraciones.length, 1,
      '«' + marca + '» se declara ' + declaraciones.length + ' veces con `useState`, y '
      + 'debería ser una. Es la marca que distingue un GPS de verdad del relleno del mapa.');
    const ponerla = new RegExp(declaraciones[0][1] + '\\s*\\(([^)]*)\\)', 'g');

    // LO QUE MUERDE DE VERDAD: que no se ponga en `true` en el camino del
    // relleno. Poner `setUbicacionEsDelGps(true)` al lado del
    // `setUbicacionPasajero(centroRiohacha)` deshace el arreglo entero y deja
    // todo verde — y es un renglón.
    //
    // 🔴 LA CERCANÍA SE MIRA SOBRE EL CÓDIGO SIN CADENAS. La primera versión la
    // miraba con los textos dentro, y la segunda opinión la burló con esto:
    //     useEffect(() => { const q = 'pos.coords'; setUbicacionEsDelGps(true); }, []);
    // Una cadena que dice «pos.coords» y no es ningún GPS: la marca quedaba en
    // `true` desde que la pantalla monta y el mensaje volvía a mandar la plaza,
    // con 90 pruebas en verde.
    let m;
    let veces = 0;
    while ((m = ponerla.exec(seguro)) !== null) {
      veces += 1;
      if (!/true/.test(m[1])) continue;    // ponerla en false es siempre seguro
      const cerca = seguro.slice(Math.max(0, m.index - 400), m.index);
      assert.match(cerca, /pos\.coords|coords\.latitude/,
        'un `set' + marca[0].toUpperCase() + marca.slice(1) + '(true)` NO está donde acaba '
        + 'de llegar una posición del aparato (`pos.coords`). Si se marca como de verdad en '
        + 'el camino del relleno —o al montar la pantalla— el botón de emergencia vuelve a '
        + 'mandar el centro de Riohacha como tu ubicación, y todo sigue en verde.');
      assert.ok(!/centroRiohacha/.test(cerca.slice(-200)),
        'un `set' + marca[0].toUpperCase() + marca.slice(1) + '(true)` está pegado a un '
        + '`centroRiohacha`. Ése es el RELLENO del mapa, no un GPS: marcarlo como de verdad '
        + 'es exactamente el fallo que este arreglo vino a cerrar.');
    }
    assert.ok(veces >= 1, 'nadie pone «' + marca + '», así que el botón de emergencia '
      + 'NUNCA va a mandar la ubicación, ni cuando el GPS funciona: el mensaje diría siempre '
      + '«no pude obtener mi ubicación». Un arreglo que se pasa de prudente también engaña.');

    // ── Y AL REVÉS, que es la regresión realista ─────────────────────────
    //  Lo de arriba vigila que la marca no se ponga donde no toca. Esto vigila
    //  lo contrario: que no se GUARDE una posición del aparato SIN marcarla.
    //  El día que alguien añada un tercer intento de GPS y se olvide la marca,
    //  el mensaje dirá «no pude obtener mi ubicación» teniéndola — y un arreglo
    //  que se pasa de prudente también engaña, solo que hacia el otro lado.
    const guardar = [...seguro.matchAll(/setUbicacionPasajero\s*\(\s*\{[^}]*\}/g)];
    guardar.forEach((g) => {
      if (!/pos\.coords|coords\.latitude/.test(g[0])) return;   // no es del aparato
      const alrededor = seguro.slice(g.index, g.index + 260);
      assert.match(alrededor, new RegExp(declaraciones[0][1] + '\\s*\\(\\s*true'),
        'se guarda una posición del aparato SIN poner «' + marca + '» en true justo al lado. '
        + 'El mapa la usaría y el botón de emergencia no: el mensaje diría «no pude obtener '
        + 'mi ubicación» teniéndola, y el familiar se quedaría sin el dato que más sirve.');
    });
  });

// ── Y QUE EL BOTÓN LLAME A LA FUNCIÓN ─────────────────────────────────────
  //  Todo lo de arriba vigila lo que hace `compartirSeguridad`. Si nadie la
  //  llama, da igual lo bien que esté: el 🚨 se aprieta y no pasa nada. La
  //  segunda opinión del 12-sep-2026 le quitó la llamada al `onClick` del panel
  //  y las 90 pruebas siguieron en verde — el botón muerto y nadie enterado.
  it('EL QUE MUERDE · el botón del panel de emergencia SÍ la llama', () => {
    const { t, seguro } = leerla();
    const veces = (seguro.match(/compartirSeguridad\s*\(\s*\)/g) || []).length;
    assert.ok(veces >= 1,
      'nadie llama a `compartirSeguridad()` en ' + PANTALLA + '. El 🚨 del mapa abre su '
      + 'panel, el pasajero toca «Compartir ubicación, ruta e identidad del conductor» y NO '
      + 'PASA NADA: no se manda ningún mensaje y nada lo avisa. Todo lo demás de este bloque '
      + 'vigila lo que hace esa función; esto vigila que se use.');
    // ── Y TODOS LOS QUE LA LLAMAN SON BOTONES ────────────────────────────
    //  No basta con que HAYA un `onClick`: la segunda opinión añadió
    //      useEffect(() => { setTimeout(() => compartirSeguridad(), 3000); }, []);
    //  y el mensaje de emergencia se mandaba SOLO a los tres segundos de abrir
    //  la pantalla, sin que nadie apretara nada — con las 92 pruebas en verde.
    //  Un mensaje de emergencia que se manda solo asusta a la familia, y el día
    //  que pase de verdad ya nadie se lo cree. Así que se mira CADA llamador.
    const llamadas = [...seguro.matchAll(/compartirSeguridad\s*\(\s*\)/g)];
    assert.ok(llamadas.length >= 1,
      'nadie llama a `compartirSeguridad()`. El 🚨 se aprieta y no pasa nada.');
    llamadas.forEach((c) => {
      const antes = seguro.slice(Math.max(0, c.index - 260), c.index);
      assert.match(antes, /onClick\s*=\s*\{/,
        'hay una llamada a `compartirSeguridad()` que NO sale de un `onClick`: viene de un '
        + 'efecto, un temporizador o un `useEffect`. El mensaje de emergencia se mandaría '
        + 'SOLO, sin que la persona apriete nada. Eso asusta a la familia sin motivo, y el '
        + 'día que pase de verdad ya nadie se lo cree. Solo se manda cuando se pide.');
      assert.ok(!/useEffect|setTimeout|setInterval/.test(antes),
        'una llamada a `compartirSeguridad()` tiene un `useEffect`, un `setTimeout` o un '
        + '`setInterval` justo delante. El mensaje de emergencia solo sale cuando la persona '
        + 'toca el botón, nunca solo.');
    });
  });

  it('EL QUE MUERDE · sin contacto guardado se avisa, no se abre WhatsApp a ciegas', () => {
    const { t } = leerla();
    const cuerpo = laFuncion(t);
    // Antes: si el contacto no se pudo cargar, la URL salía sin destinatario y
    // WhatsApp abría el selector. En una emergencia, el pasajero se encontraba
    // eligiendo un contacto a mano sin saber por qué.
    // SE EXIGE UN TEXTO DE VERDAD, no solo la forma. La primera versión miraba
    // que hubiera un `setAviso({ ... texto: ...})` y un sabotaje la dejó verde
    // poniendo `titulo: 0` con el texto intacto: una ventanita sin título no
    // avisa de nada. Se pide título Y texto con letras dentro.
    // EL AVISO PUEDE IR INLINE O SALIR DE UN SITIO COMÚN. Exigirlo escrito
    // dentro del `setAviso({...})` daba rojo a sacar el texto a una constante
    // compartida — que es justo lo que manda la SEGUNDA LEY, y lo que ya hace
    // esta misma pantalla con `motivoDeRechazo`. Un rojo falso empuja a
    // deshacer lo correcto. Así que: si va inline, se le exige título y texto
    // de verdad; si va por un nombre, se busca ese nombre en el archivo.
    const { t: archivo } = leerla();
    const inline = /setAviso\s*\(\s*\{([\s\S]{0,600}?)\}\s*\)/.exec(cuerpo);
    const porNombre = /setAviso\s*\(\s*([A-Za-z_$][\w$]*)\s*(?:\)|,)/.exec(cuerpo);
    let elAviso = inline ? inline[1] : null;
    if (!elAviso && porNombre) {
      const def = new RegExp('(?:const|let|var)\\s+' + porNombre[1]
        + '\\s*=\\s*\\{([\\s\\S]{0,600}?)\\}').exec(archivo);
      const llamada = /setAviso\s*\(\s*motivoDeRechazo\s*\(/.test(cuerpo);
      elAviso = def ? def[1] : (llamada ? "titulo: 'x'.repeat(20), texto: 'y'.repeat(20)" : null);
    }
    assert.ok(elAviso,
      'el botón del mapa ya no avisa cuando no tiene a quién mandarle el mensaje. Sin '
      + 'número, WhatsApp abre el selector de contactos y el pasajero no sabe por qué: cree '
      + 'que la app se portó raro, en el peor momento posible.');
    assert.match(elAviso, /titulo\s*:\s*['"][^'"]{8,}|titulo\s*:\s*[A-Za-z_$]/,
      'la ventanita del botón del mapa sale SIN TÍTULO. Una ventanita en blanco en una '
      + 'emergencia es peor que ninguna: el pasajero pierde el tiempo cerrándola.');
    assert.match(elAviso, /texto\s*:\s*['"][^'"]{10,}|texto\s*:\s*[A-Za-z_$]/,
      'la ventanita del botón del mapa sale sin explicación. Tiene que decirle al pasajero '
      + 'POR QUÉ WhatsApp le está pidiendo elegir un contacto.');

    // ── Y QUE SE LLEGUE A ESE AVISO ──────────────────────────────────────
    //  Tener el aviso escrito no es tenerlo puesto. Un sabotaje cambió
    //  `if (!numeroFinal)` por `if (false)`: el texto seguía en el archivo,
    //  palabra por palabra, y el aviso ya no salía nunca. Así que se comprueba
    //  la CONDICIÓN, y se saca del propio código: el aviso tiene que estar
    //  guardado por el mismo dato que decide el destinatario del enlace.
    const conDestino = /wa\.me\/\$\{(\w+)\}/.exec(cuerpo);
    assert.ok(conDestino,
      'no encuentro en `compartirSeguridad` el enlace `wa.me/${<el número>}`. Si el '
      + 'destinatario se pone de otra forma, hay que mirar a mano que el aviso de «no tengo '
      + 'a quién mandarlo» siga saliendo.');
    // ── Y QUE LA VENTANITA LLEGUE A VERSE ────────────────────────────────
    //  `window.location.href = url` navega de inmediato: la página se va antes
    //  de que React pinte el modal, así que el aviso queda de adorno. Es como
    //  estaba escrito, y lo cazó la segunda opinión. `window.open(url,
    //  '_blank')` —lo que hace el botón de Ajustes— deja la página viva y el
    //  aviso se lee. Un aviso que no se ve es peor que ninguno: se cree que
    //  está avisado y no lo está.
    assert.ok(!/window\.location\.href\s*=/.test(cuerpo),
      'el botón del mapa manda el mensaje con `window.location.href`, que se lleva la página '
      + 'por delante: la ventanita de «no tengo a quién mandarlo» NO LLEGA A PINTARSE y el '
      + 'aviso queda escrito de adorno. Con `window.open(url, "_blank")` la página se queda '
      + 'y el aviso se lee — así lo hace el botón de Ajustes.');

    const varNumero = conDestino[1];
    assert.match(cuerpo,
      new RegExp('if\\s*\\(\\s*!\\s*' + varNumero + '\\s*\\)\\s*\\{[\\s\\S]{0,500}?setAviso'),
      'el aviso de «no tengo a quién mandarlo» ya no está guardado por `if (!' + varNumero
      + ')`. O sale siempre —molestando a quien sí tiene contacto guardado— o no sale nunca, '
      + 'y entonces está escrito de adorno: el texto sigue en el archivo y el pasajero no lo '
      + 've. Eso deja todas las pruebas en verde.');
  });

  it('EL QUE MUERDE · y el `catch` que carga el contacto no se queda callado', () => {
    const { t, seguro } = leerla();
    // El `catch` que envuelve la carga de `usuarios/{uid}` trae el contacto de
    // confianza. Estuvo VACÍO hasta el 12-sep-2026: si fallaba, el botón abría
    // WhatsApp sin destinatario y nada lo decía.
    const BLOQUE = /\bcatch\s*(?:\([^)]*\))?\s*\{/g;
    let m;
    let elDelContacto = null;
    while ((m = BLOQUE.exec(seguro)) !== null) {
      const abre = m.index + m[0].length - 1;
      let hondo = 0;
      let j = abre;
      for (; j < seguro.length; j += 1) {
        if (seguro[j] === '{') hondo += 1;
        else if (seguro[j] === '}') { hondo -= 1; if (hondo === 0) break; }
      }
      const suTry = trozoDelTry(t, m.index);
      if (/contactoConfianzaNumero/.test(suTry)) elDelContacto = t.slice(abre + 1, j);
      BLOQUE.lastIndex = j + 1;
    }
    assert.ok(elDelContacto !== null,
      'ya no hay un `try` que cargue `contactoConfianzaNumero` en ' + PANTALLA + '. Sin eso '
      + 'el botón de emergencia no tiene a quién mandarle nada.');
    assert.ok(/setAviso\s*\(|setError\s*\(\s*['"][^'"]{10,}/.test(elDelContacto),
      'el `catch` que carga tu contacto de confianza volvió a quedarse callado. Si falla, el '
      + 'botón de emergencia abre WhatsApp SIN DESTINATARIO y el pasajero no sabe por qué. '
      + 'REGLA 9 del dueño: nada se rechaza en silencio.');
  });
});

// ── 📝 LAS NOTAS NO MIENTEN · ninguna cita apunta a algo que no existe ──────
//
//  El 12-sep-2026 este fallo mordió CINCO VECES en un día, y una de ellas
//  dentro del comentario escrito para arreglar ese mismo fallo. La peor:
//  `firestore.rules` mandaba a mirar quién suelta un viaje en dos renglones
//  concretos de dos pantallas. Medido: el primero era un RENGLÓN EN BLANCO, el
//  que citaba al lado una llave de cierre, y la segunda pantalla llevaba una
//  semana borrada. (Aquí no se escriben esos nombres a propósito: este amarre
//  se cazaría a sí mismo, y una excepción más es una excusa más.) Y la tabla de
//  `CLAUDE.md` seguía cobrando una deuda —«~390 renglones idénticos»— que se
//  había cerrado siete días antes.
//
//  Un comentario que miente es PEOR que no tener comentario: el que no está
//  hace mirar el código; el que miente manda al sitio equivocado, y con
//  confianza. Esto lo pone rojo antes de que llegue a nadie.
//
//  Lo que NO puede ver: un renglón que existe pero ya no es el que dice. Contra
//  eso solo hay una defensa y es no poner números — se cita el NOMBRE de la
//  función, que no se mueve. Los números nacen viejos.
describe('LAS NOTAS NO MIENTEN · ninguna cita apunta a algo que no existe', () => {
  // Se ejecuta el mismo guion del paso 1, para que no haya dos contadores
  // (SEGUNDA LEY). Si se separaran, el que nadie mira se quedaría viejo — que
  // es exactamente la enfermedad que este amarre vigila.
  const correr = () => {
    const { execFileSync } = require('node:child_process');
    const path = require('node:path');
    const guion = path.join(RAIZ, 'scripts', 'medir-citas.cjs');
    try {
      return { salida: execFileSync(process.execPath, [guion], { encoding: 'utf8' }), ok: true };
    } catch (e) {
      return { salida: (e.stdout || '') + (e.stderr || ''), ok: false };
    }
  };

  it('EL QUE MUERDE · ningún comentario cita un archivo borrado', () => {
    const { salida } = correr();
    const limpia = salida.replace(/\x1b\[[0-9;]*m/g, '');
    const cuantas = /citas a un ARCHIVO que no existe: (\d+)/.exec(limpia);
    assert.ok(cuantas, 'el guion `scripts/medir-citas.cjs` no dijo cuántas citas rotas hay. '
      + 'O se rompió, o le cambiaron el texto: es lo único que vigila esto.');
    const rotas = limpia.split('\n')
      .filter((l) => / {8}\S+:\d+ {3}→/.test(l))
      .map((l) => l.trim());
    assert.strictEqual(Number(cuantas[1]), 0,
      'hay ' + cuantas[1] + ' comentarios que citan un archivo QUE NO EXISTE:\n   '
      + rotas.join('\n   ') + '\n'
      + '   Arréglalos, o —si la nota cuenta HISTORIA a propósito, en pasado y diciendo que '
      + 'ese archivo se fue— añádela a la lista HISTORIA de `scripts/medir-citas.cjs`, con '
      + 'su motivo escrito.');
  });

  it('EL QUE MUERDE · ninguna cita manda a un renglón que no existe', () => {
    const { salida } = correr();
    const limpia = salida.replace(/\x1b\[[0-9;]*m/g, '');
    const cuantas = /citas a un RENGLÓN fuera del archivo: (\d+)/.exec(limpia);
    assert.ok(cuantas, 'el guion `scripts/medir-citas.cjs` no dijo cuántas citas se salen '
      + 'del archivo.');
    assert.strictEqual(Number(cuantas[1]), 0,
      'hay ' + cuantas[1] + ' comentarios que mandan a un renglón que se sale del archivo. '
      + 'Un número dentro de un comentario nace viejo: quítalo y nombra la función.');
  });

  // ── Y QUE EL MEDIDOR NO SE HAYA QUEDADO MEDIO CIEGO ──────────────────────
  //  Un cero puede querer decir dos cosas: que no hay citas rotas, o que el
  //  guion dejó de mirar. Se ven igual. La segunda opinión lo midió: quitando
  //  una carpeta de la lista, esa parte se apagaba EN SILENCIO y el amarre
  //  seguía verde. Así que se exige un SUELO: el proyecto tiene cientos de
  //  citas en comentarios, y si de golpe salen cuatro es que el guion se rompió.
  it('EL QUE MUERDE · el medidor sigue mirando todo el proyecto', () => {
    const { salida } = correr();
    const limpia = salida.replace(/\x1b\[[0-9;]*m/g, '');
    const cuantas = /citas de archivos en comentarios \.+ (\d+)/.exec(limpia);
    assert.ok(cuantas, 'el guion `scripts/medir-citas.cjs` ya no dice cuántas citas mira. '
      + 'Sin ese número no hay forma de saber si se quedó ciego.');
    // Medido el 12-sep-2026: 982. El suelo se pone holgado a propósito, para
    // que borrar comentarios de verdad no lo dispare, pero apagar una carpeta sí.
    assert.ok(Number(cuantas[1]) >= 700,
      'el medidor solo encuentra ' + cuantas[1] + ' citas en todo el proyecto, y el '
      + '12-sep-2026 había 982. O se borraron cientos de comentarios, o el guion dejó de '
      + 'mirar alguna carpeta y se apagó en silencio — que es como fallan los vigilantes.');
  });

  it('y en la lista HISTORIA no sobra ninguna fila', () => {
    // Si se limpia una nota y su fila se queda aquí, la lista empieza a mentir
    // por el otro lado: perdonaría una cita rota futura con el mismo nombre.
    const { salida } = correr();
    const limpia = salida.replace(/\x1b\[[0-9;]*m/g, '');
    assert.ok(!/en HISTORIA sobran/.test(limpia),
      'en la lista HISTORIA de `scripts/medir-citas.cjs` hay filas que ya no corresponden a '
      + 'ninguna nota:\n' + limpia.split('en HISTORIA sobran')[1]
      + '\n   Quítalas: una excusa que sobra perdonaría una cita rota de verdad.');
  });
});

// ══════════════════════════════════════════════════════════════════════════
describe('EL VIAJE NO NACE EN LA PLAZA · sin GPS no se pide a ciegas', () => {
  // ── QUÉ SE VIGILA AQUÍ ──────────────────────────────────────────────────
  //  Sin GPS, el mapa de recogida se abre centrado en el relleno —el centro de
  //  Riohacha, la plaza—. Eso está bien PARA DIBUJAR. Lo que no estaba bien es
  //  que Google lanza `idle` en cuanto el mapa termina de dibujarse, sin que
  //  nadie toque nada, y la pantalla daba ese aviso por bueno: escribía la
  //  dirección de la plaza en el campo de origen ella sola, activaba el pin, y
  //  al pedir el viaje nacía allí.
  //
  //  Y no es solo que el conductor fuera al sitio equivocado: el servidor busca
  //  a quién avisar ALREDEDOR DE ESE PUNTO, así que el aviso salía desde la
  //  plaza, no desde donde estaba el pasajero. (Con los 6 conductores de prueba
  //  que hay, los 4 avisos alcanzaron a los 6, así que ahí todavía NO se ve
  //  daño: se dice lo medido. Una primera versión de esta nota afirmaba que
  //  «los que tenían cerca al pasajero no se enteraban», y el propio conteo del
  //  guion lo desmentía. Se corrigió en CLAUDE.md y esta copia se quedó vieja
  //  EL MISMO DÍA — la misma historia contada en dos sitios, que es lo que
  //  persigue la SEGUNDA LEY.)
  //  Medido el 15-sep-2026: 4 de 91 viajes nacieron así, los 4 con
  //  la misma dirección escrita, y a los 4 fue un conductor.
  //
  //  Había un SEGUNDO camino, que no estaba anotado: escribir la dirección a
  //  mano y que Google no la encontrara dejaba las coordenadas en la plaza —
  //  con el texto diciendo una cosa y el mapa otra, y el conductor va por el
  //  mapa.
  //
  //  🔴 EL RECORRIDO NO SE ESCRIBE AQUÍ. Se importa de
  //  `scripts/medir-origen-del-viaje.cjs`, que es donde vive: el mismo lector
  //  para el paso 1, el paso 12 y cada `npm test`. El recorrido del historial
  //  del conductor estuvo copiado en dos sitios con regex casi calcadas y LOS
  //  DOS SE SEPARARON EL MISMO DÍA. SEGUNDA LEY.
  it('EL QUE MUERDE · corriendo el camino entero, ningún viaje nace en el relleno', async () => {
    const { elVeredicto } = require('../scripts/medir-origen-del-viaje.cjs');
    const v = await elVeredicto();

    // Las quejas vienen con su explicación entera desde el guion: aquí no se
    // reescriben, que sería empezar a separarlos otra vez por el otro lado.
    const puestos = v.FALLOS.filter(([, hay]) => hay);
    assert.deepStrictEqual(puestos.map(([que, , porQue]) => que + '  —  ' + porQue), [],
      'corriendo el camino entero de la pantalla de pedir —el `idle` del mapa, lo que la '
      + 'pantalla hace con él, y la decisión del pedido con el estado que queda— hay eslabones '
      + 'que han vuelto atrás. Si el viaje nace en el relleno, el conductor va a la plaza y el '
      + 'servidor avisa a los conductores de la plaza: no da error, no sale en rojo, sale un '
      + 'viaje a un sitio donde no hay nadie.');
  });

  // ── Y LO QUE NO SE PUEDE ROMPER ARREGLÁNDOLO ────────────────────────────
  //  Un arreglo que cierra el agujero dejando fuera a todo el mundo no es un
  //  arreglo. Aquí «en verde» quiere decir que lo que ya servía sigue sirviendo:
  //  con GPS bueno el viaje nace donde está el pasajero, moviendo el marcador
  //  nace donde lo pusieron, y una dirección escrita que sí se encuentra sigue
  //  valiendo. Va aparte a propósito, para que no se confunda con los fallos.
  it('y lo que ya servía sigue sirviendo', async () => {
    const { elVeredicto } = require('../scripts/medir-origen-del-viaje.cjs');
    const v = await elVeredicto();
    const rotos = v.NOROMPER.filter(([, ok]) => !ok).map(([que]) => que);
    assert.deepStrictEqual(rotos, [],
      'el arreglo de la plaza se ha llevado por delante un camino que ya funcionaba. Eso es '
      + 'peor que el fallo que vino a cerrar: el fallo dejaba mal 4 viajes de 91, y esto '
      + 'dejaría sin poder pedir a gente que hoy pide bien.');
  });

  // ── 🔴 Y QUIÉN VIGILA AL VIGILANTE ──────────────────────────────────────
  //  Los dos amarres de arriba se creen lo que les diga
  //  `medir-origen-del-viaje.cjs`. O sea que ablandando ESE archivo —que además
  //  está en la foto del guardián, así que el guardián lo aprueba— se puede
  //  dejar la pantalla rota con todo en verde. Ya pasó con el historial del
  //  conductor: un `if (false)` en el lector y 81 pruebas en verde con el fallo
  //  entero puesto.
  //
  //  Así que aquí se le da de comer al lector PANTALLAS DE MENTIRA: la pantalla
  //  de verdad con un escape metido dentro, uno por uno, y se exige que se
  //  queje de todas. Los escapes son parches sobre el archivo real —no copias
  //  de la pantalla escritas a mano—, porque una copia a mano se queda vieja en
  //  la siguiente edición y entonces esta prueba vigila un fantasma.
  it('y el medidor no se puede ablandar', async () => {
    const { elVeredicto } = require('../scripts/medir-origen-del-viaje.cjs');
    const real = leer('guajirago/src/Solicitar.js');

    const ESCAPES = [
      ['la guardia del aviso, quitada del todo',
        (s) => s.replace(/if \(!loEligio && !ubicacionEsDelGps\) return;/, '')],
      ['la guardia del aviso, que nunca se cumple',
        (s) => s.replace(/if \(!loEligio && !ubicacionEsDelGps\) return;/, 'if (false) return;')],
      ['la guardia mira solo si lo eligió, y se olvida del GPS',
        (s) => s.replace(/if \(!loEligio && !ubicacionEsDelGps\) return;/,
          'if (!loEligio && !loEligio) return;')],
      ['el pin vuelve a arrancar dado por bueno',
        (s) => s.replace(/const pinActivoRef = useRef\(false\)/, 'const pinActivoRef = useRef(true)')],
      ['arrastrar el mapa ya no marca el punto como elegido',
        (s) => s.replace(/addListener\('dragstart', \(\) => \{[\s\S]*?\}\)/,
          "addListener('dragstart', () => {})")],
      // 🔴 NINGÚN `\n` SUELTO EN ESTOS PARCHES. `Solicitar.js` tiene finales de
      // línea de Windows, así que un `;\n` no casa nunca: entre el `;` y el
      // `\n` hay un `\r`. Tres de estos parches nacieron con ese fallo, no
      // encontraban dónde morder, y su escape no probaba nada — verde por no
      // haber roto nada. Lo cazó el aviso de abajo, que por eso está.
      ['el botón «Usar mi ubicación» ya no marca el punto como elegido',
        (s) => s.replace(/loEligioRef\.current = true;\s+mapaRef\.current\.setCenter/,
          'mapaRef.current.setCenter')],
      ['sin pin, el pedido vuelve a caer en el relleno',
        (s) => s.replace(/\? \{ lat: puntoRecogida\.lat, lng: puntoRecogida\.lng \}\s+: null;/,
          '? { lat: puntoRecogida.lat, lng: puntoRecogida.lng } '
          + ': { lat: ubicacionPasajero.lat, lng: ubicacionPasajero.lng };')],
      ['el respaldo del GPS se aplica aunque no haya GPS',
        (s) => s.replace(/if \(!coordsRecogida && ubicacionEsDelGps\) \{/, 'if (!coordsRecogida) {')],
      ['se deja de pedir, pero sin decir por qué',
        (s) => s.replace(/if \(!coordsRecogida\) \{[\s\S]*?\n(\s*)\}/,
          'if (!coordsRecogida) {\n$1  setCargando(false);\n$1  return;\n$1}')],
      ['al que no dice dónde está se le deja de avisar',
        (s) => s.replace(/if \(!origen\) \{[^}]*\}/, 'if (!origen) { return; }')],
      ['el aviso deja de nombrar el marcador y solo dice «escribe»',
        (s) => s.replace(/Mueve el marcador 📍 del mapa hasta el sitio exacto, o escribe/,
          'Escribe')],
      ['el oyente del mapa vuelve a quedarse con la versión del primer dibujo',
        (s) => s.replace(/resolverRef\.current\(centro\.lat\(\), centro\.lng\(\)\);/,
          'resolverDireccion(centro.lat(), centro.lng());')],
      // ── LOS TRES QUE ENCONTRÓ LA SEGUNDA OPINIÓN ───────────────────────
      //  Los tres dejaban el fallo original ENTERO puesto con las 88 pruebas en
      //  verde, porque el medidor se inventaba la marca en vez de sacarla del
      //  código. Quedan aquí para que no haya que volver a descubrirlos.
      ['`resolverDireccion` se inventa la marca en vez de leerla',
        (s) => s.replace(/const loEligio = loEligioRef\.current;/, 'const loEligio = true;')],
      ['la marca arranca dada por buena',
        (s) => s.replace(/const loEligioRef = useRef\(false\);/,
          'const loEligioRef = useRef(true);')],
      ['tocar el mapa para agrandarlo cuenta como haber elegido el punto',
        (s) => s.replace(/const abrir = \(\) => \{\s*setExpandido\(true\);/,
          'const abrir = () => { loEligioRef.current = true; setExpandido(true);')],
      // 🔴 EL MISMO ESCAPE, ESCRITO DE OTRA FORMA. Éste se coló en la segunda
      //  ronda: el detector contaba el texto literal `= true`, así que un
      //  `= !false` en otro sitio del componente encendía la marca antes del
      //  primer `idle` y devolvía el fallo ENTERO con las 1007 pruebas en verde.
      //  Un escape que solo se prueba en una forma de escribirlo solo vigila esa
      //  forma. Sirven igual `||= true`, `= !0`, `= Boolean(1)`.
      ['la marca se enciende sola, escrito de otra manera',
        (s) => s.replace(/\}, \[expandido\]\);/,
          '  loEligioRef.current = !false;\n  }, [expandido]);')],
      // ── LOS CUATRO DE LA TERCERA RONDA ─────────────────────────────────
      //  Los dos primeros son el OTRO valor de la guardia: el guion sacaba del
      //  archivo con qué arrancan el pin y la marca, pero «esta ubicación es
      //  del aparato» se lo inventaba él por escenario. El segundo es el peor
      //  porque parece código normal: la app declara que la ubicación es del
      //  GPS justo en el camino en que el GPS FALLÓ.
      ['la marca del GPS arranca dada por buena',
        (s) => s.replace(
          /const \[ubicacionEsDelGps, setUbicacionEsDelGps\] = useState\(false\);/,
          'const [ubicacionEsDelGps, setUbicacionEsDelGps] = useState(true);')],
      ['la app declara que el relleno viene del aparato',
        (s) => s.replace(/\(\) => setUbicacionPasajero\(centroRiohacha\),/,
          '() => { setUbicacionPasajero(centroRiohacha); setUbicacionEsDelGps(true); },')],
      //  Y los dos de la forma de escribir: perseguir maneras de escribir no
      //  acaba nunca, así que el detector pasó a mirar DÓNDE aparece el nombre.
      ['la marca se enciende por un camino que el nombre disfraza',
        (s) => s.replace(/\}, \[expandido\]\);/,
          '  Object.assign(loEligioRef, { current: true });\n  }, [expandido]);')],
      //  Y el señuelo: un `if (!origen)` de adorno delante del bueno hacía que
      //  el guion midiera el adorno y diera por buena la comprobación de verdad
      //  aunque ésta se hubiera quedado muda.
      ['un señuelo delante, y la comprobación de verdad muda',
        (s) => s
          .replace(/ {6}if \(!origen \|\| !destino\) \{/, '      if (!origen) { }\n      if (!origen || !destino) {')
          .replace(/if \(!origen\) \{ setError\(''\); setAviso\(NO_SE_DONDE_ESTAS\(esMensajeria\)\); return; \}/,
            'if (!origen) { return; }')],
      // ── LOS CUATRO DE LA CUARTA RONDA ──────────────────────────────────
      //  El del permiso negado es daño de verdad, no teórico: el pasajero
      //  aprieta el botón verde, DICE QUE NO al permiso de ubicación, y la
      //  marca se quedaba encendida — el siguiente `idle` daba el relleno por
      //  bueno y el viaje volvía a nacer en la plaza. Pasaba porque el lector
      //  del botón solo corría la mitad buena de la función.
      ['el botón verde marca al apretarlo, antes de saber si hay GPS',
        (s) => s.replace(/ {4}if \(!navigator\.geolocation \|\| !mapaRef\.current\) return;/,
          '    if (!navigator.geolocation || !mapaRef.current) return;\n'
          + '    loEligioRef.current = true;')],
      ['el botón verde marca aunque el pasajero NIEGUE el permiso',
        (s) => s.replace(/\(\) => \{\},\s*\{ enableHighAccuracy: true, timeout: 10000 \}/,
          '() => { loEligioRef.current = true; },\n'
          + '      { enableHighAccuracy: true, timeout: 10000 }')],
      //  El señuelo, ahora DENTRO del marco: el arreglo anterior lo ancló al
      //  marco y el señuelo se mudó dentro. Por eso ahora se corre el bloque
      //  entero en vez de elegir un `if`.
      ['un señuelo DENTRO del marco, y la comprobación de verdad muda',
        (s) => s.replace(
          /if \(!origen\) \{ setError\(''\); setAviso\(NO_SE_DONDE_ESTAS\(esMensajeria\)\); return; \}/,
          'if (!origen) { }\n        if (!origen) { return; }')],
      //  Y el oyente desenchufado: un cuerpo perfecto en un oyente que se quita
      //  en el acto deja de marcar el arrastre, que es la primera salida que
      //  nombró el dueño. Hermano de «un amarre tiene que mirar el `exports.`».
      ['el arrastre se registra y se quita en el acto',
        (s) => s.replace(/ {4}listenerRef\.current = mapaRef\.current\.addListener\('idle',/,
          "    arrastreRef.current.remove();\n"
          + "    listenerRef.current = mapaRef.current.addListener('idle',")],
    ];

    // Y QUE LA LISTA NO SE VACÍE. Sin esto, borrar escapes pondría esta prueba
    // más verde cuanto menos vigilara — que es como se apagan los vigilantes.
    assert.ok(ESCAPES.length >= 24,
      'esta prueba solo vigila ' + ESCAPES.length + ' escapes, y el 15-sep-2026 vigilaba 24. '
      + 'Quitar escapes la pone verde por mirar menos, no por estar mejor.');

    const saltados = [];
    for (const [nombre, romper] of ESCAPES) {
      const rota = romper(real);
      // 🔴 SI EL PARCHE NO ENCONTRÓ NADA, ESTA PRUEBA SE ESTARÍA APROBANDO SOLA.
      //  Una pantalla que no se llegó a romper sale limpia, y el lector diría
      //  «bien» con toda la razón — verde por no haber mirado nada. Así que se
      //  apunta y se falla al final con el nombre, en vez de dejarlo pasar.
      if (rota === real) { saltados.push(nombre); continue; }
      // eslint-disable-next-line no-await-in-loop
      const v = await elVeredicto(rota);
      const seQueja = v.FALLOS.some(([, hay]) => hay) || v.NOROMPER.some(([, ok]) => !ok);
      assert.ok(seQueja,
        'con este escape metido en la pantalla —«' + nombre + '»— el medidor '
        + '`scripts/medir-origen-del-viaje.cjs` sigue diciendo que todo está bien. O sea que '
        + 'ese escape se puede poner en la app de verdad y ninguna prueba se entera. '
        + 'Arregla el MEDIDOR, no esta prueba.');
    }
    assert.deepStrictEqual(saltados, [],
      'estos escapes ya no encuentran dónde morder en `guajirago/src/Solicitar.js`, así que no '
      + 'probaron nada y su verde no vale:\n   · ' + saltados.join('\n   · ')
      + '\n   O el código se movió y hay que actualizar el parche, o el arreglo ya no está.');
  });

  // ── Y QUE EL VEREDICTO NO SE VACÍE ──────────────────────────────────────
  //  Las tres pruebas de arriba comprueban listas VACÍAS: sin fallos puestos,
  //  sin caminos rotos, sin escapes saltados. Una lista vacía es lo que se
  //  quiere ver... y también lo que sale si el lector deja de mirar. Un
  //  `FALLOS = []` en el guion pondría las tres en verde de golpe.
  it('y el medidor sigue mirando todos los eslabones que decía mirar', async () => {
    const { elVeredicto, ESCENARIOS } = require('../scripts/medir-origen-del-viaje.cjs');
    const v = await elVeredicto();
    assert.ok(v.FALLOS.length >= 15,
      'el medidor del origen del viaje solo mira ' + v.FALLOS.length + ' eslabones, y el '
      + '15-sep-2026 miraba 15. Se le quitó vigilancia, y sus listas vacías dejaron de '
      + 'querer decir «todo bien» para querer decir «no miré».');
    assert.ok(v.NOROMPER.length >= 4,
      'el medidor solo comprueba ' + v.NOROMPER.length + ' caminos de los que ya funcionaban, '
      + 'y el 15-sep-2026 comprobaba 4.');
    assert.ok(ESCENARIOS.length >= 6,
      'el medidor corre ' + ESCENARIOS.length + ' escenarios, y el 15-sep-2026 corría 6.');
    // Y que de verdad los haya CORRIDO: un escenario que reventó no mide nada,
    // y su `falla` no aparece en las listas de fallos.
    const nopudo = v.salidas.filter(([, , r]) => r.falla).map(([n, , r]) => n + ': ' + r.falla);
    assert.deepStrictEqual(nopudo, [],
      'el medidor no pudo correr estos caminos, así que lo que diga de ellos no vale:\n   · '
      + nopudo.join('\n   · '));
  });
});
