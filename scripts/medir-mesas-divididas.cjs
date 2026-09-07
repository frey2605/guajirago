#!/usr/bin/env node
/**
 * LAS MESAS Y SUS CUENTAS DIVIDIDAS — SOLO LECTURA, no escribe nada.
 *
 *   node scripts/medir-mesas-divididas.cjs
 *
 * PASO 1 de los 10, de la OBRA B. Se guarda porque el PASO 10 lo re-corre.
 *
 * ── QUÉ SE MIDE Y POR QUÉ ───────────────────────────────────────────────────
 * El dueño pidió cuatro cosas para las cuentas divididas:
 *   3. que cada comensal lleve su NOMBRE, no «Comensal 1»
 *   4. poder tomar el pedido ya dividido DESDE EL PRINCIPIO
 *   5. que al agregar un plato pregunte PARA QUIÉN es
 *   6. poder PAGAR UNA PARTE y dejar la mesa abierta, por si alguien se va
 *
 * Auditado el 7-sep-2026 leyendo el código: NO son cuatro cosas, son una. La
 * división por persona YA ESTÁ CONSTRUIDA y está bien hecha —se reparte plato por
 * plato, cada comensal paga con su método, se le imprime su recibo y se le sube
 * su comprobante—, pero TODO ESO VIVE EN LA MEMORIA DEL NAVEGADOR
 * (`cuentas` es un useState de Mesero.js) y se descarta al cerrar la mesa.
 *
 * Lo único que sobrevive es el RESULTADO agregado:
 *
 *     pagos: [{ metodo, monto }]   ← en el PRIMER pedido de la mesa
 *     pagosEnOtro: true            ← en los demás, para que la caja no sume dos veces
 *                                    (ese es el contrato que lee CorteCaja.js:35-37)
 *
 * O sea: se sabe CUÁNTO se pagó y CÓMO, pero no QUIÉN COMIÓ QUÉ. Y sin eso no se
 * puede pagar una parte y seguir la mesa abierta: si el mesero sale de la
 * pantalla, el reparto se pierde entero.
 *
 * ── LO QUE ESTE GUION CONTESTA ──────────────────────────────────────────────
 *   · cuántas mesas se han cerrado, y cuántas llevan desglose de pagos
 *   · cuántas se dividieron DE VERDAD (varios métodos, o «Mixto»)
 *   · CUÁNTAS MESAS HAY ABIERTAS AHORA MISMO — y esta es la que importa para no
 *     hacer daño: si se cambia dónde vive el reparto con una mesa a medio
 *     atender, hay que saber cuántas personas están en esa situación.
 *   · cuántas llevan propina o comprobantes, que son los otros dos datos que
 *     viajan pegados al cierre y que también habría que respetar.
 *
 * ── LO QUE NO HACE ──────────────────────────────────────────────────────────
 * No escribe NINGÚN dato. Solo GET. El único POST es el de abrir la sesión contra
 * oauth2.googleapis.com, que no toca la base.
 *
 * ── ANOTADO, NO ARREGLADO (SEGUNDA LEY) ─────────────────────────────────────
 * Este es el DUODÉCIMO guion que repite `token()` palabra por palabra. No hay un
 * ayudante común. Unificarlos es un trabajo aparte, con sus 10 pasos y su permiso.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const PROYECTO = 'guajirago';
const CI = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CS = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const SES = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
const BASE = 'https://firestore.googleapis.com/v1/projects/' + PROYECTO
  + '/databases/(default)/documents';

const val = (v) => v == null ? undefined
  : v.stringValue ?? v.booleanValue ?? (v.integerValue != null ? Number(v.integerValue) : undefined)
    ?? (v.doubleValue != null ? v.doubleValue : undefined);
const lista = (v) => (v && v.arrayValue && v.arrayValue.values) || [];
const campos = (v) => (v && v.mapValue && v.mapValue.fields) || {};

async function token() {
  const j = JSON.parse(fs.readFileSync(SES, 'utf8'));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CI, client_secret: CS,
      refresh_token: j.tokens.refresh_token, grant_type: 'refresh_token',
    }),
  });
  const x = await r.json();
  if (!x.access_token) throw new Error('no pude abrir sesión: ' + JSON.stringify(x).slice(0, 200));
  return x.access_token;
}

async function traer(t, coleccion) {
  const todos = [];
  let pagina;
  do {
    const url = BASE + '/' + coleccion + '?pageSize=300' + (pagina ? '&pageToken=' + pagina : '');
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + t } });
    if (!r.ok) return { error: r.status, docs: [] };
    const j = await r.json();
    todos.push(...(j.documents || []));
    pagina = j.nextPageToken;
  } while (pagina);
  return { docs: todos };
}

const der = (s, n) => String(s).padStart(n);
const pad = (s, n) => String(s).length >= n ? String(s).slice(0, n) : String(s) + ' '.repeat(n - String(s).length);

(async () => {
  const t = await token();

  const negocios = new Map();
  for (const d of (await traer(t, 'restaurantes')).docs) {
    negocios.set(d.name.split('/').pop(), val((d.fields || {}).nombre) || '(sin nombre)');
  }

  const { docs, error } = await traer(t, 'pedidosRestaurantes');
  if (error) throw new Error('no pude leer pedidosRestaurantes: ' + error);

  console.log('\n=== LAS MESAS Y SUS CUENTAS · SOLO LECTURA · '
    + new Date().toLocaleString('es-CO') + ' ===\n');

  const deMesa = docs.filter((d) => val((d.fields || {}).tipo) === 'local').map((d) => {
    const f = d.fields || {};
    return {
      id: d.name.split('/').pop(),
      negocio: val(f.restauranteId) || '',
      mesa: val(f.mesa),
      estado: val(f.estado) || '(sin estado)',
      metodoPago: val(f.metodoPago),
      tomadoPor: val(f.tomadoPor),
      pagos: lista(f.pagos).map((p) => {
        const g = campos(p);
        return { metodo: val(g.metodo), monto: val(g.monto) || 0 };
      }),
      tienePagos: f.pagos !== undefined,
      pagosEnOtro: val(f.pagosEnOtro) === true,
      propina: val(f.propina),
      comprobantes: lista(f.comprobantes).length,
      total: val(f.total) || 0,
    };
  });

  console.log('pedidos de mesa en la base: ' + deMesa.length + '   (de ' + docs.length + ' pedidos en total)\n');

  // ── LAS MESAS ABIERTAS · lo que importa para no hacer daño ──────────────
  const abiertas = deMesa.filter((p) => p.estado !== 'cerrado' && p.estado !== 'cancelado');
  console.log('── MESAS ABIERTAS AHORA MISMO ──');
  if (!abiertas.length) {
    console.log('   NINGUNA. Se puede cambiar dónde vive el reparto sin dejar a nadie');
    console.log('   a medias. Vuelva a correr esto justo antes de desplegar.\n');
  } else {
    console.log('   ⚠ ' + abiertas.length + ' pedido(s) de mesa sin cerrar. Cada uno es alguien sentado:');
    const porMesa = new Map();
    for (const p of abiertas) {
      const k = (negocios.get(p.negocio) || p.negocio.slice(0, 10)) + ' · mesa ' + p.mesa;
      porMesa.set(k, (porMesa.get(k) || 0) + 1);
    }
    for (const [k, n] of porMesa) console.log('      · ' + pad(k, 34) + der(n, 3) + ' pedido(s)');
    console.log('   Conviene desplegar cuando no haya ninguna.\n');
  }

  // ── LAS CERRADAS ────────────────────────────────────────────────────────
  const cerradas = deMesa.filter((p) => p.estado === 'cerrado');
  const conDesglose = cerradas.filter((p) => p.tienePagos);
  const enOtro = cerradas.filter((p) => p.pagosEnOtro);
  const mixtas = conDesglose.filter((p) => p.pagos.length > 1);
  const conPropina = cerradas.filter((p) => p.propina !== undefined);
  const conComprobante = cerradas.filter((p) => p.comprobantes > 0);

  console.log('── LAS MESAS CERRADAS ──');
  console.log('   ' + der(cerradas.length, 5) + '  pedidos de mesa cerrados');
  console.log('   ' + der(conDesglose.length, 5) + '  llevan el desglose `pagos` (son el PRIMER pedido de su mesa)');
  console.log('   ' + der(enOtro.length, 5) + '  llevan `pagosEnOtro` (los demás pedidos de esas mesas)');
  console.log('   ' + der(mixtas.length, 5) + '  se pagaron con MÁS DE UN método  ← estas SÍ se dividieron');
  console.log('   ' + der(conPropina.length, 5) + '  llevan propina');
  console.log('   ' + der(conComprobante.length, 5) + '  llevan foto de comprobante');

  if (conDesglose.length) {
    console.log('\n   el detalle de las que llevan desglose:');
    console.log('   ' + pad('negocio · mesa', 30) + pad('metodoPago', 12) + pad('total', 10) + 'pagos');
    for (const p of conDesglose) {
      const quien = (negocios.get(p.negocio) || p.negocio.slice(0, 10)) + ' · mesa ' + p.mesa;
      const detalle = p.pagos.map((x) => x.metodo + ' ' + x.monto).join(' + ') || '(vacío)';
      console.log('   ' + pad(quien, 30) + pad(p.metodoPago || '—', 12) + pad(p.total, 10) + detalle);
    }
  }

  console.log('\n── LO QUE NO SE GUARDA EN NINGÚN SITIO ──');
  console.log('   QUIÉN COMIÓ QUÉ. El reparto por comensal (`cuentas[].items` de Mesero.js)');
  console.log('   vive solo en la memoria del navegador y se descarta al cerrar la mesa.');
  console.log('   Por eso hoy no se puede pagar una parte y dejar la mesa abierta: si el');
  console.log('   mesero sale de la pantalla, el reparto se pierde entero.');
  console.log('   Comprobado leyendo el código: cero escrituras de `cuentas` a la base.');

  console.log('\n── LA HUELLA (esto es lo que se carea en el paso 10) ──');
  console.log('  pedidosMesa=' + deMesa.length
    + ' abiertos=' + abiertas.length
    + ' cerrados=' + cerradas.length
    + ' conDesglose=' + conDesglose.length
    + ' enOtro=' + enOtro.length
    + ' variosMetodos=' + mixtas.length
    + ' conPropina=' + conPropina.length
    + ' conComprobante=' + conComprobante.length);

  console.log('\nNO SE ESCRIBIÓ NADA. Este guion solo lee.');
})().catch((e) => { console.error('\n✋ ' + e.message + '\n'); process.exit(1); });
