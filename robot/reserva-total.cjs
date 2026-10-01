#!/usr/bin/env node
// 🤖 EL TOTAL DE LA RESERVA LO PONE EL SERVIDOR, NO EL TELÉFONO — P17 (1-oct-2026). En PRUEBAS:
//   0. Como la agencia de prueba (agencia@gg.test), su lista de tours queda con UNO del robot: «Tour del robot P17»,
//      $1.000 por persona (id `robotP17`).
//   1. pasajero@gg.test deja por la red, como la app (los 16 campos de P16), tres reservas de 2 personas:
//      · «Robot P17 honrada»: total $2.000 (lo que enseña la app). Tiene que quedar $2.000 y «revisado».
//      · «Robot P17 inventada»: total $1 (una app modificada). Tiene que quedar $2.000 y «revisado», con el $1 guardado
//        como lo que mandó el teléfono. Hasta P17 se quedaba en $1 y a la agencia le llegaba «— $ 1».
//      · «Robot P17 tour borrado»: de un tour que la agencia ya no tiene, total $1. Tiene que quedar «sin revisar».
//   2. Aliados como la agencia → «Reservas»: la tarjeta del tour borrado dice «⚠️ Precio sin revisar» y la honrada y la
//      inventada no; las dos enseñan $2.000.
//   3. La administradora de pruebas cancela las tres y la agencia recupera sus tours de antes.
//   node robot/reserva-total.cjs   (necesita notificarNuevaReserva y aliados publicados en PRUEBAS)
const { abrir, entrarComoRestaurante, entrarALaBase } = require('./comun.cjs');

const AGENCIA = 'negocios/prueba-agencia';
const TOUR = { id: 'robotP17', tipo: 'tour', nombre: 'Tour del robot P17', descripcion: 'Tour de mentira del robot P17', precio: 1000,
  unidadPrecio: 'persona', duracion: '1 hora', categoria: 'Otro', cupoMax: 0, puntoEncuentro: '', incluye: [], imagen: '',
  destacado: true, disponible: true, vecesReservado: 0 };

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
async function conRevision(base, ruta) {
  for (let i = 0; i < 40; i++) {
    const r = await base.leer(ruta);
    if (r.revisionServidor) return r;
    await esperar(1500);
  }
  return base.leer(ruta);
}

(async () => {
  const fallos = [];
  const ag = await entrarALaBase('agencia@gg.test');
  const antes = await ag.leer(AGENCIA);
  const toursAntes = Array.isArray(antes.tours) ? antes.tours : [];
  const t = Date.now();
  const casos = {
    honrada: { id: 'robotP17H' + t, cliente: 'Robot P17 honrada', tourId: TOUR.id, total: 2000 },
    inventada: { id: 'robotP17I' + t, cliente: 'Robot P17 inventada', tourId: TOUR.id, total: 1 },
    borrado: { id: 'robotP17B' + t, cliente: 'Robot P17 tour borrado', tourId: 'robotP17-borrado', total: 1 },
  };
  const creadas = [];
  let tarjetas = null; let carpeta = '';
  try {
    await ag.cambiar(AGENCIA, { tours: [TOUR] });
    const yo = await entrarALaBase('pasajero@gg.test');
    for (const c of Object.values(casos)) {
      // eslint-disable-next-line no-await-in-loop
      await yo.cambiar('reservasTurismo/' + c.id, {
        agenciaId: 'prueba-agencia', clienteId: yo.uid, agenciaNombre: 'Agencia de Turismo de Prueba', tourId: c.tourId,
        tipo: 'tour', nombreTour: TOUR.nombre, imagen: '', cliente: c.cliente, telefono: '3001700170', personas: 2,
        fecha: '2026-10-05', total: c.total, unidadPrecio: 'persona', estado: 'nueva', notas: 'Reserva de mentira del robot P17',
        creado: new Date().toISOString(),
      });
      creadas.push(c.id);
    }
    const quedo = {};
    for (const [k, c] of Object.entries(casos)) {
      // eslint-disable-next-line no-await-in-loop
      const r = await conRevision(yo, 'reservasTurismo/' + c.id);
      quedo[k] = r;
      console.log(k.toUpperCase() + ': mandó $' + c.total + ' → quedó $' + r.total + ' · revisión ' + JSON.stringify(r.revisionServidor || null));
    }
    const rev = (r) => r.revisionServidor || {};
    if (rev(quedo.honrada).estado !== 'revisado' || quedo.honrada.total !== 2000) fallos.push('la honrada no quedó en $2.000 «revisado» (¿está publicada notificarNuevaReserva en pruebas?)');
    if (rev(quedo.inventada).estado !== 'revisado' || quedo.inventada.total !== 2000) fallos.push('la inventada quedó en $' + quedo.inventada.total + ' y el tour dice $2.000');
    if (rev(quedo.inventada).totalDelTelefono !== 1) fallos.push('la inventada no guardó lo que mandó el teléfono');
    if (rev(quedo.borrado).estado !== 'sin_revisar' || rev(quedo.borrado).motivo !== 'sin-tour') fallos.push('la del tour borrado no quedó «sin revisar» (sin-tour)');

    const a = await abrir('aliados', { nombre: 'reserva-total' });
    carpeta = a.carpeta;
    const p = a.pagina;
    try {
      await entrarComoRestaurante(p, 'agencia@gg.test');
      if (!(await p.getByText('Reservas', { exact: true }).first().isVisible().catch(() => false))) {
        await p.getByText(/Menú|☰/).first().click();
        await p.waitForTimeout(800);
      }
      await p.getByText('Reservas', { exact: true }).first().click();
      await p.waitForTimeout(4000);
      // La tarjeta de cada cliente: se sube desde «👤 <nombre>» hasta la caja que lleva el «Confirmar».
      tarjetas = await p.evaluate((nombres) => {
        const out = {};
        for (const nombre of nombres) {
          const n = [...document.querySelectorAll('p')].find((x) => x.textContent.trim() === '👤 ' + nombre);
          let caja = n;
          while (caja && !caja.textContent.includes('Confirmar')) caja = caja.parentElement;
          out[nombre] = caja ? caja.textContent : null;
        }
        return out;
      }, Object.values(casos).map((c) => c.cliente));
      await a.captura('reservas');
      console.log('ERRORES DE LA PÁGINA:', a.errores.join(' || ') || 'ninguno');
    } finally { await a.cerrar(); }
    const tarjeta = (k) => tarjetas[casos[k].cliente];
    for (const k of Object.keys(casos)) if (!tarjeta(k)) fallos.push('no encontré la tarjeta de «' + casos[k].cliente + '» en Reservas');
    const sinRevisar = (k) => /Precio sin revisar/.test(tarjeta(k) || '');
    const dosMil = (k) => /\$\s?2\.000/.test(tarjeta(k) || '');
    console.log('ALIADOS: ' + JSON.stringify(Object.fromEntries(Object.keys(casos).map((k) => [k, { sinRevisar: sinRevisar(k), dosMil: dosMil(k) }]))) + ' · capturas ' + carpeta);
    if (tarjeta('borrado') && !sinRevisar('borrado')) fallos.push('la tarjeta del tour borrado no dice «⚠️ Precio sin revisar»');
    for (const k of ['honrada', 'inventada']) {
      if (tarjeta(k) && sinRevisar(k)) fallos.push('la tarjeta de la ' + k + ' dice «Precio sin revisar»');
      if (tarjeta(k) && !dosMil(k)) fallos.push('la tarjeta de la ' + k + ' no enseña $2.000');
    }
  } catch (e) {
    fallos.push(e.message.split('\n')[0]);
  } finally {
    if (creadas.length) {
      const admin = await entrarALaBase('admin@gg.test');
      for (const id of creadas) {
        // eslint-disable-next-line no-await-in-loop
        try { await admin.cambiar('reservasTurismo/' + id, { estado: 'cancelada', motivoCancelacion: 'Reserva de mentira del robot P17' }); } catch (e) { fallos.push('no pude cancelar ' + id + ': ' + e.message); }
      }
    }
    await ag.cambiar(AGENCIA, { tours: toursAntes });
    const despues = (await ag.leer(AGENCIA)).tours || [];
    const igual = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort()) : x));
    if (igual(despues) !== igual(toursAntes)) fallos.push('los tours de la agencia no quedaron como estaban');
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ el servidor pone el total del tour ($1 → $2.000) y aliados avisa la reserva que no pudo revisar');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
