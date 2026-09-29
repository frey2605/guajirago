#!/usr/bin/env node
/**
 * ¿A QUIÉN DEL NEGOCIO LE LLEGA CADA AVISO? — gemelo G64 (29-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-quien-recibe.cjs              (el código de hoy + los empleados de producción)
 *   node scripts/medir-quien-recibe.cjs --sin-red    (solo el código)
 *   node scripts/medir-quien-recibe.cjs --commit X   (el index.js del commit X: el careo de antes y después)
 *
 * Tres avisos del servidor van a la gente de un negocio: el PEDIDO nuevo (notificarNuevoPedido), la RESERVA nueva
 * de una agencia (notificarNuevaReserva) y el aviso del COBRO del plan (avisarAlNegocio, de rutinaDeCobros). Hasta
 * G64 cada uno decidía a mano qué empleados lo recibían, y no decían lo mismo.
 *
 * Mide, EJECUTANDO guajirago/functions/index.js entero con la nube de mentira (pruebas/nubeDeMentira.cjs):
 *   1. a quién le llega cada aviso: un negocio con el dueño y UN empleado por cada rol que existe en aliados
 *      (Empleados.js), más uno apagado y uno sin token;
 *   2. cuántos sitios de index.js eligen empleados por su cuenta (consultan «empleados» o nombran un rol);
 *   3. si aliados está de acuerdo: todo rol que recibe un aviso tiene que registrar su token (App.js) y poder abrir
 *      la pantalla de lo que le avisan (Reservas / pedidos). Un aviso a quien no puede abrirlo es ruido;
 *   4. DATOS (producción): los empleados por tipo de negocio y rol, y a cuántos teléfonos llegaría HOY cada aviso,
 *      corriendo la misma función del servidor con los datos de verdad (sin imprimir ningún token).
 * No escribe nada.
 */
const { cargarIndex, conRegistro } = require('../pruebas/nubeDeMentira.cjs');
const { leer, soloCodigo } = require('../pruebas/cargar.cjs');

const APP_ALIADOS = 'guajirago-aliados/src/App.js';
const EMPLEADOS_ALIADOS = 'guajirago-aliados/src/Empleados.js';
const FUNCIONES = 'guajirago/functions/index.js';

/** Los roles que un dueño le puede dar a un empleado, sacados de la lista ROLES de Empleados.js de aliados. */
function rolesDeAliados(fuente = leer(EMPLEADOS_ALIADOS)) {
  const i = fuente.indexOf('const ROLES = [');
  if (i < 0) throw new Error('no encuentro «const ROLES = [» en ' + EMPLEADOS_ALIADOS);
  const bloque = fuente.slice(i, fuente.indexOf('];', i));
  const ids = [...bloque.matchAll(/id:\s*'(\w+)'/g)].map((m) => m[1]);
  if (ids.length === 0) throw new Error('la lista ROLES de ' + EMPLEADOS_ALIADOS + ' salió vacía');
  return ids;
}

// Los tres avisos y cómo se encienden. El negocio de mentira se llama N.
const AVISOS = {
  pedidoNuevo: (fx, id) => fx.notificarNuevoPedido({ data: { data: () => (
    { tipo: 'domicilio', estado: 'nuevo', restauranteId: id, cliente: 'Ana', total: 1000 }) } }),
  reservaNueva: (fx, id) => fx.notificarNuevaReserva({ data: { data: () => (
    { estado: 'nueva', agenciaId: id, cliente: 'Beto', nombreTour: 'Cabo', total: 1000 }) } }),
  cobro: (fx, id) => fx.__internas.avisarAlNegocio(id, { titulo: 'Tu plan', texto: 'vence' }),
};

/** El negocio de mentira: el dueño, un empleado por rol, uno apagado y uno sin token. */
function negocioDePrueba(roles) {
  const empleados = {};
  for (const r of roles) empleados['E_' + r] = { restauranteId: 'N', fcmToken: 'rol:' + r, roles: { [r]: true } };
  const todos = Object.fromEntries(roles.map((r) => [r, true]));
  empleados.E_apagado = { restauranteId: 'N', fcmToken: 'apagado', activo: false, roles: todos };
  empleados.E_sinToken = { restauranteId: 'N', roles: todos };
  empleados.E_otroNegocio = { restauranteId: 'OTRO', fcmToken: 'otro', roles: todos };
  return { negociosPrivado: { N: { fcmToken: 'dueno' } }, empleados };
}

/** EJECUTA los tres avisos de index.js (el de hoy, o el del commit `ref`) y dice a quién le llega cada uno. */
async function quienRecibeCadaAviso(ref, roles = rolesDeAliados()) {
  const salida = {};
  for (const [aviso, encender] of Object.entries(AVISOS)) {
    const { fx, mensajero } = cargarIndex(negocioDePrueba(roles), {}, ref);
    // eslint-disable-next-line no-await-in-loop
    await conRegistro(() => encender(fx, 'N'));
    const tokens = mensajero.recibidos.map((m) => m.token);
    salida[aviso] = {
      dueno: tokens.includes('dueno'),
      roles: tokens.filter((t) => t.startsWith('rol:')).map((t) => t.slice(4)).sort(),
      coladosQueNoDeben: tokens.filter((t) => ['apagado', 'otro'].includes(t)),
    };
  }
  return salida;
}

/**
 * Los sitios de index.js que eligen empleados POR SU CUENTA: los que consultan la colección «empleados» y los que
 * nombran un rol (`.administrador`, `roles.recepcionista`…). Con la pieza son cero: eso lo hace ella.
 */
function sitiosAMano(fuente, roles = rolesDeAliados()) {
  const codigo = soloCodigo(fuente);
  const consultas = (codigo.match(/collection\(\s*["']empleados["']\s*\)/g) || []).length;
  const nombran = (codigo.match(new RegExp('\\.(' + roles.join('|') + ')\\b', 'g')) || []).length;
  return { consultas, nombran };
}

/**
 * ¿ALIADOS ESTÁ DE ACUERDO? Se sacan de App.js y se CORREN:
 *   · el efecto que registra el token de avisos (quién lo registra);
 *   · la condición del menú «Reservas» de una agencia (quién puede abrirla);
 *   · la lista de estaciones de pedidos (`opRoles`) — el administrador ve «Todos los pedidos».
 */
function loQueDiceAliados(fuente = leer(APP_ALIADOS), roles = rolesDeAliados()) {
  const j = fuente.indexOf('registrarTokenFCM(sesion)');
  if (j < 0) throw new Error('App.js de aliados ya no llama registrarTokenFCM(sesion)');
  const ini = fuente.lastIndexOf('useEffect(() => {', j);
  const fin = fuente.indexOf('}, [sesion]);', j);
  if (ini < 0 || fin < 0) throw new Error('no encuentro el efecto que registra el token en App.js de aliados');
  const cuerpo = fuente.slice(ini + 'useEffect(() => {'.length, fin);
  // eslint-disable-next-line no-new-func
  const efecto = new Function('sesion', 'registrarTokenFCM', cuerpo);
  const registra = (sesion) => { let si = false; efecto(sesion, () => { si = true; }); return si; };

  const lineaReservas = fuente.split(/\r?\n/).find((l) => /label:\s*'Reservas'/.test(l));
  const cond = lineaReservas && lineaReservas.match(/if\s*\((.*?)\)\s*opcionesMenu\.push/);
  if (!cond) throw new Error('no encuentro la condición del menú «Reservas» en App.js de aliados');
  // eslint-disable-next-line no-new-func
  const abreReservas = new Function('efDueno', 'efAdmin', 'return !!(' + cond[1] + ');');

  const op = fuente.match(/const opRoles = (\[[^\]]*\])\.filter/);
  if (!op) throw new Error('no encuentro la lista opRoles en App.js de aliados');
  // eslint-disable-next-line no-new-func
  const estaciones = new Function('return ' + op[1] + ';')();

  const porRol = {};
  for (const r of roles) {
    const esAdmin = r === 'administrador';   // App.js: efAdmin = esAdmin = !!roles.administrador
    porRol[r] = {
      registraToken: registra({ rol: 'empleado', roles: { [r]: true } }),
      abreReservas: abreReservas(false, esAdmin),
      abrePedidos: esAdmin || estaciones.includes(r),
    };
  }
  return { duenoRegistra: registra({ rol: 'dueno' }), duenoAbreReservas: abreReservas(true, false), porRol };
}

/** Qué pantalla abre el que recibe cada aviso. El cobro no tiene pantalla de empleado: es asunto del dueño. */
const PANTALLA = { pedidoNuevo: 'abrePedidos', reservaNueva: 'abreReservas', cobro: null };

/** Roles que reciben un aviso pero no pueden hacer nada con él: sin token (nunca les llega) o sin la pantalla. */
function desacuerdos(quien, aliados) {
  const malos = [];
  for (const [aviso, q] of Object.entries(quien)) {
    for (const r of q.roles) {
      const a = aliados.porRol[r];
      if (!a) { malos.push(aviso + ': «' + r + '» no es un rol de aliados'); continue; }
      if (!a.registraToken) malos.push(aviso + ': «' + r + '» lo recibe pero aliados no le registra el token');
      if (PANTALLA[aviso] && !a[PANTALLA[aviso]]) malos.push(aviso + ': «' + r + '» lo recibe pero no puede abrir la pantalla');
    }
  }
  return malos;
}

/** DATOS: los empleados de producción y a cuántos teléfonos llegaría hoy cada aviso, con el index.js de `ref`. */
async function medirProduccion(ref) {
  const nube = require('./nube.cjs');
  const [empleados, negocios, privados] = await Promise.all(
    ['empleados', 'negocios', 'negociosPrivado'].map((c) => nube.traer(c).then((l) => l.map(nube.doc))));
  const tipo = Object.fromEntries(negocios.map((n) => [n.id, n.tipoNegocio || 'restaurante']));
  const datos = {
    empleados: Object.fromEntries(empleados.map((e) => [e.id, e])),
    negociosPrivado: Object.fromEntries(privados.map((p) => [p.id, p])),
  };
  const porTipoYRol = {};
  for (const e of empleados) {
    const clave = (tipo[e.restauranteId] || '(negocio que no existe)');
    const roles = Object.keys(e.roles || {}).filter((k) => e.roles[k]).sort().join('+') || '(sin rol)';
    const k = clave + ' · ' + roles + ' · ' + (e.activo === false ? 'apagado' : 'activo') + ' · '
      + (e.fcmToken ? 'con token' : 'sin token');
    porTipoYRol[k] = (porTipoYRol[k] || 0) + 1;
  }
  const llegaria = [];
  for (const n of negocios) {
    const fila = { negocio: n.id.slice(0, 6), tipo: tipo[n.id] };
    for (const [aviso, encender] of Object.entries(AVISOS)) {
      const { fx, mensajero } = cargarIndex(datos, {}, ref);
      // eslint-disable-next-line no-await-in-loop
      await conRegistro(() => encender(fx, n.id));
      const tokens = mensajero.recibidos.map((m) => m.token);
      const delDueno = (datos.negociosPrivado[n.id] || {}).fcmToken;
      fila[aviso] = { dueno: tokens.includes(delDueno) && !!delDueno, empleados: tokens.filter((t) => t !== delDueno).length };
    }
    llegaria.push(fila);
  }
  return { empleados: empleados.length, negocios: negocios.length, porTipoYRol, llegaria };
}

async function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf('--commit');
  const ref = i >= 0 ? args[i + 1] : null;
  const roles = rolesDeAliados();
  const fuente = ref
    ? require('child_process').execSync('git show ' + ref + ':' + FUNCIONES, { cwd: require('path').join(__dirname, '..') }).toString()
    : leer(FUNCIONES);

  console.log('\n¿A QUIÉN DEL NEGOCIO LE LLEGA CADA AVISO? — index.js ' + (ref ? 'del commit ' + ref : 'de hoy'));
  console.log('Roles de aliados: ' + roles.join(', '));

  const quien = await quienRecibeCadaAviso(ref, roles);
  console.log('\n1. A quién le llega (ejecutando index.js):');
  for (const [a, q] of Object.entries(quien)) {
    console.log('   ' + a.padEnd(13) + (q.dueno ? 'dueño' : '(sin dueño)') + (q.roles.length ? ' + ' + q.roles.join(', ') : ' (ningún empleado)')
      + (q.coladosQueNoDeben.length ? '   🔴 COLADOS: ' + q.coladosQueNoDeben.join(', ') : ''));
  }

  const s = sitiosAMano(fuente, roles);
  console.log('\n2. Sitios de index.js que eligen empleados por su cuenta: consultan «empleados» ' + s.consultas
    + ' · nombran un rol ' + s.nombran);

  const aliados = loQueDiceAliados(undefined, roles);
  console.log('\n3. Lo que dice aliados (App.js, ejecutado):');
  console.log('   dueño: registra token ' + (aliados.duenoRegistra ? 'sí' : 'NO') + ' · abre Reservas ' + (aliados.duenoAbreReservas ? 'sí' : 'no'));
  for (const [r, a] of Object.entries(aliados.porRol)) {
    console.log('   ' + r.padEnd(14) + 'token ' + (a.registraToken ? 'sí' : 'no') + ' · Reservas ' + (a.abreReservas ? 'sí' : 'no')
      + ' · pedidos ' + (a.abrePedidos ? 'sí' : 'no'));
  }
  const malos = desacuerdos(quien, aliados);
  console.log('   ' + (malos.length ? '🔴 ' + malos.length + ' desacuerdo(s):\n     ' + malos.join('\n     ') : '✓ todo rol que recibe un aviso tiene token y puede abrir lo que le avisan'));

  if (!args.includes('--sin-red')) {
    const p = await medirProduccion(ref);
    console.log('\n4. PRODUCCIÓN: ' + p.negocios + ' negocios, ' + p.empleados + ' empleado(s)');
    for (const [k, n] of Object.entries(p.porTipoYRol)) console.log('   ' + n + ' × ' + k);
    console.log('   A cuántos teléfonos llegaría HOY cada aviso (dueño / empleados):');
    for (const f of p.llegaria) {
      console.log('   ' + f.negocio + ' (' + f.tipo + ')  ' + Object.keys(AVISOS).map((a) => a + ' ' + (f[a].dueno ? 'sí' : 'no') + '/' + f[a].empleados).join(' · '));
    }
  }
  console.log('');
}

if (require.main === module) main().catch((e) => { console.error('🔴', e.message); process.exit(1); });

module.exports = { rolesDeAliados, quienRecibeCadaAviso, sitiosAMano, loQueDiceAliados, desacuerdos, negocioDePrueba, AVISOS, PANTALLA };
