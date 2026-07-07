import React from 'react';

// Red de seguridad: si una pantalla falla al dibujarse, en vez de dejar
// la app en blanco/negro muestra un mensaje amable con opción de reintentar.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('GuajiraGo crash:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', background: '#FFFFFF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'Arial, sans-serif', textAlign: 'center' }}>
          <div style={{ fontSize: '52px', marginBottom: '12px' }}>😕</div>
          <h2 style={{ color: '#1A1A1E', margin: '0 0 8px' }}>Algo se quedó pegado</h2>
          <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 22px' }}>No pudimos cargar esta parte. Intenta de nuevo.</p>
          <button onClick={() => { window.location.href = '/'; }} style={{ padding: '14px 28px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', border: 'none', borderRadius: '14px', color: '#FFFFFF', fontSize: '15px', fontWeight: '900', cursor: 'pointer' }}>Volver al inicio</button>
          <p style={{ color: '#C4C4C4', fontSize: '11px', margin: '20px 0 0', maxWidth: '300px', wordBreak: 'break-word' }}>{String((this.state.error && this.state.error.message) || this.state.error)}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
