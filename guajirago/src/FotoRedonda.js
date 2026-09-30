import React, { useState } from 'react';

// 👤 LA FOTO REDONDA DE UNA PERSONA — UNA sola pieza (gemelo G98, 30-sep-2026).
//
// El círculo con la foto, y el muñeco 👤 si no hay foto, estaba escrito a mano 5 veces: el menú lateral (56),
// «Mi perfil» (80) y tres en la pantalla del pasajero (la oferta del conductor, 44; el conductor que viene, 48;
// y el viaje en curso, 44). Las cinco hacían lo mismo, y las cinco tenían el mismo hueco: si la foto NO CARGA
// (enlace viejo, sin señal, borrada del almacén) salía un círculo vacío con el ícono de imagen rota, no el muñeco.
// Ahora, si la imagen falla al cargar, sale el muñeco, igual que cuando no hay foto.
//
// QUÉ foto es la de cada quien NO lo decide esta pieza: la de la ficha la saca `fotoDe` (fotoUsuario.js, G43) y la
// del conductor de un viaje es la copia que lleva el viaje (`conductorFoto`). Aquí solo se DIBUJA. Esa regla vive
// aparte y sin imports a propósito (tiene copia idéntica en el panel, atada por pruebas/fotoFicha.test.js): meterle
// React la rompería.
//
// Cada sitio dice:
//   · src    — la foto (o nada).
//   · tamano — cuál de los tamaños de abajo, por su nombre.
//   · estilo — lo que es SUYO: el fondo, el borde, el margen (no cambia el círculo ni el muñeco).
// Lo mide `node scripts/medir-foto-redonda.cjs` y lo vigila `pruebas/fotoRedonda.test.js`.

export const TAMANOS = {
  menu: { lado: '56px', letra: '28px' }, // el menú lateral (☰ Menú)
  perfil: { lado: '80px', letra: '36px' }, // «Mi perfil»
  tarjeta: { lado: '44px', letra: '22px' }, // la oferta del conductor y el viaje en curso
  tarjetaGrande: { lado: '48px', letra: '24px' }, // el conductor que viene a recogerte
};

const IMAGEN = { width: '100%', height: '100%', objectFit: 'cover' };

function FotoRedonda({ src, tamano, estilo }) {
  const t = TAMANOS[tamano];
  if (!t) throw new Error('FotoRedonda: no conozco el tamaño «' + tamano + '»');
  // La foto que no cargó (se guarda CUÁL: si cambia la foto, se vuelve a intentar).
  const [rota, setRota] = useState(null);
  const verFoto = !!src && rota !== src;
  // `background` y `marginBottom` tienen su hueco reservado (vacío si el sitio no los da: React no los pinta) para que
  // el estilo salga en el MISMO orden que se escribía a mano: el careo del menú (G90) compara el HTML letra por letra.
  return (
    <div style={{ width: t.lado, height: t.lado, borderRadius: '50%', background: undefined, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: t.letra, marginBottom: undefined, overflow: 'hidden', ...estilo }}>
      {verFoto ? <img src={src} alt="" style={IMAGEN} onError={() => setRota(src)} /> : '👤'}
    </div>
  );
}

export default FotoRedonda;
