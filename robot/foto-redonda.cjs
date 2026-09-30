#!/usr/bin/env node
// 🤖 LA FOTO REDONDA Y EL MUÑECO 👤 — gemelo G98 (30-sep-2026).
// Desde G98 el círculo con la foto de una persona sale de UNA pieza (FotoRedonda.js), que pone el muñeco 👤 si no hay
// foto Y TAMBIÉN si la foto no carga (antes quedaba el círculo vacío con el ícono de imagen rota).
// Entra en PRUEBAS como pasajero@gg.test y, como una persona, abre el ☰ Menú (foto de 56) y «Mi perfil» (foto de 80)
// con tres fichas:
//   · con una foto buena (un cuadrito naranja escrito en la propia dirección: no depende del almacén) → la foto, cargada;
//   · con una foto ROTA (una dirección de pruebas que no es una imagen) → el muñeco, sin imagen rota;
//   · sin foto → el muñeco.
// Al final deja `fotoConductor` como estaba. Solo toca la ficha de PRUEBAS de pasajero@gg.test.
//   node robot/foto-redonda.cjs
const { SITIOS, abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');

const BUENA = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#FF7A2F"/></svg>');
const ROTA = SITIOS.transporte + 'robot-foto-que-no-existe.jpg'; // una dirección de pruebas que no es una imagen
const MODULOS = /Transporte y movilidad/;

(async () => {
  const fallos = [];
  const vistos = [];
  const base = await entrarALaBase('pasajero@gg.test');
  const ruta = 'usuarios/' + base.uid;
  const ficha = await base.leer(ruta);
  const habia = Object.prototype.hasOwnProperty.call(ficha, 'fotoConductor') ? ficha.fotoConductor : null;

  const r = await abrir('transporte', { nombre: 'foto-redonda' });
  const p = r.pagina;
  r.dialogos = [];
  p.on('dialog', async (d) => { r.dialogos.push(d.message()); await d.dismiss().catch(() => {}); });
  const espera = (ms) => p.waitForTimeout(ms);
  const enModulos = async () => MODULOS.test((await r.texto()) || '');
  const entendido = async () => {
    const e = p.getByRole('button', { name: 'Entendido' });
    if (await e.count()) { await e.first().click(); await espera(500); }
  };

  // Los círculos de foto de la pantalla: redondos, que recortan, y con una <img> o el muñeco dentro.
  const circulos = () => p.evaluate(() => [...document.querySelectorAll('div')]
    .filter((d) => d.style.borderRadius === '50%' && d.style.overflow === 'hidden'
      && (d.querySelector(':scope > img') || d.textContent.trim() === '👤'))
    .map((d) => {
      const i = d.querySelector(':scope > img');
      const q = d.getBoundingClientRect();
      return {
        lado: Math.round(q.width), alto: Math.round(q.height),
        img: i ? (i.complete && i.naturalWidth > 0 ? 'cargada' : 'rota') : null,
        muneco: !i && d.textContent.trim() === '👤',
        dentro: q.left >= 0 && q.right <= window.innerWidth,
      };
    }));

  async function mirar(nombre, lado, quiere) {
    await espera(2500);
    const cs = (await circulos()).filter((c) => c.lado === lado);
    await r.captura(nombre);
    if (cs.length !== 1) { fallos.push(nombre + ': hay ' + cs.length + ' fotos redondas de ' + lado + 'px'); vistos.push(nombre + ' 🔴'); return; }
    const c = cs[0];
    const que = c.img ? 'foto ' + c.img : (c.muneco ? 'muñeco 👤' : 'nada');
    const mal = [];
    if (quiere === 'foto' && c.img !== 'cargada') mal.push('esperaba la foto cargada y sale ' + que);
    if (quiere === 'muneco' && !c.muneco) mal.push('esperaba el muñeco 👤 y sale ' + que);
    if (c.alto !== lado) mal.push('no es redonda: ' + c.lado + '×' + c.alto);
    if (!c.dentro) mal.push('se sale de la pantalla');
    if (mal.length) fallos.push(nombre + ': ' + mal.join(', '));
    vistos.push(nombre + ' ' + (mal.length ? '🔴' : '✓') + ' (' + lado + 'px, ' + que + ')');
  }

  try {
    await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
    await espera(800);
    await p.fill('input[placeholder="Correo electrónico"]', 'pasajero@gg.test');
    await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
    await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
    await espera(8000);
    await entendido();
    if (!(await enModulos())) throw new Error('no llegó al menú de módulos');

    for (const [caso, foto, quiere] of [['foto-buena', BUENA, 'foto'], ['foto-rota', ROTA, 'muneco'], ['sin-foto', null, 'muneco']]) {
      await base.cambiar(ruta, { fotoConductor: foto });
      await p.reload();
      await espera(8000);
      await entendido();
      if (!(await enModulos())) throw new Error(caso + ': al recargar no volvió al menú de módulos');
      await p.getByText('Menú').first().click();
      await mirar(caso + '-menu', 56, quiere);
      await p.getByText('Mi perfil', { exact: true }).first().click();
      await mirar(caso + '-mi-perfil', 80, quiere);
      await p.getByText('‹ Volver').first().click();
      await espera(2500);
    }
  } catch (e) {
    fallos.push('el recorrido se cortó: ' + e.message.split('\n')[0]);
    await r.captura('cortado').catch(() => {});
  } finally {
    await base.cambiar(ruta, { fotoConductor: habia });
    console.log('FICHA DE PRUEBAS devuelta: fotoConductor = ' + (habia ? '(la que tenía)' : 'null'));
    console.log('PANTALLAS (' + vistos.length + '):\n  · ' + vistos.join('\n  · '));
    console.log('CAPTURAS:', r.carpeta);
    console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
    if (r.dialogos.length) console.log('VENTANAS DEL NAVEGADOR:', r.dialogos.join(' || '));
    await r.cerrar();
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ la foto redonda sale cargada, y el muñeco 👤 sin foto y con la foto rota, en el menú y en Mi perfil');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
