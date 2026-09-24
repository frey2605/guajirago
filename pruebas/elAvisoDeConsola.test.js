// ══════════════════════════════════════════════════════════════════════════════
//  EL AVISO DE CONSOLA, VIGILADO
//
//  🔴 El candado (`.claude/candado.cjs`) es un hook PreToolUse y solo lo llaman
//  Write, Edit y NotebookEdit. Lo escrito desde la consola —`sed -i`,
//  `cat > archivo`, `>>`— no pasa por ahí: el candado no lo niega, no lo anota,
//  no dice nada. Eso lo dice su propia cabecera desde el primer día.
//
//  Lo que estaba mal era `CLAUDE.md`, que prometía «antes de CADA escritura».
//  El mismo candado descrito en DOS PAPELES que no decían lo mismo (SEGUNDA
//  LEY), y el que se quedó viejo es el que todo el mundo lee. Mordió el
//  24-sep-2026: se leyeron las leyes, se creyó en una vigilancia que no existía,
//  y se trabajó por consola toda una sesión sin ella.
//
//  Desde hoy la otra puerta tiene TESTIGO —`.claude/aviso-consola.cjs`—, que
//  avisa después. Esta prueba existe para que el testigo no se pueda ablandar y
//  para que los dos papeles no se vuelvan a separar.
//
//  🔑 Se pregunta DÓNDE aparece cada cosa y se EJECUTA lo que decide, no si un
//  texto existe: perseguir formas de escribir no acaba nunca, y este repo ya lo
//  pagó tres veces.
// ══════════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { fueraDeLaFoto } = require('../scripts/guardian.cjs');

const RAIZ = path.resolve(__dirname, '..');
const AVISO = path.join(RAIZ, '.claude/aviso-consola.cjs');
const AJUSTES = path.join(RAIZ, '.claude/settings.json');
const leer = (r) => fs.readFileSync(path.join(RAIZ, r), 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
//  1 · LA PREGUNTA BARATA SE EJECUTA, no se lee
//
//  `fueraDeLaFoto` es pura: se le dan las tres listas. Por eso aquí se le pueden
//  dar casos de mentira sin montar un repo — y un detector que nadie ha visto
//  quejarse no es un detector.
// ─────────────────────────────────────────────────────────────────────────────
describe('LA PREGUNTA BARATA · ¿qué está sucio fuera de la promesa?', () => {
  it('lo que cambió y NO está declarado, lo nombra', () => {
    const fuera = fueraDeLaFoto(['src/App.js'], ['CLAUDE.md'], []);
    assert.deepStrictEqual(fuera, ['src/App.js']);
  });

  it('lo que cambió y SÍ está declarado, lo deja pasar', () => {
    assert.deepStrictEqual(fueraDeLaFoto(['CLAUDE.md'], ['CLAUDE.md'], []), []);
  });

  it('lo que entra por una CARPETA declarada, lo deja pasar', () => {
    // Usa el MISMO `cubrePor` que la revisión entera. Si alguien escribiera aquí
    // una segunda comparación, este caso sería el primero en separarse: una
    // carpeta se declara con barra al final y un `includes` a pelo no lo sabe.
    assert.deepStrictEqual(fueraDeLaFoto(['plan/13-cobros.md'], ['plan/'], []), []);
  });

  it('lo que YA estaba sucio antes de la foto, no cuenta', () => {
    // Si contara, el aviso se quejaría del trabajo de ayer en cada comando, y un
    // vigía que grita siempre se deja de mirar.
    assert.deepStrictEqual(fueraDeLaFoto(['viejo.js'], ['CLAUDE.md'], ['viejo.js']), []);
  });

  it('con la promesa VACÍA, todo lo sucio sale', () => {
    // Sin foto no hay nada declarado: entonces cualquier cambio está fuera. Es el
    // caso que de verdad importa, porque es el de «se me olvidó la foto».
    assert.deepStrictEqual(fueraDeLaFoto(['a.js', 'b.js'], [], []), ['a.js', 'b.js']);
  });

  it('no se cae si le dan listas a medias', () => {
    // El aviso corre después de CADA comando: si revienta, tumba el trabajo.
    assert.deepStrictEqual(fueraDeLaFoto(undefined, undefined, undefined), []);
    assert.deepStrictEqual(fueraDeLaFoto(['x.js'], new Set(['x.js']), null), []);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  2 · EL TESTIGO ESTÁ PUESTO Y CORRE
//
//  Una comprobación que existe pero que nadie llamó es un adorno. Aquí se
//  ENCIENDE el hook de verdad, con la entrada que le manda el sistema.
// ─────────────────────────────────────────────────────────────────────────────
const encender = (entrada) => spawnSync(process.execPath, [AVISO], {
  input: JSON.stringify(entrada), encoding: 'utf8', cwd: RAIZ,
});

describe('EL TESTIGO DE LA CONSOLA · se enciende y no tumba el trabajo', () => {
  it('con un comando de consola, contesta y sale bien', () => {
    const r = encender({ tool_name: 'Bash', tool_input: { command: 'ls' } });
    assert.strictEqual(r.status, 0, 'el aviso NUNCA puede tumbar el trabajo:\n' + r.stderr);
    if (r.stdout.trim()) {
      const j = JSON.parse(r.stdout); // si habla, habla en el idioma del sistema
      assert.strictEqual(j.hookSpecificOutput.hookEventName, 'PostToolUse');
    }
  });

  it('con una herramienta que NO es consola, se calla', () => {
    // El candado ya cubre Write/Edit. Hablar ahí sería ruido doble.
    const r = encender({ tool_name: 'Read', tool_input: { file_path: 'CLAUDE.md' } });
    assert.strictEqual(r.status, 0);
    assert.strictEqual(r.stdout.trim(), '');
  });

  it('con basura por entrada, se calla y sale bien', () => {
    const r = spawnSync(process.execPath, [AVISO], { input: 'no soy json', encoding: 'utf8', cwd: RAIZ });
    assert.strictEqual(r.status, 0);
    assert.strictEqual(r.stdout.trim(), '');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  3 · LOS DOS PAPELES NO SE PUEDEN VOLVER A SEPARAR
//
//  Éste es el amarre que de verdad importa, porque el fallo del 24-sep no fue de
//  código: fue que `CLAUDE.md` describía el candado de una forma y el candado
//  era de otra. La lista de hooks NO se escribe aquí: se le pregunta a
//  `settings.json`, que es quien de verdad decide qué corre.
// ─────────────────────────────────────────────────────────────────────────────
describe('LAS LEYES Y LOS HOOKS DICEN LO MISMO', () => {
  const ajustes = JSON.parse(fs.readFileSync(AJUSTES, 'utf8'));
  const declarados = [];
  for (const evento of Object.keys(ajustes.hooks || {})) {
    for (const grupo of ajustes.hooks[evento]) {
      for (const h of grupo.hooks || []) {
        const m = /\.claude\/([A-Za-z0-9._-]+)/.exec(h.command || '');
        declarados.push({ evento, matcher: grupo.matcher || '', archivo: m ? m[1] : null, crudo: h.command });
      }
    }
  }

  it('hay al menos un hook, y cada uno nombra un archivo de .claude/', () => {
    assert.ok(declarados.length > 0, 'settings.json no declara ningún hook');
    for (const d of declarados) {
      assert.ok(d.archivo, 'este hook no apunta a .claude/: ' + d.crudo);
    }
  });

  it('el archivo de cada hook EXISTE', () => {
    // Una cita que apunta a algo que no existe es un vigilante que no corre — y
    // un hook que no corre no da error: simplemente no mira.
    for (const d of declarados) {
      const abs = path.join(RAIZ, '.claude', d.archivo);
      assert.ok(fs.existsSync(abs), d.evento + ' apunta a .claude/' + d.archivo + ', que no existe');
    }
  });

  it('CLAUDE.md nombra TODOS los hooks que corren', () => {
    // 🔑 Se deriva del sistema de archivos, no de una lista escrita a mano: si
    // mañana entra un tercer hook y nadie lo cuenta en las leyes, esto se pone
    // rojo. Eso es exactamente lo que faltó el 24-sep — un papel que describía
    // media vigilancia como si fuera entera.
    const leyes = leer('CLAUDE.md');
    for (const d of declarados) {
      assert.ok(leyes.includes('.claude/' + d.archivo),
        'CLAUDE.md no nombra .claude/' + d.archivo + ', que sí corre en ' + d.evento);
    }
  });

  it('la consola tiene testigo, y las leyes dicen que avisa DESPUÉS, no que impida', () => {
    const consola = declarados.filter((d) => d.evento === 'PostToolUse' && /Bash/.test(d.matcher));
    assert.strictEqual(consola.length, 1, 'tiene que haber UN testigo de la consola, hay ' + consola.length);
    // Y el candado sigue siendo lo que es: una negación para las OTRAS puertas.
    const puerta = declarados.filter((d) => d.evento === 'PreToolUse');
    assert.ok(puerta.length >= 1, 'el candado PreToolUse desapareció');
    for (const d of puerta) {
      assert.ok(!/Bash/.test(d.matcher),
        'un PreToolUse con matcher Bash haría creer que la consola se puede NEGAR, y no se puede');
    }
  });

  it('el testigo usa el criterio del guardián, no una copia suya', () => {
    // 🔴 Ésta es la SEGUNDA LEY aplicada al vigilante. El día que alguien
    // escriba aquí su propia comparación, el criterio empieza a vivir en dos
    // sitios y uno se queda viejo — ya pasó con `esPapelDelGuardian`, y paró el
    // trabajo. Se comprueba que LO CARGUE, no cómo esté escrito.
    const testigo = leer('.claude/aviso-consola.cjs');
    assert.ok(/require\(['"]\.\.\/scripts\/guardian\.cjs['"]\)/.test(testigo),
      'el aviso de consola ya no carga al guardián: ¿se copió el criterio?');
    assert.ok(testigo.includes('fueraDeLaFoto'),
      'el aviso de consola no usa la pregunta del guardián');
  });
});
