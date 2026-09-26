// ═══════════════════════════════════════════════════════════════════════════
//  LA LEY DEL BOTÓN · todo lo que guarda pasa por el candado
//
//  Traída de Talaria el 26-sep-2026 (Jhon: «cada botón debe tener bloqueo de doble
//  toque, mostrar la acción GUARDANDO, ENVIANDO, AJUSTANDO, y al final el resultado
//  con la verdad»). Allá, cinco trampas de cinco pasaban con la tanda en verde, y un
//  botón sin señal se quedaba en «Guardando…» para siempre. Aquí se prueba:
//    · el candado EJECUTÁNDOLO (guajirago/src/candado.js tal cual): doble toque, la
//      palabra, la verdad del final, el tope de tiempo, el aviso tardío;
//    · que el panel y aliados llevan la MISMA pieza, byte a byte;
//    · el vigilante (scripts/medir-ley-boton.cjs) contra pantallas de mentira: las
//      trampas que se escapaban en Talaria y las que salieron midiendo GuajiraGo;
//    · y la cuenta de lo que ya estaba antes de la ley: solo puede bajar, a la vista.
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, cargarDeLaApp } = require('./cargar.cjs');
const V = require('../scripts/medir-ley-boton.cjs');

const C = cargarDeLaApp('guajirago/src/candado.js');

// Un reloj de mentira: el tope se dispara cuando la prueba lo dice, no a los 20 segundos.
function relojFalso() {
  const pendientes = new Map();
  let n = 0;
  return {
    poner: (fn) => { pendientes.set(++n, fn); return n; },
    quitar: (id) => pendientes.delete(id),
    vencer: () => { for (const [id, fn] of pendientes) { pendientes.delete(id); fn(); } },
    cuantos: () => pendientes.size,
  };
}
const esperar = () => new Promise((ok) => setImmediate(ok));
function candado(tope) {
  const cambios = [];
  const avisos = [];
  const reloj = relojFalso();
  const c = C.crearCandado({ alCambiar: (x) => cambios.push(x), alAviso: (x) => avisos.push(x), tope, reloj });
  return { c, cambios, avisos, reloj };
}

describe('LA LEY DEL BOTÓN · el candado, ejecutado', () => {
  it('dos toques en el mismo instante hacen UNA sola cosa, y dice cuál acción trabaja', async () => {
    const { c, cambios, avisos } = candado();
    let veces = 0;
    let soltar;
    const lento = () => new Promise((ok) => { veces++; soltar = ok; });
    const uno = c.correr(lento, 'guardar', 'Quedó guardado.');
    const dos = c.correr(lento, 'guardar', 'Quedó guardado.');
    assert.strictEqual(c.ocupado, true);
    assert.strictEqual(await dos, null, 'el segundo toque no hace nada');
    await esperar();
    soltar('hecho');
    assert.deepStrictEqual(await uno, { ok: true, valor: 'hecho' });
    assert.strictEqual(veces, 1, '⛔ se hizo dos veces');
    assert.strictEqual(c.ocupado, false);
    assert.deepStrictEqual(cambios, ['guardar', false], 'la pantalla sabe CUÁL botón dice «Guardando…»');
    assert.deepStrictEqual(avisos, [{ ok: true, texto: 'Quedó guardado.', cual: 'guardar' }], 'la verdad del final la da el candado');
  });

  it('si falla, dice el motivo en cristiano y queda libre', async () => {
    const { c, avisos } = candado();
    const r = await c.correr(async () => { throw Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' }); }, 'pagar', 'Pagado.');
    assert.deepStrictEqual(r, { ok: false, error: 'No tienes permiso para hacer esto.' });
    assert.strictEqual(avisos[0].ok, false);
    assert.ok(!/Missing/.test(avisos[0].texto), '⛔ el error técnico en inglés llegó a la pantalla');
    assert.strictEqual(c.ocupado, false, '⛔ quedó trabado después de fallar');
    assert.deepStrictEqual(await c.correr(async () => 1, 'pagar', 'Pagado.'), { ok: true, valor: 1 }, 'y vuelve a funcionar');
  });

  it('los errores de Firebase se dicen en cristiano; un mensaje propio de la app se respeta; sin motivo, uno claro', () => {
    assert.strictEqual(C.enCristiano({ code: 'functions/unavailable', message: 'internal' }), C.ERRORES.unavailable);
    assert.strictEqual(C.enCristiano({ code: 'firestore/permission-denied' }), C.ERRORES['permission-denied']);
    assert.strictEqual(C.enCristiano(new Error('Ese código ya se usó.')), 'Ese código ya se usó.');
    assert.strictEqual(C.enCristiano({ code: 'functions/internal', message: 'INTERNAL' }), C.MENSAJE_FALLA);
    assert.strictEqual(C.enCristiano(undefined), C.MENSAJE_FALLA);
  });

  it('una respuesta { ok: false } del servidor es una falla, no un éxito', async () => {
    const { c, avisos } = candado();
    assert.deepStrictEqual(await c.correr(async () => ({ ok: false, error: 'Saldo insuficiente.' }), 'recargar', 'Recargado.'),
      { ok: false, error: 'Saldo insuficiente.' });
    assert.strictEqual(avisos[0].texto, 'Saldo insuficiente.');
  });

  it('NUNCA queda trabado: si no contesta, al tope se abre y dice «no se pudo confirmar», no «falló»', { timeout: 3000 }, async () => {
    const { c, avisos, reloj, cambios } = candado(20000);
    const r = c.correr(() => new Promise(() => {}), 'enviar', 'Enviado.'); // sin señal: la base guarda y no contesta
    await esperar();
    assert.strictEqual(c.ocupado, true);
    reloj.vencer();
    assert.deepStrictEqual(await r, { ok: false, error: C.NO_CONFIRMADO, sinConfirmar: true });
    assert.strictEqual(c.ocupado, false, '⛔ el botón se quedó en «Enviando…» para siempre');
    assert.deepStrictEqual(cambios, ['enviar', false]);
    assert.ok(/confirmar/i.test(avisos[0].texto) && !/no se guard/i.test(avisos[0].texto),
      '⛔ dijo que falló sin saberlo: con plata de por medio eso invita a hacerlo dos veces');
  });

  it('si la respuesta llega TARDE, el aviso se corrige con la verdad; y si ya corre otra acción, no la pisa', { timeout: 3000 }, async () => {
    const { c, avisos, reloj } = candado();
    let soltar;
    const r = c.correr(() => new Promise((ok) => { soltar = ok; }), 'enviar', 'Enviado.');
    await esperar();
    reloj.vencer();
    await r;
    soltar('llegó');
    await esperar(); await esperar();
    assert.deepStrictEqual(avisos.map((a) => a.ok), [false, true], 'el aviso «no se pudo confirmar» se corrigió a «Enviado.»');

    const d = candado();
    let soltarViejo;
    const viejo = d.c.correr(() => new Promise((ok) => { soltarViejo = ok; }), 'enviar', 'Enviado.');
    await esperar();
    d.reloj.vencer();
    await viejo;
    await d.c.correr(async () => 1, 'otra', 'La otra quedó.');
    soltarViejo('llegó');
    await esperar(); await esperar();
    assert.strictEqual(d.avisos.at(-1).texto, 'La otra quedó.', '⛔ un aviso tardío pisó el de la acción de ahora');
  });

  it('sin el nombre de la acción o sin su «se hizo», no arranca (la palabra no saldría, o la verdad sería muda)', async () => {
    const { c } = candado();
    await assert.rejects(() => c.correr(async () => 1), /nombre de la acción/);
    await assert.rejects(() => c.correr(async () => 1, 'guardar'), /se hizo/);
    assert.strictEqual(c.ocupado, false);
  });

  it('el tope no se queda corriendo cuando la acción ya terminó', async () => {
    const { c, reloj } = candado();
    await c.correr(async () => 1, 'guardar', 'Listo.');
    assert.strictEqual(reloj.cuantos(), 0);
  });
});

describe('LA LEY DEL BOTÓN · una sola pieza en las tres apps', () => {
  for (const app of ['guajirago-admin', 'guajirago-aliados']) {
    it(app + ' lleva el candado y su gancho byte a byte como transporte', () => {
      for (const f of ['src/candado.js', 'src/useAccion.js']) {
        assert.strictEqual(leer(app + '/' + f), leer('guajirago/' + f),
          '⛔ ' + app + '/' + f + ' se separó de guajirago/' + f + ': la copia se cambia en los tres sitios');
      }
    });
  }

  it('el gancho usa el candado y la palabra sale SOLO en el botón cuya acción corre', () => {
    const t = leer('guajirago/src/useAccion.js');
    assert.match(t, /import \{ crearCandado \} from '\.\/candado'/);
    assert.match(t, /ocupado === cual \? trabajando : normal/);
    assert.match(t, /alAviso: setAviso/, '⛔ la verdad del final no llega a la pantalla');
  });
});

// ── EL VIGILANTE, contra pantallas de mentira ────────────────────────────────
const BIEN = `import { useAccion } from './useAccion';
import { updateDoc, doc } from 'firebase/firestore';
export default function X() {
  const { ocupado, correr, texto, aviso, cerrarAviso } = useAccion();
  const guardar = () => correr(() => updateDoc(doc(db, 'a', 'b'), { x: 1 }), 'guardar', 'Quedó guardado.');
  return <div>
    <button disabled={!!ocupado} onClick={guardar}>{texto('guardar', 'Guardando…', 'Guardar')}</button>
    <button disabled={!!ocupado} onClick={() => setAbierto(false)}>Cancelar</button>
    {aviso && <AvisoModal texto={aviso.texto} onCerrar={cerrarAviso} />}
  </div>;
}`;
const cambiar = (de, a) => { assert.ok(BIEN.includes(de), 'la trampa no se aplicó: ' + de); return BIEN.replace(de, a); };
const TRAMPAS = [
  ['un segundo botón que guarda sin candado (en Talaria pasaba: miraba la pantalla, no el botón)',
    cambiar('</div>;', `<button onClick={() => deleteDoc(doc(db, 'a', 'b'))}>Borrar</button></div>;`), (r) => r.sinCandado.length === 1],
  ['un «guardando» hecho a mano con otro nombre (en Talaria solo se cazaba si se llamaba «ocupado»)',
    cambiar('  return <div>', `  const pagar = async () => { setCargando(true); await addDoc(col, {}); setCargando(false); };\n  return <div>`), (r) => r.aMano.length === 1],
  ['la palabra del botón no coincide con la acción que corre: nunca sale «Guardando…»',
    cambiar(`texto('guardar',`, `texto('grabar',`), (r) => r.faltas.some((f) => /no sale nunca/.test(f))],
  ['la pantalla no pinta la verdad del final',
    cambiar(`    {aviso && <AvisoModal texto={aviso.texto} onCerrar={cerrarAviso} />}\n`, ''), (r) => r.faltas.some((f) => /aviso del final/.test(f))],
  ['«Cancelar» se puede tocar mientras trabaja',
    cambiar(`<button disabled={!!ocupado} onClick={() => setAbierto(false)}>Cancelar`, `<button onClick={() => setAbierto(false)}>Cancelar`), (r) => r.faltas.some((f) => /Cancelar/.test(f))],
  ['correr sin su «se hizo»',
    cambiar(`, 'guardar', 'Quedó guardado.')`, `, 'guardar')`), (r) => r.faltas.some((f) => /se hizo/.test(f))],
  ['el botón con candado no se deshabilita',
    cambiar(`<button disabled={!!ocupado} onClick={guardar}>`, `<button onClick={guardar}>`), (r) => r.faltas.some((f) => /deshabilita/.test(f))],
  ['el botón con candado no dice qué está haciendo',
    cambiar(`{texto('guardar', 'Guardando…', 'Guardar')}`, 'Guardar'), (r) => r.faltas.some((f) => /qué está haciendo/.test(f))],
  ['un interruptor que guarda, entregado a otra pieza de la pantalla (así se escapaban los de Configuración)',
    cambiar('  return <div>', `  const fila = (t, fn) => <div onClick={fn}>{t}</div>;\n  const cambiarSonido = () => setDoc(doc(db, 'u', 'x'), { s: 1 });\n  return <div>{fila('Sonido', cambiarSonido)}`), (r) => r.sinCandado.length === 1],
  ['enviar con la tecla Enter sin candado (se manda el mensaje dos veces)',
    cambiar('</div>;', `<input onKeyDown={(e) => e.key === 'Enter' && addDoc(col, {})} /></div>;`), (r) => r.sinCandado.length === 1],
  ['borrar la cuenta sin candado (Auth también cuenta)',
    cambiar('</div>;', `<button onClick={() => deleteUser(auth.currentUser)}>Eliminar</button></div>;`), (r) => r.sinCandado.length === 1],
  ['una función importada de otro archivo de la app que guarda',
    cambiar('</div>;', `<button onClick={() => guardarRechazo(x)}>Rechazar</button></div>;`).replace(`import { useAccion }`, `import { guardarRechazo } from './guardarRechazo';\nimport { useAccion }`),
    (r) => r.sinCandado.length === 1, new Set(['guardarRechazo'])],
];

describe('LA LEY DEL BOTÓN · el vigilante caza cada trampa', () => {
  it('la pantalla bien hecha pasa limpia (si no, el vigilante acusaría a los que cumplen)', () => {
    assert.deepStrictEqual(V.revisarArchivo(BIEN), { sinCandado: [], aMano: [], faltas: [] });
  });
  for (const [nombre, fuente, cazada, escritores] of TRAMPAS) {
    it('trampa: ' + nombre, () => {
      const r = V.revisarArchivo(fuente, escritores);
      assert.ok(cazada(r), '⛔ se escapó: ' + JSON.stringify(r));
    });
  }
  it('los escritores de la app se sacan leyendo la app, siguiendo la cadena entre archivos', () => {
    const esc = V.escritoresDe([
      { fuente: `import { addDoc } from 'firebase/firestore';\nexport async function guardarRechazo(x) { await addDoc(c, x); }` },
      { fuente: `import { guardarRechazo } from './a';\nexport const rechazar = (x) => guardarRechazo(x);` },
      { fuente: `export function sumar(a, b) { return a + b; }` },
    ]);
    assert.deepStrictEqual([...esc].sort(), ['guardarRechazo', 'rechazar']);
  });
});

describe('LA LEY DEL BOTÓN · lo que ya estaba antes de la ley solo puede bajar', () => {
  const hoy = V.medir();
  it('ninguna pantalla que ya usa la ley la incumple', () => {
    const faltas = Object.entries(hoy).flatMap(([f, x]) => x.faltas.map((s) => f + ': ' + s));
    assert.deepStrictEqual(faltas, [], '\n' + faltas.join('\n'));
  });
  it('la cuenta de hoy es EXACTAMENTE la anotada: ni un botón nuevo sin candado, ni uno arreglado sin tacharlo', () => {
    const difs = [];
    for (const f of new Set([...Object.keys(hoy), ...Object.keys(V.PENDIENTES)])) {
      const a = hoy[f] ? [hoy[f].sinCandado.length, hoy[f].aMano.length] : [0, 0];
      const p = V.PENDIENTES[f] || [0, 0];
      if (a[0] > p[0] || a[1] > p[1]) difs.push(`🔴 ${f}: ${a[0]} sin candado y ${a[1]} a mano; se permiten ${p[0]} y ${p[1]}. Lo nuevo nace con useAccion.`);
      else if (a[0] < p[0] || a[1] < p[1]) difs.push(`✓ ${f} bajó a [${a[0]}, ${a[1]}]: táchalo en PENDIENTES de scripts/medir-ley-boton.cjs.`);
    }
    assert.deepStrictEqual(difs, [], '\n' + difs.join('\n'));
  });
});
