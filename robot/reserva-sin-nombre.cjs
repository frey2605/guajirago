#!/usr/bin/env node
// 🤖 UN TOUR SIN NOMBRE NI CÓDIGO YA NO TRANCA LA RESERVA — P16 (1-oct-2026). En PRUEBAS:
//   0. Como la agencia de prueba (agencia@gg.test), su lista de tours gana UNO sin nombre y sin id (destacado, para que
//      salga primero), con la descripción «Tour de mentira del robot P16».
//   1. Como una persona: pasajero@gg.test → Turismo → «Agencia de Turismo de Prueba» → «Reservar» en ese tour, escoge el
//      día, pone un teléfono y toca «Enviar reserva». Hasta P16 la reserva no salía del teléfono (mandaba `nombreTour` y
//      `tourId` en undefined) y el cliente veía «No se pudo enviar la reserva» cada vez. Ahora tiene que salir
//      «¡Reserva enviada!», y en la base la reserva tiene que decir «Tour», sin `tourId`.
//   2. La reserva la cancela la administradora de pruebas (el cliente ya no cambia el estado) y a la agencia se le
//      devuelven sus tours de antes: no queda nada cambiado.
//   node robot/reserva-sin-nombre.cjs
const { abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');

const AGENCIA = 'negocios/prueba-agencia';
const DESCRIPCION = 'Tour de mentira del robot P16';

(async () => {
  const fallos = [];
  const ag = await entrarALaBase('agencia@gg.test');
  const antes = await ag.leer(AGENCIA);
  const toursAntes = Array.isArray(antes.tours) ? antes.tours : [];
  const tour = { tipo: 'tour', descripcion: DESCRIPCION, precio: 1000, unidadPrecio: 'persona', duracion: '1 hora', categoria: 'Otro',
    cupoMax: 0, puntoEncuentro: '', incluye: [], imagen: '', destacado: true, disponible: true, vecesReservado: 0 };
  const telefono = '315' + String(Date.now()).slice(-7);
  let visto = null; let id = null; let r = null;
  try {
    // SOLO el tour del robot (como unidades-tour.cjs): los sembrados en pruebas llevan `incluye` como texto y la
    // pantalla de la agencia se cae con ellos (anotado en APRENDIDO.md; sembrar-pruebas.cjs).
    await ag.cambiar(AGENCIA, { tours: [tour] });
    r = await abrir('transporte', { nombre: 'reserva-sin-nombre' });
    const p = r.pagina;
    try {
      await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
      await p.waitForTimeout(800);
      await p.fill('input[placeholder="Correo electrónico"]', 'pasajero@gg.test');
      await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
      await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
      await p.waitForTimeout(8000);
      await p.getByText('Turismo', { exact: true }).first().click();
      await p.waitForTimeout(5000);
      await p.getByText('Agencia de Turismo de Prueba').first().click();
      await p.waitForTimeout(3000);
      await r.captura('agencia');
      // El «Reservar» de la tarjeta que lleva la descripción del robot.
      const toco = await p.evaluate((desc) => {
        const d = [...document.querySelectorAll('p')].find((x) => x.textContent.trim() === desc);
        let caja = d && d.parentElement;
        while (caja && ![...caja.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Reservar')) caja = caja.parentElement;
        const b = caja && [...caja.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Reservar');
        if (!b) return false;
        b.click();
        return true;
      }, DESCRIPCION);
      if (!toco) throw new Error('no encontré el tour del robot en la agencia');
      await p.waitForTimeout(1500);
      await p.fill('input[type="date"]', '2026-10-05');
      await p.fill('input[placeholder="10 números"]', telefono);
      await r.captura('formulario');
      await p.getByRole('button', { name: 'Enviar reserva' }).click();
      await p.waitForTimeout(8000);
      await r.captura('enviada');
      visto = await p.evaluate(() => ({
        enviada: document.body.innerText.includes('¡Reserva enviada!'),
        noSePudo: document.body.innerText.includes('No se pudo enviar la reserva'),
        ids: (() => { try { return JSON.parse(localStorage.getItem('misReservasGuajira')) || []; } catch (e) { return []; } })(),
      }));
    } finally { await r.cerrar(); }
    console.log('LA APP: ' + JSON.stringify({ enviada: visto.enviada, noSePudo: visto.noSePudo }) + ' · capturas', r.carpeta);
    if (!visto.enviada) fallos.push('no salió «¡Reserva enviada!»');
    if (visto.noSePudo) fallos.push('el cliente vio «No se pudo enviar la reserva»');
    id = visto.enviada ? visto.ids[visto.ids.length - 1] : null;
    if (visto.enviada && !id) fallos.push('la app no recordó la reserva en «Mis reservas»');
    if (id) {
      const yo = await entrarALaBase('pasajero@gg.test');
      const res = await yo.leer('reservasTurismo/' + id);
      console.log('EN LA BASE: ' + JSON.stringify({ nombreTour: res.nombreTour, tourId: res.tourId, estado: res.estado, telefono: res.telefono, total: res.total }));
      if (res.nombreTour !== 'Tour') fallos.push('la reserva dice nombreTour ' + JSON.stringify(res.nombreTour) + ' y tenía que decir «Tour»');
      if ('tourId' in res) fallos.push('la reserva de un tour sin id lleva tourId ' + JSON.stringify(res.tourId));
      if (res.telefono !== telefono) fallos.push('la reserva no lleva el teléfono en sus 10 cifras');
    }
    console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
  } catch (e) {
    fallos.push(e.message.split('\n')[0]);
  } finally {
    if (id) {
      try { await (await entrarALaBase('admin@gg.test')).cambiar('reservasTurismo/' + id, { estado: 'cancelada', motivoCancelacion: 'Reserva de mentira del robot P16' }); } catch (e) { fallos.push('no pude cancelar la reserva ' + id + ': ' + e.message); }
    }
    await ag.cambiar(AGENCIA, { tours: toursAntes });
    const despues = (await ag.leer(AGENCIA)).tours || [];
    // La base no devuelve los campos en el mismo orden: se comparan con las claves ordenadas.
    const igual = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort()) : x));
    if (igual(despues) !== igual(toursAntes)) fallos.push('los tours de la agencia no quedaron como estaban');
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ con un tour sin nombre ni código, la reserva sale como «Tour» y el cliente ve «¡Reserva enviada!»');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
