import React from 'react';

// ── LA VENTANITA DE AVISO DEL PANEL · UNA SOLA ─────────────────────────────
// REGLA 9 del dueño: «Nada se rechaza en silencio.»
//
// El 27-ago-2026 se cerraron los botones del panel que fallaban callados: aprobar
// o suspender un negocio, anular un código de recarga, borrar una promoción,
// contestar un chat.
//
// EL NÚMERO, bien contado: el panel tenía 32 catch vacíos, y DIECINUEVE de ellos
// eran escrituras. Se cerraron DIECISÉIS. Los tres que quedan están dichos abajo,
// con su porqué. La primera versión de este comentario decía diecisiete: los contó
// mal, y lo cazó la segunda opinión volviéndolos a contar.
//
// POR QUÉ ES UN COMPONENTE Y NO SE COPIA EN CADA PANTALLA: son seis pantallas.
// Copiar estos ocho renglones de ventanita seis veces es sembrar seis gemelos que en
// un mes dirán cosas distintas — y ya nos ha mordido esta semana (SEGUNDA LEY).
// El texto de cada aviso sale de avisoRechazo.js, que también es único; esto solo
// lo pinta.
//
// LO QUE NO HACE, y queda ANOTADO:
//
//   · ComentariosReportados.js tiene su PROPIA ventanita, escrita a mano. Es la
//     única copia que queda; cambiarla es tocar código que funciona y no estaba
//     en la lista (PRIMERA LEY). Trabajo aparte de un rato.
//     (Rechazos.js NO tiene ventanita: avisa con una franja dentro de la propia
//     pantalla. La primera versión de este comentario decía que sí, y era falso —
//     dentro de un mes alguien habría ido a buscar allí algo que no existe.)
//
//   · Y quedan QUINCE escrituras mudas que no estaban en la lista. Este número
//     dijo TRES hasta el 30-ago-2026 y era FALSO: la cuenta se hizo buscando
//     `catch (e) {}` VACÍOS, y las doce que faltaban no lo son. Lo midió la
//     segunda opinión antes del commit.
//
//     Las tres que ya se sabían: `registrarLog` (Superadmin.js:145),
//     `olvideContrasena` (App.js:34) y el `signOut` del efecto de sesión
//     (App.js:104). De la segunda: el mensaje único es a PROPÓSITO, para no
//     revelar qué correos están registrados; solo miente cuando el fallo es de red.
//
//     Y las DOCE de Conductores.js, que son las peores del panel porque es donde
//     se le quita el trabajo a alguien: cuatro llevan `catch (e) { console.error }`
//     —rastro en la consola, CERO en pantalla— (r299, r307, r321, r333) y ocho no
//     llevan catch ninguno, son `onClick={async () => { await updateDoc(...) }}`
//     a pelo (r471, r479, r517, r767, r901, r909, r1009, r1017). En todo el
//     archivo hay 0 `setAviso`, 0 `alert` y 0 `apuntarRechazo`.
//     Conductores.js va con su propia foto y sus diez pasos.
function AvisoModal({ aviso, onCerrar }) {
  if (!aviso) return null;
  return (
    <div onClick={onCerrar} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#FFFFFF', borderRadius: '20px', padding: '24px', width: '100%', maxWidth: '360px', textAlign: 'center' }}>
        <div style={{ fontSize: '44px', marginBottom: '8px' }}>⚠️</div>
        <p style={{ color: '#1A1A1E', fontSize: '17px', fontWeight: '900', margin: '0 0 8px' }}>{aviso.titulo}</p>
        <p style={{ color: '#666', fontSize: '14px', margin: '0 0 18px' }}>{aviso.texto}</p>
        <button onClick={onCerrar} style={{ width: '100%', padding: '13px', background: '#1C8EF9', border: 'none', borderRadius: '12px', color: '#FFF', fontSize: '15px', fontWeight: '900', cursor: 'pointer' }}>Entendido</button>
      </div>
    </div>
  );
}

export default AvisoModal;
