// ═══════════════════════════════════════════════════════════════════════════
//  UNA SOLA FORMA DE SALIR · gemelo G07, 28-sep-2026
//
//  Cerrar la sesión estaba escrito en tres sitios (el menú lateral, la salida del conductor y la de la app) y
//  «Eliminar cuenta» tenía el suyo. El menú cerraba la sesión PRIMERO y después le pedía al conductor apagarse:
//  sin sesión, las reglas rechazan esa escritura, así que su ficha se quedaba «activo» (el servidor le seguía
//  mandando viajes) y, si tenía un viaje en marcha, la cancelación tampoco entraba. «Eliminar cuenta» borraba el
//  usuario primero y tenía el mismo problema.
//
//  Ahora: el menú solo llama a la salida de la pantalla; el conductor se apaga (y cancela su viaje) con la sesión
//  viva; y la sesión la cierra UNA sola pieza, handleCerrarSesion de App.js, al final. Borrar el usuario va ahí
//  dentro, justo antes de cerrarla.
//
//  No se mira el texto: las cuatro funciones se SACAN de sus archivos y se CORREN encadenadas, en un mundo de
//  mentira donde —como en las reglas de Firestore— sin sesión no entra ninguna escritura.
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { leer, soloCodigo, sinTextos, cuerpoDeLaFuncion } = require('./cargar.cjs');

const SRC = 'guajirago/src/';

/** La declaración `const nombre = ...;` entera, sacada del archivo tal como está. */
function laFuncion(archivo, nombre) {
  const t = soloCodigo(leer(SRC + archivo)).replace(/\r\n/g, '\n');
  const marca = 'const ' + nombre + ' = ';
  const pos = t.indexOf(marca);
  assert.ok(pos >= 0, 'no encuentro ' + nombre + ' en ' + archivo);
  assert.strictEqual(t.indexOf(marca, pos + 1), -1, nombre + ' está dos veces en ' + archivo);
  const seguro = sinTextos(t);
  const flecha = seguro.indexOf('=>', pos);
  const tras = seguro.slice(flecha + 2).trimStart();
  if (tras[0] === '{') {
    const c = cuerpoDeLaFuncion(t, pos);
    return t.slice(pos, c.fin + 1) + ';';
  }
  return t.slice(pos, seguro.indexOf(';', flecha) + 1);
}

/** Un mundo de mentira: auth, Firestore con la regla «sin sesión no se escribe», y lo que pasó, en orden. */
function mundo({ viaje = null, rechazaViaje = false } = {}) {
  const pasos = [];
  const auth = { currentUser: { uid: 'c1', email: 'taxi@gg.test' } };
  const ficha = { activo: true };
  const viajes = viaje ? { [viaje.id]: { estado: 'aceptado' } } : {};
  const pantalla = { screen: 'home', errorEliminar: '' };
  const rechazo = (por) => Object.assign(new Error('Missing or insufficient permissions (' + por + ')'), { code: 'permission-denied' });
  const escribir = (ref, datos) => {
    if (!auth.currentUser) { pasos.push('RECHAZADA ' + ref.col + ' (sin sesión)'); throw rechazo('sin sesión'); }
    if (ref.col === 'viajes' && rechazaViaje) { pasos.push('RECHAZADA viajes'); throw rechazo('viaje'); }
    pasos.push('escribe ' + ref.col);
    Object.assign(ref.col === 'conductores' ? ficha : viajes[ref.id], datos);
  };
  const piezas = {
    auth, db: {}, STORAGE_KEY: 'k',
    doc: (_db, col, id) => ({ col, id }),
    setDoc: async (ref, datos) => escribir(ref, datos),
    updateDoc: async (ref, datos) => escribir(ref, datos),
    signOut: async () => { pasos.push('cierra la sesión'); auth.currentUser = null; },
    deleteUser: async (u) => {
      if (!auth.currentUser || auth.currentUser !== u) { pasos.push('RECHAZADO borrar usuario'); throw rechazo('borrar'); }
      pasos.push('borra el usuario'); auth.currentUser = null;
    },
    reauthenticateWithCredential: async () => { pasos.push('confirma la contraseña'); },
    EmailAuthProvider: { credential: () => ({}) },
    localStorage: { removeItem: () => {} },
    setScreen: (s) => { pantalla.screen = s; },
    setErrorEliminar: (e) => { pantalla.errorEliminar = e; },
    contrasenaEliminar: 'clave',
    viajeActual: viaje,
    // El candado de la ley del botón, reducido a lo que decide aquí: { ok } según si la escritura entró.
    correr: async (fn) => { try { await fn(); return { ok: true }; } catch (e) { return { ok: false }; } },
  };
  return { pasos, ficha, viajes, pantalla, piezas };
}

/** Arma una función sacada del archivo con las piezas del mundo (y las que se le pasen). */
function armar(archivo, nombre, piezas) {
  const nombres = Object.keys(piezas);
  // eslint-disable-next-line no-new-func
  return new Function(...nombres, laFuncion(archivo, nombre) + '\nreturn ' + nombre + ';')(...nombres.map((n) => piezas[n]));
}

/** La cadena de verdad: App.handleCerrarSesion ← AppConductor.cerrarSesion ← MenuLateral / Configuracion. */
function cadena(m, { conductor = true } = {}) {
  const salidaApp = armar('App.js', 'handleCerrarSesion', m.piezas);
  const salida = conductor ? armar('AppConductor.js', 'cerrarSesion', { ...m.piezas, onCerrarSesion: salidaApp }) : salidaApp;
  // Todas las piezas a todas: si alguna vuelve a cerrar la sesión por su cuenta, aquí lo hace de verdad.
  const menu = armar('MenuLateral.js', 'cerrarSesion', { ...m.piezas, onCerrarSesion: salida });
  const eliminar = armar('Configuracion.js', 'eliminarCuenta', { ...m.piezas, onCerrarSesion: salida });
  return { menu, eliminar };
}

describe('UNA SOLA FORMA DE SALIR · G07', () => {
  it('EL QUE MUERDE · el conductor sale por el menú: se apaga con la sesión viva y la sesión se cierra al final', async () => {
    const m = mundo();
    await cadena(m).menu();
    assert.deepStrictEqual(m.pasos, ['escribe conductores', 'cierra la sesión']);
    assert.strictEqual(m.ficha.activo, false, '⛔ salió por el menú y su ficha sigue ACTIVA: el servidor le seguiría mandando viajes');
    assert.strictEqual(m.pantalla.screen, 'login');
  });

  it('con un viaje en marcha: lo cancela, se apaga, y solo entonces cierra la sesión', async () => {
    const m = mundo({ viaje: { id: 'v1' } });
    await cadena(m).menu();
    assert.deepStrictEqual(m.pasos, ['escribe viajes', 'escribe conductores', 'cierra la sesión']);
    assert.strictEqual(m.viajes.v1.estado, 'cancelado_conductor');
  });

  it('si la cancelación del viaje NO entra, NO se va (el pasajero no se queda esperando a nadie)', async () => {
    const m = mundo({ viaje: { id: 'v1' }, rechazaViaje: true });
    await cadena(m).menu();
    assert.ok(!m.pasos.includes('cierra la sesión'), '⛔ se fue con el viaje vivo');
    assert.strictEqual(m.pantalla.screen, 'home');
  });

  it('EL QUE MUERDE · «Eliminar cuenta» del conductor: se apaga ANTES de borrar el usuario', async () => {
    const m = mundo();
    await cadena(m).eliminar();
    assert.deepStrictEqual(m.pasos, ['confirma la contraseña', 'escribe conductores', 'borra el usuario', 'cierra la sesión']);
    assert.strictEqual(m.ficha.activo, false, '⛔ borró la cuenta y la ficha sigue ACTIVA');
    assert.strictEqual(m.pantalla.errorEliminar, '');
    assert.strictEqual(m.pantalla.screen, 'login');
  });

  it('«Eliminar cuenta» con un viaje que no se deja cancelar: no borra nada y lo dice', async () => {
    const m = mundo({ viaje: { id: 'v1' }, rechazaViaje: true });
    await cadena(m).eliminar();
    assert.ok(!m.pasos.includes('borra el usuario'), '⛔ borró la cuenta con el viaje vivo');
    assert.match(m.pantalla.errorEliminar, /no se eliminó/);
  });

  it('el pasajero (sin ficha de conductor) sale y elimina su cuenta por la misma salida', async () => {
    const a = mundo();
    await cadena(a, { conductor: false }).menu();
    assert.deepStrictEqual(a.pasos, ['cierra la sesión']);
    assert.strictEqual(a.pantalla.screen, 'login');
    const b = mundo();
    await cadena(b, { conductor: false }).eliminar();
    assert.deepStrictEqual(b.pasos, ['confirma la contraseña', 'borra el usuario', 'cierra la sesión']);
  });

  it('las pantallas están cableadas a esa cadena (el menú y Configuración del conductor van a su salida)', () => {
    const app = soloCodigo(leer(SRC + 'AppConductor.js'));
    assert.match(app, /<MenuLateral [^\n]*onCerrarSesion=\{cerrarSesion\}/, '⛔ el menú del conductor no sale por cerrarSesion');
    assert.match(app, /<Configuracion [^\n]*onCerrarSesion=\{cerrarSesion\}/, '⛔ Configuración del conductor no sale por cerrarSesion');
    const raiz = soloCodigo(leer(SRC + 'App.js'));
    assert.match(raiz, /<AppConductor[\s\S]{0,400}?onCerrarSesion=\{handleCerrarSesion\}/, '⛔ el conductor no sale por la salida de la app');
  });

  it('nadie más cierra la sesión: solo App.js (salir) y Login.js (rechazar una entrada)', () => {
    const dir = path.join(__dirname, '..', 'guajirago', 'src');
    const quien = fs.readdirSync(dir).filter((f) => f.endsWith('.js'))
      .filter((f) => /\bsignOut\b/.test(soloCodigo(leer(SRC + f))));
    assert.deepStrictEqual(quien.sort(), ['App.js', 'Login.js'], '⛔ otra pantalla cierra la sesión por su cuenta');
    assert.ok(!/\bdeleteUser\s*\(\s*user\s*\)\s*;/.test(soloCodigo(leer(SRC + 'Configuracion.js'))),
      '⛔ «Eliminar cuenta» vuelve a borrar el usuario antes de pasar por la salida');
  });
});
