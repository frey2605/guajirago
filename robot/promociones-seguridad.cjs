#!/usr/bin/env node
/**
 * SEGURIDAD · ¿un pasajero puede fabricarse una promoción? (29-sep-2026) — contra la base de PRUEBAS.
 *
 *  Entra como `pasajero@gg.test` (entrarALaBase: la base de pruebas, nunca producción) e intenta:
 *   1. CREAR una promoción nueva (apagada y sin valor que canjear, para no dejar nada usable);
 *   2. EDITAR la que dejó una corrida anterior (si la hay);
 *   3. CREARSE su contador de usos de esa promoción.
 *  Con las reglas viejas las tres entran; con las nuevas las tres se rechazan.
 *
 *  Uso: node robot/promociones-seguridad.cjs
 *  Sale con código 1 si ALGUNA de las tres entra (el hueco sigue abierto).
 *
 *  🔴 Con las reglas viejas deja escrita en pruebas `promociones/ROBOT-HUECO-<hora>` (apagada,
 *  valor 0). Con las nuevas no escribe nada.
 */
const { entrarALaBase } = require('./comun.cjs');

async function intentar(nombre, fn) {
  try {
    await fn();
    console.log('🔴 ENTRÓ     ' + nombre);
    return true;
  } catch (e) {
    console.log('✓ rechazado ' + nombre + '  (' + String(e.message).slice(0, 90) + ')');
    return false;
  }
}

async function main() {
  const b = await entrarALaBase('pasajero@gg.test');
  const id = 'ROBOT-HUECO-' + Date.now();
  const fabricada = {
    nombre: 'PRUEBA DEL HUECO (robot, no sirve)', tipoBeneficio: 'credito', valorBeneficio: 0,
    activa: false, fechaInicio: '2026-01-01', fechaFin: '2026-01-02', creadoPor: 'robot-pasajero',
  };
  let entro = 0;
  if (await intentar('crear promociones/' + id, () => b.cambiar('promociones/' + id, fabricada))) entro++;
  if (await intentar('editar promociones/' + id + ' (valor)', () => b.cambiar('promociones/' + id, { valorBeneficio: 1 }))) entro++;
  if (await intentar('crearse promociones/' + id + '/usos/' + b.uid, () => b.cambiar('promociones/' + id + '/usos/' + b.uid, { veces: 0 }))) entro++;
  console.log(entro ? '🔴 el hueco está ABIERTO en pruebas (' + entro + ' de 3 entraron)' : '✓ el hueco está CERRADO en pruebas (0 de 3 entraron)');
  if (entro) process.exitCode = 1;
}

main().catch((e) => { console.error('🔴 ' + e.message); process.exitCode = 1; });
