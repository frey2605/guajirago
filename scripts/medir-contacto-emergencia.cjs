#!/usr/bin/env node
/**
 * ¿EL CONTACTO DE EMERGENCIA GUARDADO SIRVE? — gemelo G10 (28-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-contacto-emergencia.cjs
 *
 * El contacto de confianza (`usuarios/{uid}.contactoConfianzaNumero`) lo escriben dos
 * pantallas: el REGISTRO (Login.js), que exigía 10 cifras, y SEGURIDAD (Seguridad.js),
 * que solo exigía que no estuviera vacío. Los dos botones de emergencia le pegaban un
 * 57 delante a lo que hubiera, así que «300 123 45» abría wa.me/5730012345 (no existe)
 * y «abc» abría wa.me/57 (no avisa a nadie).
 *
 * Cuenta, contra los datos VIVOS de producción:
 *   1. cuántas fichas tienen contacto guardado;
 *   2. cuántos SIRVEN y cuántos NO, con la regla única (guajirago/src/telefonoValido.js
 *      si ya existe —se carga y se EJECUTA, no se copia—; si no, la del registro: 10 cifras);
 *   3. qué habría abierto el botón de emergencia ANTES con cada uno que no sirve.
 *
 * No imprime números enteros: solo cuántas cifras tiene y los 2 últimos dígitos.
 * No escribe nada: los que no sirven se ANOTAN para el dueño, no se corrigen.
 * Se vuelve a correr en el paso 12.
 */
const fs = require('fs');
const path = require('path');
const { traer, doc } = require('./nube.cjs');

const PIEZA = 'guajirago/src/telefonoValido.js';

function laRegla() {
  if (fs.existsSync(path.join(__dirname, '..', PIEZA))) {
    const { cargarDeLaApp } = require('../pruebas/cargar.cjs');
    const { celularDiezCifras } = cargarDeLaApp(PIEZA);
    return { de: PIEZA, sirve: (x) => !!celularDiezCifras(x) };
  }
  return { de: 'Login.js de antes (10 cifras)', sirve: (x) => String(x).replace(/\D/g, '').length === 10 };
}

// Lo que hacían los dos botones de emergencia ANTES del arreglo.
const waDeAntes = (x) => {
  const n = String(x || '').replace(/\D/g, '');
  return 'wa.me/' + (n.startsWith('57') ? n : '57' + n);
};
const tapar = (x) => {
  const d = String(x || '').replace(/\D/g, '');
  return d.length + ' cifras' + (d ? ' (…' + d.slice(-2) + ')' : '') + (/[^\d\s+().-]/.test(String(x)) ? ' + letras' : '');
};
const taparWa = (w) => w.replace(/\d(?=\d{2})/g, '•');

async function main() {
  const regla = laRegla();
  const usuarios = (await traer('usuarios')).map(doc);
  const conContacto = usuarios.filter((u) => String(u.contactoConfianzaNumero || '').trim() !== '');
  const malos = conContacto.filter((u) => !regla.sirve(u.contactoConfianzaNumero));
  const conPrefijo = conContacto.filter((u) => String(u.contactoConfianzaNumero).replace(/\D/g, '').length === 12);

  console.log('\n🆘 CONTACTO DE EMERGENCIA — regla: ' + regla.de);
  console.log('   fichas usuarios/{uid} ............... ' + usuarios.length);
  console.log('   con contacto guardado ............... ' + conContacto.length);
  console.log('   ✓ sirven ............................ ' + (conContacto.length - malos.length));
  console.log('   🔴 NO sirven ........................ ' + malos.length);
  console.log('   (guardados con +57 delante: ' + conPrefijo.length + ')');
  for (const u of malos) {
    console.log('      ' + u.id.slice(0, 8) + '… (' + (u.tipo || 'sin tipo') + ') guardado: ' + tapar(u.contactoConfianzaNumero)
      + ' · antes abría ' + taparWa(waDeAntes(u.contactoConfianzaNumero)));
  }
  console.log('\n   (Los que no sirven NO se tocan: se anotan para el dueño. El pasajero lo corrige en Seguridad.)\n');
}

main().catch((e) => { console.error('❌ ' + e.message); process.exit(1); });
