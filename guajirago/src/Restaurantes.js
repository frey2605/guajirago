import React, { useState, useEffect, useRef } from 'react';
import { auth, db, storage } from './firebase';
// El formateador de pesos vive en moneda.js: un solo sitio (SEGUNDA LEY).
import { cop } from './moneda';
// Y el filtro anti-datos de los chats, en filtroChat.js — amarrado al panel.
import { contieneInfoSensible } from './filtroChat';
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  arrayUnion,
  serverTimestamp,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Logo from './Logo';
import MenuLateral from './MenuLateral';
import { obtenerTokenFCM } from './Notificaciones';

// ============================================================
// GuajiraGo - Módulo de Restaurantes (lado del cliente)
// Pantallas: lista de restaurantes -> menú + carrito -> confirmación
// Lee la colección "restaurantes" y crea pedidos en "pedidosRestaurantes"
// ============================================================

// Pedidos que este dispositivo ha hecho (para la pantalla "Mis pedidos")
const LS_MIS_PEDIDOS = 'misPedidosGuajira';
const leerMisPedidosIds = () => { try { return JSON.parse(localStorage.getItem(LS_MIS_PEDIDOS) || '[]'); } catch (e) { return []; } };
const guardarMiPedidoId = (id) => { try { const arr = leerMisPedidosIds().filter(x => x !== id); arr.unshift(id); localStorage.setItem(LS_MIS_PEDIDOS, JSON.stringify(arr.slice(0, 40))); } catch (e) {} };
const ESTADO_LABEL_CLIENTE = { nuevo: 'Recibido', confirmado: 'Confirmado', preparando: 'Preparando', empacado: 'Preparando', en_camino: 'En camino', entregado: 'Entregado', cerrado: 'Entregado', cancelado: 'Cancelado' };

// Botón de volver del módulo de restaurantes (azul, claro)
const backBtn = { display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#EAF2FF', border: '1px solid #1C8EF9', borderRadius: '12px', padding: '9px 16px', color: '#1C8EF9', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' };

const METODOS_PAGO = ['Efectivo', 'Nequi', 'Daviplata', 'Tarjeta'];

// ¿El restaurante está dentro de su horario de atención ahora?
const dentroHorario = (r) => {
  const a = r.horarioApertura, c = r.horarioCierre;
  if (a === undefined || c === undefined) return true;
  const h = new Date().getHours();
  if (a === c) return true;            // 24 horas
  if (a < c) return h >= a && h < c;   // horario normal
  return h >= a || h < c;              // cruza la medianoche
};
// Abierto = no pausado manualmente Y dentro del horario
const restauranteAbiertoAhora = (r) => r.abierto !== false && dentroHorario(r);

function Restaurantes({ nombre, onVolver, foto, onCerrarSesion, onIrPerfil, onIrCreditos, onIrViajes, onIrGanancias, onIrSeguridad, onIrAyuda, onIrConfig, onIrPromociones }) {
  const [pantalla, setPantalla] = useState('lista'); // lista | menu | confirmado
  const [restaurantes, setRestaurantes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [restauranteActivo, setRestauranteActivo] = useState(null);
  const [carrito, setCarrito] = useState([]); // {id, nombre, precio, cantidad}
  const [usosPromo, setUsosPromo] = useState(() => { try { return JSON.parse(localStorage.getItem('usosPromoGuajira')) || {}; } catch (e) { return {}; } });
  const [avisoPromo, setAvisoPromo] = useState('');
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
  const [misPedidos, setMisPedidos] = useState([]);
  const [estrellasCal, setEstrellasCal] = useState(0);
  const [comentarioCal, setComentarioCal] = useState('');
  const [enviandoCal, setEnviandoCal] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [metodoPago, setMetodoPago] = useState('');
  const [avisoPago, setAvisoPago] = useState('');
  const [ubicando, setUbicando] = useState(false);
  const [avisoUbic, setAvisoUbic] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const [pidiendoMotivoCancel, setPidiendoMotivoCancel] = useState(false);
  const [motivoCancelCliente, setMotivoCancelCliente] = useState('');
  const [califsRestaurante, setCalifsRestaurante] = useState([]);
  const [mapaCalif, setMapaCalif] = useState({});
  const [verComentarios, setVerComentarios] = useState(false);
  const [platoConfig, setPlatoConfig] = useState(null);
  const [adicionesSel, setAdicionesSel] = useState([]);
  const [cantidadConfig, setCantidadConfig] = useState(1);
  const direccionRef = useRef(null);

  // Escuchar restaurantes en tiempo real
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'restaurantes'),
      (snap) => {
        const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          .filter((r) => r.tipoNegocio !== 'turismo' && r.aprobado !== false);
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

  // Cargar el promedio de calificaciones de cada restaurante (para la lista)
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'calificaciones'));
        const m = {};
        snap.docs.forEach((d) => {
          const c = d.data();
          if (c.reportado || !c.calificadoId || c.quienCalifica !== 'cliente') return;
          if (!m[c.calificadoId]) m[c.calificadoId] = { suma: 0, count: 0 };
          m[c.calificadoId].suma += (c.estrellas || 0);
          m[c.calificadoId].count += 1;
        });
        setMapaCalif(m);
      } catch (e) {}
    })();
  }, []);

  // Escuchar el pedido activo en tiempo real (para el seguimiento y el chat)
  useEffect(() => {
    if (!pedidoId) { setPedidoActivo(null); return; }
    const unsub = onSnapshot(doc(db, 'pedidosRestaurantes', pedidoId), (snap) => {
      if (snap.exists()) setPedidoActivo({ id: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [pedidoId]);

  // Cargar en vivo "Mis pedidos" (los que este dispositivo ha hecho)
  useEffect(() => {
    if (pantalla !== 'misPedidos') return;
    const ids = leerMisPedidosIds();
    if (ids.length === 0) { setMisPedidos([]); return; }
    const unsubs = ids.map((id) => onSnapshot(doc(db, 'pedidosRestaurantes', id), (snap) => {
      if (!snap.exists()) return;
      setMisPedidos((prev) => [...prev.filter((p) => p.id !== snap.id), { id: snap.id, ...snap.data() }]);
    }));
    return () => unsubs.forEach((u) => u());
  }, [pantalla]);

  // Cargar calificaciones del restaurante al entrar a su menú (sin las reportadas)
  useEffect(() => {
    if (pantalla !== 'menu' || !restauranteActivo) return;
    let activo = true;
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'calificaciones'), where('calificadoId', '==', restauranteActivo.id)));
        if (activo) setCalifsRestaurante(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => !c.reportado));
      } catch (e) {}
    })();
    return () => { activo = false; };
  }, [pantalla, restauranteActivo]);

  // Autocompletado de Google en la dirección de entrega (se inicializa una vez)
  useEffect(() => {
    if (pantalla !== 'menu') return;
    const iv = setInterval(() => {
      const el = direccionRef.current;
      if (el && !el._acDone && window.google && window.google.maps && window.google.maps.places) {
        el._acDone = true;
        // Sesgar las sugerencias a La Guajira (Riohacha y alrededores)
        const laGuajira = new window.google.maps.LatLngBounds(
          new window.google.maps.LatLng(10.9, -73.4),
          new window.google.maps.LatLng(12.5, -71.1)
        );
        const ac = new window.google.maps.places.Autocomplete(el, { componentRestrictions: { country: 'co' }, bounds: laGuajira, fields: ['formatted_address'] });
        ac.setBounds(laGuajira);
        ac.addListener('place_changed', () => { const p = ac.getPlace(); if (p.formatted_address) setDireccion(p.formatted_address); });
        clearInterval(iv);
      }
    }, 400);
    return () => clearInterval(iv);
  }, [pantalla]);

  // Llena la dirección con la ubicación actual del cliente (GPS + geocodificación)
  const usarMiUbicacion = () => {
    if (!navigator.geolocation) { setAvisoUbic('Tu dispositivo no permite obtener la ubicación. Escribe la dirección a mano.'); return; }
    setUbicando(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (window.google && window.google.maps) {
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
            if (status === 'OK' && results && results[0]) setDireccion(results[0].formatted_address);
            else setDireccion(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
            setUbicando(false);
          });
        } else {
          setDireccion(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
          setUbicando(false);
        }
      },
      () => { setUbicando(false); setAvisoUbic('No pudimos obtener tu ubicación. Activa el GPS y da permiso, o escribe la dirección a mano.'); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // El filtro anti-datos ya NO vive aquí: está en filtroChat.js, el único
  // sitio para todos los chats (SEGUNDA LEY). Esta era la copia FLOJA: dejaba
  // pasar gmail, correo, celular, tiktok... Ahora bloquea lo mismo que todos.

  // ---------- Carrito ----------
  const nuevaLineaId = () => 'l_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

  // ---------- Promociones (ofertas) ----------
  const promosActivasHoy = () => {
    const proms = (restauranteActivo && restauranteActivo.promociones) || [];
    const dow = new Date().getDay();
    const hoy = new Date().toISOString().slice(0, 10);
    return proms.filter((p) => {
      if (!p.activa) return false;
      if (p.programacion === 'dias') return (p.dias || []).includes(dow);
      if (p.programacion === 'rango') return (!p.fechaInicio || hoy >= p.fechaInicio) && (!p.fechaFin || hoy <= p.fechaFin);
      return true; // siempre
    });
  };
  // Mejor descuento (%, fijo) aplicable a un plato para ESTE cliente (respeta límite por dispositivo)
  const descuentoDePlato = (plato) => {
    let mejor = null;
    for (const p of promosActivasHoy()) {
      if (p.tipo !== 'porcentaje' && p.tipo !== 'fijo') continue;
      const lista = p.platosAplica || [];
      if (lista.length > 0 && !lista.some((x) => x.id === plato.id)) continue;
      if (p.limiteCliente > 0 && (usosPromo[p.id] || 0) >= p.limiteCliente) continue;
      const precioFinal = p.tipo === 'porcentaje' ? Math.round(plato.precio * (1 - (p.valor || 0) / 100)) : Math.max(0, plato.precio - (p.valor || 0));
      if (precioFinal < plato.precio && (!mejor || precioFinal < mejor.precioFinal)) mejor = { promo: p, precioFinal };
    }
    return mejor;
  };
  const DOW_TXT = { 0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb' };
  const vigenciaTxt = (p) => {
    if (p.programacion === 'dias' && (p.dias || []).length) return [...p.dias].sort().map((d) => DOW_TXT[d]).join(', ');
    if (p.programacion === 'rango' && p.fechaInicio) return 'hasta ' + (p.fechaFin || p.fechaInicio);
    return '';
  };

  const agregarLinea = (plato, adicionesSel, cantidad) => {
    const desc = descuentoDePlato(plato);
    const extra = adicionesSel.reduce((s, a) => s + (a.precio || 0), 0);
    const unit = (desc ? desc.precioFinal : plato.precio) + extra;
    const firma = plato.id + '|' + [...adicionesSel.map((a) => a.nombre)].sort().join(',') + (desc ? '|p' + desc.promo.id : '');
    setCarrito((prev) => {
      const idx = prev.findIndex((l) => l.firma === firma);
      if (idx >= 0) return prev.map((l, i) => (i === idx ? { ...l, cantidad: l.cantidad + cantidad } : l));
      return [...prev, { lineaId: nuevaLineaId(), firma, id: plato.id, nombre: plato.nombre, precio: unit, cantidad, adiciones: adicionesSel, ...(desc ? { promoId: desc.promo.id, promoNombre: desc.promo.nombre, precioOriginal: plato.precio + extra } : {}) }];
    });
  };

  const tocarPlato = (plato) => {
    if (!plato.disponible) return;
    if ((plato.adiciones || []).length > 0) { setPlatoConfig(plato); setAdicionesSel([]); setCantidadConfig(1); }
    else agregarLinea(plato, [], 1);
  };

  const toggleAdicion = (a) => setAdicionesSel((prev) => prev.some((x) => x.nombre === a.nombre) ? prev.filter((x) => x.nombre !== a.nombre) : [...prev, a]);

  const agregarConfigurado = () => {
    if (!platoConfig) return;
    agregarLinea(platoConfig, adicionesSel, cantidadConfig);
    setPlatoConfig(null);
  };

  const cambiarCantidad = (lineaId, delta) => {
    setCarrito((prev) =>
      prev
        .map((l) => (l.lineaId === lineaId ? { ...l, cantidad: l.cantidad + delta } : l))
        .filter((l) => l.cantidad > 0)
    );
  };

  const totalCarrito = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const itemsCarrito = carrito.reduce((s, i) => s + i.cantidad, 0);

  // ---------- Enviar pedido ----------
  const enviarPedido = async () => {
    const tel = telefono.replace(/\D/g, '');
    if (carrito.length === 0 || !direccion.trim() || tel.length !== 10 || enviando) return;
    if (!metodoPago) { setAvisoPago('Escoge cómo vas a pagar tu pedido para continuar.'); return; }
    setAvisoPago('');
    setEnviando(true);
    try {
      // Verificar el límite POR TELÉFONO de las promociones usadas (además del dispositivo)
      const promosEnCarrito = [...new Set(carrito.filter((l) => l.promoId).map((l) => l.promoId))];
      const promsRest = (restauranteActivo.promociones) || [];
      const excedidas = [];
      for (const pid of promosEnCarrito) {
        const pc = promsRest.find((x) => x.id === pid);
        if (pc && pc.limiteCliente > 0) {
          try {
            const s = await getDoc(doc(db, 'usosPromo', pid + '__' + tel));
            const usados = s.exists() ? (s.data().veces || 0) : 0;
            if (usados >= pc.limiteCliente) excedidas.push(pc);
          } catch (e) {}
        }
      }
      if (excedidas.length > 0) {
        const ids = excedidas.map((p) => p.id);
        setCarrito((prev) => prev.map((l) => ids.includes(l.promoId) ? { ...l, precio: l.precioOriginal || l.precio, promoId: undefined, promoNombre: undefined, precioOriginal: undefined } : l));
        setAvisoPromo('Con este teléfono ya usaste el máximo de veces: ' + excedidas.map((p) => p.nombre).join(', ') + '. Se quitó ese descuento; revisa el total y vuelve a enviar.');
        setEnviando(false);
        return;
      }

      // Token para avisarle al cliente los cambios de estado (si acepta notificaciones)
      const clienteFcmToken = await obtenerTokenFCM();
      const ref = await addDoc(collection(db, 'pedidosRestaurantes'), {
        restauranteId: restauranteActivo.id,
        // REGLA 9 - LA FIRMA: aqui se apunta QUIEN lo pide. Sin esta firma el
        // servidor no tiene forma de saber de quien es, y hasta el 24-ago-2026
        // por eso los dejaba mirar a CUALQUIERA que tuviera una cuenta.
        clienteId: auth.currentUser ? auth.currentUser.uid : null,
        restauranteNombre: restauranteActivo.nombre,
        cliente: nombre || 'Cliente GuajiraGo',
        telefono: tel,
        direccion: direccion.trim(),
        items: carrito,
        subtotal: totalCarrito,
        costoDomicilio: restauranteActivo.costoDomicilio || 0,
        total: totalCarrito + (restauranteActivo.costoDomicilio || 0),
        metodoPago,
        estado: 'nuevo',
        tipo: 'domicilio',
        clienteFcmToken: clienteFcmToken || null,
        creado: serverTimestamp(),
      });
      setNumeroPedido(ref.id.slice(-5).toUpperCase());
      guardarMiPedidoId(ref.id);
      // Registrar el uso de las promociones (por dispositivo y por teléfono)
      if (promosEnCarrito.length > 0) {
        const nuevosUsos = { ...usosPromo };
        for (const pid of promosEnCarrito) {
          nuevosUsos[pid] = (nuevosUsos[pid] || 0) + 1;
          try { await setDoc(doc(db, 'usosPromo', pid + '__' + tel), { veces: increment(1), telefono: tel, promoId: pid }, { merge: true }); } catch (e) {}
        }
        setUsosPromo(nuevosUsos);
        try { localStorage.setItem('usosPromoGuajira', JSON.stringify(nuevosUsos)); } catch (e) {}
      }
      setCarrito([]);
      setDireccion(''); setTelefono(''); setMetodoPago('');
      setPedidoId(ref.id);
      setPantalla('seguimiento');
    } catch (e) {
      alert('No se pudo enviar el pedido. Revisa tu conexión e intenta de nuevo.');
    }
    setEnviando(false);
  };

  // ---------- Cancelar mi pedido (solo si aún no entró a preparación) ----------
  const puedeCancelar = (estado) => ['nuevo', 'confirmado'].includes(estado);
  const cancelarMiPedido = async () => {
    if (!pedidoActivo || cancelando || !puedeCancelar(pedidoActivo.estado)) return;
    setCancelando(true);
    try {
      await updateDoc(doc(db, 'pedidosRestaurantes', pedidoActivo.id), { estado: 'cancelado', canceladoPor: 'cliente' });
      setMotivoCancelCliente('');
      setPidiendoMotivoCancel(true);
    } catch (e) {}
    setCancelando(false);
  };

  const guardarMotivoCancel = async () => {
    if (pedidoActivo) {
      try { await updateDoc(doc(db, 'pedidosRestaurantes', pedidoActivo.id), { motivoCancelacion: motivoCancelCliente.trim() || 'Sin especificar' }); } catch (e) {}
    }
    setPidiendoMotivoCancel(false);
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

  // ---------- Calificar el pedido/restaurante ----------
  const enviarCalificacion = async () => {
    if (estrellasCal === 0 || enviandoCal || !pedidoActivo) return;
    setEnviandoCal(true);
    try {
      await addDoc(collection(db, 'calificaciones'), {
        pedidoId: pedidoActivo.id,
        restauranteId: pedidoActivo.restauranteId,
        restauranteNombre: pedidoActivo.restauranteNombre || '',
        quienCalifica: 'cliente',
        calificadoId: pedidoActivo.restauranteId,
        estrellas: estrellasCal,
        comentario: comentarioCal.trim(),
        fecha: new Date().toISOString(),
      });
      await updateDoc(doc(db, 'pedidosRestaurantes', pedidoActivo.id), { calificado: true, estrellas: estrellasCal });
      setEstrellasCal(0);
      setComentarioCal('');
    } catch (e) {}
    setEnviandoCal(false);
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
    // El restaurante maneja etapas internas (empacado, cerrado) que el cliente
    // ve resumidas en estos 5 pasos.
    const ESTADO_A_PASO = { nuevo: 0, confirmado: 1, preparando: 2, empacado: 2, en_camino: 3, entregado: 4, cerrado: 4 };
    const indiceActual = ESTADO_A_PASO[pedidoActivo.estado] !== undefined ? ESTADO_A_PASO[pedidoActivo.estado] : -1;
    const mensajes = pedidoActivo.mensajesPedido || [];

    return (
      <div style={{ backgroundColor: '#FFFFFF', minHeight: '100vh', fontFamily: 'Arial, sans-serif', paddingBottom: '160px' }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #FFFFFF, #ECECEF)', padding: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button onClick={() => setPantalla('misPedidos')} style={backBtn}>‹ Volver</button>
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
              <p style={{ color: '#FF4444', fontWeight: '900', fontSize: '15px', margin: '0 0 4px' }}>❌ {(pedidoActivo.canceladoPor === 'restaurante' || (!pedidoActivo.canceladoPor && pedidoActivo.motivoRechazo)) ? 'Cancelado por el restaurante' : 'Cancelado por ti'}</p>
              {(pedidoActivo.motivoRechazo || pedidoActivo.motivoCancelacion) && (
                <p style={{ color: '#6B7280', fontSize: '13px', margin: 0 }}>Motivo: {pedidoActivo.motivoRechazo || pedidoActivo.motivoCancelacion}</p>
              )}
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
              {pedidoActivo.tiempoEstimado && !['entregado', 'cerrado', 'cancelado'].includes(pedidoActivo.estado) && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #ECECEF', textAlign: 'center' }}>
                  <p style={{ color: '#FF7A2F', fontSize: '14px', fontWeight: '900', margin: '0' }}>
                    ⏱️ Listo en ~{pedidoActivo.tiempoEstimado} min
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Cancelar (solo si aún no entró a preparación) */}
          {puedeCancelar(pedidoActivo.estado) && (
            <button onClick={cancelarMiPedido} disabled={cancelando} style={{ width: '100%', padding: '14px', background: '#FFFFFF', border: '1.5px solid #FF4444', borderRadius: '14px', color: '#FF4444', fontSize: '14px', fontWeight: '900', cursor: 'pointer', marginBottom: '20px' }}>
              {cancelando ? 'Cancelando…' : '✕ Cancelar pedido'}
            </button>
          )}

          {/* Resumen del pedido */}
          <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '16px', marginBottom: '20px', border: '1px solid #ECECEF' }}>
            <p style={{ color: '#6B7280', fontSize: '11px', letterSpacing: '2px', margin: '0 0 10px' }}>TU PEDIDO</p>
            {(pedidoActivo.items || []).map((i, idx) => (
              <div key={idx} style={{ marginBottom: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <p style={{ color: '#1A1A1E', fontSize: '13px', margin: '0' }}>{i.cantidad}x {i.nombre}</p>
                  <p style={{ color: '#1A1A1E', fontSize: '13px', margin: '0' }}>{cop(i.precio * i.cantidad)}</p>
                </div>
                {(i.adiciones || []).length > 0 && <p style={{ color: '#FF7A2F', fontSize: '11px', margin: '1px 0 0' }}>+ {i.adiciones.map((a) => a.nombre).join(', ')}</p>}
              </div>
            ))}
            {pedidoActivo.costoDomicilio > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <p style={{ color: '#6B7280', fontSize: '13px', margin: '0' }}>🛵 Domicilio</p>
                <p style={{ color: '#1A1A1E', fontSize: '13px', margin: '0' }}>{cop(pedidoActivo.costoDomicilio)}</p>
              </div>
            )}
            <div style={{ borderTop: '1px solid #ECECEF', marginTop: '10px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between' }}>
              <p style={{ color: '#1A1A1E', fontWeight: '900', fontSize: '14px', margin: '0' }}>Total</p>
              <p style={{ color: '#FF7A2F', fontWeight: '900', fontSize: '14px', margin: '0' }}>{cop(pedidoActivo.total)}</p>
            </div>
          </div>

          {/* Calificar el pedido (cuando ya fue entregado) */}
          {['entregado', 'cerrado'].includes(pedidoActivo.estado) && (
            <div style={{ background: 'linear-gradient(135deg, #FFFFFF, #ECECEF)', borderRadius: '16px', padding: '18px', marginBottom: '20px', border: '1px solid #ECECEF', textAlign: 'center' }}>
              {pedidoActivo.calificado ? (
                <p style={{ color: '#2ECC71', fontWeight: '900', fontSize: '14px', margin: 0 }}>⭐ ¡Gracias por calificar!</p>
              ) : (
                <>
                  <p style={{ color: '#1A1A1E', fontWeight: '900', fontSize: '15px', margin: '0 0 2px' }}>¿Cómo estuvo tu pedido?</p>
                  <p style={{ color: '#6B7280', fontSize: '12px', margin: '0 0 12px' }}>Califica a {pedidoActivo.restauranteNombre || 'el restaurante'}</p>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '12px' }}>
                    {[1, 2, 3, 4, 5].map(s => (
                      <span key={s} onClick={() => setEstrellasCal(s)} style={{ fontSize: '36px', cursor: 'pointer', opacity: s <= estrellasCal ? 1 : 0.3 }}>⭐</span>
                    ))}
                  </div>
                  <input value={comentarioCal} onChange={e => setComentarioCal(e.target.value)} placeholder="Comentario (opcional)" style={{ width: '100%', boxSizing: 'border-box', padding: '12px', border: '1px solid #ECECEF', borderRadius: '12px', fontSize: '14px', outline: 'none', marginBottom: '12px' }} />
                  <button onClick={enviarCalificacion} disabled={estrellasCal === 0 || enviandoCal} style={{ width: '100%', padding: '14px', background: estrellasCal > 0 ? 'linear-gradient(135deg, #FFCF4D, #FF7A2F)' : '#E7E7EA', border: 'none', borderRadius: '12px', color: estrellasCal > 0 ? '#FFF' : '#9AA0A6', fontSize: '15px', fontWeight: '900', cursor: estrellasCal > 0 ? 'pointer' : 'default' }}>{enviandoCal ? 'Enviando...' : 'Enviar calificación'}</button>
                </>
              )}
            </div>
          )}

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

        {/* Modal: motivo de cancelación del cliente (después de cancelar) */}
        {pidiendoMotivoCancel && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: '#FFFFFF', borderRadius: '20px', padding: '24px', width: '100%', maxWidth: '360px', textAlign: 'center' }}>
              <span style={{ fontSize: '40px' }}>🙁</span>
              <h3 style={{ color: '#1A1A1E', margin: '8px 0 4px' }}>Pedido cancelado</h3>
              <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 16px' }}>¿Nos cuentas por qué cancelaste?</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '12px' }}>
                {['Ya no lo necesito', 'Me equivoqué', 'Se demora mucho', 'Pedí de más', 'Encontré otra opción'].map((m) => (
                  <span key={m} onClick={() => setMotivoCancelCliente(m)} style={{ padding: '8px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', background: motivoCancelCliente === m ? 'linear-gradient(135deg, #FFCF4D, #FF7A2F)' : '#F4F6F8', color: motivoCancelCliente === m ? '#FFF' : '#1A1A1E', border: '1px solid #ECECEF' }}>{m}</span>
                ))}
              </div>
              <input value={motivoCancelCliente} onChange={(e) => setMotivoCancelCliente(e.target.value)} placeholder="Otro motivo… (escríbelo)" style={{ width: '100%', boxSizing: 'border-box', padding: '12px', border: '1px solid #ECECEF', borderRadius: '12px', fontSize: '14px', outline: 'none', marginBottom: '16px' }} />
              <button onClick={guardarMotivoCancel} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', border: 'none', borderRadius: '12px', color: '#FFF', fontSize: '15px', fontWeight: '900', cursor: 'pointer' }}>Enviar</button>
              <p onClick={() => setPidiendoMotivoCancel(false)} style={{ color: '#999', fontSize: '13px', cursor: 'pointer', margin: '12px 0 0' }}>Omitir</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // PANTALLA: menú del restaurante + carrito
  // ============================================================
  if (pantalla === 'menu' && restauranteActivo) {
    const costoDom = restauranteActivo.costoDomicilio || 0;
    const minimoPedido = restauranteActivo.pedidoMinimo || 0;
    const totalConDom = totalCarrito + costoDom;
    const bajoMinimo = carrito.length > 0 && totalCarrito < minimoPedido;
    const telValido = telefono.replace(/\D/g, '').length === 10;
    const totalCalif = califsRestaurante.length;
    const promedioCalif = totalCalif ? (califsRestaurante.reduce((s, c) => s + (c.estrellas || 0), 0) / totalCalif) : 0;
    const abiertoAhora = restauranteAbiertoAhora(restauranteActivo);
    return (
      <div style={{ backgroundColor: '#FFFFFF', minHeight: '100vh', fontFamily: 'Arial, sans-serif', paddingBottom: carrito.length > 0 ? '210px' : '20px' }}>

        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #FFFFFF, #ECECEF)',
          padding: '20px',
          display: 'flex', alignItems: 'center', gap: '14px',
        }}>
          <button onClick={() => { setPantalla('lista'); setRestauranteActivo(null); setCarrito([]); }} style={backBtn}>‹ Volver</button>
          {restauranteActivo.logo ? (
            <img src={restauranteActivo.logo} alt="" style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <span style={{ fontSize: '40px' }}>{restauranteActivo.emoji || '🍽️'}</span>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: '#1A1A1E', fontWeight: '900', fontSize: '18px', margin: '0' }}>
              {restauranteActivo.nombre}
            </p>
            <p style={{ color: abiertoAhora ? '#2ECC71' : '#FF4444', fontSize: '12px', margin: '2px 0 0', fontWeight: 'bold' }}>
              {abiertoAhora ? 'Abierto ahora' : 'Cerrado'}
            </p>
            {abiertoAhora && restauranteActivo.demoraMin > 0 && (
              <p style={{ color: '#FF7A2F', fontSize: '12px', margin: '2px 0 0', fontWeight: 'bold' }}>⏱ Con demora · ~{restauranteActivo.demoraMin} min extra</p>
            )}
          </div>
        </div>

        {/* Barra de calificación (siempre visible) */}
        <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #ECECEF' }}>
          {totalCalif > 0 ? (
            <span style={{ color: '#FF7A2F', fontSize: '15px', fontWeight: '900' }}>⭐ {promedioCalif.toFixed(1)} <span style={{ color: '#6B7280', fontWeight: 'normal', fontSize: '12px' }}>({totalCalif})</span></span>
          ) : (
            <span style={{ color: '#6B7280', fontSize: '13px', fontWeight: 'bold' }}>⭐ Aún sin calificaciones</span>
          )}
          <button onClick={() => setVerComentarios(true)} style={{ background: '#EAF2FF', border: '1px solid #1C8EF9', borderRadius: '10px', padding: '7px 14px', color: '#1C8EF9', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>Ver comentarios</button>
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
                .map((plato) => {
                  const desc = plato.disponible ? descuentoDePlato(plato) : null;
                  return (
                  <div
                    key={plato.id}
                    onClick={() => tocarPlato(plato)}
                    style={{
                      background: 'linear-gradient(135deg, #FFFFFF, #ECECEF)',
                      borderRadius: '16px', padding: '16px', marginBottom: '10px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      border: desc ? '1.5px solid #FF7A2F' : '1px solid #ECECEF',
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
                      {desc ? (
                        <p style={{ margin: '4px 0 0' }}>
                          <span style={{ color: '#9AA0A6', fontSize: '13px', textDecoration: 'line-through', marginRight: '6px' }}>{cop(plato.precio)}</span>
                          <span style={{ color: '#E33', fontSize: '15px', fontWeight: '900' }}>{cop(desc.precioFinal)}</span>
                        </p>
                      ) : (
                        <p style={{ color: '#FF7A2F', fontSize: '14px', fontWeight: '900', margin: '4px 0 0' }}>
                          {cop(plato.precio)}
                        </p>
                      )}
                      {desc && (
                        <p style={{ color: '#FF7A2F', fontSize: '11px', fontWeight: 'bold', margin: '3px 0 0' }}>
                          🏷️ {desc.promo.nombre}{vigenciaTxt(desc.promo) ? ' · ' + vigenciaTxt(desc.promo) : ''}{desc.promo.limiteCliente > 0 ? ` · te quedan ${Math.max(0, desc.promo.limiteCliente - (usosPromo[desc.promo.id] || 0))}` : ''}
                        </p>
                      )}
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
                  );
                })}
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
                <div key={i.lineaId || i.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0, marginRight: '8px' }}>
                    <p style={{ color: '#1A1A1E', fontSize: '13px', margin: '0' }}>{i.nombre}</p>
                    {(i.adiciones || []).length > 0 && (
                      <p style={{ color: '#FF7A2F', fontSize: '11px', margin: '1px 0 0' }}>+ {i.adiciones.map((a) => a.nombre).join(', ')}</p>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button onClick={() => cambiarCantidad(i.lineaId, -1)} style={{
                      background: '#ECECEF', border: 'none', borderRadius: '8px',
                      width: '28px', height: '28px', color: '#1A1A1E',
                      fontWeight: '900', cursor: 'pointer',
                    }}>−</button>
                    <span style={{ color: '#1A1A1E', fontWeight: '900', fontSize: '14px', minWidth: '16px', textAlign: 'center' }}>
                      {i.cantidad}
                    </span>
                    <button onClick={() => cambiarCantidad(i.lineaId, 1)} style={{
                      background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)',
                      border: 'none', borderRadius: '8px',
                      width: '28px', height: '28px', color: '#FFFFFF',
                      fontWeight: '900', cursor: 'pointer',
                    }}>+</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Resumen de cobro */}
            <div style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#6B7280', fontSize: '13px' }}>Subtotal</span>
                <span style={{ color: '#1A1A1E', fontSize: '13px' }}>{cop(totalCarrito)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#6B7280', fontSize: '13px' }}>🛵 Domicilio</span>
                <span style={{ color: '#1A1A1E', fontSize: '13px' }}>{costoDom > 0 ? cop(costoDom) : 'Gratis'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #ECECEF', paddingTop: '6px' }}>
                <span style={{ color: '#1A1A1E', fontWeight: '900', fontSize: '14px' }}>Total</span>
                <span style={{ color: '#FF7A2F', fontWeight: '900', fontSize: '15px' }}>{cop(totalConDom)}</span>
              </div>
              {bajoMinimo && (
                <p style={{ color: '#FF4444', fontSize: '12px', fontWeight: 'bold', margin: '8px 0 0', textAlign: 'center' }}>El pedido mínimo es {cop(minimoPedido)}. Te faltan {cop(minimoPedido - totalCarrito)}.</p>
              )}
            </div>

            <input
              ref={direccionRef}
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
            <button
              onClick={usarMiUbicacion}
              disabled={ubicando}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '11px',
                background: ubicando ? '#CCCCCC' : 'linear-gradient(135deg, #2ECC71, #27AE60)',
                border: 'none', borderRadius: '12px', color: '#FFFFFF',
                fontSize: '14px', fontWeight: '900', cursor: ubicando ? 'default' : 'pointer',
                marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}
            >{ubicando ? '⏳ Buscando tu ubicación...' : '📍 Usar mi ubicación'}</button>
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="📞 Tu teléfono (obligatorio · 10 dígitos)"
              type="tel"
              inputMode="numeric"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '13px',
                background: '#FFFFFF', border: `1px solid ${telValido || telefono.length === 0 ? '#ECECEF' : '#FF4444'}`,
                borderRadius: '12px', color: '#1A1A1E', fontSize: '14px',
                marginBottom: '12px', outline: 'none',
              }}
            />

            {/* Método de pago (obligatorio, sin uno por defecto) */}
            <p style={{ color: '#6B7280', fontSize: '11px', letterSpacing: '2px', margin: '0 0 8px' }}>MÉTODO DE PAGO</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {METODOS_PAGO.map((m) => (
                <span key={m} onClick={() => { setMetodoPago(m); setAvisoPago(''); }} style={{ padding: '8px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', background: metodoPago === m ? 'linear-gradient(135deg, #FFCF4D, #FF7A2F)' : '#F4F6F8', color: metodoPago === m ? '#FFFFFF' : '#1A1A1E', border: '1px solid #ECECEF' }}>{m}</span>
              ))}
            </div>

            <button
              onClick={enviarPedido}
              disabled={!direccion.trim() || !telValido || enviando || bajoMinimo}
              style={{
                width: '100%', padding: '16px',
                background: (!direccion.trim() || !telValido || enviando || bajoMinimo)
                  ? '#E7E7EA'
                  : 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)',
                border: 'none', borderRadius: '14px',
                color: (!direccion.trim() || !telValido || enviando || bajoMinimo) ? '#9AA0A6' : '#FFFFFF',
                fontSize: '16px', fontWeight: '900',
                cursor: (!direccion.trim() || !telValido || enviando || bajoMinimo) ? 'default' : 'pointer',
              }}
            >
              {bajoMinimo
                ? `Pedido mínimo ${cop(minimoPedido)}`
                : !direccion.trim()
                  ? 'Escribe la dirección'
                  : !telValido
                    ? 'Teléfono de 10 dígitos'
                    : enviando
                      ? 'Enviando…'
                      : `Pedir ${itemsCarrito} item${itemsCarrito > 1 ? 's' : ''} · ${cop(totalConDom)}`}
            </button>
          </div>
        )}

        {/* Ventanita: falta método de pago */}
        {avisoPago && (
          <div onClick={() => setAvisoPago('')} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: '#FFFFFF', borderRadius: '20px', padding: '28px 24px', width: '100%', maxWidth: '340px', textAlign: 'center' }}>
              <div style={{ fontSize: '46px', marginBottom: '8px' }}>💳</div>
              <p style={{ color: '#1A1A1E', fontSize: '17px', fontWeight: '900', margin: '0 0 8px' }}>Falta el método de pago</p>
              <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 20px' }}>{avisoPago}</p>
              <button onClick={() => setAvisoPago('')} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', border: 'none', borderRadius: '12px', color: '#FFF', fontSize: '15px', fontWeight: '900', cursor: 'pointer' }}>Entendido</button>
            </div>
          </div>
        )}

        {/* Ventanita: promoción con límite alcanzado */}
        {avisoPromo && (
          <div onClick={() => setAvisoPromo('')} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: '#FFFFFF', borderRadius: '20px', padding: '28px 24px', width: '100%', maxWidth: '340px', textAlign: 'center' }}>
              <div style={{ fontSize: '46px', marginBottom: '8px' }}>🏷️</div>
              <p style={{ color: '#1A1A1E', fontSize: '17px', fontWeight: '900', margin: '0 0 8px' }}>Promoción sin cupos</p>
              <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 20px' }}>{avisoPromo}</p>
              <button onClick={() => setAvisoPromo('')} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', border: 'none', borderRadius: '12px', color: '#FFF', fontSize: '15px', fontWeight: '900', cursor: 'pointer' }}>Entendido</button>
            </div>
          </div>
        )}

        {/* Ventanita: no se pudo obtener la ubicación */}
        {avisoUbic && (
          <div onClick={() => setAvisoUbic('')} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: '#FFFFFF', borderRadius: '20px', padding: '28px 24px', width: '100%', maxWidth: '340px', textAlign: 'center' }}>
              <div style={{ fontSize: '46px', marginBottom: '8px' }}>📍</div>
              <p style={{ color: '#1A1A1E', fontSize: '17px', fontWeight: '900', margin: '0 0 8px' }}>Ubicación no disponible</p>
              <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 20px' }}>{avisoUbic}</p>
              <button onClick={() => setAvisoUbic('')} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', border: 'none', borderRadius: '12px', color: '#FFF', fontSize: '15px', fontWeight: '900', cursor: 'pointer' }}>Entendido</button>
            </div>
          </div>
        )}

        {/* Modal: configurar plato con adiciones */}
        {platoConfig && (
          <div onClick={() => setPlatoConfig(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: '#FFFFFF', borderRadius: '24px 24px 0 0', padding: '20px', width: '100%', maxWidth: '460px', maxHeight: '85vh', overflowY: 'auto' }}>
              <p style={{ color: '#1A1A1E', fontWeight: '900', fontSize: '18px', margin: '0 0 2px' }}>{platoConfig.nombre}</p>
              <p style={{ color: '#FF7A2F', fontWeight: '900', fontSize: '15px', margin: '0 0 14px' }}>{cop(platoConfig.precio)}</p>
              <p style={{ color: '#6B7280', fontSize: '11px', letterSpacing: '2px', margin: '0 0 8px' }}>ADICIONES</p>
              {(platoConfig.adiciones || []).map((a, idx) => {
                const sel = adicionesSel.some((x) => x.nombre === a.nombre);
                return (
                  <div key={idx} onClick={() => toggleAdicion(a)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '12px', cursor: 'pointer', background: sel ? '#FFF7E6' : '#F4F6F8', border: sel ? '2px solid #FF7A2F' : '1px solid #ECECEF', marginBottom: '8px' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: sel ? '#FF7A2F' : '#FFFFFF', border: sel ? 'none' : '2px solid #CCC', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontWeight: 'bold', flexShrink: 0 }}>{sel ? '✓' : ''}</div>
                    <span style={{ flex: 1, color: '#1A1A1E', fontSize: '14px', fontWeight: 'bold' }}>{a.nombre}</span>
                    <span style={{ color: '#FF7A2F', fontSize: '13px', fontWeight: '900' }}>{a.precio > 0 ? '+' + cop(a.precio) : 'Gratis'}</span>
                  </div>
                );
              })}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '14px 0' }}>
                <button onClick={() => setCantidadConfig((c) => Math.max(1, c - 1))} style={{ width: '40px', height: '40px', borderRadius: '12px', border: '1px solid #ECECEF', background: '#F4F6F8', fontSize: '22px', fontWeight: '900', cursor: 'pointer' }}>−</button>
                <span style={{ fontSize: '20px', fontWeight: '900', minWidth: '24px', textAlign: 'center' }}>{cantidadConfig}</span>
                <button onClick={() => setCantidadConfig((c) => c + 1)} style={{ width: '40px', height: '40px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', color: '#FFF', fontSize: '22px', fontWeight: '900', cursor: 'pointer' }}>+</button>
              </div>
              <button onClick={agregarConfigurado} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '14px', color: '#FFF', fontSize: '16px', fontWeight: '900', cursor: 'pointer' }}>
                Agregar {cop((platoConfig.precio + adicionesSel.reduce((s, a) => s + (a.precio || 0), 0)) * cantidadConfig)}
              </button>
            </div>
          </div>
        )}

        {/* Modal: comentarios del restaurante */}
        {verComentarios && (
          <div onClick={() => setVerComentarios(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: '#FFFFFF', borderRadius: '24px 24px 0 0', padding: '20px', width: '100%', maxWidth: '460px', maxHeight: '80vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <p style={{ color: '#1A1A1E', fontWeight: '900', fontSize: '16px', margin: 0 }}>⭐ {promedioCalif.toFixed(1)} · {totalCalif} calificación{totalCalif !== 1 ? 'es' : ''}</p>
                <span onClick={() => setVerComentarios(false)} style={{ color: '#AAA', cursor: 'pointer', fontWeight: 'bold', fontSize: '18px' }}>✕</span>
              </div>
              {califsRestaurante.filter((c) => c.comentario).length === 0 ? (
                <p style={{ color: '#6B7280', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>Aún no hay comentarios escritos.</p>
              ) : (
                [...califsRestaurante].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).filter((c) => c.comentario).map((c) => (
                  <div key={c.id} style={{ background: '#F9FAFB', border: '1px solid #ECECEF', borderRadius: '12px', padding: '12px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px' }}>{'⭐'.repeat(c.estrellas || 0)}</span>
                      <span style={{ color: '#AAA', fontSize: '11px' }}>{c.fecha ? new Date(c.fecha).toLocaleDateString('es-CO') : ''}</span>
                    </div>
                    <p style={{ color: '#444', fontSize: '13px', margin: 0 }}>“{c.comentario}”</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // PANTALLA: mis pedidos (los que este dispositivo ha hecho)
  // ============================================================
  if (pantalla === 'misPedidos') {
    const lista = [...misPedidos].sort((a, b) => {
      const ta = a.creado && a.creado.seconds ? a.creado.seconds : 0;
      const tb = b.creado && b.creado.seconds ? b.creado.seconds : 0;
      return tb - ta;
    });
    return (
      <div style={{ backgroundColor: '#FFFFFF', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ background: 'linear-gradient(135deg, #FFFFFF, #ECECEF)', padding: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button onClick={() => setPantalla('lista')} style={backBtn}>‹ Volver</button>
          <div>
            <p style={{ color: '#1A1A1E', fontWeight: '900', fontSize: '20px', margin: '0' }}>📦 Mis pedidos</p>
            <p style={{ color: '#6B7280', fontSize: '13px', margin: '2px 0 0' }}>Toca un pedido para ver su estado</p>
          </div>
        </div>

        <div style={{ padding: '20px' }}>
          {lista.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🧾</div>
              <p style={{ color: '#6B7280', fontSize: '15px', margin: '0' }}>Aún no has hecho pedidos.</p>
            </div>
          ) : (
            lista.map((p) => {
              const porRest = p.canceladoPor === 'restaurante' || (!p.canceladoPor && p.motivoRechazo);
              const est = p.estado === 'cancelado'
                ? (porRest ? 'Cancelado por el restaurante' : 'Cancelado por mí')
                : (ESTADO_LABEL_CLIENTE[p.estado] || p.estado);
              const cancelado = p.estado === 'cancelado';
              return (
                <div
                  key={p.id}
                  onClick={() => { setPedidoId(p.id); setNumeroPedido((p.id || '').slice(-5).toUpperCase()); setPantalla('seguimiento'); }}
                  style={{ background: 'linear-gradient(135deg, #FFFFFF, #ECECEF)', borderRadius: '16px', padding: '16px', marginBottom: '12px', border: '1px solid #ECECEF', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <p style={{ color: '#1A1A1E', fontWeight: '900', fontSize: '15px', margin: '0' }}>{p.restauranteNombre || 'Restaurante'}</p>
                    <span style={{ background: cancelado ? '#FF4444' : 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', color: '#FFFFFF', fontSize: '12px', fontWeight: '900', borderRadius: '20px', padding: '4px 12px', whiteSpace: 'nowrap' }}>{est}</span>
                  </div>
                  <p style={{ color: '#6B7280', fontSize: '12px', margin: '0' }}>Pedido #{(p.id || '').slice(-5).toUpperCase()} · {cop(p.total || 0)}</p>
                  {p.tiempoEstimado && !['entregado', 'cerrado', 'cancelado'].includes(p.estado) && (
                    <p style={{ color: '#FF7A2F', fontSize: '12px', fontWeight: 'bold', margin: '4px 0 0' }}>⏱️ Listo en ~{p.tiempoEstimado} min</p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  // PANTALLA: lista de restaurantes
  // ============================================================
  const texto = busqueda.trim().toLowerCase();
  const categoriasDisponibles = [...new Set(restaurantes.map((r) => r.categoria).filter(Boolean))].sort();
  const restaurantesFiltrados = restaurantes.filter((r) => {
    if (texto && !(r.nombre || '').toLowerCase().includes(texto)) return false;
    if (filtroCategoria && r.categoria !== filtroCategoria) return false;
    return true;
  });
  return (
    <div style={{ backgroundColor: '#FFFFFF', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #FFFFFF, #ECECEF)',
        padding: '20px',
        display: 'flex', alignItems: 'center', gap: '14px',
        position: 'relative',
      }}>
        <MenuLateral nombre={nombre} foto={foto} onIrPerfil={onIrPerfil} onIrCreditos={onIrCreditos} onIrViajes={onIrViajes} onIrGanancias={onIrGanancias} onIrSeguridad={onIrSeguridad} onIrAyuda={onIrAyuda} onIrConfig={onIrConfig} onIrPromociones={onIrPromociones} onCerrarSesion={onCerrarSesion} />
        <Logo size={28} style={{ position: 'absolute', top: '14px', right: '16px', zIndex: 6 }} />
        <button onClick={onVolver} style={{ ...backBtn, marginLeft: '96px' }}>‹ Volver</button>
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
        <button onClick={() => setPantalla('misPedidos')} style={{ width: '100%', padding: '14px', background: '#EAF2FF', border: '1px solid #1C8EF9', borderRadius: '14px', color: '#1C8EF9', fontSize: '15px', fontWeight: '900', cursor: 'pointer', marginBottom: '14px' }}>
          📦 Mis pedidos
        </button>

        {/* Buscar por nombre + filtrar por categoría */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', background: '#F4F6F8', border: '1px solid #ECECEF', borderRadius: '12px', padding: '10px 12px' }}>
            <span>🔍</span>
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar…" style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', color: '#1A1A1E', fontSize: '14px' }} />
            {busqueda && <span onClick={() => setBusqueda('')} style={{ color: '#AAA', cursor: 'pointer', fontWeight: 'bold' }}>✕</span>}
          </div>
          <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} style={{ flexShrink: 0, maxWidth: '42%', background: '#F4F6F8', border: '1px solid #ECECEF', borderRadius: '12px', padding: '10px', color: filtroCategoria ? '#1A1A1E' : '#6B7280', fontSize: '13px', outline: 'none', cursor: 'pointer' }}>
            <option value="">Categoría</option>
            {categoriasDisponibles.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

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

        {restaurantesFiltrados.map((r) => {
          const ab = restauranteAbiertoAhora(r);
          return (
            <div
              key={r.id}
              onClick={() => { if (!ab) return; setRestauranteActivo(r); setCarrito([]); setDireccion(''); setTelefono(''); setMetodoPago(''); setVerComentarios(false); setPantalla('menu'); }}
              style={{
                background: 'linear-gradient(135deg, #FFFFFF, #ECECEF)',
                borderRadius: '20px', padding: '16px', marginBottom: '12px',
                display: 'flex', alignItems: 'center', gap: '14px',
                border: '1px solid #ECECEF',
                cursor: ab ? 'pointer' : 'default',
                opacity: ab ? 1 : 0.55,
              }}
            >
              {r.logo ? (
                <img src={r.logo} alt="" style={{ width: '56px', height: '56px', borderRadius: '14px', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <span style={{ fontSize: '36px' }}>{r.emoji || '🍽️'}</span>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <p style={{ color: '#1A1A1E', fontWeight: '900', fontSize: '16px', margin: '0' }}>{r.nombre}</p>
                  {mapaCalif[r.id] && mapaCalif[r.id].count > 0 ? (
                    <span style={{ color: '#FF7A2F', fontSize: '13px', fontWeight: '900', flexShrink: 0 }}>⭐ {(mapaCalif[r.id].suma / mapaCalif[r.id].count).toFixed(1)} <span style={{ color: '#9AA0A6', fontWeight: 'normal' }}>({mapaCalif[r.id].count})</span></span>
                  ) : (
                    <span style={{ color: '#8A97B8', fontSize: '12px', fontWeight: 'bold', background: '#F0F1F4', borderRadius: '8px', padding: '2px 7px', flexShrink: 0 }}>🆕 Nuevo</span>
                  )}
                </div>
                <p style={{ color: '#6B7280', fontSize: '12px', margin: '3px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.descripcion || r.categoria || ''}</p>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 10px', margin: '4px 0 0' }}>
                  <span style={{ color: ab ? '#2ECC71' : '#FF4444', fontSize: '12px', fontWeight: 'bold' }}>{ab ? 'Abierto ahora' : 'Cerrado ahora'}</span>
                  {r.tiempoEntrega > 0 && <span style={{ color: '#5B6B99', fontSize: '12px', fontWeight: 'bold' }}>⏱ ~{r.tiempoEntrega}{ab && r.demoraMin > 0 ? '+' + r.demoraMin : ''} min</span>}
                  {(!r.tiempoEntrega && ab && r.demoraMin > 0) && <span style={{ color: '#FF7A2F', fontSize: '12px', fontWeight: 'bold' }}>⏱ +{r.demoraMin}m demora</span>}
                </div>
              </div>
            </div>
          );
        })}
        {!cargando && restaurantes.length > 0 && restaurantesFiltrados.length === 0 && (
          <p style={{ color: '#6B7280', textAlign: 'center', padding: '30px 0', fontSize: '14px' }}>No hay restaurantes que coincidan con tu búsqueda.</p>
        )}
      </div>
    </div>
  );
}

export default Restaurantes;