// ══════════════════════════════════════════════════════════════════════════════
//  LA MUDANZA A GOOGLE DRIVE, VIGILADA
//
//  Este guion mueve el proyecto entero. Si se equivoca, lo que se pierde no se
//  recupera — así que no basta con que «se vea bien»: hay que verlo QUEJARSE.
//
//  🔴 Lo que de verdad puede salir mal, y por eso está cada prueba:
//   · que dé por bueno mudarse cuando hay algo sin empujar → un clon lo borra;
//   · que confunda la unidad AL VUELO de Drive (`G:`) con una carpeta de verdad
//     → git y npm abren miles de archivos y allí no están;
//   · que arrastre los node_modules —169.976 archivos, medido— a Drive;
//   · que firme el careo en verde sin haber comparado nada.
//
//  Las partes que deciden son PURAS o se corren contra repos de mentira hechos
//  aquí mismo, así que no hace falta ni Windows ni Drive ni el PC del dueño.
// ══════════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const {
  dondePuedeEstarDrive, motivosParaNoMudar, loQueNoViaja, carear,
  seVuelveAFabricar, clonarEnSuRama, NOMBRE_DESTINO, SE_VUELVEN_A_FABRICAR, HERMANOS,
} = require('../scripts/mudar-a-drive.cjs');

// ─── un repo de mentira, de verdad: git init, commit y empujado a otro de al lado ───
let n = 0;
const nuevaCarpeta = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mudanza-' + (n++) + '-'));
const g = (dir, ...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/** Un repo con su «servidor» al lado, todo empujado: el caso bueno. */
function repoLimpio() {
  const servidor = nuevaCarpeta();
  g(servidor, 'init', '--bare', '-b', 'main');
  const d = nuevaCarpeta();
  g(d, 'init', '-b', 'main');
  g(d, 'config', 'user.email', 'prueba@guajirago');
  g(d, 'config', 'user.name', 'Prueba');
  fs.writeFileSync(path.join(d, 'hola.txt'), 'hola\n');
  fs.writeFileSync(path.join(d, '.gitignore'), 'node_modules/\nbuild/\n.env\n');
  g(d, 'add', '-A');
  g(d, 'commit', '-m', 'primero');
  g(d, 'remote', 'add', 'origin', servidor);
  g(d, 'push', '-u', 'origin', 'main');
  return { dir: d, servidor };
}

// ─────────────────────────────────────────────────────────────────────────────
//  1 · LO QUE PARA EL TRABAJO
//
//  Un clon trae lo que está en GitHub y NADA MÁS. Si esto se ablanda, la mudanza
//  borra trabajo sin decirlo — que es el único daño de aquí que no se deshace.
// ─────────────────────────────────────────────────────────────────────────────
describe('ANTES DE MUDAR · lo que no está en GitHub PARA la mudanza', () => {
  it('con todo empujado, no pone ningún motivo', () => {
    const { dir } = repoLimpio();
    assert.deepStrictEqual(motivosParaNoMudar(dir, 'x'), []);
  });

  it('un archivo sin guardar PARA la mudanza', () => {
    const { dir } = repoLimpio();
    fs.writeFileSync(path.join(dir, 'nuevo.txt'), 'trabajo sin guardar\n');
    const m = motivosParaNoMudar(dir, 'x');
    assert.ok(m.length >= 1, 'no se quejó de un archivo sin guardar');
    assert.match(m.join('\n'), /sin guardar/);
  });

  it('un cambio commiteado y NO empujado PARA la mudanza', () => {
    const { dir } = repoLimpio();
    fs.writeFileSync(path.join(dir, 'hola.txt'), 'cambiado\n');
    g(dir, 'add', '-A');
    g(dir, 'commit', '-m', 'sin empujar');
    const m = motivosParaNoMudar(dir, 'x');
    assert.ok(m.length >= 1, 'no se quejó de un commit que el servidor no tiene');
    assert.match(m.join('\n'), /servidor NO tiene/);
  });

  it('un STASH PARA la mudanza', () => {
    // Las TRAMPAS de CLAUDE.md avisan que el PC tiene TRES stashes, y que uno NO
    // se puede subir (lleva una credencial de Twilio). Un clon los pierde los tres
    // sin decir nada: por eso esto tiene que parar el trabajo, no avisar de paso.
    const { dir } = repoLimpio();
    fs.writeFileSync(path.join(dir, 'hola.txt'), 'a medias\n');
    g(dir, 'stash');
    const m = motivosParaNoMudar(dir, 'x');
    assert.match(m.join('\n'), /stash/i);
  });

  it('sin servidor con quien hablar, PARA — no supone que está respaldado', () => {
    const { dir, servidor } = repoLimpio();
    fs.rmSync(servidor, { recursive: true, force: true });
    const m = motivosParaNoMudar(dir, 'x');
    assert.ok(m.length >= 1, 'se calló cuando no pudo preguntarle al servidor');
    assert.match(m.join('\n'), /servidor/);
  });

  it('una carpeta que no es repo lo dice, no revienta', () => {
    assert.deepStrictEqual(motivosParaNoMudar(nuevaCarpeta(), 'x'), ['no es un repo de git']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  2 · LO QUE NO VIAJA EN EL CLON
// ─────────────────────────────────────────────────────────────────────────────
describe('LO QUE EL CLON NO TRAE · se busca, no se escribe a mano', () => {
  it('un archivo ignorado que EXISTE sale en la lista', () => {
    const { dir } = repoLimpio();
    fs.writeFileSync(path.join(dir, '.env'), 'LLAVE=secreta\n');
    const l = loQueNoViaja(dir).map((x) => x.ruta);
    assert.ok(l.includes('.env'), 'no vio el .env, y un clon no lo trae: ' + JSON.stringify(l));
  });

  it('los node_modules NO salen: se vuelven a bajar', () => {
    // 🔴 Si salieran, la mudanza copiaría 169.976 archivos a Drive (medido el
    //  24-sep-2026) para cuidar los 234 que importan. Eso es exactamente lo que
    //  se comió la copia de Dropbox.
    const { dir } = repoLimpio();
    fs.mkdirSync(path.join(dir, 'node_modules', 'algo'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'node_modules', 'algo', 'x.js'), '1\n');
    fs.mkdirSync(path.join(dir, 'build'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'build', 'main.js'), '1\n');
    const l = loQueNoViaja(dir).map((x) => x.ruta);
    assert.ok(!l.some((r) => r.startsWith('node_modules')), 'iba a copiar node_modules: ' + JSON.stringify(l));
    assert.ok(!l.some((r) => r.startsWith('build')), 'iba a copiar el compilado: ' + JSON.stringify(l));
  });

  it('🔴 los node_modules ANIDADOS tampoco: el hueco que cazó el simulacro', () => {
    // 🔴 ESTA PRUEBA NACE DE UN FALLO MÍO, y de que la primera versión de la de
    //  arriba no lo veía. `loQueNoViaja` preguntaba `startsWith('node_modules/')`,
    //  así que `guajirago/node_modules/` pasaba de largo — y la prueba ponía los
    //  node_modules en la RAÍZ, el único sitio donde el `startsWith` acertaba.
    //  Correrlo contra el repo de verdad lo desmintió en la primera corrida: iba a
    //  copiar 900 MB a Drive. Una prueba que solo mira el caso fácil da permiso.
    const { dir } = repoLimpio();
    const hondo = path.join(dir, 'guajirago', 'functions', 'node_modules', 'x');
    fs.mkdirSync(hondo, { recursive: true });
    fs.writeFileSync(path.join(hondo, 'y.js'), '1\n');
    fs.mkdirSync(path.join(dir, 'guajirago', 'build'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'guajirago', 'build', 'main.js'), '1\n');
    fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\nbuild/\n.env\n');
    const l = loQueNoViaja(dir).map((x) => x.ruta);
    assert.ok(!l.some((r) => r.includes('node_modules')),
      'iba a copiar node_modules anidados: ' + JSON.stringify(l));
    assert.ok(!l.some((r) => r.includes('build')),
      'iba a copiar un compilado anidado: ' + JSON.stringify(l));
  });

  it('🔴 los repos HERMANOS no se copian: se clonan aparte', () => {
    // Copiar su `.git` es exactamente como Dropbox corrompe un repo: a medias.
    for (const h of HERMANOS) {
      assert.ok(seVuelveAFabricar(h + '/'), h + ' se iba a copiar en vez de clonarse');
      assert.ok(seVuelveAFabricar(h + '/src/App.js'), h + ' (un archivo suyo) se iba a copiar');
    }
  });

  it('y el criterio se pregunta por TRAMOS, no por el principio de la ruta', () => {
    assert.strictEqual(seVuelveAFabricar('node_modules/'), true);
    assert.strictEqual(seVuelveAFabricar('guajirago/node_modules/'), true);
    assert.strictEqual(seVuelveAFabricar('guajirago/functions/node_modules/algo/x.js'), true);
    assert.strictEqual(seVuelveAFabricar('guajirago/build/'), true);
    assert.strictEqual(seVuelveAFabricar('guajirago/.firebase/'), true);
    // Y no se pasa de listo: un archivo que solo SE PARECE sí se copia.
    assert.strictEqual(seVuelveAFabricar('.env'), false);
    assert.strictEqual(seVuelveAFabricar('mis-node_modules-notas.txt'), false);
    assert.strictEqual(seVuelveAFabricar('guajirago/buildspec.yml'), false);
  });

  it('y la lista de «se vuelven a fabricar» nombra los dos que pesan', () => {
    assert.ok(SE_VUELVEN_A_FABRICAR.includes('node_modules'));
    assert.ok(SE_VUELVEN_A_FABRICAR.includes('build'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  3 · BUSCAR LA CARPETA DE DRIVE
//
//  Es pura: se le da un PC de mentira. Aquí no hay Windows ni Drive, y aun así
//  se puede exigir que distinga las dos clases — que es lo que decide si el
//  proyecto puede vivir ahí.
// ─────────────────────────────────────────────────────────────────────────────
describe('LA CARPETA DE DRIVE · distingue el espejo de la unidad AL VUELO', () => {
  const pc = (rutas) => dondePuedeEstarDrive(
    { USERPROFILE: 'C:\\Users\\Windows 11' },
    (r) => rutas.includes(r),
  );

  it('encuentra la carpeta espejo y la llama espejo', () => {
    const r = pc(['C:\\Users\\Windows 11' + path.sep + 'Mi unidad']);
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].clase, 'espejo');
  });

  it('🔴 la unidad G: la marca AL VUELO, no espejo', () => {
    // Si la confundiera, mandaría el proyecto a una unidad donde los archivos son
    // marcadores que se bajan al abrirlos. git y npm abren miles: no están.
    const r = pc(['G:\\Mi unidad']);
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].clase, 'al vuelo');
  });

  it('si no hay ninguna, devuelve vacío en vez de inventarse una', () => {
    assert.deepStrictEqual(pc([]), []);
  });

  it('las encuentra todas cuando hay varias, para que el dueño escoja', () => {
    const r = pc(['C:\\Users\\Windows 11' + path.sep + 'Mi unidad', 'G:\\My Drive']);
    assert.strictEqual(r.length, 2);
    assert.deepStrictEqual(r.map((x) => x.clase).sort(), ['al vuelo', 'espejo']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  4 · EL CAREO FINAL
//
//  Es lo único que separa «mudado» de «creo que mudado». Si se puede ablandar,
//  la mudanza firma en verde sin haber comparado nada — y entonces el dueño borra
//  la carpeta vieja fiándose de una firma hueca.
// ─────────────────────────────────────────────────────────────────────────────
describe('EL CAREO · byte a byte, y se queja', () => {
  const clonAlLado = (origen) => { const d = nuevaCarpeta(); fs.rmSync(d, { recursive: true }); execFileSync('git', ['clone', origen, d], { stdio: 'ignore' }); return d; };

  it('un clon fiel sale todo igual', () => {
    const { dir } = repoLimpio();
    const c = carear(dir, clonAlLado(dir));
    assert.ok(c.total >= 2, 'no comparó nada: ' + c.total);
    assert.strictEqual(c.iguales.length, c.total);
    assert.deepStrictEqual(c.distintos, []);
    assert.deepStrictEqual(c.faltan, []);
  });

  it('🔴 un solo byte distinto lo caza', () => {
    const { dir } = repoLimpio();
    const d = clonAlLado(dir);
    fs.writeFileSync(path.join(d, 'hola.txt'), 'holb\n'); // una letra
    const c = carear(dir, d);
    assert.deepStrictEqual(c.distintos, ['hola.txt']);
  });

  it('🔴 un archivo que falta lo caza', () => {
    const { dir } = repoLimpio();
    const d = clonAlLado(dir);
    fs.rmSync(path.join(d, 'hola.txt'));
    const c = carear(dir, d);
    assert.deepStrictEqual(c.faltan, ['hola.txt']);
  });

  it('contra una carpeta vacía NO dice que cuadra', () => {
    // El escape más fácil: comparar contra la nada y no encontrar diferencias.
    const { dir } = repoLimpio();
    const c = carear(dir, nuevaCarpeta());
    assert.strictEqual(c.iguales.length, 0);
    assert.strictEqual(c.faltan.length, c.total);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  5 · EL CLON SE PONE EN LA RAMA DEL ORIGEN
//
//  🔴 ESTA PRUEBA NACE DE UN FALLO QUE SE ESCAPÓ A TODO LO DE ARRIBA. En el primer
//  simulacro de verdad (25-sep-2026), `git clone` a secas trajo LA RAMA POR
//  DEFECTO: la carpeta nueva quedó en `main`, sin dos archivos y con dos versiones
//  viejas, y sin un solo error. Lo cazó el careo byte a byte, no una prueba — y por
//  eso existe ésta: un arreglo que nadie ha visto funcionar vuelve solo.
// ─────────────────────────────────────────────────────────────────────────────
describe('EL CLON · queda en la MISMA rama que el origen, no en la por defecto', () => {
  /** Un servidor con `main` Y una segunda rama que es donde está el trabajo. */
  function conDosRamas() {
    const servidor = nuevaCarpeta();
    g(servidor, 'init', '--bare', '-b', 'main');
    const d = nuevaCarpeta();
    g(d, 'init', '-b', 'main');
    g(d, 'config', 'user.email', 'prueba@guajirago');
    g(d, 'config', 'user.name', 'Prueba');
    fs.writeFileSync(path.join(d, 'viejo.txt'), 'lo de main\n');
    g(d, 'add', '-A'); g(d, 'commit', '-m', 'main');
    g(d, 'remote', 'add', 'origin', servidor);
    g(d, 'push', '-u', 'origin', 'main');
    g(d, 'checkout', '-b', 'claude/trabajo-de-hoy');
    fs.writeFileSync(path.join(d, 'nuevo.txt'), 'lo de hoy\n');
    g(d, 'add', '-A'); g(d, 'commit', '-m', 'el trabajo de hoy');
    g(d, 'push', '-u', 'origin', 'claude/trabajo-de-hoy');
    return { dir: d, servidor };
  }
  const callado = () => {};

  it('🔴 queda en la rama del trabajo, y el archivo nuevo ESTÁ', () => {
    const { dir, servidor } = conDosRamas();
    const destino = nuevaCarpeta(); fs.rmSync(destino, { recursive: true });
    assert.strictEqual(clonarEnSuRama(servidor, destino, 'x', 'claude/trabajo-de-hoy', callado), true);
    assert.strictEqual(g(destino, 'rev-parse', '--abbrev-ref', 'HEAD').trim(), 'claude/trabajo-de-hoy');
    assert.ok(fs.existsSync(path.join(destino, 'nuevo.txt')),
      'quedó en la rama por defecto: falta el archivo del trabajo de hoy');
    // Y el careo tiene que estar de acuerdo: es el que dio la alarma la primera vez.
    const c = carear(dir, destino);
    assert.deepStrictEqual(c.faltan, []);
    assert.deepStrictEqual(c.distintos, []);
  });

  it('si la rama NO está en el servidor, no se calla ni miente', () => {
    // Pasa de verdad: una rama fusionada y borrada. La carpeta queda en otra, y eso
    // hay que decirlo — el careo de después lo confirma.
    const { servidor } = conDosRamas();
    const destino = nuevaCarpeta(); fs.rmSync(destino, { recursive: true });
    const dicho = [];
    assert.strictEqual(clonarEnSuRama(servidor, destino, 'x', 'rama/que-no-existe', (s) => dicho.push(s)), true);
    assert.match(dicho.join('\n'), /no se pudo poner/);
    assert.strictEqual(g(destino, 'rev-parse', '--abbrev-ref', 'HEAD').trim(), 'main');
  });

  it('si el clon falla, devuelve false en vez de seguir como si nada', () => {
    const destino = nuevaCarpeta(); fs.rmSync(destino, { recursive: true });
    assert.strictEqual(clonarEnSuRama('/no/existe/este/repo', destino, 'x', 'main', () => {}), false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  6 · EL NOMBRE QUE PIDIÓ EL DUEÑO
// ─────────────────────────────────────────────────────────────────────────────
describe('LA CARPETA SE LLAMA COMO PIDIÓ EL DUEÑO', () => {
  it('«Guajira Go Proyecto», tal cual', () => {
    assert.strictEqual(NOMBRE_DESTINO, 'Guajira Go Proyecto');
  });
});
