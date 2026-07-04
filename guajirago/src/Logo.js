import React from 'react';

// Símbolo (pin) de GuajiraGo como SVG vectorial reutilizable.
// variante: 'color' (degradado), 'blanco' o 'negro'.
const OUTER = 'M 52 88 C 30 88, 14 74, 14 55 C 14 36, 28 24, 42 20 C 50 17, 58 16, 62 10 C 64 6, 63 2, 63 2 C 72 10, 76 22, 72 34 C 70 40, 66 45, 62 48 L 82 48 L 82 56 C 82 73, 69 88, 52 88 Z';
const INNER = 'M 52 78 C 36 78, 26 68, 26 55 C 26 42, 35 33, 46 30 C 53 27, 60 26, 64 20 C 66 30, 62 38, 56 42 L 70 42 L 70 56 C 70 63, 62 78, 52 78 Z';

export default function Logo({ size = 40, variante = 'color', style }) {
  const fill = variante === 'blanco' ? '#FFFFFF' : variante === 'negro' ? '#1A1A1E' : 'url(#ggLogoGrad)';
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" style={style} aria-label="GuajiraGo">
      <defs>
        <linearGradient id="ggLogoGrad" x1="10%" y1="90%" x2="90%" y2="5%">
          <stop offset="0%" stopColor="#FFCF4D" />
          <stop offset="40%" stopColor="#FF7A2F" />
          <stop offset="100%" stopColor="#D6357E" />
        </linearGradient>
      </defs>
      <g transform="translate(4,4)">
        <path fillRule="evenodd" fill={fill} d={`${OUTER} ${INNER}`} />
        <rect x="44" y="51" width="10" height="10" transform="rotate(45 49 56)" fill={fill} />
      </g>
    </svg>
  );
}

// Logo en esquina superior derecha (para pantallas con espacio).
export function LogoEsquina({ size = 36 }) {
  return (
    <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 6, lineHeight: 0 }}>
      <Logo size={size} />
    </div>
  );
}
