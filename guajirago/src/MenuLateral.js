import React, { useState } from 'react';
import { auth } from './firebase';
import { signOut } from 'firebase/auth';

function MenuLateral({ nombre, foto, onIrPerfil, onIrCreditos, onIrViajes, onIrGanancias, onIrSeguridad, onIrAyuda, onIrConfig, onIrPromociones, onCerrarSesion }) {
  const [abierto, setAbierto] = useState(false);

  const cerrar = () => setAbierto(false);

  const cerrarSesion = async () => {
    try { await signOut(auth); } catch (e) {}
    if (onCerrarSesion) onCerrarSesion(); else window.location.reload();
  };

  const compartir = async () => {
    const texto = '¡Pide tu taxi o mototaxi en Riohacha con GuajiraGo! 🚗 https://guajirago.web.app';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'GuajiraGo', text: texto, url: 'https://guajirago.web.app' });
      } else {
        await navigator.clipboard.writeText(texto);
        alert('¡Enlace copiado! Compártelo con tus amigos.');
      }
    } catch (e) {}
  };

  const proximamente = () => alert('Esta función estará disponible muy pronto.');

  const opcion = (icono, texto, accion, color) => (
    <div onClick={() => { cerrar(); accion(); }} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '12px', cursor: 'pointer', marginBottom: '2px' }}>
      <span style={{ fontSize: '20px' }}>{icono}</span>
      <span style={{ color: color || '#1A1A1E', fontSize: '15px', fontWeight: '500' }}>{texto}</span>
    </div>
  );

  return (
    <>
      <div onClick={() => setAbierto(true)} style={{ position: 'absolute', top: '18px', left: '20px', display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #1C8EF9, #FF7A2F)', borderRadius: '12px', color: '#FFFFFF', fontSize: '14px', fontWeight: '700', padding: '8px 16px', cursor: 'pointer', zIndex: 5, boxShadow: '0 3px 10px rgba(28,142,249,0.30)' }}>
        <span style={{ fontSize: '20px', lineHeight: '1' }}>☰</span> Menú
      </div>

      {abierto && (
        <div onClick={cerrar} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '82%', maxWidth: '320px', background: '#FFFFFF', borderRight: '1.5px solid #ECECEF', display: 'flex', flexDirection: 'column', boxShadow: '2px 0 20px rgba(0,0,0,0.5)' }}>

            <div style={{ background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', padding: '28px 20px 24px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', marginBottom: '12px', overflow: 'hidden' }}>
                {foto ? <img src={foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
              </div>
              <p style={{ color: '#141416', fontSize: '18px', fontWeight: '900', margin: '0' }}>{nombre || 'Usuario'}</p>
              <p style={{ color: 'rgba(20,20,22,0.7)', fontSize: '13px', margin: '4px 0 0', fontWeight: 'bold' }}>GuajiraGo</p>
            </div>

            <div style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
              {opcion('👤', 'Mi perfil', () => { if (onIrPerfil) onIrPerfil(); else proximamente(); })}
              {opcion('🕐', 'Mis viajes', () => { if (onIrViajes) onIrViajes(); else proximamente(); })}
              {opcion('💰', 'Mis créditos', () => { if (onIrCreditos) onIrCreditos(); else proximamente(); })}
              {opcion('📊', 'Ganancias', () => { if (onIrGanancias) onIrGanancias(); else proximamente(); })}
              {opcion('🛡️', 'Seguridad', () => { if (onIrSeguridad) onIrSeguridad(); else proximamente(); })}
              {opcion('📢', 'Compartir GuajiraGo', compartir)}
              {opcion('🎁', 'Promociones', () => { if (onIrPromociones) onIrPromociones(); else proximamente(); })}
              {opcion('⚙️', 'Configuración', () => { if (onIrConfig) onIrConfig(); else proximamente(); })}
              {opcion('❓', 'Ayuda y soporte', () => { if (onIrAyuda) onIrAyuda(); else proximamente(); })}
            </div>

            <div style={{ padding: '12px 12px 24px', borderTop: '1px solid #ECECEF' }}>
              {opcion('🚪', 'Cerrar sesión', cerrarSesion, '#FF4444')}
            </div>

          </div>
        </div>
      )}
    </>
  );
}

export default MenuLateral;