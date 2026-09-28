#!/usr/bin/env node
// 🤖 EL PASAJERO CANCELA UN VIAJE Y LEE LOS MOTIVOS — gemelo G06 (28-sep-2026).
// Entra como el pasajero de prueba (pasajero@gg.test), pide un Taxi en PRUEBAS con un GPS de mentira, y en la
// pantalla de espera toca «Cancelar viaje». En la ventanita «¿Por qué cancelas?» mira el color que PINTA EL
// NAVEGADOR de verdad (no el código) en la letra de cada motivo y en su fondo, y calcula el contraste: antes era
// blanco sobre blanco (1,0) y el pasajero veía cajas vacías. Luego escoge «Otro motivo», confirma, y exige que
// vuelva al inicio y que el viaje quede cancelado en la base de pruebas con ese motivo.
// Deja en pruebas UN viaje, ya cancelado (no le llega a nadie como viaje vivo).
//   node robot/cancelar-viaje.cjs
const { abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');
const { contraste, CONTRASTE_MINIMO } = require('../scripts/medir-cancelacion-g06.cjs');

const CORREO = 'pasajero@gg.test';
const LAT = 11.5444;
const LNG = -72.9072;

// Va como TEXTO porque el motor no le pasa datos a lo que corre antes de cargar (ver APRENDIDO.md).
const antesDeCargar = '(' + ((lat, lng) => {
  const pos = () => ({ coords: { latitude: lat, longitude: lng, accuracy: 10 }, timestamp: Date.now() });
  const geo = {
    getCurrentPosition: (ok) => setTimeout(() => ok(pos()), 200),
    watchPosition: (ok) => { setTimeout(() => ok(pos()), 200); return 1; },
    clearWatch: () => {},
  };
  Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
}) + ')(' + LAT + ',' + LNG + ');';

const aRgb = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return s; const p = m[1].split(',').map((x) => x.trim()); return p.length === 4 ? 'rgba(' + p.join(',') + ')' : 'rgb(' + p.join(',') + ')'; };

(async () => {
  const fallos = [];
  const r = await abrir('transporte', { nombre: 'cancelar-viaje', antesDeCargar });
  const p = r.pagina;
  // El id del viaje se saca de lo que la app le manda a Firestore al crearlo (el SDK arma el id en el aparato).
  const vistos = new Set();
  p.on('request', (req) => {
    let b = '';
    try { b = decodeURIComponent(req.postData() || ''); } catch (e) { b = req.postData() || ''; }
    for (const m of b.matchAll(/documents\/viajes\/([A-Za-z0-9]{20})/g)) vistos.add(m[1]);
  });
  try {
    await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
    await p.waitForTimeout(800);
    await p.fill('input[placeholder="Correo electrónico"]', CORREO);
    await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
    await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
    await p.waitForTimeout(8000);
    for (const paso of ['Transporte y movilidad', 'Soy pasajero']) {
      const x = p.getByText(paso, { exact: true });
      if (await x.count()) { await x.first().click(); await p.waitForTimeout(2500); }
    }
    await p.getByText('Taxi', { exact: true }).first().click();
    await p.waitForTimeout(4000);
    await p.fill('input[placeholder="¿Dónde estás? (Riohacha)"]', 'Calle 1 # 1-1 prueba del robot');
    await p.fill('input[placeholder="¿A dónde vas? (Riohacha)"]', 'Terminal de transportes');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(1500);
    await r.captura('formulario');
    await p.getByRole('button', { name: /^Solicitar Taxi/ }).click();
    await p.waitForTimeout(6000);
    await r.captura('esperando');
    const cancelar = p.getByRole('button', { name: 'Cancelar viaje', exact: true });
    if (!(await cancelar.count())) throw new Error('no llegué a la pantalla de espera: ' + (await r.texto()).slice(0, 200));
    await cancelar.first().click();
    await p.waitForTimeout(1200);
    await r.captura('ventanita');

    // Lo que PINTA el navegador en cada motivo: letra, fondo y el fondo de la tarjeta de debajo.
    const motivos = await p.getByRole('button', { name: /^○ / }).evaluateAll((bs) => bs.map((b) => {
      const s = getComputedStyle(b);
      const tarjeta = getComputedStyle(b.parentElement.parentElement);
      return { texto: b.innerText.trim(), letra: s.color, fondo: s.backgroundColor, tarjeta: tarjeta.backgroundColor };
    }));
    if (motivos.length !== 5) fallos.push('esperaba 5 motivos y la ventanita tiene ' + motivos.length);
    for (const m of motivos) {
      if (m.tarjeta !== 'rgb(255, 255, 255)') fallos.push('la tarjeta ya no es blanca (' + m.tarjeta + '): el contraste se mide sobre otra cosa');
      const c = contraste(aRgb(m.letra), aRgb(m.fondo));
      console.log('MOTIVO', m.texto.padEnd(30), 'letra', m.letra, 'sobre', m.fondo, '· contraste', c, c >= CONTRASTE_MINIMO ? '✓' : '🔴 NO SE LEE');
      if (c < CONTRASTE_MINIMO) fallos.push('el motivo «' + m.texto + '» no se lee: ' + m.letra + ' sobre ' + m.fondo + ' (contraste ' + c + ')');
    }

    await p.getByRole('button', { name: /Otro motivo/ }).click();
    await p.getByRole('button', { name: 'Confirmar cancelación' }).click();
    await p.waitForTimeout(5000);
    await r.captura('cancelado');
    const t = await r.texto();
    // Al entrar la cancelación la pantalla vuelve al inicio (onVolver) y el «Viaje cancelado.» del candado no llega a
    // verse: es así desde antes de G06 (ver APRENDIDO.md). Se exige volver al inicio; la verdad la da la base.
    if (!/¿QUÉ NECESITAS\?/.test(t)) fallos.push('después de confirmar no volvió al inicio: ' + t.slice(0, 200));

    // Y en la base de pruebas: el último viaje del pasajero quedó cancelado por él con el motivo escogido.
    const base = await entrarALaBase(CORREO);
    const ids = [...vistos];
    console.log('VIAJES QUE LA APP NOMBRÓ AL ESCRIBIR:', ids.join(', ') || '(ninguno)');
    if (ids.length !== 1) fallos.push('esperaba que la app escribiera en UN viaje y nombró ' + ids.length);
    const idViaje = ids[0];
    if (idViaje) {
      const v = await base.leer('viajes/' + idViaje);
      console.log('EN LA BASE:', idViaje, '·', v.estado, '·', v.canceladoPor, '·', v.razonCancelacion);
      if (v.estado !== 'cancelado' || v.canceladoPor !== 'pasajero' || v.razonCancelacion !== 'Otro motivo') {
        fallos.push('el viaje no quedó cancelado por el pasajero con «Otro motivo»: ' + [v.estado, v.canceladoPor, v.razonCancelacion].join(' · '));
      }
    }
  } finally {
    console.log('CAPTURAS:', r.carpeta);
    console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
    await r.cerrar();
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ el pasajero lee los cinco motivos y cancela con el que escogió');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
