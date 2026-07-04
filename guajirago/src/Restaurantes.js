import React, { useState, useEffect } from 'react';
import { db, storage } from './firebase';
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Logo from './Logo';

// ============================================================
// GuajiraGo - Módulo de Restaurantes (lado del cliente)
// Pantallas: lista de restaurantes -> menú + carrito -> confirmación
// Lee la colección "restaurantes" y crea pedidos en "pedidosRestaurantes"
// ============================================================

function Restaurantes({ nombre, onVolver }) {
  const [pantalla, setPantalla] = useState('lista'); // lista | menu | confirmado
  const [restaurantes, setRestaurantes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [restauranteActivo, setRestauranteActivo] = useState(null);
  const [carrito, setCarrito] = useState([]); // {id, nombre, precio, cantidad}
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [numeroPedido, setNumeroPedido] = useState('');

  // --- Seguimiento del pedido y chat de soporte de pago ---
  const [pedidoId, setPedidoId] = useState(null);
  const [pedidoActivo, setPedidoActivo] = useState(null);
  const [mensajeChat, setMensajeChat] = useState('');
  const [imagenChat, setImagenChat] = useState(null);
  const [enviandoMensaje, setEnviandoMensaje] = useState(false);
  const [errorChat, setErrorChat] = useState('');

  const [errorCarga, setErrorCarga] = useState('');

  // Escuchar restaurantes en tiempo real
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'restaurantes'),
      (snap) => {
        const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRestaurantes(lista);
        setCargando(false);
      },
      (error) => {
        setErrorCarga(error.message || 'Error al leer restaurantes');
        setCargando(false);
      }
    );
    return () => unsub();
  }, []);

  // Escuchar el pedido activo en tiempo real (para el seguimiento y el chat)
  useEffect(() => {
    if (!pedidoId) { setPedidoActivo(null); return; }
    const unsub = onSnapshot(doc(db, 'pedidosRestaurantes', pedidoId), (snap) => {
      if (snap.exists()) setPedidoActivo({ id: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [pedidoId]);

  // Detecta teléfonos, correos o menciones a redes/WhatsApp en el chat,
  // para que el pago se coordine siempre dentro de la app.
  const contieneInfoSensible = (texto) => {
    const limpio = texto.toLowerCase();
    const patronTelefono = /(\+?\d[\s.-]?){7,}/;
    const patronCorreo = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
    const palabrasProhibidas = ['whatsapp', 'wasap', 'wapp', 'instagram', 'facebook', 'telegram', 'llamame', 'llámame', 'numero', 'número'];
    if (patronTelefono.test(texto)) return true;
    if (patronCorreo.test(texto)) return true;
    return palabrasProhibidas.some((p) => limpio.includes(p));
  };

  const cop = (n) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(n);

  // ---------- Carrito ----------
  const agregarAlCarrito = (plato) => {
    if (!plato.disponible) return;
    setCarrito((prev) => {
      const existe = prev.find((i) => i.id === plato.id);
      if (existe) {
        return prev.map((i) =>
          i.id === plato.id ? { ...i, cantidad: i.cantidad + 1 } : i
        );
      }
      return [...prev, { id: plato.id, nombre: plato.nombre, precio: plato.precio, cantidad: 1 }];
    });
  };

  const cambiarCantidad = (id, delta) => {
    setCarrito((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, cantidad: i.cantidad + delta } : i))
        .filter((i) => i.cantidad > 0)
    );
  };

  const totalCarrito = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const itemsCarrito = carrito.reduce((s, i) => s + i.cantidad, 0);

  // ---------- Enviar pedido ----------
  const enviarPedido = async () => {
    if (carrito.length === 0 || !direccion.trim() || enviando) return;
    setEnviando(true);
    try {
      const ref = await addDoc(collection(db, 'pedidosRestaurantes'), {
        restauranteId: restauranteActivo.id,
        restauranteNombre: restauranteActivo.nombre,
        cliente: nombre || 'Cliente GuajiraGo',
        telefono: telefono.trim(),
        direccion: direccion.trim(),
        items: carrito,
        total: totalCarrito,
        estado: 'nuevo',
        creado: serverTimestamp(),
      });
      setNumeroPedido(ref.id.slice(-5).toUpperCase());
      setCarrito([]);
      setPedidoId(ref.id);
      setPantalla('seguimiento');
    } catch (e) {
      alert('No se pudo enviar el pedido. Revisa tu conexión e intenta de nuevo.');
    }
    setEnviando(false);
  };

  // ---------- Chat de soporte de pago (dentro del pedido) ----------
  const subirImagenChat = async (archivo) => {
    const refArchivo = ref(storage, `pedidosRestaurantes/${pedidoActivo.id}/${Date.now()}.jpg`);
    await uploadBytes(refArchivo, archivo);
    return await getDownloadURL(refArchivo);
  };

  const enviarMensajeChat = async () => {
    if (!pedidoActivo || enviandoMensaje) return;
    const texto = mensajeChat.trim();
    if (!texto && !imagenChat) return;
    if (texto && contieneInfoSensible(texto)) {
      setErrorChat('Por tu seguridad, no escribas teléfonos, correos ni redes sociales aquí. Usa el chat solo para enviar tu comprobante de pago.');
      return;
    }
    setErrorChat('');
    setEnviandoMensaje(true);
    try {
      let urlImagen = '';
      if (imagenChat) urlImagen = await subirImagenChat(imagenChat);
      await updateDoc(doc(db, 'pedidosRestaurantes', pedidoActivo.id), {
        mensajesPedido: arrayUnion({
          de: 'cliente',
          texto,
          imagen: urlImagen,
          fecha: new Date().toISOString(),
        }),
      });
      setMensajeChat('');
      setImagenChat(null);
    } catch (e) {
      setErrorChat('No se pudo enviar el mensaje. Revisa tu conexión e intenta de nuevo.');
    }
    setEnviandoMensaje(false);
  };

  // ---------- Solo para probar: crear restaurante demo ----------
  const crearRestauranteDemo = async () => {
    await setDoc(doc(db, 'restaurantes', 'donde-meche'), {
      nombre: 'Donde Meche',
      emoji: '🍲',
      descripcion: 'Comida guajira de la buena',
      abierto: true,
      menu: [
        { id: 1, nombre: 'Arepa de huevo', precio: 5000, categoria: 'Entradas', disponible: true },
        { id: 2, nombre: 'Empanada de carne', precio: 3000, categoria: 'Entradas', disponible: true },
        { id: 3, nombre: 'Sancocho de gallina', precio: 18000, categoria: 'Platos fuertes', disponible: true },
        { id: 4, nombre: 'Friche guajiro', precio: 22000, categoria: 'Platos fuertes', disponible: true },
        { id: 5, nombre: 'Chivo guisado', precio: 25000, categoria: 'Platos fuertes', disponible: true },
        { id: 6, nombre: 'Pescado frito con patacón', precio: 26000, categoria: 'Platos fuertes', disponible: true },
        { id: 7, nombre: 'Jugo de corozo', precio: 6000, categoria: 'Bebidas', disponible: true },
        { id: 8, nombre: 'Limonada de coco', precio: 8000, categoria: 'Bebidas', disponible: true },
        { id: 9, nombre: 'Arroz con leche', precio: 6000, categoria: 'Postres', disponible: true },
      ],
    });
  };

  const categorias = restauranteActivo
    ? [...new Set((restauranteActivo.menu || []).map((p) => p.categoria))]
    : [];

  // ============================================================
  // PANTALLA: pedido confirmado
  // ============================================================
  if (pantalla === 'seguimiento') {
    const ESTADOS = [
      { id: 'nuevo', label: 'Recibido', icono: '📩' },
      { id: 'confirmado', label: 'Confirmado', icono: '✅' },
      { id: 'preparando', label: 'Preparando', icono: '👨‍🍳' },
      { id: 'en_camino', label: 'En camino', icono: '🏍️' },
      { id: 'entregado', label: 'Entregado', icono: '🎉' },
    ];

    if (!pedidoActivo) {
      return (
        <div style={{ backgroundColor: '#FFFFFF', minHeight: '100vh', fontFamily: 'Arial, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#6B7280' }}>Cargando tu pedido…</p>
        </div>
      );
    }

    const cancelado = pedidoActivo.estado === 'cancelado';
    const indiceActual = ESTADOS.findIndex((e) => e.id === pedidoActivo.estado);
    const mensajes = pedidoActivo.mensajesPedido || [];

    return (
      <div style={{ backgroundColor: '#FFFFFF', minHeight: '100vh', fontFamily: 'Arial, sans-serif', paddingBottom: '160px' }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #FFFFFF, #ECECEF)', padding: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={() => { setPantalla('lista'); }}
            style={{ background: '#ECECEF', border: 'none', borderRadius: '12px', padding: '10px 14px', color: '#1A1A1E', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            ←
          </button>
          <div>
            <p style={{ color: '#1A1A1E', fontWeight: '900', fontSize: '18px', margin: '0' }}>
              Pedido #{numeroPedido}
            </p>
            <p style={{ color: '#FF7A2F', fontSize: '12px', margin: '2px 0 0' }}>
              {pedidoActivo.restauranteNombre}
            </p>
          </div>
        </div>

        <div style={{ padding: '20px' }}>

          {/* Estado del pedido */}
          {cancelado ? (
            <div style={{ background: '#FFFFFF', border: '1px solid #FF4444', borderRadius: '16px', padding: '18px', marginBottom: '20px', textAlign: 'center' }}>
              <p style={{ color: '#FF4444', fontWeight: '900', fontSize: '15px', margin: '0' }}>❌ Este pedido fue cancelado</p>
            </div>
          ) : (
            <div style={{ background: 'linear-gradient(135deg, #FFFFFF, #ECECEF)', borderRadius: '16px', padding: '20px', marginBottom: '20px', border: '1px solid #ECECEF' }}>
              {ESTADOS.map((e, i) => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: i < ESTADOS.length - 1 ? '4px' : '0' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: i <= indiceActual ? 'linear-gradient(135deg, #FFCF4D, #FF7A2F)' : '#ECECEF',
                    fontSize: '15px', flexShrink: 0,
                  }}>
                    {i <= indiceActual ? e.icono : ''}
                  </div>
                  <p style={{
                    color: i <= indiceActual ? '#1A1A1E' : '#6B7280',
                    fontSize: '14px', fontWeight: i === indiceActual ? '900' : '500', margin: '0',
                  }}>
                    {e.label}{i === indiceActual ? ' — ahora' : ''}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Resumen del pedido */}
          <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '16px', marginBottom: '20px', border: '1px solid #ECECEF' }}>
            <p style={{ color: '#6B7280', fontSize: '11px', letterSpacing: '2px', margin: '0 0 10px' }}>TU PEDIDO</p>
            {(pedidoActivo.items || []).map((i) => (
              <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <p style={{ color: '#1A1A1E', fontSize: '13px', margin: '0' }}>{i.cantidad}x {i.nombre}</p>
                <p style={{ color: '#1A1A1E', fontSize: '13px', margin: '0' }}>{cop(i.precio * i.cantidad)}</p>
              </div>
            ))}
            <div style={{ borderTop: '1px solid #ECECEF', marginTop: '10px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between' }}>
              <p style={{ color: '#1A1A1E', fontWeight: '900', fontSize: '14px', margin: '0' }}>Total</p>
              <p style={{ color: '#FF7A2F', fontWeight: '900', fontSize: '14px', margin: '0' }}>{cop(pedidoActivo.total)}</p>
            </div>
          </div>

          {/* Chat de soporte de pago */}
          <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '16px', border: '1px solid #ECECEF' }}>
            <p style={{ color: '#6B7280', fontSize: '11px', letterSpacing: '2px', margin: '0 0 4px' }}>CHAT CON EL RESTAURANTE</p>
            <p style={{ color: '#6B7280', fontSize: '12px', margin: '0 0 14px' }}>Usa este chat solo para enviar tu comprobante de pago.</p>

            {mensajes.length === 0 && (
              <p style={{ color: '#6B7280', fontSize: '13px', textAlign: 'center', padding: '14px 0' }}>Aún no hay mensajes.</p>
            )}

            {mensajes.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.de === 'cliente' ? 'flex-end' : 'flex-start', marginBottom: '10px' }}>
                <div style={{
                  maxWidth: '75%', background: m.de === 'cliente' ? 'linear-gradient(135deg, #FF7A2F, #D6357E)' : '#6B7280',
                  borderRadius: '14px', padding: '10px 12px',
                }}>
                  {m.imagen && (
                    <img src={m.imagen} alt="comprobante" style={{ width: '100%', maxWidth: '200px', borderRadius: '10px', display: 'block', marginBottom: m.texto ? '6px' : '0' }} />
                  )}
                  {m.texto && <p style={{ color: '#FFFFFF', fontSize: '13px', margin: '0' }}>{m.texto}</p>}
                </div>
              </div>
            ))}

            {imagenChat && (
              <div style={{ marginBottom: '10px' }}>
                <img src={URL.createObjectURL(imagenChat)} alt="preview" style={{ width: '80px', borderRadius: '10px', display: 'block' }} />
                <span onClick={() => setImagenChat(null)} style={{ color: '#FF4444', fontSize: '12px', cursor: 'pointer' }}>✕ Quitar</span>
              </div>
            )}

            {errorChat && <p style={{ color: '#FF4444', fontSize: '12px', margin: '0 0 10px' }}>{errorChat}</p>}

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label style={{ background: '#ECECEF', borderRadius: '12px', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                📎
                <input type="file" accept="image/*" onChange={(e) => e.target.files[0] && setImagenChat(e.target.files[0])} style={{ display: 'none' }} />
              </label>
              <input
                value={mensajeChat}
                onChange={(e) => setMensajeChat(e.target.value)}
                placeholder="Escribe un mensaje…"
                style={{ flex: 1, padding: '12px', background: '#FFFFFF', border: '1px solid #ECECEF', borderRadius: '12px', color: '#1A1A1E', fontSize: '14px', outline: 'none' }}
              />
              <button
                onClick={enviarMensajeChat}
                disabled={enviandoMensaje}
                style={{ background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', border: 'none', borderRadius: '12px', width: '42px', height: '42px', color: '#FFFFFF', fontWeight: '900', cursor: 'pointer', flexShrink: 0 }}
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // PANTALLA: menú del restaurante + carrito
  // ============================================================
  if (pantalla === 'menu' && restauranteActivo) {
    return (
      <div style={{ backgroundColor: '#FFFFFF', minHeight: '100vh', fontFamily: 'Arial, sans-serif', paddingBottom: carrito.length > 0 ? '210px' : '20px' }}>

        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #FFFFFF, #ECECEF)',
          padding: '20px',
          display: 'flex', alignItems: 'center', gap: '14px',
        }}>
          <button
            onClick={() => { setPantalla('lista'); setRestauranteActivo(null); setCarrito([]); }}
            style={{
              background: '#ECECEF', border: 'none', borderRadius: '12px',
              padding: '10px 14px', color: '#1A1A1E', fontSize: '16px',
              fontWeight: 'bold', cursor: 'pointer',
            }}
          >
            ←
          </button>
          <div>
            <p style={{ color: '#1A1A1E', fontWeight: '900', fontSize: '18px', margin: '0' }}>
              {restauranteActivo.emoji} {restauranteActivo.nombre}
            </p>
            <p style={{ color: '#FF7A2F', fontSize: '12px', margin: '2px 0 0' }}>
              {restauranteActivo.abierto ? 'Abierto ahora' : 'Cerrado'}
            </p>
          </div>
        </div>

        {/* Menú por categorías */}
        <div style={{ padding: '20px' }}>
          {categorias.map((cat) => (
            <div key={cat} style={{ marginBottom: '20px' }}>
              <p style={{ color: '#6B7280', fontSize: '11px', letterSpacing: '3px', margin: '0 0 10px', textTransform: 'uppercase' }}>
                {cat}
              </p>
              {(restauranteActivo.menu || [])
                .filter((p) => p.categoria === cat)
                .map((plato) => (
                  <div
                    key={plato.id}
                    onClick={() => agregarAlCarrito(plato)}
                    style={{
                      background: 'linear-gradient(135deg, #FFFFFF, #ECECEF)',
                      borderRadius: '16px', padding: '16px', marginBottom: '10px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      border: '1px solid #ECECEF',
                      cursor: plato.disponible ? 'pointer' : 'default',
                      opacity: plato.disponible ? 1 : 0.45,
                    }}
                  >
                    <div>
                      <p style={{
                        color: '#1A1A1E', fontWeight: 'bold', fontSize: '15px', margin: '0',
                        textDecoration: plato.disponible ? 'none' : 'line-through',
                      }}>
                        {plato.nombre}
                      </p>
                      <p style={{ color: '#FF7A2F', fontSize: '14px', fontWeight: '900', margin: '4px 0 0' }}>
                        {cop(plato.precio)}
                      </p>
                      {!plato.disponible && (
                        <p style={{ color: '#FF4444', fontSize: '11px', fontWeight: 'bold', margin: '4px 0 0' }}>
                          AGOTADO HOY
                        </p>
                      )}
                    </div>
                    {plato.disponible && (
                      <span style={{
                        background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)',
                        borderRadius: '10px', width: '34px', height: '34px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#FFFFFF', fontWeight: '900', fontSize: '20px',
                      }}>
                        +
                      </span>
                    )}
                  </div>
                ))}
            </div>
          ))}
        </div>

        {/* Carrito fijo abajo */}
        {carrito.length > 0 && (
          <div style={{
            position: 'fixed', bottom: '0', left: '0', right: '0',
            background: '#FFFFFF', border: '1.5px solid #ECECEF', borderRadius: '24px 24px 0 0',
            padding: '16px 20px 20px',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.5)', zIndex: 999,
          }}>
            <div style={{ maxHeight: '110px', overflowY: 'auto', marginBottom: '10px' }}>
              {carrito.map((i) => (
                <div key={i.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <p style={{ color: '#1A1A1E', fontSize: '13px', margin: '0', flex: 1 }}>
                    {i.nombre}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button onClick={() => cambiarCantidad(i.id, -1)} style={{
                      background: '#ECECEF', border: 'none', borderRadius: '8px',
                      width: '28px', height: '28px', color: '#1A1A1E',
                      fontWeight: '900', cursor: 'pointer',
                    }}>−</button>
                    <span style={{ color: '#1A1A1E', fontWeight: '900', fontSize: '14px', minWidth: '16px', textAlign: 'center' }}>
                      {i.cantidad}
                    </span>
                    <button onClick={() => cambiarCantidad(i.id, 1)} style={{
                      background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)',
                      border: 'none', borderRadius: '8px',
                      width: '28px', height: '28px', color: '#FFFFFF',
                      fontWeight: '900', cursor: 'pointer',
                    }}>+</button>
                  </div>
                </div>
              ))}
            </div>

            <input
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="📍 Dirección de entrega"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '13px',
                background: '#FFFFFF', border: '1px solid #ECECEF',
                borderRadius: '12px', color: '#1A1A1E', fontSize: '14px',
                marginBottom: '8px', outline: 'none',
              }}
            />
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="📞 Tu teléfono (opcional)"
              type="tel"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '13px',
                background: '#FFFFFF', border: '1px solid #ECECEF',
                borderRadius: '12px', color: '#1A1A1E', fontSize: '14px',
                marginBottom: '10px', outline: 'none',
              }}
            />

            <button
              onClick={enviarPedido}
              disabled={!direccion.trim() || enviando}
              style={{
                width: '100%', padding: '16px',
                background: (!direccion.trim() || enviando)
                  ? '#E7E7EA'
                  : 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)',
                border: 'none', borderRadius: '14px',
                color: (!direccion.trim() || enviando) ? '#9AA0A6' : '#FFFFFF',
                fontSize: '16px', fontWeight: '900',
                cursor: (!direccion.trim() || enviando) ? 'default' : 'pointer',
              }}
            >
              {enviando
                ? 'Enviando…'
                : `Pedir ${itemsCarrito} item${itemsCarrito > 1 ? 's' : ''} · ${cop(totalCarrito)}`}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // PANTALLA: lista de restaurantes
  // ============================================================
  return (
    <div style={{ backgroundColor: '#FFFFFF', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #FFFFFF, #ECECEF)',
        padding: '20px',
        display: 'flex', alignItems: 'center', gap: '14px',
        position: 'relative',
      }}>
        <Logo size={28} style={{ position: 'absolute', top: '14px', right: '16px', zIndex: 6 }} />
        <button
          onClick={onVolver}
          style={{
            background: '#ECECEF', border: 'none', borderRadius: '12px',
            padding: '10px 14px', color: '#1A1A1E', fontSize: '16px',
            fontWeight: 'bold', cursor: 'pointer',
          }}
        >
          ←
        </button>
        <div>
          <p style={{ color: '#1A1A1E', fontWeight: '900', fontSize: '20px', margin: '0' }}>
            🍽️ Restaurantes
          </p>
          <p style={{ color: '#6B7280', fontSize: '13px', margin: '2px 0 0' }}>
            ¿Qué vas a comer hoy?
          </p>
        </div>
      </div>

      <div style={{ padding: '20px' }}>
        {cargando && (
          <p style={{ color: '#6B7280', textAlign: 'center', padding: '40px 0' }}>
            Buscando restaurantes…
          </p>
        )}

        {errorCarga && (
          <p style={{ color: '#FF4444', textAlign: 'center', padding: '20px 0', fontSize: '13px' }}>
            ⚠️ {errorCarga}
          </p>
        )}

        {!cargando && restaurantes.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🍽️</div>
            <p style={{ color: '#6B7280', fontSize: '15px', margin: '0 0 20px' }}>
              Aún no hay restaurantes disponibles.
            </p>
            <button
              onClick={crearRestauranteDemo}
              style={{
                padding: '14px 20px',
                background: 'transparent',
                border: '2px dashed #FF7A2F', borderRadius: '14px',
                color: '#FF7A2F', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer',
              }}
            >
              ⚡ Crear restaurante de prueba
            </button>
          </div>
        )}

        {restaurantes.map((r) => (
          <div
            key={r.id}
            onClick={() => {
              if (!r.abierto) return;
              setRestauranteActivo(r);
              setCarrito([]);
              setPantalla('menu');
            }}
            style={{
              background: 'linear-gradient(135deg, #FFFFFF, #ECECEF)',
              borderRadius: '20px', padding: '20px', marginBottom: '12px',
              display: 'flex', alignItems: 'center', gap: '16px',
              border: '1px solid #ECECEF',
              cursor: r.abierto ? 'pointer' : 'default',
              opacity: r.abierto ? 1 : 0.5,
            }}
          >
            <span style={{ fontSize: '36px' }}>{r.emoji || '🍽️'}</span>
            <div>
              <p style={{ color: '#1A1A1E', fontWeight: '900', fontSize: '16px', margin: '0' }}>
                {r.nombre}
              </p>
              <p style={{ color: r.abierto ? '#FF7A2F' : '#FF4444', fontSize: '12px', margin: '4px 0 0' }}>
                {r.abierto ? (r.descripcion || 'Abierto ahora') : 'Cerrado ahora'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Restaurantes;