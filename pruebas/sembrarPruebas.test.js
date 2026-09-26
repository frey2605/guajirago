// ═══════════════════════════════════════════════════════════════════════════
//  SEMBRAR DATOS DE MENTIRA EN PRUEBAS · solo en pruebas, sin pisar, sin avisos reales
//
//  scripts/sembrar-pruebas.cjs escribe datos y crea cuentas, así que tiene que
//  demostrar lo que NO hace: escribir en producción, escribir en simulacro, pisar lo
//  que ya existe, o guardar un código de avisos que llegue a un teléfono de verdad.
//  Aquí se le da una nube de mentira que anota cada llamada; nada toca la red.
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const S = require('../scripts/sembrar-pruebas.cjs');
const N = require('../scripts/nube.cjs');

// Una nube de mentira: guarda cuentas y documentos, y anota cada llamada.
function nubeFalsa({ cuentas = [], docs = {} } = {}) {
  const hay = { cuentas: new Set(cuentas), docs: new Map(Object.entries(docs)) };
  const llamadas = [];
  const responde = (x, ok = true) => ({ ok, status: ok ? 200 : 409, json: async () => x });
  const pedir = async (url, op) => {
    const b = op.body ? JSON.parse(op.body) : {};
    llamadas.push({ url, b });
    if (url.endsWith('/accounts:lookup')) return responde({ users: b.localId.filter((u) => hay.cuentas.has(u)).map((localId) => ({ localId })) });
    if (url.endsWith(':batchGet')) {
      return responde(b.documents.map((n) => {
        const ruta = n.split('/documents/')[1];
        return hay.docs.has(ruta) ? { found: { name: n, fields: N.aCampos(hay.docs.get(ruta)) } } : { missing: n };
      }));
    }
    if (url.endsWith('/accounts')) { hay.cuentas.add(b.localId); return responde({ localId: b.localId }); }
    if (url.endsWith(':commit')) {
      const rutas = b.writes.map((w) => w.update.name.split('/documents/')[1]);
      if (b.writes.some((w, i) => w.currentDocument.exists === false && hay.docs.has(rutas[i]))) return responde({ error: 'ya existe' }, false);
      b.writes.forEach((w, i) => hay.docs.set(rutas[i], N.doc({ fields: w.update.fields })));
      return responde({});
    }
    throw new Error('llamada inesperada: ' + url);
  };
  return { pedir, llamadas, hay };
}
const correr = (argv, nube) => S.principal({ argv, pedir: nube.pedir, permiso: 'x', log: () => {}, clave: () => 'clave-falsa', guardar: () => {} });
const escribe = (l) => l.url.endsWith(':commit') || l.url.endsWith('/accounts');

describe('SEMBRAR PRUEBAS · la guardia: jamás producción', () => {
  it('el guion apunta a guajirago-pruebas, y armar una dirección de producción revienta', () => {
    assert.strictEqual(S.PROYECTO, 'guajirago-pruebas');
    assert.match(S.urls('guajirago-pruebas').commit, /projects\/guajirago-pruebas\//);
    assert.throws(() => S.urls('guajirago'), /pruebas|produccion|producción/i, '⛔ se pudo armar una dirección de PRODUCCIÓN');
  });

  it('ninguna llamada, en ningún modo, va a otro proyecto que pruebas', async () => {
    for (const argv of [[], ['--comprobar'], ['--de-verdad']]) {
      const n = nubeFalsa();
      await correr(argv, n);
      for (const l of n.llamadas) assert.match(l.url, /\/projects\/guajirago-pruebas[/:]/, '⛔ ' + l.url);
    }
  });
});

describe('SEMBRAR PRUEBAS · simulacro primero, y sin pisar', () => {
  it('SIN --de-verdad no escribe nada, pero dice todo lo que crearía', async () => {
    const n = nubeFalsa();
    const r = await correr([], n);
    assert.strictEqual(n.llamadas.filter(escribe).length, 0, '⛔ el simulacro escribió');
    assert.strictEqual(r.cuentasNuevas.length, 7);
    assert.strictEqual(r.docsNuevos.length, r.plan.docs.length);
  });

  it('--comprobar tampoco escribe', async () => {
    const n = nubeFalsa();
    await correr(['--comprobar'], n);
    assert.strictEqual(n.llamadas.filter(escribe).length, 0);
  });

  it('CON --de-verdad crea todo en UN lote, cada documento con «que no exista», y después lo vuelve a leer', async () => {
    const n = nubeFalsa();
    const r = await correr(['--de-verdad'], n);
    const commits = n.llamadas.filter((l) => l.url.endsWith(':commit'));
    assert.strictEqual(commits.length, 1, 'un solo lote');
    assert.ok(commits[0].b.writes.every((w) => w.currentDocument && w.currentDocument.exists === false), '⛔ un documento se escribe sin la condición «que no exista»');
    assert.strictEqual(r.faltan, 0);
    const ultima = n.llamadas.at(-1).url;
    assert.ok(/:batchGet$/.test(ultima), '⛔ no volvió a leer del servidor después de escribir');
    for (const d of r.plan.docs) assert.deepStrictEqual(S.diferencias(d.datos, n.hay.docs.get(d.ruta)), [], d.ruta + ' no quedó como el plan');
  });

  it('lo que ya existe NO se toca: ni la cuenta ni el documento', async () => {
    const n = nubeFalsa({ cuentas: ['prueba-pasajero'], docs: { 'config/global': { hecha: 'a mano por el dueño' } } });
    await correr(['--de-verdad'], n);
    const creadas = n.llamadas.filter((l) => l.url.endsWith('/accounts')).map((l) => l.b.localId);
    assert.ok(!creadas.includes('prueba-pasajero'), '⛔ volvió a crear una cuenta que ya existía');
    const escritos = n.llamadas.find((l) => l.url.endsWith(':commit')).b.writes.map((w) => w.update.name);
    assert.ok(!escritos.some((x) => x.endsWith('/config/global')), '⛔ pisó un documento que ya existía');
    assert.deepStrictEqual(n.hay.docs.get('config/global'), { hecha: 'a mano por el dueño' });
  });

  it('una segunda corrida no hace nada: no hay qué sembrar', async () => {
    const n = nubeFalsa();
    await correr(['--de-verdad'], n);
    const antes = n.llamadas.length;
    await correr(['--de-verdad'], n);
    assert.strictEqual(n.llamadas.slice(antes).filter(escribe).length, 0);
  });
});

describe('SEMBRAR PRUEBAS · lo sembrado sirve para usar las apps, y no manda nada a nadie', () => {
  const plan = S.elPlan();
  const de = (ruta) => (plan.docs.find((d) => d.ruta === ruta) || {}).datos;

  it('ningún código de avisos, ninguna suscripción, ningún viaje ni pedido', () => {
    assert.ok(!/fcmToken|clienteFcmToken/.test(JSON.stringify(plan.docs)), '⛔ un código de avisos de verdad mandaría avisos a un teléfono real');
    for (const d of plan.docs) assert.match(d.ruta, /^(config|usuarios|conductores|negocios|negociosPrivado)\//, '⛔ se siembra en ' + d.ruta);
  });

  it('los correos son de un dominio que no existe, y cada cuenta tiene su documento', () => {
    for (const c of plan.cuentas) {
      assert.match(c.email, /@gg\.test$/);
      assert.ok(de('usuarios/' + c.uid) || de('negocios/' + c.uid), c.uid + ' no tiene documento');
    }
  });

  it('la configuración es la del panel (no una copia), con restaurantes y turismo encendidos', () => {
    const c = de('config/global');
    assert.deepStrictEqual(c, { ...S.configPorDefecto(), moduloRestaurantes: true, moduloTurismo: true });
  });

  it('los conductores pueden trabajar: placa, vehículo, tipo y créditos para la comisión; apagados hasta abrir la app', () => {
    const c = de('config/global');
    for (const [uid, comision] of [['prueba-conductor-taxi', c.comisionTaxi], ['prueba-conductor-moto', c.comisionMototaxi]]) {
      const u = de('usuarios/' + uid);
      assert.strictEqual(u.tipo, 'conductor');
      assert.ok(u.placa && u.vehiculo, uid + ': sin placa o vehículo la app lo manda al formulario de registro');
      assert.ok(u.creditos >= comision, uid + ': sin créditos no puede aceptar viajes');
      assert.ok(u.activo !== false && !u.sancionHasta, uid + ': saldría la pantalla de sanción');
      assert.strictEqual(de('conductores/' + uid).activo, false);
    }
    assert.deepStrictEqual([de('usuarios/prueba-conductor-taxi').tipoVehiculo, de('usuarios/prueba-conductor-moto').tipoVehiculo], ['Taxi', 'Mototaxi']);
  });

  it('dos pasajeros distintos (las reglas no dejan ofertar en tu propio viaje) y un superadministrador', () => {
    assert.strictEqual(de('usuarios/prueba-pasajero').tipo, 'pasajero');
    assert.strictEqual(de('usuarios/prueba-pasajera').tipo, 'pasajero');
    assert.strictEqual(de('usuarios/prueba-admin').rol, 'superadmin');
  });

  it('el restaurante y la agencia salen en el escaparate, y lo privado va aparte', () => {
    for (const [uid, tipo] of [['prueba-restaurante', 'restaurante'], ['prueba-agencia', 'turismo']]) {
      const n = de('negocios/' + uid);
      assert.strictEqual(n.tipoNegocio, tipo);
      for (const k of ['activo', 'aprobado', 'visibleEnEscaparate', 'perfilCompleto']) assert.strictEqual(n[k], true, uid + '.' + k);
      assert.ok(!('duenoTelefono' in n) && !('creditos' in n), '⛔ un dato privado quedó en el documento público');
      assert.ok(de('negociosPrivado/' + uid), uid + ' sin su documento privado');
    }
    assert.ok(de('negocios/prueba-restaurante').menu.every((p) => p.disponible === true), 'un plato sin disponible:true no sale');
    assert.ok(de('negocios/prueba-agencia').tours.every((t) => t.disponible === true));
  });
});

describe('LA CASA COMÚN · escribir y leer dicen lo mismo', () => {
  it('aCampos y val van y vuelven sin cambiar nada', () => {
    const o = { t: 'á', n: 5, d: 1.5, b: false, z: null, l: [1, 'x'], v: [], m: { a: { b: 2 } } };
    assert.deepStrictEqual(N.doc({ fields: N.aCampos(o) }), { id: '', ...o });
  });
  it('un entero se guarda como ENTERO (ir y volver no lo ve: un 5 decimal también vuelve como 5)', () => {
    assert.deepStrictEqual(N.aValor(50000), { integerValue: '50000' });
    assert.deepStrictEqual(N.aValor(1.5), { doubleValue: 1.5 });
  });
  it('lo que no sabe escribir lo dice, en vez de guardar un hueco', () => {
    assert.throws(() => N.aCampos({ x: undefined }), /el campo «x» está undefined/, 'el aviso tiene que nombrar el campo');
    assert.throws(() => N.aValor(NaN), /no es un número/);
    assert.throws(() => N.aValor(() => 1), /no sé escribir/);
  });
});
