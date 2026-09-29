#!/usr/bin/env node
/**
 * ¿CUÁL ES LA FOTO DE ESTA PERSONA? — gemelo G43 (28-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-foto-ficha.cjs
 *
 * La foto de perfil se guarda en la ficha `usuarios/{uid}` como `fotoConductor` —aunque la
 * persona sea pasajero: «Mi perfil» y el alta del conductor escriben ese nombre—. Y cada
 * pantalla la buscaba a su manera: la app `fotoConductor || foto`, la pantalla del conductor
 * solo `fotoConductor`, el panel de Conductores solo `fotoConductor` y el panel de Pasajeros
 * solo `foto`, un campo que nadie escribe.
 *
 * Este guion cuenta, contra los datos VIVOS de producción:
 *   1. qué campos con «foto» en el nombre hay en las fichas, y cuántas los llevan;
 *   2. por grupo (conductores / pasajeros), cuántos tienen foto guardada, cuántos enseñaba
 *      cada pantalla ANTES y cuántos enseña la regla de ahora (`fotoDe`, sacada del archivo
 *      y corrida).
 *
 * No imprime enlaces: solo cuenta. No escribe nada. Se vuelve a correr en el paso 12.
 */
const { traer, doc } = require('./nube.cjs');
const { cargarDeLaApp } = require('../pruebas/cargar.cjs');

// Lo que hacía cada pantalla ANTES del arreglo.
const ANTES = {
  'App.js / Home.js / MiPerfil.js': (f) => f.fotoConductor || f.foto || null,
  'AppConductor.js (cargarSaldo)': (f) => f.fotoConductor || null,
  'panel Conductores.js': (f) => f.fotoConductor || null,
  'panel Pasajeros.js': (f) => f.foto || null,
};

async function main() {
  let fotoDe = null;
  try { ({ fotoDe } = cargarDeLaApp('guajirago/src/fotoUsuario.js')); } catch (e) { /* antes del arreglo no existe */ }

  const usuarios = (await traer('usuarios')).map(doc);
  const campos = {};
  for (const u of usuarios) {
    for (const k of Object.keys(u)) {
      if (/foto/i.test(k) && u[k]) campos[k] = (campos[k] || 0) + 1;
    }
  }
  console.log('\n🖼️  FICHAS usuarios/{uid}: ' + usuarios.length);
  console.log('   campos con «foto» en el nombre (con valor):');
  for (const [k, n] of Object.entries(campos).sort()) console.log('      ' + k.padEnd(28) + n);

  const grupos = {
    conductores: usuarios.filter((u) => u.tipo === 'conductor'),
    // El panel de Pasajeros lee `tipo != conductor`.
    pasajeros: usuarios.filter((u) => u.tipo !== 'conductor'),
  };
  for (const [nombre, lista] of Object.entries(grupos)) {
    const conFoto = lista.filter((u) => u.fotoConductor || u.foto).length;
    console.log('\n👥 ' + nombre.toUpperCase() + ': ' + lista.length + ' · con foto guardada (fotoConductor o foto): ' + conFoto);
    for (const [pantalla, f] of Object.entries(ANTES)) {
      console.log('   ANTES  ' + pantalla.padEnd(32) + 'enseña ' + lista.filter((u) => f(u)).length);
    }
    if (fotoDe) console.log('   AHORA  ' + 'fotoDe (todas las pantallas)'.padEnd(32) + 'enseña ' + lista.filter((u) => fotoDe(u)).length);
    else console.log('   AHORA  (todavía no existe guajirago/src/fotoUsuario.js)');
  }
  console.log('');
}

main().catch((e) => { console.error('❌ ' + e.message); process.exit(1); });
