import React, { useState } from 'react';
// G90: los colores salen de LA paleta (theme.js).
import { T } from './theme';

function MenuLateral({ nombre, foto, onIrPerfil, onIrCreditos, onIrViajes, onIrGanancias, onIrSeguridad, onIrAyuda, onIrConfig, onIrPromociones, onCerrarSesion, onCambiarNegocio }) {
  const [abierto, setAbierto] = useState(false);

  const cerrar = () => setAbierto(false);

  // Salir lo hace la pantalla que abrió el menú, y la sesión se cierra AL FINAL (G07, 28-sep-2026). Antes el menú la
  // cerraba primero: sin sesión, apagar al conductor ya no entraba y su ficha se quedaba «activo».
  const cerrarSesion = () => onCerrarSesion();

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
      <span style={{ color: color || T.tinta, fontSize: '15px', fontWeight: '500' }}>{texto}</span>
    </div>
  );

  return (
    <>
      <div onClick={() => setAbierto(true)} style={{ position: 'absolute', top: '18px', left: '20px', display: 'flex', alignItems: 'center', gap: '6px', background: T.azulNaranja, borderRadius: '12px', color: '#FFFFFF', fontSize: '14px', fontWeight: '700', padding: '8px 16px', cursor: 'pointer', zIndex: 5, boxShadow: '0 3px 10px rgba(28,142,249,0.30)' }}>
        <span style={{ fontSize: '20px', lineHeight: '1' }}>☰</span> Menú
      </div>

      {abierto && (
        <div onClick={cerrar} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '82%', maxWidth: '320px', background: T.fondo, borderRight: `1.5px solid ${T.borde}`, display: 'flex', flexDirection: 'column', boxShadow: '2px 0 20px rgba(0,0,0,0.5)' }}>

            <div style={{ background: T.grad, padding: '28px 20px 24px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', marginBottom: '12px', overflow: 'hidden' }}>
                {foto ? <img src={foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
              </div>
              <p style={{ color: T.negro, fontSize: '18px', fontWeight: '900', margin: '0' }}>{nombre || 'Usuario'}</p>
              <p style={{ color: 'rgba(20,20,22,0.7)', fontSize: '13px', margin: '4px 0 0', fontWeight: 'bold' }}>GuajiraGo</p>
            </div>

            <div style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
              {onCambiarNegocio && (
                <div onClick={() => { cerrar(); onCambiarNegocio(); }} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '12px', cursor: 'pointer', marginBottom: '10px', background: 'linear-gradient(135deg, #EAF2FF, #FFF3EA)', border: `1.5px solid ${T.azul}` }}>
                  <span style={{ fontSize: '20px' }}>🔄</span>
                  <span style={{ color: T.azul, fontSize: '15px', fontWeight: '900' }}>Cambiar de negocio</span>
                </div>
              )}
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

            <div style={{ padding: '12px 12px 24px', borderTop: `1px solid ${T.borde}` }}>
              {opcion('🚪', 'Cerrar sesión', cerrarSesion, T.peligro)}
            </div>

          </div>
        </div>
      )}
    </>
  );
}

export default MenuLateral;