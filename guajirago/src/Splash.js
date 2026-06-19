import React, { useEffect, useState } from 'react';

function Splash({ onFinish }) {
  const [escala, setEscala] = useState(0.5);
  const [opacidad, setOpacidad] = useState(0);
  const [pantalla, setPantalla] = useState('splash');
  const [esIphone, setEsIphone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [yaInstalada, setYaInstalada] = useState(false);

  useEffect(() => {
    // Animación de entrada
    setTimeout(() => { setEscala(1); setOpacidad(1); }, 100);

    // Detectar si ya está instalada
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) {
      setYaInstalada(true);
      setTimeout(() => onFinish(), 2000);
      return;
    }

    // Detectar iPhone
    const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    setEsIphone(isIOS);

    // Para Android — capturar evento de instalación
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    // Mostrar pantalla de instalación después del splash
    setTimeout(() => setPantalla('instalar'), 2500);
  }, [onFinish]);

  const instalarAndroid = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const resultado = await deferredPrompt.userChoice;
      if (resultado.outcome === 'accepted') {
        onFinish();
      }
    }
  };

  const saltarInstalacion = () => {
    onFinish();
  };

  // Pantalla splash inicial
  if (pantalla === 'splash') {
    return (
      <div style={{
        backgroundColor: '#141416', minHeight: '100vh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Arial Black, sans-serif',
      }}>
        <div style={{
          transform: `scale(${escala})`, opacity: opacidad,
          transition: 'all 1s ease-in-out', textAlign: 'center',
        }}>
          <img src="/logo192.png" alt="GuajiraGo" style={{
            width: '100px', height: '100px',
            borderRadius: '24px', marginBottom: '24px',
          }}/>
          <h1 style={{ fontSize: '52px', color: '#FFFFFF', margin: '0', letterSpacing: '-1px' }}>
            Guajira
          </h1>
          <h1 style={{
            fontSize: '72px',
            background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            margin: '0', letterSpacing: '-2px',
          }}>GO</h1>
          <p style={{ color: '#555', fontSize: '12px', letterSpacing: '4px', marginTop: '24px' }}>
            UNA APP · TODA LA GUAJIRA
          </p>
        </div>
      </div>
    );
  }

  // Pantalla de instalación
  return (
    <div style={{
      backgroundColor: '#141416', minHeight: '100vh',
      fontFamily: 'Arial, sans-serif', display: 'flex',
      flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '32px 24px',
    }}>
      <img src="/logo192.png" alt="GuajiraGo" style={{
        width: '100px', height: '100px',
        borderRadius: '24px', marginBottom: '24px',
        boxShadow: '0 8px 32px rgba(255, 122, 47, 0.4)',
      }}/>

      <h1 style={{
        fontSize: '32px',
        background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        margin: '0 0 8px', fontFamily: 'Arial Black, sans-serif',
      }}>GuajiraGo</h1>

      <p style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: '900', margin: '0 0 8px', textAlign: 'center' }}>
        ¡Instala la app gratis!
      </p>
      <p style={{ color: '#555', fontSize: '14px', margin: '0 0 32px', textAlign: 'center' }}>
        Solicita taxi o mototaxi en Riohacha desde tu celular
      </p>

      {/* Beneficios */}
      <div style={{ width: '100%', marginBottom: '32px' }}>
        {[
          { emoji: '🚕', texto: 'Taxis y mototaxis al instante' },
          { emoji: '🗺️', texto: 'Mapa en tiempo real' },
          { emoji: '⚡', texto: 'Rápido y fácil de usar' },
          { emoji: '🆓', texto: '100% gratis' },
        ].map((item, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '12px 0', borderBottom: '1px solid #1A1A1E',
          }}>
            <span style={{ fontSize: '24px' }}>{item.emoji}</span>
            <p style={{ color: '#FFFFFF', fontSize: '15px', margin: '0' }}>{item.texto}</p>
          </div>
        ))}
      </div>

      {/* Botón instalar iPhone */}
      {esIphone && (
        <div style={{
          background: '#1A1A1E', borderRadius: '20px',
          padding: '20px', width: '100%', marginBottom: '16px',
        }}>
          <p style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: 'bold', margin: '0 0 12px', textAlign: 'center' }}>
            📲 Cómo instalar en iPhone:
          </p>
          <p style={{ color: '#555', fontSize: '13px', margin: '0 0 6px' }}>
            1️⃣ Toca <strong style={{color:'#FF7A2F'}}>↑ Compartir</strong> abajo en Safari
          </p>
          <p style={{ color: '#555', fontSize: '13px', margin: '0' }}>
            2️⃣ Toca <strong style={{color:'#FF7A2F'}}>"Añadir a pantalla de inicio"</strong>
          </p>
        </div>
      )}

      {/* Botón instalar Android */}
      {!esIphone && deferredPrompt && (
        <button onClick={instalarAndroid} style={{
          width: '100%', padding: '18px',
          background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)',
          border: 'none', borderRadius: '16px',
          color: '#141416', fontSize: '18px',
          fontWeight: '900', cursor: 'pointer',
          marginBottom: '12px',
        }}>
          📲 Instalar GuajiraGo ahora
        </button>
      )}

      <button onClick={saltarInstalacion} style={{
        background: 'none', border: 'none',
        color: '#555', fontSize: '14px',
        cursor: 'pointer', marginTop: '8px',
      }}>
        Continuar sin instalar →
      </button>
    </div>
  );
}

export default Splash;