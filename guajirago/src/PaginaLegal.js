import React from 'react';

// 📜 EL ESQUELETO DE LAS PÁGINAS LEGALES — UNA sola pieza (gemelo G75, 29-sep-2026).
//
// Los Términos y condiciones y la Política de privacidad eran el mismo archivo con otro texto: cada uno dibujaba a mano
// la cabecera con «‹ Volver», el marco, la fecha de actualización y el estilo de cada sección. Ahora los dos pintan
// esta pieza y solo ponen lo suyo: el título, la fecha y sus secciones. El texto legal sigue en cada página, sin tocar.
// Que se vea EXACTAMENTE igual que antes lo mide `node scripts/medir-soporte-legal.cjs` (pinta las dos páginas y
// compara su HTML con el de antes) y lo vigila `pruebas/soporteLegal.test.js`.

/** Una sección de la página: su título en naranja y su texto. */
export const seccion = (titulo, texto) => (
  <div style={{ marginBottom: '20px' }}>
    <h3 style={{ color: '#FF7A2F', fontSize: '15px', fontWeight: '900', margin: '0 0 8px' }}>{titulo}</h3>
    <p style={{ color: '#6B7280', fontSize: '14px', margin: '0', lineHeight: '1.6' }}>{texto}</p>
  </div>
);

function PaginaLegal({ titulo, actualizacion, onVolver, children }) {
  return (
    <div style={{ backgroundColor: '#FFFFFF', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg, #FFFFFF, #ECECEF)', padding: '24px 20px', position: 'relative', display: 'flex', alignItems: 'center' }}>
        <div onClick={onVolver} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.06)', borderRadius: '12px', color: '#1A1A1E', fontSize: '14px', fontWeight: '500', padding: '8px 16px', cursor: 'pointer' }}>
          <span style={{ fontSize: '20px', fontWeight: '900', lineHeight: '1', position: 'relative', top: '-1px' }}>‹</span> Volver
        </div>
        <h2 style={{ color: '#1A1A1E', margin: '0 auto', fontSize: '18px', fontWeight: '900' }}>{titulo}</h2>
      </div>

      <div style={{ padding: '24px 20px' }}>
        <p style={{ color: '#6B7280', fontSize: '12px', margin: '0 0 20px' }}>{'Última actualización: ' + actualizacion}</p>

        {children}

        <div style={{ height: '20px' }} />
      </div>
    </div>
  );
}

export default PaginaLegal;
