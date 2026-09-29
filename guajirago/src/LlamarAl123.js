import React from 'react';

// 🚨 «LLAMAR AL 123» — UNA sola pieza para la tarjeta roja y para el número (gemelo G70, 29-sep-2026).
//
// La tarjeta sale en dos sitios de la app del pasajero: Ajustes › Seguridad (Seguridad.js) y la ventanita del 🚨 en
// medio del viaje (el `PanelEmergencia` de Solicitar.js). Hasta el 29-sep-2026 cada pantalla la dibujaba a mano y
// cada una tenía su propio `window.location.href = 'tel:123'`: la misma tarjeta escrita dos veces (SEGUNDA LEY).
//
// Lo que hace al tocarse NO cambió: llama a la línea de emergencias de Colombia. Lo mide, TOCÁNDOLA en las dos
// pantallas, `node scripts/medir-llamar-123.cjs`, y lo vigila `pruebas/llamar123.test.js`.

// La línea de emergencias de Colombia. Si un día cambia, se cambia aquí y cambia en las dos pantallas.
export const NUMERO_EMERGENCIA = '123';

export const llamarAlNumeroDeEmergencia = () => {
  window.location.href = `tel:${NUMERO_EMERGENCIA}`;
};

// Las dos pantallas la dibujan con tamaños distintos, y es A PROPÓSITO, así que se conserva con nombre:
//  · `ajustes`: en Ajustes › Seguridad va SOLA, arriba de todo, como lo primero de la pantalla: más grande y con borde.
//  · `viaje`: en la ventanita del 🚨, en medio del viaje, comparte sitio con «Compartir ubicación…» por WhatsApp:
//    más compacta, para que las dos opciones quepan juntas en un teléfono.
const TAMANOS = {
  ajustes: {
    caja: { borderRadius: '20px', padding: '24px', marginBottom: '24px', gap: '16px', border: '2px solid #FF4444' },
    icono: '40px', titulo: '18px',
    subtitulo: { color: 'rgba(255,255,255,0.7)', fontSize: '13px', margin: '4px 0 0' },
    textoSubtitulo: 'Línea de emergencias Colombia',
  },
  viaje: {
    caja: { borderRadius: '18px', padding: '20px', marginBottom: '14px', gap: '14px' },
    icono: '34px', titulo: '17px',
    subtitulo: { color: 'rgba(255,255,255,0.8)', fontSize: '12px', margin: '3px 0 0' },
    textoSubtitulo: 'Línea de emergencias',
  },
};

export function TarjetaLlamar123({ donde }) {
  const t = TAMANOS[donde] || TAMANOS.ajustes;
  const { border, ...caja } = t.caja;
  return (
    <div onClick={llamarAlNumeroDeEmergencia} style={{ background: 'linear-gradient(135deg, #FF4444, #CC0000)', borderRadius: caja.borderRadius, padding: caja.padding, marginBottom: caja.marginBottom, display: 'flex', alignItems: 'center', gap: caja.gap, cursor: 'pointer', ...(border ? { border } : {}) }}>
      <span style={{ fontSize: t.icono }}>🚨</span>
      <div>
        <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: t.titulo, margin: '0' }}>{`Llamar al ${NUMERO_EMERGENCIA}`}</p>
        <p style={t.subtitulo}>{t.textoSubtitulo}</p>
      </div>
    </div>
  );
}
