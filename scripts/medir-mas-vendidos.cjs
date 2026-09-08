#!/usr/bin/env node
/**
 * ¿CUÁNTO MIENTE EL RANKING DE «MÁS VENDIDOS»? — SOLO LECTURA, no escribe nada.
 *
 *   node scripts/medir-mas-vendidos.cjs
 *
 * PASO 1 de los 10, del PUNTO 2 del plan del restaurante (6-sep-2026).
 * Se guarda porque el PASO 10 lo re-corre: contar dos veces con el mismo contador
 * es la única forma de saber que el arreglo hizo lo que decía.
 *
 * ── QUÉ SE MIDE Y POR QUÉ ───────────────────────────────────────────────────
 * Auditado LEYENDO EL CÓDIGO: al cerrar una mesa, Mesero.js suma cuántas veces se
 * vendió cada plato y lo guarda DENTRO del documento del negocio:
 *
 *     // Mesero.js:269
 *     await updateDoc(doc(db, 'restaurantes', restauranteId), { menu: menuActualizado });
 *     } catch (e) {}      // <- línea 271
 *
 * Pero la regla de esa colección solo deja escribir a quien tiene el mismo uid que
 * el negocio — o sea, AL DUEÑO (firestore.rules:1316). Un empleado no. Y la
 * pantalla «Tomar pedido» está abierta al dueño Y a los empleados con rol de
 * mesero (aliados/App.js:276).
 *
 * Encima el error cae en un `catch (e) {}`: no se ve, no se anota, no se avisa.
 * El mesero ve su «✅ Mesa cerrada» y sigue como si nada.
 *
 * SI ESO ES CIERTO, el ranking de «más vendidos» que mira el dueño solo cuenta las
 * mesas que cerró ÉL MISMO. Este guion no lo supone: lo cuenta contra la base de
 * verdad, plato por plato.
 *
 * ── CÓMO SE CUENTA ──────────────────────────────────────────────────────────
 * El contador solo lo toca el cierre de mesa, así que lo que DEBERÍA decir se
 * reconstruye sumando los pedidos de mesa ya cerrados:
 *
 *     pedidosRestaurantes  con  tipo == 'local'  y  estado == 'cerrado'
 *     → por cada línea de `items`: id del plato × cantidad
 *
 * y se carea contra `menu[].vecesVendido` del documento del negocio.
 *
 * ── LO QUE ESTE GUION *NO* PUEDE PROBAR SOLO ────────────────────────────────
 * Se dice aquí para que nadie lea de más en el número:
 *
 *   1. `vecesVendido` empezó a contar el día que se programó. Los pedidos
 *      anteriores no están ahí, y eso TAMBIÉN produce diferencia. Por eso el guion
 *      enseña las dos cosas juntas: la diferencia Y quién cerró cada mesa. Lo que
 *      señala al fallo es que CUADREN.
 *   2. `tomadoPor` se escribe al CREAR el pedido (Mesero.js:296), no al cerrarlo.
 *      Lo normal es que sea la misma persona, pero no está garantizado.
 *   3. El valor 'Mesero' es el POR DEFECTO de `empleadoNombre || 'Mesero'`: la
 *      sesión del dueño no lleva nombre de empleado, así que 'Mesero' pelado
 *      significa «lo tomó el dueño».
 *
 * ── LO QUE NO HACE ──────────────────────────────────────────────────────────
 * No escribe NINGÚN dato. Solo GET. El único POST es el de abrir la sesión contra
 * oauth2.googleapis.com, que no toca la base.
 *
 * ── ANOTADO, NO ARREGLADO (SEGUNDA LEY) ─────────────────────────────────────
 * Este es el NOVENO guion que repite `token()` palabra por palabra. No hay un
 * ayudante común. Unificarlos es tocar ocho archivos que funcionan, así que se
 * anota y se le dice al dueño: es un trabajo aparte, con sus 10 pasos.
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

const pad = (s, n) => String(s).length >= n ? String(s).slice(0, n) : String(s) + ' '.repeat(n - String(s).length);
const der = (s, n) => String(s).padStart(n);

(async () => {
  const t = await token();
  console.log('\n=== ¿CUÁNTO MIENTE EL RANKING DE MÁS VENDIDOS? · SOLO LECTURA · '
    + new Date().toLocaleString('es-CO') + ' ===\n');

  // ── Los negocios, con su menú ───────────────────────────────────────────
  const negocios = new Map();
  for (const d of (await traer(t, 'restaurantes')).docs) {
    const id = d.name.split('/').pop();
    const f = d.fields || {};
    const menu = lista(f.menu).map((p) => {
      const g = campos(p);
      return {
        id: val(g.id),
        nombre: val(g.nombre) || '(sin nombre)',
        vecesVendido: val(g.vecesVendido) || 0,
      };
    });
    negocios.set(id, { nombre: val(f.nombre) || '(sin nombre)', tipo: val(f.tipoNegocio) || '—', menu });
  }
  console.log('negocios en el servidor: ' + negocios.size);
  for (const [id, n] of negocios) {
    console.log('   · ' + pad(n.nombre, 26) + ' ' + pad(n.tipo, 12)
      + ' platos: ' + der(n.menu.length, 3) + '   (' + id.slice(0, 12) + '…)');
  }

  // ── Quién es empleado de quién ──────────────────────────────────────────
  const empleados = [];
  const nombresEmpleado = new Set();
  for (const d of (await traer(t, 'empleados')).docs) {
    const f = d.fields || {};
    const roles = campos(f.roles);
    const nombre = val(f.nombre) || '(sin nombre)';
    empleados.push({
      nombre,
      negocio: val(f.restauranteId) || '',
      activo: val(f.activo) !== false,
      mesero: val(roles.mesero) === true,
    });
    nombresEmpleado.add(nombre);
  }
  console.log('\nempleados: ' + empleados.length);
  for (const e of empleados) {
    console.log('   · ' + pad(e.nombre, 20)
      + (e.mesero ? ' MESERO ' : '        ')
      + (e.activo ? 'activo  ' : 'INACTIVO')
      + '  del negocio ' + ((negocios.get(e.negocio) || {}).nombre || e.negocio.slice(0, 12) + '…'));
  }
  if (!empleados.some((e) => e.mesero && e.activo)) {
    console.log('   (ningún mesero activo: hoy solo el dueño cierra mesas)');
  }

  // ── Las mesas cerradas ──────────────────────────────────────────────────
  const { docs: pedidos, error } = await traer(t, 'pedidos');
  if (error) throw new Error('no pude leer los pedidos: ' + error);

  const deMesa = [];
  const estados = new Map();
  for (const d of pedidos) {
    const f = d.fields || {};
    const tipo = val(f.tipo) || '(sin tipo)';
    const estado = val(f.estado) || '(sin estado)';
    estados.set(tipo + ' / ' + estado, (estados.get(tipo + ' / ' + estado) || 0) + 1);
    if (tipo !== 'local') continue;
    deMesa.push({
      id: d.name.split('/').pop(),
      negocio: val(f.restauranteId) || '',
      estado,
      tomadoPor: val(f.tomadoPor) || '(sin apuntar)',
      mesa: val(f.mesa),
      items: lista(f.items).map((it) => {
        const g = campos(it);
        return { id: val(g.id), nombre: val(g.nombre) || '(sin nombre)', cantidad: val(g.cantidad) || 1 };
      }),
    });
  }

  console.log('\n── TODOS LOS PEDIDOS, por tipo y estado ──');
  console.log('   total en la base: ' + pedidos.length);
  for (const [k, n] of [...estados].sort()) console.log('   ' + der(n, 5) + '  ' + k);

  const cerradas = deMesa.filter((p) => p.estado === 'cerrado');
  console.log('\n── MESAS CERRADAS (tipo «local», estado «cerrado») ──');
  console.log('   son las únicas que mueven el contador: ' + cerradas.length);
  if (!cerradas.length) {
    console.log('\n   NO HAY NINGUNA. El contador no ha tenido ocasión de fallar todavía,');
    console.log('   así que este guion no puede probar el fallo con datos — solo el');
    console.log('   código lo demuestra. Vuelva a correrlo cuando haya mesas cerradas.');
  }

  // CÓMO SE SABE QUIÉN CERRÓ. Solo hay un valor que significa «el dueño»: el
  // literal 'Mesero', que es el POR DEFECTO de `empleadoNombre || 'Mesero'`
  // (Mesero.js:296) — la sesión del dueño no lleva nombre de empleado.
  //
  // CUALQUIER OTRA COSA es una sesión CON nombre, o sea un empleado. No se le
  // exige que el nombre cuadre con la lista de empleados de HOY, y esto lo cazó
  // la base de verdad: los pedidos dicen «JUAN MESERO» y el empleado se llama
  // hoy «JUAN». Lo renombraron, y el pedido guarda el nombre de entonces.
  // Pedir coincidencia exacta hacía que 9 de 12 mesas se contaran como «no sé
  // quién», y el guion concluía que no había ninguna de empleado. Al revés.
  const esDelDueno = (quien) => quien === 'Mesero';

  const porQuien = new Map();
  for (const p of cerradas) porQuien.set(p.tomadoPor, (porQuien.get(p.tomadoPor) || 0) + 1);
  let cerradasPorEmpleado = 0;
  if (porQuien.size) {
    console.log('\n   quién las tomó:');
    for (const [quien, n] of [...porQuien].sort((a, b) => b[1] - a[1])) {
      if (!esDelDueno(quien)) cerradasPorEmpleado += n;
      const nota = esDelDueno(quien)
        ? '<- valor por defecto: la tomó EL DUEÑO'
        : (nombresEmpleado.has(quien)
          ? '<- EMPLEADO: su cierre NO puede escribir el contador'
          : '<- EMPLEADO (con un nombre que hoy ya no existe: lo renombraron)');
      console.log('   ' + der(n, 5) + '  ' + pad(quien, 20) + ' ' + nota);
    }
  }

  // ── El careo, negocio por negocio ───────────────────────────────────────
  console.log('\n══ EL CAREO · lo que dice el contador contra lo que se vendió ══');
  let huboDiferencia = false;
  for (const [id, n] of negocios) {
    const suyas = cerradas.filter((p) => p.negocio === id);
    if (!n.menu.length && !suyas.length) continue;

    // Se cuenta POR SEPARADO lo que se vendió en mesas del dueño y en mesas de
    // empleado. Ese es el careo de verdad: si el fallo es real, el contador
    // tiene que parecerse a la columna del DUEÑO, no al total.
    const vendido = new Map();
    const vendidoDueno = new Map();
    const vendidoEmpleado = new Map();
    for (const p of suyas) {
      const caja = esDelDueno(p.tomadoPor) ? vendidoDueno : vendidoEmpleado;
      for (const it of p.items) {
        if (it.id == null) continue;
        const c = Number(it.cantidad) || 1;
        vendido.set(it.id, (vendido.get(it.id) || 0) + c);
        caja.set(it.id, (caja.get(it.id) || 0) + c);
      }
    }
    const nDueno = suyas.filter((p) => esDelDueno(p.tomadoPor)).length;

    console.log('\n── ' + n.nombre + ' ──   mesas cerradas: ' + suyas.length
      + '  (del dueño: ' + nDueno + ' · de empleado: ' + (suyas.length - nDueno) + ')');
    if (!n.menu.length) { console.log('   (sin menú)'); continue; }

    console.log('   ' + pad('plato', 26) + der('contador', 9) + der('d.dueño', 9)
      + der('d.emplea', 9) + der('vendido', 9) + der('difer.', 8));
    let sumaContador = 0, sumaVendido = 0, sumaDueno = 0, sumaEmpleado = 0;
    const sinMenu = new Map(vendido);
    for (const plato of n.menu) {
      const v = vendido.get(plato.id) || 0;
      const vd = vendidoDueno.get(plato.id) || 0;
      const ve = vendidoEmpleado.get(plato.id) || 0;
      sinMenu.delete(plato.id);
      sumaContador += plato.vecesVendido;
      sumaVendido += v; sumaDueno += vd; sumaEmpleado += ve;
      if (plato.vecesVendido === 0 && v === 0) continue;
      const dif = plato.vecesVendido - v;
      console.log('   ' + pad(plato.nombre, 26) + der(plato.vecesVendido, 9) + der(vd, 9)
        + der(ve, 9) + der(v, 9) + der(dif === 0 ? '=' : (dif > 0 ? '+' + dif : dif), 8));
    }
    console.log('   ' + pad('TOTAL', 26) + der(sumaContador, 9) + der(sumaDueno, 9)
      + der(sumaEmpleado, 9) + der(sumaVendido, 9)
      + der(sumaContador - sumaVendido === 0 ? '=' : sumaContador - sumaVendido, 8));

    // LA PREGUNTA QUE IMPORTA, contestada con números y no con opinión.
    if (sumaEmpleado > 0) {
      const falta = sumaVendido - sumaContador;
      console.log('   ');
      console.log('   falta por contar: ' + falta + '   ·   vendido en mesas de empleado: ' + sumaEmpleado);
      if (falta === sumaEmpleado) {
        console.log('   → CUADRA EXACTO. Lo que falta es justo lo que vendieron los empleados.');
      } else if (falta > 0) {
        console.log('   → no cuadra exacto: sobran ' + (falta - sumaEmpleado) + ' sin explicar por');
        console.log('     los empleados (lo más probable: ventas anteriores al contador).');
      }
    }

    if (sinMenu.size) {
      console.log('   ojo: ' + sinMenu.size + ' plato(s) vendidos que YA NO ESTÁN en el menú');
      console.log('        (no cuentan para el contador, pero explican parte de la diferencia)');
    }
    if (sumaContador !== sumaVendido) huboDiferencia = true;
  }

  // ── La conclusión, sin adornos ──────────────────────────────────────────
  console.log('\n───────────────────────────────────────────────────────────');
  if (!cerradas.length) {
    console.log('SIN MESAS CERRADAS: no hay nada que carear todavía.');
  } else if (!huboDiferencia && cerradasPorEmpleado === 0) {
    console.log('CUADRA, y no hay ninguna mesa cerrada por un empleado.');
    console.log('Es lo esperable: el fallo solo aparece cuando cierra alguien que NO');
    console.log('es el dueño. Con estos datos NO se puede ver — el código sí lo dice.');
  } else if (huboDiferencia && cerradasPorEmpleado > 0) {
    console.log('NO CUADRA, y hay ' + cerradasPorEmpleado + ' mesa(s) cerradas por un EMPLEADO.');
    console.log('Es exactamente lo que predice el hallazgo: esas ventas no se contaron.');
    console.log('Mire arriba si la diferencia cuadra con los platos de esas mesas.');
  } else if (huboDiferencia) {
    console.log('NO CUADRA, pero NINGUNA mesa la cerró un empleado.');
    console.log('Entonces la diferencia es de otra cosa —lo más probable: pedidos');
    console.log('anteriores al día en que se programó el contador—. Hay que mirarlo');
    console.log('antes de tocar nada: el número no señala al fallo por sí solo.');
  } else {
    console.log('CUADRA aunque hay mesas cerradas por empleados. Eso NO se esperaba:');
    console.log('hay que volver a mirar el código antes de seguir.');
  }
  console.log('\nNO SE ESCRIBIÓ NADA. Este guion solo lee.');
})().catch((e) => { console.error('\n✋ ' + e.message + '\n'); process.exit(1); });
