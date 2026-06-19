import React, { useState, useEffect } from 'react';
import Splash from './Splash';
import Login from './Login';
import Home from './Home';
import AppConductor from './AppConductor';

function App() {
  const [screen, setScreen] = useState('splash');
  const [tipoUsuario, setTipoUsuario] = useState('');
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [telefonoUsuario, setTelefonoUsuario] = useState('');
  const [placaUsuario, setPlacaUsuario] = useState('');
  const [vehiculoUsuario, setVehiculoUsuario] = useState('');
  const [mostrarInstalar, setMostrarInstalar] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [esIphone, setEsIphone] = useState(false);

  useEffect(() => {
    // Detectar si es iPhone
    const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;

    if (isIOS && !isInStandaloneMode) {
      setEsIphone(true);
      setTimeout(() => setMostrarInstalar(true), 3000);
    }

    // Para Android
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setMostrarInstalar(true), 3000);
    });
  }, []);

  const instalarApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const resultado = await deferredPrompt.userChoice;
      if (resultado.outcome === 'accepted') {
        setMostrarInstalar(false);
      }
      setDeferredPrompt(null);
    } else {
      setMostrarInstalar(false);
    }
  };

  if (screen === 'splash') {
    return <Splash onFinish={() => setScreen('login')} />;
  }

  if (screen === 'login') {
    return <Login onEntrar={(tipo, nombre, telefono, placa, vehiculo) => {
      setTipoUsuario(tipo);
      setNombreUsuario(nombre);
      setTelefonoUsuario(telefono);
      setPlacaUsuario(placa);
      setVehiculoUsuario(vehiculo);
      setScreen('home');
    }} />;
  }

  if (screen === 'home') {
    return (
      <div style={{ position: 'relative' }}>

        {/* Banner de instalación */}
        {mostrarInstalar && (
          <div style={{
            position: 'fixed',
            bottom: '0',
            left: '0',
            right: '0',
            zIndex: 9999,
            background: '#1A1A1E',
            borderRadius: '24px 24px 0 0',
            padding: '24px',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
            animation: 'slideUp 0.3s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
              <img src="/logo192.png" alt="GuajiraGo" style={{
                width: '60px', height: '60px', borderRadius: '16px',
              }}/>
              <div>
                <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '18px', margin: '0' }}>
                  Instalar GuajiraGo
                </p>
                <p style={{ color: '#555', fontSize: '13px', margin: '4px 0 0' }}>
                  Agrégala a tu pantalla de inicio
                </p>
              </div>
              <button onClick={() => setMostrarInstalar(false)} style={{
                marginLeft: 'auto', background: 'none',
                border: 'none', color: '#555',
                fontSize: '24px', cursor: 'pointer',
              }}>✕</button>
            </div>

            {esIphone ? (
              <div>
                <p style={{ color: '#FFFFFF', fontSize: '14px', margin: '0 0 8px' }}>
                  Para instalar GuajiraGo en tu iPhone:
                </p>
                <p style={{ color: '#555', fontSize: '13px', margin: '0 0 4px' }}>
                  1️⃣ Toca el botón <strong style={{color:'#FF7A2F'}}>↑ Compartir</strong> abajo
                </p>
                <p style={{ color: '#555', fontSize: '13px', margin: '0 0 16px' }}>
                  2️⃣ Toca <strong style={{color:'#FF7A2F'}}>"Añadir a pantalla de inicio"</strong>
                </p>
                <button onClick={() => setMostrarInstalar(false)} style={{
                  width: '100%', padding: '16px',
                  background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)',
                  border: 'none', borderRadius: '14px',
                  color: '#141416', fontSize: '16px',
                  fontWeight: '900', cursor: 'pointer',
                }}>
                  ¡Entendido!
                </button>
              </div>
            ) : (
              <button onClick={instalarApp} style={{
                width: '100%', padding: '16px',
                background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)',
                border: 'none', borderRadius: '14px',
                color: '#141416', fontSize: '16px',
                fontWeight: '900', cursor: 'pointer',
              }}>
                📲 Instalar GuajiraGo ahora
              </button>
            )}
          </div>
        )}

        {tipoUsuario === 'conductor' ? (
          <AppConductor
            nombre={nombreUsuario}
            telefono={telefonoUsuario}
            placa={placaUsuario}
            vehiculo={vehiculoUsuario}
          />
        ) : (
          <Home nombre={nombreUsuario} />
        )}
      </div>
    );
  }
}

export default App;