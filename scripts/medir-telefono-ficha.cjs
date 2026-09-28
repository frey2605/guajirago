#!/usr/bin/env node
/**
 * ¿CUÁL ES EL TELÉFONO DE ESTA PERSONA? — gemelo G08 (28-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-telefono-ficha.cjs
 *
 * La ficha `usuarios/{uid}` puede llevar DOS campos de teléfono:
 *   · `celular`  — lo escribe el REGISTRO (Login.js), una vez.
 *   · `telefono` — lo escriben después «Mi perfil», el alta del conductor y el panel.
 * Y cada pantalla elegía uno en distinto orden. Este guion cuenta, contra los datos
 * VIVOS de producción:
 *   1. cuántas fichas tienen uno, otro, los dos iguales, los dos DISTINTOS, o ninguno;
 *   2. en las que los tienen distintos, qué número enseñaba cada pantalla ANTES;
 *   3. qué número copió el conductor a sus viajes (`conductorTelefono`, el que va
 *      en el MENSAJE DE EMERGENCIA) y a su hoja de `conductores`, comparado con
 *      la ficha — así se ve cuál de los dos era el que se usaba de verdad.
 *
 * No imprime números enteros: enseña solo los 4 últimos dígitos.
 * No escribe nada. Se vuelve a correr en el paso 12.
 */
const { traer, doc } = require('./nube.cjs');

const dig = (x) => String(x == null ? '' : x).replace(/\D/g, '');
const tapar = (x) => { const d = dig(x); return d ? '…' + d.slice(-4) : '(vacío)'; };
const mismo = (a, b) => !!dig(a) && dig(a).slice(-10) === dig(b).slice(-10);

// Lo que hacía cada pantalla ANTES del arreglo (los renglones que cita la
// auditoría), para contar qué número enseñaba cada una.
const ANTES = {
  'Login.js (entrar con correo)': (f) => f.celular || f.telefono || '',
  'App.js (abrir con sesión)': (f) => f.telefono || f.celular || '',
  'MiPerfil.js': (f) => f.telefono || f.celular || '',
  'panel Pasajeros.js': (f) => f.celular || f.telefono || '',
  'panel Conductores.js': (f) => f.telefono || '',
};

async function main() {
  const usuarios = (await traer('usuarios')).map(doc);
  const cuenta = { soloCelular: 0, soloTelefono: 0, igualesTexto: 0, igualesCifras: 0, distintos: 0, ninguno: 0 };
  const distintos = [];
  for (const u of usuarios) {
    const hayC = !!(u.celular && String(u.celular).trim());
    const hayT = !!(u.telefono && String(u.telefono).trim());
    if (hayC && hayT) {
      if (String(u.celular) === String(u.telefono)) cuenta.igualesTexto++;
      else if (mismo(u.celular, u.telefono)) cuenta.igualesCifras++;
      else { cuenta.distintos++; distintos.push(u); }
    } else if (hayC) cuenta.soloCelular++;
    else if (hayT) cuenta.soloTelefono++;
    else cuenta.ninguno++;
  }

  console.log('\n📱 FICHAS usuarios/{uid}: ' + usuarios.length);
  console.log('   solo celular ....................... ' + cuenta.soloCelular);
  console.log('   solo telefono ...................... ' + cuenta.soloTelefono);
  console.log('   los dos, idénticos ................. ' + cuenta.igualesTexto);
  console.log('   los dos, mismas cifras, otro formato ' + cuenta.igualesCifras);
  console.log('   🔴 los dos, DISTINTOS .............. ' + cuenta.distintos);
  console.log('   ninguno ............................ ' + cuenta.ninguno);

  const viajes = (await traer('viajes')).map(doc);
  const conductores = (await traer('conductores')).map(doc);
  const hoja = new Map(conductores.map((c) => [c.id, c]));

  if (distintos.length) {
    console.log('\n🔴 LAS FICHAS CON LOS DOS DISTINTOS — qué enseñaba cada pantalla ANTES:');
    for (const u of distintos) {
      console.log('\n   ' + u.id.slice(0, 8) + '… (' + (u.tipo || 'sin tipo') + ')  celular ' + tapar(u.celular)
        + ' · telefono ' + tapar(u.telefono));
      for (const [pantalla, f] of Object.entries(ANTES)) console.log('      ' + pantalla.padEnd(30) + tapar(f(u)));
      const suyos = viajes.filter((v) => v.conductorId === u.id && v.conductorTelefono);
      if (suyos.length) {
        const deCel = suyos.filter((v) => mismo(v.conductorTelefono, u.celular)).length;
        const deTel = suyos.filter((v) => mismo(v.conductorTelefono, u.telefono)).length;
        console.log('      viajes con su teléfono: ' + suyos.length + ' → del celular ' + deCel + ', del telefono ' + deTel
          + ', de ninguno ' + (suyos.length - deCel - deTel));
      }
      const h = hoja.get(u.id);
      if (h && h.telefono) console.log('      hoja conductores/' + u.id.slice(0, 8) + '… lleva ' + tapar(h.telefono)
        + (mismo(h.telefono, u.telefono) ? ' (= telefono)' : mismo(h.telefono, u.celular) ? ' (= celular)' : ' (ninguno)'));
    }
  }

  // Todos los viajes con teléfono del conductor: ¿cuántos NO coinciden con la regla de ahora?
  const fichas = new Map(usuarios.map((u) => [u.id, u]));
  let conTel = 0; let noCuadra = 0;
  for (const v of viajes) {
    if (!v.conductorTelefono || !v.conductorId) continue;
    const f = fichas.get(v.conductorId);
    if (!f) continue;
    conTel++;
    if (!mismo(f.telefono || f.celular || '', v.conductorTelefono)) noCuadra++;
  }
  console.log('\n🚕 VIAJES con teléfono del conductor: ' + conTel
    + ' · no coinciden con «telefono, y si no hay, celular» de su ficha HOY: ' + noCuadra);
  console.log('   (un viaje guarda el número del día en que se hizo: si luego cambió de teléfono, no cuadra y está bien)\n');
}

main().catch((e) => { console.error('❌ ' + e.message); process.exit(1); });
