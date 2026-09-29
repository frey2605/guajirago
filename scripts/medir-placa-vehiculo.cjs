#!/usr/bin/env node
/**
 * 🚘 ¿SIRVEN LAS PLACAS Y LOS VEHÍCULOS? — gemelo G45 (28-sep-2026). SOLO LECTURA.
 *
 * Qué cuenta:
 *   1. LOS DATOS (Firestore VIVO, producción): cada conductor con su placa y su vehículo guardados, por su
 *      FORMA (cada letra → «A», cada cifra → «9»; no enseña ninguna placa). Dice cuántas placas cumplen la
 *      regla única (guajirago/src/vehiculoConductor.js: 6 letras o números), cuántas ya están guardadas en su
 *      forma limpia, cuántos vehículos son «Marca Año», y cuántos tienen `vehiculo` distinto de marca + modelo.
 *      NO corrige nada: lo que no cumpla se anota para el dueño.
 *   2. EL CÓDIGO (sin red): saca del archivo y CORRE
 *        · el trozo de la placa del registro del conductor (App.js, `guardar` de PantallaDatosConductor), y
 *        · la edición del panel (guajirago-admin/src/Conductores.js, `guardarEdicion`),
 *      con placas y vehículos de mentira, y dice qué habría guardado cada uno.
 *      Con `--commit <hash>` (repo raíz) y `--commit-panel <hash>` (repo del panel) corre el código de esos
 *      commits: así se carea el de antes con el de ahora.
 *
 * Uso:  node scripts/medir-placa-vehiculo.cjs [--commit <hash>] [--commit-panel <hash>] [--solo-codigo]
 * No escribe nada. Usa la casa común de datos (scripts/nube.cjs).
 */
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { cargarDeLaApp, cuerpoDeLaFuncion, soloCodigo } = require('../pruebas/cargar.cjs');

const RAIZ = path.join(__dirname, '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };

/** El texto de un archivo: del disco, o de un commit (`repo` es la carpeta del repo dentro de RAIZ, '' = raíz). */
function textoDe(repo, ruta, commit) {
  if (!commit) {
    const p = path.join(RAIZ, repo, ruta);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  }
  try {
    return execFileSync('git', ['-C', path.join(RAIZ, repo), 'show', commit + ':' + ruta], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch { return null; }
}

/** Las piezas puras de un archivo (o {} si en ese commit no existía). */
function piezas(repo, ruta, commit) {
  const t = textoDe(repo, ruta, commit);
  return t == null ? {} : cargarDeLaApp(path.posix.join(repo, ruta), t);
}

// ── EL CÓDIGO ──────────────────────────────────────────────────────────────────────────────────────────────

/** `const <nombre> = async () => {…}` sacado del texto y listo para correr con un ámbito de mentira. */
function funcionDelTexto(texto, nombre, archivo) {
  const marca = 'const ' + nombre + ' = ';
  const desde = texto.indexOf(marca);
  if (desde < 0) throw new Error('no está `' + marca + '` en ' + archivo);
  if (texto.indexOf(marca, desde + 1) >= 0) throw new Error('hay DOS `' + marca + '` en ' + archivo);
  const cuerpo = cuerpoDeLaFuncion(texto, desde);
  // eslint-disable-next-line no-new-func
  const f = new Function('ambito', 'with (ambito) { return (async () => {' + cuerpo.texto + '\n})(); }');
  return (dados) => f(new Proxy(dados, {
    has: (d, k) => typeof k === 'string' && ((k in d) || /^set[A-Z]/.test(k) || !(k in globalThis)),
    get: (d, k) => {
      if (k in d) return d[k];
      if (typeof k !== 'string') return undefined;
      if (/^set[A-Z]/.test(k)) return () => {};
      if (k in globalThis) return globalThis[k];
      throw new Error(archivo + ' · ' + nombre + ' usa «' + k + '» y el medidor no se lo dio');
    },
  }));
}

/**
 * EL PANEL: corre `guardarEdicion` con `datosEdit` y devuelve { guardo: {…} | null, aviso }.
 * `fuente` es el texto de Conductores.js; `pz` las piezas del panel que puede usar.
 */
async function correrEdicionDelPanel(fuente, pz, datosEdit) {
  const guardar = funcionDelTexto(fuente, 'guardarEdicion', 'guajirago-admin/src/Conductores.js');
  const r = { guardo: null, aviso: null };
  await guardar({
    ...pz,
    db: {}, doc: (...a) => a.slice(1).join('/'),
    updateDoc: async (_ref, datos) => { r.guardo = datos; },
    seleccionado: { id: 'c1', placa: 'ABC123', vehiculo: 'Chevrolet 2015', marca: 'Chevrolet', modelo: '2015' },
    datosEdit,
    cargarTodo: () => {},
    setAviso: (a) => { r.aviso = a; },
    apuntarRechazo: () => {},
    motivoDeRechazo: (e) => ({ titulo: 'falló', texto: String(e) }),
  });
  return r;
}

/**
 * EL REGISTRO: saca de `guardar` (App.js) el trozo que decide la placa —del `if (!placa)` al `if (!marca)`— y
 * lo corre; y del `setDoc` saca la expresión con que se GUARDA la placa y la evalúa.
 * Devuelve { pasa, guarda } (guarda = lo que se escribiría en la ficha si pasa).
 */
function correrPlacaDelRegistro(fuente, pz, placa) {
  const t = soloCodigo(fuente).replace(/\r\n/g, '\n');
  const pantalla = t.indexOf('function PantallaDatosConductor(');
  if (pantalla < 0) throw new Error('no está PantallaDatosConductor en App.js');
  const g = t.indexOf('const guardar = async', pantalla);
  const cuerpo = t.slice(g, cuerpoDeLaFuncion(t, g).fin + 1);
  const a = cuerpo.indexOf('if (!placa)');
  const b = cuerpo.indexOf('if (!marca)');
  if (a < 0 || b < a) throw new Error('no encuentro el trozo de la placa en guardar (App.js)');
  const trozo = cuerpo.slice(a, b);
  const nombres = Object.keys(pz);
  // eslint-disable-next-line no-new-func
  const decide = new Function('placa', 'setError', 'setCampoError', ...nombres, trozo + '\nreturn true;');
  const pasa = decide(placa, () => {}, () => {}, ...nombres.map((n) => pz[n])) === true;
  const sd = cuerpo.indexOf('setDoc(');
  const m = cuerpo.slice(sd).match(/\n\s*placa: ([^\n]+),\n/);
  if (!m) throw new Error('no encuentro `placa:` en el setDoc de guardar (App.js)');
  // eslint-disable-next-line no-new-func
  const guarda = new Function('placa', ...nombres, 'return (' + m[1] + ');')(placa, ...nombres.map((n) => pz[n]));
  return { pasa, guarda };
}

// Los casos de mentira. `ok` es lo que la REGLA dice (vehiculoConductor.js).
const PLACAS = ['ABC123', 'ABC12D', 'abc-123', 'ABC 12', 'AB 12', 'ABC1234567', 'AB#123', ''];
const VEHICULOS = ['Chevrolet 2015', '  renault   2019 ', 'hola', 'Chevrolet 1985', 'Chevrolet'];

async function medirCodigo(commit, commitPanel) {
  const fuenteApp = textoDe('', 'guajirago/src/App.js', commit);
  const pzApp = piezas('', 'guajirago/src/vehiculoConductor.js', commit);
  const fuentePanel = textoDe('guajirago-admin', 'src/Conductores.js', commitPanel);
  const pzPanel = {
    ...piezas('guajirago-admin', 'src/telefonoValido.js', commitPanel),
    ...piezas('guajirago-admin', 'src/telefonoUsuario.js', commitPanel),
    ...piezas('guajirago-admin', 'src/vehiculoConductor.js', commitPanel),
  };
  const filas = { registro: [], panelPlaca: [], panelVehiculo: [] };
  for (const p of PLACAS) {
    const r = correrPlacaDelRegistro(fuenteApp, pzApp, p);
    filas.registro.push({ escrita: p, pasa: r.pasa, guarda: r.pasa ? r.guarda : null });
    const e = await correrEdicionDelPanel(fuentePanel, pzPanel, { placa: p.toUpperCase() });
    filas.panelPlaca.push({ escrita: p, guarda: e.guardo ? e.guardo.placa : null, aviso: e.aviso ? e.aviso.titulo : null });
  }
  for (const v of VEHICULOS) {
    const e = await correrEdicionDelPanel(fuentePanel, pzPanel, { vehiculo: v });
    filas.panelVehiculo.push({ escrito: v, guarda: e.guardo, aviso: e.aviso ? e.aviso.titulo : null });
  }
  return filas;
}

// ── LOS DATOS ──────────────────────────────────────────────────────────────────────────────────────────────

const forma = (v) => String(v).replace(/[A-Z]/g, 'A').replace(/[a-z]/g, 'a').replace(/\d/g, '9');

function contarDatos(usuarios, regla) {
  const conductores = usuarios.filter((u) => u.tipo === 'conductor' || u.placa || u.vehiculo);
  const r = {
    conductores: conductores.length, conPlaca: 0, placaSirve: 0, placaNoSirve: 0, placaYaLimpia: 0,
    conVehiculo: 0, vehiculoSirve: 0, vehiculoNoSirve: 0, vehiculoDistintoDeMarcaModelo: 0,
    formasPlaca: {}, formasNoSirven: [], vehiculosNoSirven: [],
  };
  for (const u of conductores) {
    const tipo = u.tipoVehiculo || '(sin tipo)';
    if (u.placa != null && u.placa !== '') {
      r.conPlaca++;
      const k = tipo + ' · ' + forma(u.placa);
      r.formasPlaca[k] = (r.formasPlaca[k] || 0) + 1;
      if (regla.placaLimpia) {
        const limpia = regla.placaLimpia(u.placa);
        if (limpia) r.placaSirve++; else { r.placaNoSirve++; r.formasNoSirven.push(k + ' (ficha ' + u.id.slice(0, 6) + '…)'); }
        if (limpia && limpia === u.placa) r.placaYaLimpia++;
      }
    }
    if (u.vehiculo != null && u.vehiculo !== '') {
      r.conVehiculo++;
      if (regla.datosDelVehiculo) {
        if (regla.datosDelVehiculo(u.vehiculo)) r.vehiculoSirve++;
        else { r.vehiculoNoSirve++; r.vehiculosNoSirven.push(forma(u.vehiculo) + ' (ficha ' + u.id.slice(0, 6) + '…)'); }
      }
      if (u.marca != null && u.modelo != null && u.vehiculo !== `${u.marca} ${u.modelo}`) r.vehiculoDistintoDeMarcaModelo++;
    }
  }
  return r;
}

async function main() {
  const commit = arg('--commit');
  const commitPanel = arg('--commit-panel');
  console.log('\n🚘 G45 · PLACA Y VEHÍCULO — solo lectura\n');

  console.log('── EL CÓDIGO ' + (commit || commitPanel ? '(app ' + (commit || 'disco') + ' · panel ' + (commitPanel || 'disco') + ')' : '(el del disco)') + ' ──');
  const c = await medirCodigo(commit, commitPanel);
  console.log('  REGISTRO del conductor (App.js):');
  for (const f of c.registro) console.log('    ' + JSON.stringify(f.escrita).padEnd(14) + (f.pasa ? '→ guarda ' + JSON.stringify(f.guarda) : '→ NO deja seguir'));
  console.log('  EDICIÓN del panel, la placa (Conductores.js):');
  for (const f of c.panelPlaca) console.log('    ' + JSON.stringify(f.escrita).padEnd(14) + (f.guarda != null ? '→ guarda ' + JSON.stringify(f.guarda) : '→ NO guarda · ventanita «' + f.aviso + '»'));
  console.log('  EDICIÓN del panel, el vehículo:');
  for (const f of c.panelVehiculo) console.log('    ' + JSON.stringify(f.escrito).padEnd(22) + (f.guarda ? '→ guarda ' + JSON.stringify(f.guarda) : '→ NO guarda · ventanita «' + f.aviso + '»'));
  const malasQueGuardaElPanel = c.panelPlaca.filter((f, i) => f.guarda != null && !['ABC123', 'ABC12D', 'abc-123'].includes(PLACAS[i])).length;
  console.log('  → el panel guarda ' + malasQueGuardaElPanel + ' de ' + (PLACAS.length - 3) + ' placas que no sirven');

  if (process.argv.includes('--solo-codigo')) return;

  console.log('\n── LOS DATOS (producción) ──');
  const { traer, doc } = require('./nube.cjs');
  const usuarios = (await traer('usuarios')).map(doc);
  const regla = piezas('', 'guajirago/src/vehiculoConductor.js', null);
  if (!regla.placaLimpia) console.log('  (la regla guajirago/src/vehiculoConductor.js no existe en el disco: solo formas)');
  const d = contarDatos(usuarios, regla);
  console.log('  fichas leídas: ' + usuarios.length + ' · con datos de conductor: ' + d.conductores);
  console.log('  PLACAS guardadas: ' + d.conPlaca + ' · cumplen la regla: ' + d.placaSirve + ' · NO la cumplen: ' + d.placaNoSirve
    + ' · ya en la forma limpia: ' + d.placaYaLimpia);
  for (const [k, n] of Object.entries(d.formasPlaca).sort()) console.log('    ' + k.padEnd(28) + n);
  if (d.formasNoSirven.length) console.log('  ⚠ no cumplen (NO se corrigen, van para el dueño): ' + d.formasNoSirven.join(' · '));
  console.log('  VEHÍCULOS guardados: ' + d.conVehiculo + ' · «Marca Año»: ' + d.vehiculoSirve + ' · NO: ' + d.vehiculoNoSirve
    + ' · distintos de marca + modelo: ' + d.vehiculoDistintoDeMarcaModelo);
  if (d.vehiculosNoSirven.length) console.log('  ⚠ no cumplen: ' + d.vehiculosNoSirven.join(' · '));
}

module.exports = { correrEdicionDelPanel, correrPlacaDelRegistro, medirCodigo, contarDatos, PLACAS, VEHICULOS };

if (require.main === module) {
  main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
}
