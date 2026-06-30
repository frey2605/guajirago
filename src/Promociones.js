import React, { useState, useEffect, useCallback } from 'react';
import { db, auth } from './firebase';
import { collection, getDocs, doc, getDoc, runTransaction } from 'firebase/firestore';

const CATEGORIAS = [
  { id: 'transporte', label: 'Transporte', icono: '🚗' },
  { id: 'domicilios', label: 'Domicilios', icono: '🛵' },
  { id: 'restaurantes', label: 'Restaurantes', icono: '🍽️' },
  { id: 'turismo', label: 'Turismo', icono: '🌴' },
  { id: 'general', label: 'General', icono: '🎉' },
];

function Promociones({ onVolver }) {
  const [promos, setPromos] = useState([]);
  const [tipoUsuario, setTipoUsuario] = useState('');
  const [cargando, setCargando] = useState(true);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [aplicando, setAplicando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const user = auth.currentUser;
      let tipo = '';
      if (user) {
        const snapU = await getDoc(doc(db, 'usuarios', user.uid));
        if (snapU.exists()) tipo = snapU.data().tipo || '';
      }
      setTipoUsuario(tipo);

      const snap = await getDocs(collection(db, 'promociones'));
      const ahora = new Date();
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => {
        if (!p.activa) return false;
        if (new Date(p.fechaInicio) > ahora || new Date(p.fechaFin) < ahora) return false;
        if (p.aplicaA === 'pasajeros' && tipo === 'conductor') return false;
        if (p.aplicaA === 'conductores' && tipo !== 'conductor') return false;
        return true;
      });
      lista.sort((a, b) => (b.fechaCreacion || '').localeCompare(a.fechaCreacion || ''));
      setPromos(lista);
    } catch (e) { console.error(e); }
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const categoriaInfo = (id) => CATEGORIAS.find(c => c.id === id) || { label: id, icono: '🎁' };

  const aplicarCodigo = async () => {
    setError(''); setMensaje('');
    const cod = codigo.trim().toUpperCase();
    if (!cod) { setError('Escribe un código de promoción'); return; }
    const user = auth.currentUser;
    if (!user) { setError('Error de sesión. Vuelve a iniciar sesión'); return; }

    setAplicando(true);
    try {
      const refPromo = doc(db, 'promociones', cod);
      const refUso = doc(db, 'promociones', cod, 'usos', user.uid);
      const refUsuario = doc(db, 'usuarios', user.uid);

      const resultado = await runTransaction(db, async (transaccion) => {
        const snapPromo = await transaccion.get(refPromo);
        if (!snapPromo.exists()) throw new Error('NO_EXISTE');
        const datosPromo = snapPromo.data();
        const ahora = new Date();
        if (!datosPromo.activa) throw new Error('NO_ACTIVA');
        if (new Date(datosPromo.fechaInicio) > ahora || new Date(datosPromo.fechaFin) < ahora) throw new Error('FUERA_VIGENCIA');
        if (datosPromo.aplicaA === 'pasajeros' && tipoUsuario === 'conductor') throw new Error('NO_APLICA');
        if (datosPromo.aplicaA === 'conductores' && tipoUsuario !== 'conductor') throw new Error('NO_APLICA');

        const snapUso = await transaccion.get(refUso);
        const usosPrevios = snapUso.exists() ? (snapUso.data().veces || 0) : 0;
        if (datosPromo.limiteUsosPorPersona && usosPrevios >= datosPromo.limiteUsosPorPersona) {
          throw new Error('LIMITE_ALCANZADO');
        }

        const snapUsuario = await transaccion.get(refUsuario);
        if (snapUsuario.exists() && snapUsuario.data().descuentoPendiente) {
          throw new Error('YA_TIENE_PENDIENTE');
        }

        // Guardar el descuento como pendiente, NO se aplica todavía
        transaccion.set(refUsuario, {
          descuentoPendiente: {
            promoId: cod,
            tipoBeneficio: datosPromo.tipoBeneficio, // 'credito' (monto fijo $) o 'descuento' (%)
            valorBeneficio: datosPromo.valorBeneficio || 0,
            fechaActivacion: new Date().toISOString(),
          },
        }, { merge: true });

        return { tipo: datosPromo.tipoBeneficio, valor: datosPromo.valorBeneficio || 0 };
      });

      if (resultado.tipo === 'credito') {
        setMensaje(`¡Código activado! Tendrás $${resultado.valor.toLocaleString()} de descuento en tu próximo servicio 🎉`);
      } else {
        setMensaje(`¡Código activado! Tendrás ${resultado.valor}% de descuento en tu próximo servicio 🎉`);
      }
      setCodigo('');
    } catch (e) {
      if (e.message === 'NO_EXISTE') setError('Ese código no existe. Verifícalo');
      else if (e.message === 'NO_ACTIVA' || e.message === 'FUERA_VIGENCIA') setError('Esta promoción ya no está disponible');
      else if (e.message === 'NO_APLICA') setError('Esta promoción no aplica para tu tipo de cuenta');
      else if (e.message === 'LIMITE_ALCANZADO') setError('Ya usaste esta promoción el máximo de veces permitido');
      else if (e.message === 'YA_TIENE_PENDIENTE') setError('Ya tienes un descuento pendiente de usar. Úsalo primero en tu próximo servicio');
      else setError('Error al aplicar el código. Intenta de nuevo');
    }
    setAplicando(false);
  };

  return (
    <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)', padding: '24px 20px', display: 'flex', alignItems: 'center' }}>
        <div onClick={onVolver} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.12)', borderRadius: '12px', color: '#FFFFFF', fontSize: '14px', fontWeight: '500', padding: '8px 16px', cursor: 'pointer' }}>
          <span style={{ fontSize: '20px', fontWeight: '900', lineHeight: '1', position: 'relative', top: '-1px' }}>‹</span> Volver
        </div>
        <h2 style={{ color: '#FFFFFF', margin: '0 auto', fontSize: '20px', fontWeight: '900' }}>Promociones</h2>
      </div>

      <div style={{ padding: '20px' }}>
        {/* Tengo un código */}
        <div style={{ background: '#1A1A1E', borderRadius: '16px', padding: '16px', marginBottom: '20px', border: '1px solid #2A2A2E' }}>
          <p style={{ color: '#FFCF4D', fontSize: '12px', letterSpacing: '2px', margin: '0 0 10px', fontWeight: '900' }}>¿TIENES UN CÓDIGO?</p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input
              value={codigo}
              onChange={e => setCodigo(e.target.value.toUpperCase())}
              placeholder="Escribe el código"
              style={{ flex: 1, background: '#141416', border: '1px solid #2A2A2E', borderRadius: '12px', padding: '12px 14px', color: '#FFFFFF', fontSize: '15px', outline: 'none' }}
            />
            <button onClick={aplicarCodigo} disabled={aplicando} style={{ padding: '12px 18px', background: aplicando ? '#2A2A2E' : 'linear-gradient(135deg, #FF7A2F, #D6357E)', border: 'none', borderRadius: '12px', color: '#FFFFFF', fontSize: '14px', fontWeight: '900', cursor: aplicando ? 'default' : 'pointer' }}>
              {aplicando ? '...' : 'Aplicar'}
            </button>
          </div>
          {error && <p style={{ color: '#FF4444', fontSize: '12px', margin: 0 }}>{error}</p>}
          {mensaje && <p style={{ color: '#2ECC71', fontSize: '13px', fontWeight: 'bold', margin: 0 }}>{mensaje}</p>}
        </div>

        {cargando ? (
          <p style={{ color: '#555', textAlign: 'center', marginTop: '40px' }}>Cargando...</p>
        ) : promos.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '70px', marginBottom: '20px' }}>🎁</div>
            <h2 style={{ color: '#FFFFFF', fontSize: '20px', fontWeight: '900', margin: '0 0 10px' }}>No hay ofertas activas</h2>
            <p style={{ color: '#555', fontSize: '14px', margin: '0', lineHeight: '1.6' }}>En este momento no hay promociones disponibles. Vuelve pronto, ¡pronto habrá sorpresas para ti!</p>
          </div>
        ) : (
          <div>
            <p style={{ color: '#AAAAAA', fontSize: '11px', letterSpacing: '3px', margin: '0 0 12px' }}>OFERTAS DISPONIBLES</p>
            {promos.map(p => {
              const cat = categoriaInfo(p.categoria);
              return (
                <div key={p.id} style={{ background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)', borderRadius: '20px', padding: '20px', marginBottom: '12px', border: '1px solid #FF7A2F' }}>
                  <span style={{ fontSize: '10px', fontWeight: 'bold', padding: '3px 10px', borderRadius: '20px', background: 'rgba(255,122,47,0.15)', color: '#FF7A2F' }}>{cat.icono} {cat.label}</span>
                  <p style={{ color: '#FFFFFF', fontSize: '17px', fontWeight: '900', margin: '10px 0 6px' }}>{p.nombre}</p>
                  <p style={{ color: '#2ECC71', fontSize: '20px', fontWeight: '900', margin: '0 0 8px' }}>
                    {p.tipoBeneficio === 'descuento' ? `${p.valorBeneficio}% de descuento` : `$${(p.valorBeneficio || 0).toLocaleString()} de crédito`}
                  </p>
                  {p.descripcion && <p style={{ color: '#AAAAAA', fontSize: '13px', margin: '0 0 10px', lineHeight: '1.5' }}>{p.descripcion}</p>}
                  {p.requiereCodigo ? (
                    <div onClick={() => setCodigo(p.id)} style={{ background: '#141416', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                      <span style={{ color: '#FFCF4D', fontSize: '14px', fontWeight: '900', letterSpacing: '1px' }}>{p.id}</span>
                      <span style={{ color: '#888', fontSize: '11px' }}>Tocar para usar ↑</span>
                    </div>
                  ) : (
                    <p style={{ color: '#888', fontSize: '11px', margin: 0 }}>Se aplica automáticamente</p>
                  )}
                  <p style={{ color: '#666', fontSize: '11px', margin: '10px 0 0' }}>Válida hasta {new Date(p.fechaFin).toLocaleDateString('es-CO')}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Promociones;