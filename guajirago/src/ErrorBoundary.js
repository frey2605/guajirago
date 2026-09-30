import React from 'react';

// Red de seguridad: si una pantalla falla al dibujarse, en vez de dejar
// la app en blanco/negro muestra un mensaje amable con opción de reintentar.
// G102 (30-sep-2026): ESTA es la pieza. guajirago-aliados/src/ErrorBoundary.js es una copia IDÉNTICA (otro repo, no
// puede importarla), atada por pruebas/redDeSeguridad.test.js del repo raíz: se cambia aquí y se copia allá.
// Lo único que cambia entre apps lo pasa su index.js, tomado de SU paleta:
//   app     = el nombre que sale en la consola ('GuajiraGo', 'GuajiraAliados')
//   colores = { titulo, texto, boton } (boton es el fondo del botón «Volver al inicio»)
// Sin props también atrapa: una red que revienta al enseñar su mensaje deja la app en blanco.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error((this.props.app || 'App') + ' crash:', error, info);
  }

  render() {
    if (this.state.error) {
      const colores = this.props.colores || {};
      return (
        <div style={{ minHeight: '100vh', background: '#FFFFFF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'Arial, sans-serif', textAlign: 'center' }}>
          <div style={{ fontSize: '52px', marginBottom: '12px' }}>😕</div>
          <h2 style={{ color: colores.titulo, margin: '0 0 8px' }}>Algo se quedó pegado</h2>
          <p style={{ color: colores.texto, fontSize: '14px', margin: '0 0 22px' }}>No pudimos cargar esta parte. Intenta de nuevo.</p>
          <button onClick={() => { window.location.href = '/'; }} style={{ padding: '14px 28px', background: colores.boton, border: 'none', borderRadius: '14px', color: '#FFFFFF', fontSize: '15px', fontWeight: '900', cursor: 'pointer' }}>Volver al inicio</button>
          <p style={{ color: '#C4C4C4', fontSize: '11px', margin: '20px 0 0', maxWidth: '300px', wordBreak: 'break-word' }}>{String((this.state.error && this.state.error.message) || this.state.error)}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
