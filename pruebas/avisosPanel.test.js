/**
 * REGLA 9 EN EL PANEL · LOS BOTONES QUE FALLABAN EN SILENCIO
 *
 * Palabras del dueño: «Nada se rechaza en silencio.»
 *
 * Medido el 27-ago-2026 leyendo el repo: el panel tenía 32 `catch (e) {}` vacíos.
 * DIECINUEVE eran ESCRITURAS —la primera cuenta dijo diecisiete y estaba mal; lo
 * cazó la segunda opinión volviéndolas a contar—: aprobar o suspender un negocio, rechazar una
 * agencia, anular un código de recarga, borrar una promoción, contestar el chat
 * de un reclamo. En todas, el dueño tocaba el botón, el servidor decía que no, y
 * la pantalla se quedaba exactamente igual. No había forma de distinguir «se
 * hizo» de «no se hizo».
 *
 * Estas pruebas leen los archivos de la app tal cual están en el disco y
 * comprueban que cada uno de esos catch AVISA. Los ayudantes que leen código sin
 * que los comentarios engañen viven en cargar.cjs (SEGUNDA LEY).
 *
 * LO QUE ESTE ARREGLO NO CIERRA, y hay que decirlo aquí porque el número de arriba
 * se lee como si fuera todo: quedan QUINCE escrituras mudas fuera de esta lista, y
 * DOCE están en Conductores.js — la pantalla donde se sanciona y se reactiva a un
 * conductor. No entraron en la cuenta porque el barrido buscaba `catch (e) {}`
 * VACÍOS, y esas cuatro llevan un `console.error` dentro y las otras ocho no llevan
 * catch ninguno. El método falló, no la intención. Va con su propia foto.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, soloCodigo, sinTextos, cuerpoDelCatch, cuerpoDeLaFuncion } = require('./cargar.cjs');

// Los dieciséis botones. `registrarLog` NO está aquí a propósito: es el rastro de
// auditoría que se escribe DENTRO de otras acciones, y sacarle una ventanita al
// dueño por un apunte que no es su acción sería ruido. Queda ANOTADO.
const BOTONES = [
  ['guajirago-admin/src/AliadosPendientes.js', 'aprobar', 'aprobar un negocio pendiente'],
  ['guajirago-admin/src/AliadosPendientes.js', 'rechazar', 'rechazar un negocio pendiente'],
  ['guajirago-admin/src/Restaurantes.js', 'aprobar', 'aprobar un restaurante'],
  ['guajirago-admin/src/Restaurantes.js', 'suspender', 'suspender un restaurante'],
  ['guajirago-admin/src/Restaurantes.js', 'rechazar', 'rechazar un restaurante'],
  ['guajirago-admin/src/Turismo.js', 'aprobar', 'aprobar una agencia'],
  ['guajirago-admin/src/Turismo.js', 'suspender', 'suspender una agencia'],
  ['guajirago-admin/src/Turismo.js', 'rechazar', 'rechazar una agencia'],
  ['guajirago-admin/src/Promociones.js', 'desactivar', 'desactivar una promoción'],
  ['guajirago-admin/src/Promociones.js', 'reactivar', 'reactivar una promoción'],
  ['guajirago-admin/src/Promociones.js', 'borrar', 'borrar una promoción'],
  ['guajirago-admin/src/Codigos.js', 'enviarRespuestaRecarga', 'contestar por el chat de recargas'],
  ['guajirago-admin/src/Codigos.js', 'enviarPorChatGG', 'enviar un código por el chat'],
  ['guajirago-admin/src/Codigos.js', 'enviarCodigoExistentePorChat', 'reenviar un código por el chat'],
  ['guajirago-admin/src/Codigos.js', 'anular', 'anular un código de recarga'],
  ['guajirago-admin/src/App.js', 'enviarRespuestaChat', 'contestar un reclamo'],
];

const PANTALLAS = [...new Set(BOTONES.map((b) => b[0]))];

describe('REGLA 9 · los botones del panel ya no fallan en silencio', () => {
  for (const [archivo, fn, que] of BOTONES) {
    it('EL QUE MUERDE · «' + que + '» avisa si el servidor dice que no', () => {
      const t = soloCodigo(leer(archivo));
      const i = t.search(new RegExp('const ' + fn + '\\s*=\\s*(?:async\\s*)?\\('));
      assert.ok(i >= 0, 'no encontré la función ' + fn + ' en ' + archivo);
      const cuerpo = cuerpoDelCatch(t, i);
      assert.ok(cuerpo !== null, archivo + ' · ' + fn + ': ya no tiene catch');
      // Se pregunta en POSITIVO. Preguntar «¿está vacío?» se puede burlar de
      // cuatro formas —`catch {}` sin paréntesis, un comentario de bloque dentro,
      // un console.log que nadie ve, un `void e`— y la segunda opinión las usó
      // todas contra la versión anterior de estas comprobaciones.
      assert.ok(/apuntarRechazo\s*\(/.test(cuerpo),
        archivo + ' · ' + fn + '(): el catch no deja rastro del rechazo');
      assert.ok(/setAviso\s*\(\s*motivoDeRechazo/.test(cuerpo),
        archivo + ' · ' + fn + '(): saca el motivo pero no lo enseña, o ni lo saca. '
        + 'Calcularlo y no pintarlo es lo mismo que tragárselo.');
      // Y que no lo borre a continuación. Poner el aviso y quitarlo en el mismo
      // catch se ve exactamente igual que no ponerlo — la segunda opinión lo probó
      // y sobrevivía.
      assert.ok(!/setAviso\s*\(\s*null\s*\)/.test(cuerpo),
        archivo + ' · ' + fn + '(): pone el aviso y lo quita en el mismo catch. '
        + 'Eso se ve igual que no avisar.');
    });
  }

  // ── QUE EL AVISO SE VEA DE VERDAD ────────────────────────────────────────
  // Es la clase de bicho que ya mordió dos veces: una ventanita puesta en un sitio
  // distinto del botón que la dispara, que no se ve NUNCA y con las pruebas en
  // verde. La segunda vez fue AQUÍ, en App.js — que tiene CUATRO componentes y el
  // aviso cayó en el return de Dashboard. Lo cazó esta prueba.
  //
  // (Se dijo primero que ese tercer return era «de una función auxiliar». No lo es:
  // Dashboard es un COMPONENTE, montado desde Panel. Y ahí el fallo no habría sido
  // del todo silencioso, porque `aviso` no existe en ese ámbito y la compilación con
  // CI=true lo habría cazado. Lo corrigió la segunda opinión.)
  //
  // LA PRIMERA VERSIÓN DE ESTA PRUEBA ERA FLOJA: contaba los `return` y exigía que
  // hubiera uno solo. Eso no comprueba lo que importa —solo avisa de que hay que
  // mirar a mano— y en App.js habría bastado con partir el componente para
  // silenciarla. Lo que se comprueba ahora es la propiedad de verdad: que el botón
  // y la ventanita caigan en el MISMO return.
  // (PANTALLAS se declara arriba, fuera de este describe: lo usan tres.)
  // Los `return (` DEL COMPONENTE, que se reconocen por ir a dos espacios: los de
  // más adentro son de funciones que dibujan un trozo (una fila, una tarjeta) y
  // se pintan desde el de fuera. Se exige que el paréntesis cierre el renglón,
  // para no confundirlo con el `return () => unsub()` de los efectos.
  //
  // ESTE MATIZ COSTÓ DOS INTENTOS. La primera versión de esta comprobación pedía
  // que el botón y la ventanita cayeran en el MISMO return, y eso es FALSO en
  // cuatro de estas pantallas: el botón vive dentro de la función que dibuja cada
  // fila, y la ventanita en el return del componente — que es justo donde tiene
  // que estar, y sí se ve. Lo que de verdad hay que comprobar es lo de abajo.
  const returnsDelComponente = (t) => [...t.matchAll(/^ {2}return \($/gm)].map((m) => m.index);
  const elSuyo = (returns, pos) => {
    const antes = returns.filter((r) => r < pos);
    return antes.length ? antes[antes.length - 1] : -1;
  };

  for (const archivo of PANTALLAS) {
    it('«' + archivo.split('/').pop() + '» pinta la ventanita DONDE está el botón', () => {
      const t = soloCodigo(leer(archivo));
      assert.ok(/import AvisoModal from '\.\/AvisoModal'/.test(t),
        archivo + ' no trae la ventanita compartida');
      const dondeElAviso = t.search(/<AvisoModal aviso=\{aviso\} onCerrar=/);
      assert.ok(dondeElAviso >= 0, archivo + ' no pinta la ventanita en ningún sitio');

      // El botón: cualquiera de las funciones de este archivo, llamada desde el JSX.
      const funciones = BOTONES.filter((b) => b[0] === archivo).map((b) => b[1]);
      const dondeElBoton = t.search(new RegExp('onClick=\\{(?:\\(\\) => )?(?:'
        + funciones.join('|') + ')\\b'));
      assert.ok(dondeElBoton >= 0,
        archivo + ': no encontré ningún botón que llame a ' + funciones.join('/'));

      const returns = returnsDelComponente(t);
      assert.ok(returns.length >= 1, archivo + ': no reconocí el return del componente');

      // 1 · La ventanita tiene que estar DENTRO del return del componente. Si cae
      //     en una función auxiliar, no se pinta nunca.
      const rAviso = elSuyo(returns, dondeElAviso);
      assert.ok(rAviso >= 0,
        archivo + ': la ventanita no está dentro de ningún return del componente. '
        + 'Ahí no se va a ver nunca.');

      // 2 · Y si el componente tiene VARIOS return —o sea, sale antes según el
      //     caso—, la ventanita tiene que estar en el mismo por el que sale cuando
      //     se ve el botón. Es exactamente el fallo que se coló en App.js: tres
      //     return, el aviso en el que no era.
      if (returns.length > 1) {
        const rBoton = elSuyo(returns, dondeElBoton);
        assert.strictEqual(rAviso, rBoton,
          archivo + ' tiene ' + returns.length + ' return del componente, y el botón '
          + 'y su ventanita caen en DISTINTOS. El aviso no se va a ver nunca.');
      }
    });
  }

  // ── EL MISMO ARCHIVO NO ES EL MISMO SITIO ────────────────────────────────
  // Van TRES veces que muerde este bicho: archivo correcto, sitio equivocado. La
  // tercera fue aquí — el estado `aviso` acabó en el componente del login y el
  // chat que lo usa está en el del panel. Eso no compila, y la compilación lo
  // cazó; pero fiarse de que la compilación avise es fiarse de la suerte: si el
  // otro componente hubiera tenido un `aviso` suyo, habría compilado y el aviso
  // no se vería nunca.
  it('EL QUE MUERDE · el estado, el aviso y la ventanita viven en el MISMO componente', () => {
    for (const archivo of PANTALLAS) {
      const t = soloCodigo(leer(archivo));
      // Los componentes del archivo: funciones declaradas a nivel de archivo.
      const componentes = [...t.matchAll(/^function ([A-Z][A-Za-z0-9_]*)\s*\(/gm)]
        .map((m) => ({ nombre: m[1], ...cuerpoDeLaFuncion(t, m.index) }));
      assert.ok(componentes.length >= 1, archivo + ': no reconocí ningún componente');

      const dentroDe = (c, re) => re.test(t.slice(c.ini, c.fin));
      const completos = componentes.filter((c) => (
        dentroDe(c, /const \[aviso, setAviso\] = useState/)
        && dentroDe(c, /setAviso\s*\(\s*motivoDeRechazo/)
        && dentroDe(c, /<AvisoModal aviso=\{aviso\}/)
      ));
      assert.strictEqual(completos.length, 1,
        archivo + ': el estado `aviso`, la llamada que lo llena y la ventanita que lo '
        + 'pinta NO están los tres en el mismo componente (encontré ' + completos.length
        + ' que los tengan). Reparte: '
        + componentes.map((c) => c.nombre + '='
          + [/const \[aviso, setAviso\] = useState/, /setAviso\s*\(\s*motivoDeRechazo/, /<AvisoModal aviso=\{aviso\}/]
            .map((re) => (dentroDe(c, re) ? '1' : '0')).join('')).join(' '));
    }
  });

  it('la ventanita es UNA para todo el panel, no una copia por pantalla', () => {
    // Seis pantallas × ocho renglones de ventanita serían seis gemelos que en un
    // mes dirían cosas distintas (SEGUNDA LEY). Esto lo fija.
    //
    // LA PRIMERA VERSIÓN NO SERVÍA PARA NADA, y no es una sospecha: la segunda
    // opinión pegó la ventanita ENTERA, letra por letra, dentro de Turismo.js y
    // la prueba siguió verde. Buscaba el fondo oscuro y la palabra «Entendido»
    // a menos de 400 letras de distancia, y en la ventanita de verdad hay 785.
    // O sea: el detector de gemelos no reconocía ni al original.
    //
    // Ahora no se mide distancia —que es adivinar— sino las dos MARCAS que solo
    // tiene una ventanita de aviso: el fondo oscuro que tapa la pantalla y el
    // botón de cerrar. Si las dos aparecen en la misma pantalla, ahí hay una
    // ventanita escrita a mano.
    const modal = leer('guajirago-admin/src/AvisoModal.js');
    assert.ok(/function AvisoModal/.test(modal), 'no existe el componente compartido');
    for (const archivo of PANTALLAS) {
      const t = soloCodigo(leer(archivo));
      const fondo = /rgba\(0,\s*0,\s*0,\s*0\.5\)/.test(t);
      const boton = /Entendido/.test(t);
      assert.ok(!(fondo && boton),
        archivo + ' se escribió su propia ventanita de aviso en vez de usar AvisoModal: '
        + 'tiene el fondo oscuro Y el botón de cerrar. Dos ventanitas para lo mismo se '
        + 'separan en un mes (SEGUNDA LEY).');
    }
  });

  it('el motivo sale del mismo archivo que en el resto del proyecto', () => {
    for (const archivo of PANTALLAS) {
      const t = soloCodigo(leer(archivo));
      assert.ok(/from '\.\/avisoRechazo'/.test(t),
        archivo + ' no saca el motivo del archivo compartido: se lo está escribiendo');
    }
  });

  // ── LO QUE QUEDA ABIERTO, ESCRITO PARA QUE NO SE OLVIDE ──────────────────
  it('ANOTADO · siguen mudas las LECTURAS del panel, y algunas mienten', () => {
    // No es un fallo de este arreglo: es el trabajo siguiente, y se fija aquí para
    // que se vea el número y no se pierda. Dos de ellas hacen lo peor: si la carga
    // falla, la pantalla dice «No hay códigos para mostrar» o «Aún no hay
    // mandados» — que es lo contrario de la verdad.
    const MUDAS = ['guajirago-admin/src/Codigos.js', 'guajirago-admin/src/Mensajeria.js'];
    let quedan = 0;
    for (const archivo of MUDAS) {
      const t = soloCodigo(leer(archivo));
      quedan += (t.match(/catch\s*\([^)]*\)\s*\{\s*\}/g) || []).length;
    }
    assert.ok(quedan > 0,
      'ya no quedan catch vacíos en las lecturas: si es así, borra esta prueba y '
      + 'la anotación que la acompaña.');
  });
});

// ── LA VENTANITA COMPARTIDA, QUE NO TENÍA NINGUNA PRUEBA ───────────────────
// Es el único punto por el que pasan los seis avisos, y la única comprobación
// que había sobre ella era que existiera una función con ese nombre. La segunda
// opinión le metió `if (aviso) return null;` y las SEIS pantallas se quedaron
// mudas otra vez con las 26 pruebas en verde. Lo mismo con `zIndex: -1` y con
// `onCerrar={() => {}}`.
describe('REGLA 9 · la ventanita compartida del panel', () => {
  const M = () => soloCodigo(leer('guajirago-admin/src/AvisoModal.js'));

  it('EL QUE MUERDE · se esconde cuando NO hay aviso, y solo entonces', () => {
    const t = M();
    assert.ok(/if \(!aviso\) return null;/.test(t),
      'no se esconde cuando no hay nada que decir: va a estorbar siempre');
    assert.ok(!/if \(aviso\) return null/.test(t),
      'se esconde justo cuando SÍ hay aviso: las seis pantallas se quedan mudas');
  });

  it('EL QUE MUERDE · pinta el título, el texto y un botón que la cierra', () => {
    const t = M();
    assert.ok(/\{aviso\.titulo\}/.test(t), 'no pinta el título del aviso');
    assert.ok(/\{aviso\.texto\}/.test(t), 'no pinta el motivo: el aviso no diría por qué');
    // Se mira el BOTÓN, no cualquier `onCerrar` del archivo. La primera versión
    // buscaba `onClick={onCerrar}` a secas y encontraba el del FONDO oscuro: se
    // le podía quitar el cierre al botón y la prueba seguía verde. Lo probó la
    // segunda opinión. Y el fondo no vale como sustituto: en un teléfono, tocar
    // fuera de la ventanita es justo lo que no se acierta.
    assert.ok(/<button[^>]*onClick=\{onCerrar\}/.test(t),
      'el BOTÓN no cierra la ventanita: se queda puesta para siempre');
  });

  it('EL QUE MUERDE · va por ENCIMA de todo lo demás del panel', () => {
    // Un aviso tapado es un aviso que no existe. Se compara contra el zIndex más
    // alto de las seis pantallas y del armazón del panel.
    const suyo = Number((M().match(/zIndex: (\d+)/) || [])[1]);
    assert.ok(suyo > 0, 'la ventanita no declara zIndex, o es negativo: no se vería');
    const OTRAS = ['guajirago-admin/src/App.js', 'guajirago-admin/src/Codigos.js',
      'guajirago-admin/src/Promociones.js', 'guajirago-admin/src/Restaurantes.js',
      'guajirago-admin/src/Turismo.js', 'guajirago-admin/src/AliadosPendientes.js'];
    for (const a of OTRAS) {
      for (const m of soloCodigo(leer(a)).matchAll(/zIndex: (\d+)/g)) {
        assert.ok(suyo >= Number(m[1]),
          'en ' + a + ' hay algo con zIndex ' + m[1] + ', por encima de la ventanita ('
          + suyo + '): el aviso quedaría tapado');
      }
    }
  });

  it('EL QUE MUERDE · se pinta SIEMPRE que hay aviso, sin condiciones de más', () => {
    // `{cargando && <AvisoModal/>}` sobrevivía: el aviso solo se vería mientras la
    // pantalla carga, o sea nunca.
    for (const archivo of PANTALLAS) {
      const t = soloCodigo(leer(archivo));
      const linea = (t.match(/^.*<AvisoModal .*$/m) || [''])[0];
      assert.ok(!/&&\s*<AvisoModal/.test(linea),
        archivo + ': la ventanita se pinta solo si se cumple algo más («' + linea.trim()
        + '»). Ese «algo más» decide si el dueño se entera o no.');
    }
  });
});

// ── QUE NO NAZCA UN BOTÓN MUDO MAÑANA ──────────────────────────────────────
// La lista de arriba está escrita a mano, así que no dice nada del botón número
// diecisiete. La segunda opinión metió uno nuevo con `catch (e) {}` y las pruebas
// siguieron verdes. Esta es la pregunta en negativo: en estas seis pantallas, NO
// puede quedar ninguna escritura que se trague el fallo.
describe('REGLA 9 · en el panel no queda NINGUNA escritura muda', () => {
  const ESCRIBE = /setDoc\s*\(|updateDoc\s*\(|addDoc\s*\(|deleteDoc\s*\(|httpsCallable/;
  const GUARDA = /setDoc\s*\(|updateDoc\s*\(|addDoc\s*\(|deleteDoc\s*\(/g;

  // Qué cuenta como AVISAR. No solo la ventanita: si una pantalla ya le decía el
  // fallo al usuario a su manera —un `setError` en rojo debajo del formulario—
  // eso ya cumple la REGLA 9 y NO se toca (PRIMERA LEY: lo que funciona, quieto).
  const AVISA = /setAviso|setError|setErrorAsignar|alert\s*\(/;

  // El try que va justo antes de un catch, contando llaves hacia atrás.
  const trozoDelTry = (codigo, posCatch) => {
    const seguro = sinTextos(codigo);
    let i = seguro.lastIndexOf('}', posCatch);
    let hondo = 1;
    i -= 1;
    while (i >= 0 && hondo > 0) {
      if (seguro[i] === '}') hondo += 1;
      else if (seguro[i] === '{') hondo -= 1;
      i -= 1;
    }
    return codigo.slice(i + 2, posCatch);
  };

  // ¿Esta posición está dentro de algún `try {`? Se cuenta hacia atrás: cada llave
  // que se abre y no se cierra es un bloque que nos contiene; si alguno lleva
  // `try` delante, estamos protegidos.
  const dentroDeTry = (seguro, pos) => {
    let hondo = 0;
    for (let i = pos - 1; i >= 0; i -= 1) {
      if (seguro[i] === '}') hondo += 1;
      else if (seguro[i] === '{') {
        if (hondo > 0) hondo -= 1;
        else if (/\btry\s*$/.test(seguro.slice(Math.max(0, i - 8), i))) return true;
      }
    }
    return false;
  };

  for (const archivo of [...new Set(BOTONES.map((b) => b[0]))]) {
    it('EL QUE MUERDE · «' + archivo.split('/').pop() + '» no tiene ninguna escritura muda', () => {
      const t = soloCodigo(leer(archivo));
      const seguro = sinTextos(t);
      const renglon = (i) => 'renglón ' + t.slice(0, i).split('\n').length;
      const mudas = [];

      // FORMA 1 · el catch que no le dice NADA al usuario.
      //
      // La primera versión solo cazaba el catch VACÍO, `catch (e) {}`. Con eso, un
      // botón nuevo escrito `catch (e) { console.error(e); }` pasaba en verde — y
      // ese no es un caso inventado: es la costumbre de esta misma casa, escrita
      // cuatro veces en Conductores.js. El guardia tenía el agujero justo del
      // tamaño de la costumbre. Lo midió la segunda opinión.
      for (const m of t.matchAll(/catch\s*(\([^)]*\))?\s*\{([^{}]*)\}/g)) {
        if (!ESCRIBE.test(trozoDelTry(t, m.index))) continue;
        if (AVISA.test(m[2])) continue;
        mudas.push(renglon(m.index) + ' (el catch no avisa)');
      }

      // FORMA 2 · la escritura que no tiene NINGÚN catch.
      //
      // `onClick={async () => { await updateDoc(...) }}` a pelo: si el servidor
      // dice que no, el fallo se pierde en el aire y la pantalla se queda igual.
      // Es la otra mitad de la costumbre — ocho veces en Conductores.js — y la
      // primera versión tampoco la veía.
      for (const m of t.matchAll(GUARDA)) {
        if (!dentroDeTry(seguro, m.index)) mudas.push(renglon(m.index) + ' (sin try)');
      }

      assert.deepStrictEqual(mudas, [],
        archivo + ': hay ' + mudas.length + ' escritura(s) que se tragan el fallo ('
        + mudas.join(', ') + '). Un botón que guarda algo y no dice si no pudo es '
        + 'justo lo que este arreglo vino a cerrar.');
    });
  }
});

// ── Y LOS PROPIOS AYUDANTES, QUE SON EL SUELO DE TODO ESTO ─────────────────
// Viven en cargar.cjs y los usan tres archivos de pruebas. Si mienten, todo lo
// que se apoya en ellos sale verde sin comprobar nada — y eso pasó: los dos
// fallos de abajo estuvieron dentro, y los midió la segunda opinión.
describe('LOS AYUDANTES · leer código sin que los comentarios engañen', () => {
  it('EL QUE MUERDE · quita los comentarios TAMBIÉN con finales de línea de Windows', () => {
    // Costó siete botones: Codigos.js y Promociones.js son CRLF, y ahí el filtro
    // no quitaba NADA. Se podía comentar el arreglo entero y nada se ponía rojo.
    const cuerpo = 'const a = 1;\n// aquí hay un catch (e) {} de mentira\nconst b = 2;\n';
    const cuenta = (t) => (soloCodigo(t).match(/catch\s*\([^)]*\)\s*\{\s*\}/g) || []).length;
    assert.strictEqual(cuenta(cuerpo), 0, 'con finales de Unix ya fallaba');
    assert.strictEqual(cuenta(cuerpo.split('\n').join('\r\n')), 0,
      'con finales de Windows NO quita los comentarios: cualquier prueba que lea '
      + 'código en Codigos.js o Promociones.js está comprobando comentarios.');
    // Y no se lleva por delante lo que no es comentario.
    assert.ok(soloCodigo("const u = 'https://ejemplo.com';").includes('ejemplo.com'),
      'se comió la mitad de un texto entrecomillado');
  });

  it('EL QUE MUERDE · encuentra el cuerpo de la función, y NO el de la de al lado', () => {
    const casos = [
      ['flecha', 'const enviar = async () => {\n  AQUI;\n};\n'],
      ['flecha con parámetros', 'const anular = async (cod) => {\n  AQUI;\n};\n'],
      // Este es el que se rompió al arreglar el de abajo: saltaba el paréntesis de
      // useCallback ENTERO y agarraba la función siguiente. Todas las cargas del
      // panel son useCallback.
      ['useCallback', 'const cargar = useCallback(async () => {\n  AQUI;\n}, []);\n'
        + 'const otra = () => { OTRA_COSA; };\n'],
      // Y este es el que obligó al arreglo: las llaves de los parámetros se
      // tomaban por el cuerpo, y de 15.000 letras se leían 33.
      ['componente con llaves en los parámetros', 'function C({ irA }) {\n  AQUI;\n}\n'],
    ];
    for (const [nombre, codigo] of casos) {
      const r = cuerpoDeLaFuncion(codigo, 0);
      assert.ok(r && r.texto.includes('AQUI'),
        'con «' + nombre + '» agarró otro trozo: ' + JSON.stringify((r ? r.texto : '').trim()));
      assert.ok(r && !r.texto.includes('OTRA_COSA'),
        'con «' + nombre + '» se metió en la función de al lado');
    }
  });
});
