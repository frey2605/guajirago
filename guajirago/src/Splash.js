import React, { useEffect, useState } from 'react';

function Splash({ onFinish }) {
  const [scale, setScale] = useState(0.5);
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    setTimeout(() => {
      setScale(1);
      setOpacity(1);
    }, 100);

    const timer = setTimeout(() => {
      onFinish();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div style={{
      backgroundColor: '#141416',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Arial Black, sans-serif',
    }}>
      <div style={{
        transform: `scale(${scale})`,
        opacity: opacity,
        transition: 'all 1s ease-in-out',
        textAlign: 'center',
      }}>
        <h1 style={{
          fontSize: '52px',
          color: '#FFFFFF',
          margin: '0',
          letterSpacing: '-1px',
        }}>
          Guajira
        </h1>
        <h1 style={{
          fontSize: '72px',
          background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          margin: '0',
          letterSpacing: '-2px',
        }}>
          GO
        </h1>
        <p style={{
          color: '#555',
          fontSize: '12px',
          letterSpacing: '4px',
          marginTop: '24px',
        }}>
          UNA APP · TODA LA GUAJIRA
        </p>
      </div>
    </div>
  );
}

export default Splash;