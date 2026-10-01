import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, auth } from './firebase';
import { collection, query, where, limit, onSnapshot, doc, updateDoc, setDoc, getDoc, getDocs, orderBy, deleteField } from 'firebase/firestore';
import { registrarTokenFCM, permisoDeAvisos, avisoDeAvisos } from './Notificaciones';
import { sonarAlerta, desbloquearAudio } from './alerta';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { comisionSegunTipoDeViaje, comisionParaActivarse } from './comisiones';
import { porQueNoLeToca } from './leTocaElViaje';
import { calcularTarifaMinima } from './tarifas';
import { RESPALDO_CONFIG, leerConfig, segundosDeEspera, BUSQUEDA } from './configApp';
import { cop } from './moneda';
import PantallaFiesta from './PantallaFiesta';
import { ESTADOS_MERCADO, ESTADO_ACEPTADO, ESTADOS_TERMINADOS, ESTADOS_QUE_CIERRA_EL_SERVIDOR, avisoDelCierre, comoTermino, meAceptaronEsteViaje } from './estadosViaje';
import { consultaDeGanancias, resumenDeGanancias } from './gananciasConductor';
// REGLA 9 · qué se le dice al conductor cuando el servidor dice que no. Mismo
// archivo que usan el panel y aliados, copia idéntica byte a byte.
import { motivoDeRechazo, apuntarRechazo } from './avisoRechazo';
import AvisoModal from './AvisoModal';
import LlamadoAtencion from './LlamadoAtencion';
// LA LEY DEL BOTÓN (26-sep-2026): todo lo que guarda en la app del conductor pasa por el candado.
import { useAccion } from './useAccion';
import { calcularDistanciaKm } from './distancia';
import { RAZONES_CANCELACION_CONDUCTOR, AVISO_SIN_SALDO } from './textosViaje';
import { T } from './theme'; // P05: los colores de la franja «Te falta saldo» (G90: no se escriben a mano)
import ModalCancelacion from './ModalCancelacion';
import Calificacion from './Calificacion';
import Llamada from './Llamada';
import TratoHecho from './TratoHecho'; // G74: la ventanita «¡Trato hecho!», la misma para pasajero y conductor
import { useLlamadaEntrante } from './llamadaEntrante';
import { useChatDelViaje } from './chatDelViaje'; // G96: escuchar y enviar el chat del viaje, la misma pieza que el pasajero
import Creditos from './Creditos';
import MiPerfil from './MiPerfil';
import Ganancias from './Ganancias';
import Seguridad from './Seguridad';
import AyudaSoporte from './AyudaSoporte';
import Configuracion from './Configuracion';
import Promociones from './Promociones';
import MenuLateral from './MenuLateral';
// G51: adónde llevan «Mis viajes» y «Ganancias» lo dice UNA tabla; aquí, con el papel de conductor.
import { pantallaDelMenu } from './navegacionMenu';
import { fotoDe } from './fotoUsuario';
// G81: el saldo de la ficha se lee con UNA pieza (la misma que usa «Mis créditos»).
import { saldoDe } from './saldoUsuario';
import { sinConductor } from './conductorDelViaje';
import { puntoDeDireccion, geocodificadorDe } from './direccionDePunto';
import { LogoEsquina } from './Logo';
// Pedirle el GPS al teléfono, con sus tiempos en un solo sitio (G28).
import { pedirGps, seguirGps } from './pedirGps';
// El mapa con ruta es UNO para el conductor y el pasajero (G29).
import MapaConRuta from './MapaConRuta';
import BotonVolver from './BotonVolver';
import { fechaDelViaje, minutosSegundos } from './tiempoDelViaje';

// Valores por defecto (respaldo). Se reemplazan por los de config/global cuando cargan.
// G36/G66: el respaldo ENTERO sale de configApp.js (tarifas, comisiones, números y módulos), el mismo de toda la app,
// amarrado por prueba a la copia del panel. Las claves que esta pantalla no usa son inertes.
const CONFIG_APP_DEFECTO = RESPALDO_CONFIG;

// La tarifa mínima ya NO se calcula aquí: vive en tarifas.js (SEGUNDA LEY). Se importa arriba.
//
// ANOTADO, NO ARREGLADO EN ESTE CAMBIO — este respaldo tiene dos fallas viejas que
// NO se tocan hoy porque cambiarlas cambiaría lo que ve el conductor:
//   1. Se calcula UNA sola vez al abrir la app. Si el conductor la deja abierta
//      desde las 5 de la tarde, a las 7 sigue creyendo que es de día.
//   2. No mira el tipo de viaje ni la configuración del panel: un mototaxi sin
//      tarifa saldría con el mínimo del taxi.
// Hoy no hace daño: se midió el 23-ago-2026 y los 91 viajes traen su tarifa, así
// que este respaldo no se ha usado nunca. Arreglarlo es un trabajo aparte.
//
// SE ESCRIBEN LOS DOS PARÁMETROS A PROPÓSITO, aunque sean los de por defecto: el
// primero es el TIPO de viaje, no la config. Escribirlo así evita que alguien lo
// "arregle" a calcularTarifaMinima(configApp) — que no daría error, pero metería
// la config donde va el tipo y devolvería el paracaídas en vez del precio bueno.
const TARIFA_MINIMA = calcularTarifaMinima(undefined, CONFIG_APP_DEFECTO);

// La comisión ya NO se calcula aquí: vive en comisiones.js, que es el único sitio
// donde se calcula para toda la app (SEGUNDA LEY). Se importa arriba.
// La distancia tampoco: vive en distancia.js, amarrada por prueba a la copia
// del servidor (que no puede importar archivos de la app). Se importa arriba.

// Las razones de cancelación viven en textosViaje.js (SEGUNDA LEY). Se importan arriba.

// El fondo y el confeti salen del marco común PantallaFiesta.js (gemelo G80); lo de dentro es de esta pantalla.
function CelebracionConductor({ monto, onCerrar }) {
  return (
    <PantallaFiesta estilo="saldo">
      <div style={{ fontSize: '70px', marginBottom: '12px' }}>🎉</div>
      <h2 style={{ color: '#1A1A1E', fontSize: '24px', fontWeight: '900', margin: '0 0 6px', textAlign: 'center' }}>¡Recibiste tu saldo!</h2>
      <p style={{ color: '#FF7A2F', fontSize: '16px', margin: '0 0 24px', textAlign: 'center', fontWeight: 'bold' }}>El descuento del pasajero es tuyo 🎁</p>
      <div style={{ background: '#FFFFFF', borderRadius: '28px', padding: '32px 24px', width: '100%', maxWidth: '420px', border: '3px solid #2ECC71', textAlign: 'center', zIndex: 2 }}>
        <p style={{ color: '#2ECC71', fontSize: '12px', margin: '0 0 12px', letterSpacing: '2px', fontWeight: 'bold' }}>SALDO ACREDITADO A TUS CRÉDITOS</p>
        <p style={{ color: '#1A1A1E', fontSize: '52px', fontWeight: '900', margin: '0' }}>{cop(monto || 0)}</p>
        <p style={{ color: '#6B7280', fontSize: '13px', margin: '16px 0 0', lineHeight: '1.5' }}>Ya está sumado a tu saldo de créditos. ¡Gracias por rodar con GuajiraGo!</p>
      </div>
      <button onClick={onCerrar} style={{ marginTop: '28px', width: '100%', maxWidth: '420px', padding: '18px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '16px', color: '#FFFFFF', fontSize: '17px', fontWeight: '900', cursor: 'pointer', zIndex: 2 }}>Continuar</button>
    </PantallaFiesta>
  );
}

function MensajeGrande({ mensaje, onCerrar }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9998, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ fontSize: '70px', marginBottom: '20px' }}>💬</div>
      <p style={{ color: '#FF7A2F', fontSize: '14px', margin: '0 0 16px', letterSpacing: '2px', fontWeight: 'bold', textAlign: 'center' }}>MENSAJE DEL PASAJERO</p>
      <div style={{ background: '#FFFFFF', borderRadius: '24px', padding: '32px 24px', width: '100%', maxWidth: '420px', border: '2px solid #FF7A2F', textAlign: 'center' }}>
        <p style={{ color: '#1A1A1E', fontSize: '32px', fontWeight: '900', margin: '0', lineHeight: '1.3' }}>{mensaje}</p>
      </div>
      <button onClick={onCerrar} style={{ marginTop: '28px', padding: '16px 40px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', border: 'none', borderRadius: '16px', color: '#FFFFFF', fontSize: '16px', fontWeight: '900', cursor: 'pointer' }}>Entendido</button>
    </div>
  );
}

function HistorialConductor({ onVolver }) {
  const [viajes, setViajes] = React.useState([]);
  const [cargando, setCargando] = React.useState(true);
  const [totalHoy, setTotalHoy] = React.useState(0);

  React.useEffect(() => {
    const cargar = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        // 🔴 LOS ÚLTIMOS 50, NO 50 CUALESQUIERA.
        //
        // Hasta el 15-sep-2026 esto pedía `limit(50)` **sin decirle al servidor
        // por cuál empezar**. Con menos de 50 no se notaba; al pasar de 50, el
        // servidor manda los que le salgan y el `.sort` de abajo ordena bien una
        // lista a la que YA le faltan viajes. Y no avisa: ni error, ni rojo.
        // Medido ese día: el conductor con más viajes iba por 47 de 50.
        //
        // 🔴 EL ÍNDICE VA ANTES QUE ESTA APP, SIEMPRE.
        // El `orderBy` necesita un índice (viajes: conductorId ASC +
        // fechaSolicitud DESC) que no existía. Está declarado en
        // `firestore.indexes.json` y se despliega **desde la raíz**, ANTES de
        // publicar esta app — y hay que ESPERAR a que esté construido, porque
        // mientras se construye la consulta falla igual que si no existiera.
        // Al revés, o a medias, el conductor ve «Mis viajes» EN BLANCO y este
        // `catch` no lo dice (deuda anotada). La dirección importa: un índice
        // ascendente NO sirve para este `'desc'`.
        // Los índices que ya había se bajan antes con
        // `node scripts/bajar-indices.cjs` para no borrarlos al desplegar.
        //
        // Se ordena por `fechaSolicitud`, que la escribe el celular del cliente
        // (deuda anotada). Medido contra la hora del SERVIDOR el 15-sep-2026:
        // los 76 viajes con conductor tienen fecha, ninguno se desvía ni un
        // minuto, y los dos órdenes coinciden viaje por viaje. Se cuenta con
        // `node scripts/medir-tope-historial.cjs`.
        const q = query(
          collection(db, 'viajes'),
          where('conductorId', '==', user.uid),
          orderBy('fechaSolicitud', 'desc'),
          limit(50),
        );
        const snap = await getDocs(q);
        const lista = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          // 🔴 TODOS LOS VIAJES TERMINADOS, NO DOS DE CINCO.
          //
          // Hasta el 13-sep-2026 aquí decía `finalizado || cancelado`, así que
          // los que canceló el propio conductor y los que se quedaron colgados
          // NO APARECÍAN en su historial. No daba error ni salía en rojo:
          // simplemente no estaban, y nadie echa de menos lo que nunca vio.
          //
          // Medido ese día con `node scripts/medir-historial-conductor.cjs`:
          // 40 viajes invisibles entre 5 conductores. Uno de ellos veía 16 de
          // sus 47 — se perdía 31 de su propio trabajo.
          //
          // La lista sale de `estadosViaje.js`, que está en esta misma carpeta:
          // aquí NO hace falta copiarla ni amarrarla, se importa y ya. (El
          // panel sí tiene que copiarla, porque es otro repo.)
          .filter(v => ESTADOS_TERMINADOS.includes(v.estado))
          // Este `.sort` SE QUEDA a propósito, aunque el servidor ya los manda
          // ordenados desde el 15-sep-2026. No es código muerto: es lo que
          // garantiza el orden EN PANTALLA si algún día la consulta cambia. Lo
          // que era un error antes no era ordenar aquí, era ordenar aquí
          // **en vez de** decirle al servidor por cuál empezar.
          .sort((a, b) => new Date(b.fechaSolicitud) - new Date(a.fechaSolicitud));
        setViajes(lista);
        // G23 — «GANANCIAS DE HOY» es la MISMA cuenta que la tarjeta HOY de la pantalla Ganancias
        // (gananciasConductor.js): día de Colombia y su propia consulta, así que no depende del tope
        // de 50 de la lista de arriba.
        const ahora = new Date();
        const snapGanancias = await getDocs(consultaDeGanancias({ collection, query, where }, db, user.uid, ahora));
        setTotalHoy(resumenDeGanancias(snapGanancias.docs.map(d => d.data()), ahora).hoy.total);
      } catch (e) { console.error(e); }
      setCargando(false);
    };
    cargar();
  }, []);

  return (
    <div style={{ backgroundColor: '#FFFFFF', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: '#FFFFFF', borderBottom: '1.5px solid #ECECEF', padding: '24px 20px', position: 'relative', display: 'flex', alignItems: 'center' }}>
        <BotonVolver alVolver={onVolver} />
        <h2 style={{ color: '#1A1A1E', margin: '0 auto', fontSize: '20px', fontWeight: '900' }}>Mis viajes</h2>
      </div>
      {totalHoy > 0 && (
        <div style={{ margin: '16px 20px 0', background: '#FFFFFF', borderRadius: '16px', padding: '16px 20px', border: '1.5px solid #ECECEF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ color: '#6B7280', fontSize: '11px', margin: '0', letterSpacing: '2px' }}>GANANCIAS DE HOY</p>
            <p style={{ color: '#2ECC71', fontSize: '28px', fontWeight: '900', margin: '4px 0 0' }}>{cop(totalHoy)}</p>
          </div>
          <span style={{ fontSize: '36px' }}>💰</span>
        </div>
      )}
      <div style={{ padding: '16px 20px' }}>
        {cargando && <p style={{ color: '#6B7280', textAlign: 'center', marginTop: '40px' }}>Cargando...</p>}
        {!cargando && viajes.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: '60px' }}>
            <p style={{ fontSize: '60px', margin: '0 0 16px' }}>🚗</p>
            <p style={{ color: '#6B7280', fontSize: '15px' }}>Aún no tienes viajes</p>
          </div>
        )}
        {viajes.map((v) => {
          const fecha = fechaDelViaje(v.fechaSolicitud);
          // 🔴 ESTA BANDERA DECIDE SI EL VIAJE SALE VERDE «Completado» CON SU
          // TARIFA, o rojo. Decía `estado === 'cancelado'` a secas, así que
          // cualquier otra forma de no terminar salía EN VERDE: el conductor
          // veía un trabajo hecho y cobrado que no lo fue.
          //
          // Hoy no se notaba porque esos viajes ni entraban en la lista. Al
          // arreglar el filtro de arriba habrían entrado los 40 —y LOS 40
          // habrían salido verdes, porque ninguno es `finalizado` ni
          // `cancelado`—, así que las dos mitades van juntas: arreglar solo una
          // hace un fallo peor que el que había.
          //
          // Completado es UNO; todo lo demás que entra aquí es un final que no
          // se completó. Desde G21 (28-sep-2026) eso, las palabras de cada final
          // y su color salen de `comoTermino` (estadosViaje.js), la MISMA pieza
          // de los historiales del pasajero (Home.js y MisViajes.js).
          const fin = comoTermino(v, 'conductor');
          return (
            <div key={v.id} style={{ background: '#FFFFFF', borderRadius: '20px', padding: '20px', marginBottom: '12px', border: '1.5px solid #ECECEF' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '28px' }}>{v.tipo === 'Taxi' ? '🚗' : '🏍️'}</span>
                  <div>
                    <p style={{ color: '#1A1A1E', fontWeight: '900', fontSize: '15px', margin: '0' }}>{v.tipo}</p>
                    <p style={{ color: '#6B7280', fontSize: '12px', margin: '3px 0 0' }}>{fecha}</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ color: fin.color, fontSize: '13px', fontWeight: 'bold', margin: '0' }}>{fin.texto}</p>
                  <p style={{ color: '#1A1A1E', fontSize: '18px', fontWeight: '900', margin: '4px 0 0' }}>{v.tarifa}</p>
                </div>
              </div>
              <div style={{ background: '#FFFFFF', border: '1px solid #ECECEF', borderRadius: '12px', padding: '12px' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2ECC71', marginTop: '3px', flexShrink: 0 }}/>
                  <p style={{ color: '#1A1A1E', fontSize: '13px', margin: '0' }}>{v.origen}</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#FF7A2F', marginTop: '3px', flexShrink: 0 }}/>
                  <p style={{ color: '#1A1A1E', fontSize: '13px', margin: '0' }}>{v.destino}</p>
                </div>
              </div>
              {!fin.completado && fin.porque && <p style={{ color: '#6B7280', fontSize: '12px', margin: '10px 0 0' }}>Razón: {fin.porque}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// P05 (30-sep-2026, decisión del dueño: «Que pueda ver: se pone disponible y ve los viajes y sus precios, pero no puede
// ofertar hasta recargar»). El interruptor ya no frena por saldo. Mientras no le alcance para la comisión más barata
// que puede tomar (comisionParaActivarse, la misma vara que tenía el interruptor), esta franja le dice por qué no
// puede ofertar, con el texto de AVISO_SIN_SALDO, y tocarla abre «Mis créditos». El freno de verdad sigue al aceptar
// o contraofertar cada viaje (P04: app, reglas y servidor).
function FranjaSinSaldo({ saldoCreditos, tipoVehiculo, configApp, onRecargar }) {
  if (!(saldoCreditos !== null && saldoCreditos < comisionParaActivarse(tipoVehiculo, configApp))) return null;
  return (
    <div onClick={onRecargar} style={{ background: T.fondoSuave, border: '1px solid ' + T.amarillo, borderRadius: '14px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '12px' }}>
      <span style={{ fontSize: '22px' }}>{AVISO_SIN_SALDO.icono}</span>
      <div>
        <p style={{ color: T.tinta, fontWeight: '900', fontSize: '14px', margin: '0' }}>{AVISO_SIN_SALDO.titulo}</p>
        <p style={{ color: T.gris, fontSize: '12px', margin: '4px 0 0', lineHeight: '1.4' }}>{AVISO_SIN_SALDO.texto}</p>
      </div>
    </div>
  );
}

// `onAviso` es de la REGLA 9: esta tarjeta vive DENTRO de AppConductor pero es un
// componente aparte, así que no alcanza su ventanita. Se le pasa por prop, como ya
// se le pasa onRechazar. Sin esto, la oferta que el servidor rechaza se quedaría
// muda — y la tarjeta diría «oferta enviada» igual.
function TarjetaSolicitud({ solicitud, nombre, telefono, placa, vehiculo, tipoVehiculo, fotoConductor, colorConductor, saldoCreditos, configApp, descartadosRef, agregarViajeEscuchando, onRechazar, onAviso }) {
  const [tarifaModificada, setTarifaModificada] = useState(solicitud.tarifaValor || TARIFA_MINIMA);
  const [tarifaCambiada, setTarifaCambiada] = useState(false);
  const [ofertaEnviada, setOfertaEnviada] = useState(null); // monto que ya oferté en este viaje (para poder ajustar)
  // El candado de esta tarjeta. Su aviso sube a la pantalla por `onAviso` (la tarjeta vive fuera del componente),
  // solo cuando falla. Por un ref: si el padre pasa una función nueva en cada dibujo, el efecto volvería a abrir un
  // aviso que el conductor ya cerró.
  const { ocupado, correr, texto, aviso } = useAccion();
  const onAvisoRef = useRef(onAviso);
  onAvisoRef.current = onAviso;
  useEffect(() => {
    if (aviso && !aviso.ok && onAvisoRef.current) onAvisoRef.current(aviso);
  }, [aviso]);

  useEffect(() => {
    setTarifaModificada(solicitud.tarifaValor || TARIFA_MINIMA);
    setTarifaCambiada(false);
    setOfertaEnviada(null); // el pasajero cambió su oferta → puedo volver a ofertar
  }, [solicitud.tarifaValor]);

  const subirTarifa = () => {
    setTarifaModificada(prev => (tarifaCambiada ? prev : (solicitud.tarifaValor || TARIFA_MINIMA)) + configApp.incrementoTarifa);
    setTarifaCambiada(true);
  };

  const bajarTarifa = () => {
    const minimo = solicitud.tarifaValor || TARIFA_MINIMA;
    setTarifaModificada(prev => {
      const actual = tarifaCambiada ? prev : minimo;
      if (actual <= minimo) return actual;
      return actual - configApp.incrementoTarifa;
    });
    setTarifaCambiada(true);
  };

  const aceptarOEnviar = async () => {
    // G03: la misma cifra que cobrará el servidor, que mira el tipo del VIAJE (no el vehículo del conductor).
    const comisionAplicable = comisionSegunTipoDeViaje(solicitud.tipo, configApp);
    if (saldoCreditos !== null && saldoCreditos < comisionAplicable) {
      onAviso(AVISO_SIN_SALDO); // G69: la misma ventanita que el interruptor, texto de textosViaje.js
      return;
    }
    const user = auth.currentUser;
    if (!user) return;
    const idViaje = solicitud.id;
    const esContra = tarifaCambiada;
    const monto = esContra ? tarifaModificada : (solicitud.tarifaValor || 0);
    agregarViajeEscuchando(idViaje);
    // Mi oferta va en la subcolección viajes/{id}/contraofertas/{miUid}: no pisa las de otros
    // conductores y puedo AJUSTARLA (mismo doc). La tarjeta NO se descarta: el viaje sigue abierto.
    const r = await correr(() => setDoc(doc(db, 'viajes', idViaje, 'contraofertas', user.uid), {
      conductorId: user.uid,
      conductorNombre: nombre || 'Conductor',
      conductorTelefono: telefono || '',
      conductorPlaca: placa || '',
      conductorVehiculo: vehiculo || '',
      conductorFoto: fotoConductor || null,
      conductorColor: colorConductor || '',
      tipoOferta: esContra ? 'contraoferta' : 'acepta',
      monto: cop(monto), // G13: el formateador único, no el idioma del teléfono
      montoValor: monto,
      creado: new Date().toISOString(),
      vigente: true,
      // REGLA 9. Antes: `.catch(() => {})`. La oferta no salía, la tarjeta decía
      // «oferta enviada» igual, y el conductor se quedaba esperando una respuesta
      // a algo que el pasajero nunca vio. Desde LA LEY DEL BOTÓN el «enviada» se pone
      // SOLO cuando la oferta entró, y si falla lo dice el candado.
    }, { merge: true }), 'oferta', 'Oferta enviada.', 'enviar tu oferta');
    if (r && r.ok) setOfertaEnviada(monto);
  };

  return (
    <div style={{ background: '#FFFFFF', borderRadius: '20px', padding: '20px', border: '1px solid #FF7A2F', marginBottom: '12px' }}>
      {solicitud.tipo === 'Mensajería' ? (
        <>
          <div style={{ background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', borderRadius: '10px', padding: '8px 12px', margin: '0 0 12px', display: 'inline-block' }}>
            <p style={{ color: '#1A1A1E', fontSize: '15px', margin: '0', letterSpacing: '1px', fontWeight: '900' }}>📦 MENSAJERÍA / MANDADO</p>
          </div>
          {solicitud.mensajeria?.queEnvia && <p style={{ color: '#1A1A1E', fontWeight: '900', fontSize: '17px', margin: '0 0 8px' }}>📦 Envía: {solicitud.mensajeria.queEnvia}</p>}
          <p style={{ color: '#1A1A1E', fontSize: '15px', margin: '0 0 4px', fontWeight: 'bold' }}>📍 Recoger en: {solicitud.origen}</p>
          <p style={{ color: '#1A1A1E', fontSize: '15px', margin: '0 0 8px', fontWeight: 'bold' }}>🏁 Entregar en: {solicitud.destino}</p>
          {solicitud.mensajeria?.recibeNombre && <p style={{ color: '#1A1A1E', fontSize: '15px', margin: '0 0 4px', fontWeight: 'bold' }}>🙋 Recibe: {solicitud.mensajeria.recibeNombre}{solicitud.mensajeria?.recibeTel ? ` · 📞 ${solicitud.mensajeria.recibeTel}` : ''}</p>}
          {solicitud.mensajeria?.nota && <p style={{ color: '#FF7A2F', fontSize: '14px', margin: '0 0 14px', fontWeight: 'bold' }}>📝 {solicitud.mensajeria.nota}</p>}
          {!solicitud.mensajeria?.nota && <div style={{ marginBottom: '14px' }} />}
        </>
      ) : (
        <>
          <p style={{ color: '#FF7A2F', fontSize: '11px', margin: '0 0 8px', letterSpacing: '2px', fontWeight: 'bold' }}>🔔 SOLICITUD</p>
          <p style={{ color: '#1A1A1E', fontWeight: '900', fontSize: '15px', margin: '0 0 3px' }}>{solicitud.tipo}</p>
          <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 2px' }}>📍 {solicitud.origen}</p>
          <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 14px' }}>🏁 {solicitud.destino}</p>
        </>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', background: '#FFFFFF', borderRadius: '14px', padding: '14px' }}>
        <div>
          <p style={{ color: '#6B7280', fontSize: '10px', margin: '0' }}>{tarifaCambiada ? 'TU CONTRAOFERTA' : 'OFERTA DEL PASAJERO'}</p>
          <p style={{ color: tarifaCambiada ? '#FF7A2F' : '#2ECC71', fontWeight: '900', fontSize: '26px', margin: '4px 0 0' }}>{cop(tarifaCambiada ? tarifaModificada : (solicitud.tarifaValor || TARIFA_MINIMA))}</p>
          {!tarifaCambiada && solicitud.nuevaOferta && <p style={{ color: '#FF7A2F', fontSize: '11px', margin: '4px 0 0' }}>⬆️ Pasajero actualizó su oferta</p>}
          {tarifaCambiada && <p style={{ color: '#6B7280', fontSize: '11px', margin: '4px 0 0' }}>Oferta original: {solicitud.tarifa}</p>}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={bajarTarifa} style={{ width: '52px', height: '52px', background: tarifaModificada <= (solicitud.tarifaValor || TARIFA_MINIMA) ? '#ECECEF' : '#FFFFFF', border: `2px solid ${tarifaModificada <= (solicitud.tarifaValor || TARIFA_MINIMA) ? '#ECECEF' : '#FF7A2F'}`, borderRadius: '14px', color: tarifaModificada <= (solicitud.tarifaValor || TARIFA_MINIMA) ? '#6B7280' : '#FF7A2F', fontSize: '26px', fontWeight: '900', cursor: tarifaModificada <= (solicitud.tarifaValor || TARIFA_MINIMA) ? 'default' : 'pointer' }}>−</button>
          <button onClick={subirTarifa} style={{ width: '52px', height: '52px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', border: 'none', borderRadius: '14px', color: '#FFFFFF', fontSize: '26px', fontWeight: '900', cursor: 'pointer' }}>+</button>
        </div>
      </div>
      {ofertaEnviada != null && (
        <div style={{ background: '#EAF9EF', border: '1px solid #2ECC71', borderRadius: '12px', padding: '10px 12px', marginBottom: '10px', textAlign: 'center' }}>
          <p style={{ color: '#1B8A4A', fontSize: '13px', fontWeight: '900', margin: 0 }}>✅ Enviaste tu oferta: {cop(ofertaEnviada)}</p>
          <p style={{ color: '#1B8A4A', fontSize: '11px', margin: '2px 0 0' }}>Puedes ajustar el precio con − / + y volver a enviar.</p>
        </div>
      )}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={() => onRechazar(solicitud.id)} disabled={!!ocupado} style={{ flex: 1, padding: '13px', background: '#FFFFFF', border: 'none', borderRadius: '13px', color: '#6B7280', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>{ofertaEnviada != null ? '✗ Quitar' : '✗ Rechazar'}</button>
        <button onClick={aceptarOEnviar} disabled={!!ocupado} style={{ flex: 2, padding: '13px', background: ofertaEnviada != null ? 'linear-gradient(135deg, #1C8EF9, #39A6FF)' : (tarifaCambiada ? 'linear-gradient(135deg, #FF7A2F, #D6357E)' : 'linear-gradient(135deg, #FFCF4D, #FF7A2F)'), border: 'none', borderRadius: '13px', color: '#FFFFFF', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
          {texto('oferta', 'Enviando…', ofertaEnviada != null ? '🔄 Actualizar oferta' : (tarifaCambiada ? '💬 Enviar contraoferta' : '✅ Aceptar viaje'))}
        </button>
      </div>
    </div>
  );
}

function AppConductor({ nombre, telefono, placa, vehiculo, tipoVehiculo, onCerrarSesion, onVolver }) {
  const [activo, setActivo] = useState(true);
  const [solicitudes, setSolicitudes] = useState([]);
  const [fase, setFase] = useState(null);
  const [viajeActual, setViajeActual] = useState(null);
  const [ubicacion, setUbicacion] = useState(null);
  const [ubicacionPasajero, setUbicacionPasajero] = useState(null);
  const [celebrando, setCelebrando] = useState(false);
  const [viajesEscuchando, setViajesEscuchando] = useState([]);
  const [tiempoLlegada, setTiempoLlegada] = useState(null);
  const [distancia, setDistancia] = useState(null);
  // La tarjeta de abajo del viaje: el mapa con ruta deja su alto libre al encuadrar (G29).
  const tarjetaRef = useRef(null);
  const [respuestaPasajero, setRespuestaPasajero] = useState(null);
  const [mensajeGrande, setMensajeGrande] = useState(null);
  // REGLA 9 · el aviso de «no se pudo» tiene su PROPIA ventanita. Reusar la de
  // los mensajes del pasajero le ponia encima el encabezado «MENSAJE DEL
  // PASAJERO», y ademas se quedaba TAPADA por el modal del codigo de descuento
  // (los dos a zIndex 9998, y el otro se pinta despues). AvisoModal va a 10000.
  const [aviso, setAviso] = useState(null);
  // El candado de LA LEY DEL BOTÓN. Su aviso entra por la MISMA ventanita que ya pintan las cuatro pantallas del
  // conductor (`aviso`), y solo cuando algo FALLA: lo que sale bien se ve solo (la fase avanza, el mensaje sale).
  const { ocupado, correr, texto, aviso: avisoAccion } = useAccion();
  useEffect(() => {
    if (avisoAccion && !avisoAccion.ok) setAviso(avisoAccion);
  }, [avisoAccion]);
  const [mostrarCancelacion, setMostrarCancelacion] = useState(false);
  const [mostrarCodigo, setMostrarCodigo] = useState(false);
  const [codigoIngresado, setCodigoIngresado] = useState('');
  const [errorCodigo, setErrorCodigo] = useState('');
  const [destinoCoords, setDestinoCoords] = useState(null);
  const [contador, setContador] = useState(segundosDeEspera(CONFIG_APP_DEFECTO));
  // G51: la pantalla que abrió «Mis viajes» o «Ganancias» (una clave de navegacionMenu.js), o null.
  const [verDelMenu, setVerDelMenu] = useState(null);
  const abrirDelMenu = (opcion) => setVerDelMenu(pantallaDelMenu(opcion, 'conductor'));
  const [verCreditos, setVerCreditos] = useState(false);
  const [verPerfil, setVerPerfil] = useState(false);
  const [verSeguridad, setVerSeguridad] = useState(false);
  const [verAyuda, setVerAyuda] = useState(false);
  const [verConfig, setVerConfig] = useState(false);
  const [verPromociones, setVerPromociones] = useState(false);
  const [saldoCreditos, setSaldoCreditos] = useState(null);
  const [fotoConductor, setFotoConductor] = useState(null);
  const [colorConductor, setColorConductor] = useState('');
  const [datosCalificacion, setDatosCalificacion] = useState(null);
  const [enLlamada, setEnLlamada] = useState(false);
  const [confirmarFin, setConfirmarFin] = useState(false);
  const [llamadaEntrante, setLlamadaEntrante] = useLlamadaEntrante(viajeActual?.id, setAviso);
  const [textoChat, setTextoChat] = useState('');
  const chatFinRef = useRef(null);
  const [mensajesChat, enviarAlChat] = useChatDelViaje(viajeActual?.id, 'conductor', chatFinRef, setAviso);
  const contadorRef = useRef(null);
  const ultimoMensajeRef = useRef(null);
  const descartadosRef = useRef({});
  const celebrandoRef = useRef(false);
  const faseRef = useRef(null);
  const unsubsViajesRef = useRef({});
  const misOfertasRef = useRef(new Set()); // ids de viajes donde dejé una oferta (para invalidarlas al ganar otro)
  const solicitudesIdsRef = useRef(new Set());
  const ubicacionRef = useRef(null);
  const [refrescoListener, setRefrescoListener] = useState(0);
  const [sancionActiva, setSancionActiva] = useState(null);
  const [contadorSancion, setContadorSancion] = useState('');
  const [saldoVirtualRecibido, setSaldoVirtualRecibido] = useState(null);
  const [configApp, setConfigApp] = useState(CONFIG_APP_DEFECTO);

  // Cargar la configuración global (comisiones, tarifas, etc.) una vez al abrir
  const [, setDebugConfig] = useState('Cargando config...');
  useEffect(() => {
    const cargarConfigApp = async () => {
      // G66: la lectura sale de configApp.js (lo del servidor encima del respaldo, y dice si falló).
      const { config: d, existe, error: e } = await leerConfig({ getDoc, doc, db });
      if (existe) {
        setConfigApp(d);
        setDebugConfig('CONFIG OK → comisionTaxi=' + d.comisionTaxi + ' / comisionMoto=' + d.comisionMototaxi);
      } else if (!e) {
        setDebugConfig('config/global NO EXISTE');
      } else {
        setDebugConfig('ERROR: ' + (e.code || '') + ' ' + (e.message || ''));
      }
    };
    cargarConfigApp();
  }, []);

  const [textoApelacion, setTextoApelacion] = useState('');
  const [mensajesApelacion, setMensajesApelacion] = useState([]);
  const chatApelacionFinRef = useRef(null);

  useEffect(() => {
    if (chatApelacionFinRef.current) {
      setTimeout(() => chatApelacionFinRef.current.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [mensajesApelacion]);

  const enviarApelacion = async () => {
    if (!textoApelacion.trim()) return;
    const user = auth.currentUser;
    if (!user) return;
    // Antes: `catch (e) {}`. (Y ANOTADO sin tocar, PRIMERA LEY: sube la lista entera, así que una respuesta del
    // panel escrita a la vez puede borrar este mensaje — el mismo fallo que se le quitó al chat de recargas con
    // arrayUnion. Va aparte.)
    await correr(async () => {
      const nuevoMensaje = {
        texto: textoApelacion.trim(),
        autor: 'conductor',
        fecha: new Date().toISOString(),
      };
      const previos = mensajesApelacion || [];
      await updateDoc(doc(db, 'usuarios', user.uid), {
        mensajesApelacion: [...previos, nuevoMensaje],
      });
      setTextoApelacion('');
    }, 'apelacion', 'Mensaje enviado.', 'enviar tu mensaje');
  };
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'usuarios', user.uid), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const ahora = new Date();
      const esPermanente = data.activo === false && !data.sancionHasta;
      const esTemporalVigente = data.sancionHasta && new Date(data.sancionHasta) > ahora;

      if (esPermanente || esTemporalVigente) {
        const ultimaSancion = (data.sanciones || [])[data.sanciones.length - 1] || null;
        setSancionActiva({
          razon: ultimaSancion?.razon || 'Motivo no especificado',
          duracion: ultimaSancion?.duracion || (esPermanente ? 'Permanente' : ''),
          permanente: esPermanente,
          sancionHasta: data.sancionHasta || null,
        });
        setMensajesApelacion(data.mensajesApelacion || []);
      } else {
        setSancionActiva(null);
        setMensajesApelacion([]);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!sancionActiva || sancionActiva.permanente || !sancionActiva.sancionHasta) {
      setContadorSancion('');
      return;
    }
    const actualizar = () => {
      const restante = new Date(sancionActiva.sancionHasta) - new Date();
      if (restante <= 0) {
        setContadorSancion('00:00:00');
        return;
      }
      const horas = Math.floor(restante / 3600000);
      const minutos = Math.floor((restante % 3600000) / 60000);
      const segundos = Math.floor((restante % 60000) / 1000);
      setContadorSancion(`${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`);
    };
    actualizar();
    const intervalo = setInterval(actualizar, 1000);
    return () => clearInterval(intervalo);
  }, [sancionActiva]);
  useEffect(() => { celebrandoRef.current = celebrando; }, [celebrando]);
  useEffect(() => { faseRef.current = fase; }, [fase]);

  const limpiarTodosVigilantes = useCallback(() => {
    Object.values(unsubsViajesRef.current).forEach(fn => { try { fn(); } catch(e) {} });
    unsubsViajesRef.current = {};
    setViajesEscuchando([]);
  }, []);

  const limpiarViajesOtrosConductor = useCallback(async (miId, idViajeGanador) => {
    try {
      const snap = await getDocs(query(collection(db, 'viajes'), where('conductorId', '==', miId)));
      snap.docs.forEach(d => {
        // Sin `confirmando` (9-sep-2026) ni `en_negociacion` (12-sep): estados
        // retirados del mercado, que no los escribía nadie.
        // G55: «buscando conductor» sale de ESTADOS_MERCADO; y como solo entra un viaje que ya está en el mercado, se
        // le deja el estado que tiene (hoy `esperando`, el mismo que se escribía a mano).
        // G59: los campos del conductor que se borran salen de la lista atada a confirmarConductor (antes se
        // quedaban la foto y el color).
        if (d.id !== idViajeGanador && ESTADOS_MERCADO.includes(d.data().estado)) {
          updateDoc(doc(db, 'viajes', d.id), {
            estado: d.data().estado,
            ...sinConductor(),
          }).catch(() => {});
        }
      });
    } catch(e) {}
  }, []);

  // Al GANAR un viaje, invalidar MIS ofertas en los OTROS viajes → desaparecen al instante de las listas de esos pasajeros.
  const invalidarMisOtrasOfertas = useCallback((miId, ganadorId) => {
    const ids = Array.from(misOfertasRef.current);
    misOfertasRef.current.clear();
    ids.forEach(vid => {
      if (vid !== ganadorId && miId) updateDoc(doc(db, 'viajes', vid, 'contraofertas', miId), { vigente: false }).catch(() => {});
    });
  }, []);

  // G24 (28-sep-2026): LA ÚNICA reacción a «me aceptaron el viaje». La llaman los dos vigilantes —el de la oferta
  // (`agregarViajeEscuchando`) y el general (todos mis viajes)—, que antes llevaban cada uno su copia y su regla, con
  // una ventana en que no lo veía ninguno. La regla es `meAceptaronEsteViaje` (estadosViaje.js). El primero que llega
  // celebra; el otro encuentra el candado puesto y no repite.
  const alQueMeAceptaron = useCallback((data) => {
    if (celebrandoRef.current || faseRef.current) return;
    const miId = auth.currentUser?.uid;
    limpiarTodosVigilantes();
    limpiarViajesOtrosConductor(miId, data.id);
    invalidarMisOtrasOfertas(miId, data.id);
    setCelebrando(true);
    celebrandoRef.current = true;
    // La comisión y el marcar "ocupado" ya los aplica la Cloud Function confirmarConductor (atómico, sin doble cobro).
    setTimeout(() => {
      setCelebrando(false);
      celebrandoRef.current = false;
      iniciarFase1(data);
    }, 3000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limpiarTodosVigilantes, limpiarViajesOtrosConductor, invalidarMisOtrasOfertas]);

  const agregarViajeEscuchando = useCallback((idViaje) => {
    if (idViaje) misOfertasRef.current.add(idViaje); // registro que oferté en este viaje
    if (unsubsViajesRef.current[idViaje]) return;
    const miId = auth.currentUser?.uid;
    const unsubHolder = { fn: null };

    const cerrarEsteVigilante = () => {
      if (unsubHolder.fn) {
        try { unsubHolder.fn(); } catch(e) {}
        unsubHolder.fn = null;
      }
      delete unsubsViajesRef.current[idViaje];
      setViajesEscuchando(prev => prev.filter(id => id !== idViaje));
    };

    const unsub = onSnapshot(doc(db, 'viajes', idViaje), (snap) => {
      if (!snap.exists()) { cerrarEsteVigilante(); return; }
      const data = snap.data();

      // El pasajero aceptó (contraoferta o directo): este viaje es mío → celebrar aunque el estado llegue junto con los datos.
      // Sin `confirmado`: estado retirado el 12-sep-2026. Nadie lo escribía en
      // `viajes`; el `confirmado` que SÍ existe es de PEDIDOS, que es otra cosa.
      if (meAceptaronEsteViaje(data, miId)) {
        alQueMeAceptaron({ id: idViaje, ...data });
        return;
      }

      if (data.estado === ESTADO_ACEPTADO && data.conductorId !== miId) {
        cerrarEsteVigilante();
        return;
      }

      // G20: CUALQUIER final suelta el vigilante, no solo las dos cancelaciones. Con la lista corta, un viaje que el
      // servidor cerraba (`vencido`, `expirado`) o que ya se terminó seguía vigilado hasta el tope de 3 minutos.
      if (ESTADOS_TERMINADOS.includes(data.estado)) {
        cerrarEsteVigilante();
        return;
      }

      // El pasajero subió su oferta: soltar este viaje para que reaparezca en la lista de solicitudes
      if (ESTADOS_MERCADO.includes(data.estado) && data.nuevaOferta) {
        delete descartadosRef.current[idViaje];
        cerrarEsteVigilante();
        return;
      }

      if (data.respuestaPasajero) recibirMensajePasajero(data.respuestaPasajero);
    });

    unsubHolder.fn = unsub;
    unsubsViajesRef.current[idViaje] = cerrarEsteVigilante;
    setViajesEscuchando(prev => prev.includes(idViaje) ? prev : [...prev, idViaje]);

    setTimeout(() => {
      if (unsubsViajesRef.current[idViaje]) cerrarEsteVigilante();
    }, 180000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alQueMeAceptaron]);

  // NUEVO: vigilante global. Escucha TODOS los viajes del conductor a la vez y detecta cuando un pasajero acepta,
  // sin importar cuántas contraofertas haya enviado (arregla que la 2ª contraoferta no le llegara la respuesta).
  useEffect(() => {
    const miId = auth.currentUser?.uid;
    if (!miId) return;
    const q = query(collection(db, 'viajes'), where('conductorId', '==', miId));
    const unsub = onSnapshot(q, (snap) => {
      // G24: la misma regla y la misma reacción que el vigilante de la oferta. Antes llevaba su copia, que solo creía
      // los viajes de menos de 10 min medidos con el reloj del teléfono: entre los 10 y los 20 no lo veía nadie.
      const d = snap.docs.find((docu) => meAceptaronEsteViaje(docu.data(), miId));
      if (d) alQueMeAceptaron({ id: d.id, ...d.data() });
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alQueMeAceptaron, tipoVehiculo]);

  // G07 (28-sep-2026): ésta es la única salida del conductor —el menú, Configuración y «Eliminar cuenta» llaman
  // aquí—. Primero se apaga con la sesión viva y después sale por la salida de la app (App.js, handleCerrarSesion),
  // que cierra la sesión al final. `ultimoPaso` («Eliminar cuenta»: borrar el usuario) va después de apagarse.
  // Devuelve true si salió.
  const cerrarSesion = async (ultimoPaso) => {
    // Antes: `catch(e) {}` y se salía igual. Si había un viaje en marcha y su cancelación no entraba, el pasajero se
    // quedaba esperando a un conductor que ya se había ido, sin que nadie lo supiera. Ahora: con viaje en marcha, si
    // no entra, NO se sale (el candado dice por qué y se puede reintentar). Sin viaje, se sale igual que antes: dejar
    // a alguien sin poder cerrar sesión por falta de señal sería peor que apagarle el «activo» un rato tarde.
    const r = await correr(async () => {
      if (viajeActual) {
        await updateDoc(doc(db, 'viajes', viajeActual.id), { estado: 'cancelado_conductor', canceladoPor: 'conductor', razonCancelacion: 'Conductor cerró sesión' });
      }
      const user = auth.currentUser;
      if (user) await setDoc(doc(db, 'conductores', user.uid), { activo: false, ocupado: false, enViajeId: null }, { merge: true });
    }, 'salir', 'Sesión cerrada.', 'cerrar la sesión');
    if (!r) return; // segundo toque
    if (!r.ok && viajeActual) return;
    return onCerrarSesion(ultimoPaso);
  };

  // Al abrir: se pide el token y, si este celular no le va a avisar de los viajes, se le dice en una ventanita
  // (27-sep-2026). Antes se pintaba el registro técnico «FCM: permiso=denied» y nada más.
  useEffect(() => {
    registrarTokenFCM().then(() => { const a = avisoDeAvisos(permisoDeAvisos()); if (a) setAviso(a); });
  }, []);
const cargarSaldo = useCallback(async (uid) => {
    try {
      const id = uid || auth.currentUser?.uid;
      if (!id) { setSaldoCreditos(0); return; }
      const snap = await getDoc(doc(db, 'usuarios', id));
      if (snap.exists()) {
        setSaldoCreditos(saldoDe(snap.data()));
        setFotoConductor(fotoDe(snap.data()));
        setColorConductor(snap.data().color || '');
      } else {
        setSaldoCreditos(0);
      }
    } catch (e) { setSaldoCreditos(0); }
  }, []);
  useEffect(() => {
    let unsubSaldo = null;
    const desuscribir = auth.onAuthStateChanged((user) => {
      if (unsubSaldo) { unsubSaldo(); unsubSaldo = null; }
      if (user) {
        cargarSaldo(user.uid);
        // Saldo en TIEMPO REAL: refleja al instante el cobro de comisión que hace la Cloud Function
        unsubSaldo = onSnapshot(doc(db, 'usuarios', user.uid), (snap) => {
          if (snap.exists()) setSaldoCreditos(saldoDe(snap.data()));
        });
      } else setSaldoCreditos(0);
    });
    return () => { desuscribir(); if (unsubSaldo) unsubSaldo(); };
  }, [cargarSaldo]);
  const recibirMensajePasajero = useCallback((mensaje) => {
    if (!mensaje) return;
    setRespuestaPasajero(mensaje);
    if (mensaje !== ultimoMensajeRef.current) {
      ultimoMensajeRef.current = mensaje;
      setMensajeGrande(mensaje);
    }
  }, []);

  useEffect(() => {
    if (!activo && !fase) return;
    const user = auth.currentUser;
    if (!user || !navigator.geolocation) return;
    if (activo) registrarTokenFCM();

    // El token de avisos va por UN solo camino, registrarTokenFCM (27-sep-2026): el GPS llevaba su propia copia
    // y lo pedía en cada lectura. Aquí solo se reintenta mientras no haya quedado guardado y el permiso esté dado.
    let tokenListo = false, pidiendoToken = false;
    const guardarUbicacion = async (pos) => {
      const nueva = { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: new Date().toISOString() };
      setUbicacion(nueva);
      ubicacionRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (!tokenListo && !pidiendoToken && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        pidiendoToken = true;
        registrarTokenFCM().then((ok) => { tokenListo = ok; pidiendoToken = false; });
      }
      try {
        await setDoc(doc(db, 'conductores', user.uid), {
          nombre: nombre || 'Conductor', telefono: telefono || '',
          placa: placa || '', vehiculo: vehiculo || '',
          ubicacion: nueva, activo: true,
        // merge (27-sep-2026, G02): sin él, cada lectura del GPS reescribía la ficha ENTERA y borraba
        // lo que pone el servidor al confirmarlo (enViajeId, ocupado) y el token si esta vez no salió.
        }, { merge: true });
      } catch (e) {}
    };

    // 🔴 EL RESPALDO PEDÍA ALGO MÁS DIFÍCIL QUE EL INTENTO QUE YA HABÍA FALLADO
    // (23-sep-2026). El mismo fallo que tenía la pantalla del pasajero, aquí.
    //
    // Estaba al revés: el intento 1 pedía precisión BAJA —wifi y antenas, el
    // camino fácil— y, cuando ése fallaba, el respaldo pedía SATÉLITES, que es
    // lo más difícil que hay. Un conductor arranca su turno donde se arranca un
    // turno: dentro de su casa. Ahí el satélite es justo lo que no se ve, así
    // que cuando el camino fácil no servía esta petición se iba por el
    // imposible y se rendía a los 28 segundos sin haber escrito nada.
    //
    // 🔴 Y LO RARO ES QUE ESTE MISMO ARCHIVO YA LO SABÍA: cuatro renglones más
    // abajo, el `watchPosition` lo tiene BIEN desde siempre —satélite primero,
    // wifi de respaldo—. O sea que el archivo se contradecía consigo mismo, y
    // nadie lo había mirado porque nada vigilaba esto.
    //
    // La regla NO se escribe aquí ni en un medidor nuevo: vive UNA sola vez en
    // `pruebas/cargar.cjs` (`elRespaldoDelGps`) y juzga a las DOS pantallas con
    // el mismo código, así que no se pueden separar en silencio (SEGUNDA LEY).
    //
    // `maximumAge` deja valer una posición que el aparato YA tiene. Antes decía
    // 0 —«no me sirve nada guardado»—, y un conductor que acaba de usar el mapa
    // tiraba una posición buena de hace medio minuto para pedirla otra vez.
    //
    // Los intentos y sus tiempos viven en `pedirGps.js` (G28, 28-sep-2026).
    pedirGps(navigator, 'pantalla', guardarUbicacion, () => {});

    // 🔴 EL SEGUIMIENTO DEJABA SEGUIMIENTOS SUELTOS (G28). Cada vez que el
    // satélite fallaba se abría OTRO de respaldo sin cerrar el anterior, y al
    // salir del turno solo se cerraba el último: los sueltos seguían escribiendo
    // la ficha, con `activo: true`, de un conductor que ya se había ido.
    // `seguirGps` abre UN respaldo y devuelve con qué pararlo TODO.
    const pararSeguimiento = seguirGps(navigator, 'seguimiento', guardarUbicacion);

    return () => pararSeguimiento();
  }, [activo, fase, nombre, telefono, placa, vehiculo]);

  useEffect(() => {
    if (activo || fase) return;
    const user = auth.currentUser;
    if (!user) return;
    // Con merge, como el GPS (G02); la ubicación sí se quita, como antes: fuera de turno no se guarda dónde está.
    setDoc(doc(db, 'conductores', user.uid), { activo: false, nombre: nombre || '', ubicacion: deleteField() }, { merge: true }).catch(() => {});
  }, [activo, fase, nombre]);

  useEffect(() => {
    if (!activo) { setSolicitudes([]); solicitudesIdsRef.current.clear(); return; }
    // G27: el MISMO plazo con que el celular del pasajero da su búsqueda por agotada (configApp.js), no uno aparte.
    const VENTANA_MS = BUSQUEDA.segundos * 1000;
    // SEGUNDA LEY — la lista vive en estadosViaje.js, y una prueba la ata a
    // firestore.rules para que no puedan separarse en silencio.
    const q = query(collection(db, 'viajes'), where('estado', 'in', ESTADOS_MERCADO));
    const unsub = onSnapshot(q, (snap) => {
      const ahora = Date.now();
      const tsDe = (v) => new Date(v.nuevaOferta || v.fechaSolicitud).getTime();
      const vigentes = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(v => {
          if (!v.nuevaOferta && !v.fechaSolicitud) return false;
          // ¿Le toca? Tipo de vehículo (los mototaxistas ADEMÁS ven los mandados) y radio del viaje: leTocaElViaje.js,
          // la MISMA regla con la que el servidor decide a quién le suena el aviso (G04, atada por prueba).
          const km = (ubicacionRef.current && v.pasajeroLat && v.pasajeroLng)
            ? calcularDistanciaKm(ubicacionRef.current.lat, ubicacionRef.current.lng, v.pasajeroLat, v.pasajeroLng) : undefined;
          if (porQueNoLeToca(v, tipoVehiculo, km)) return false;
          const ts = tsDe(v);
          const edad = ahora - ts;
          if (edad < 0 || edad > VENTANA_MS) return false;
          const descartadoEn = descartadosRef.current[v.id];
          if (descartadoEn && ts <= new Date(descartadoEn).getTime()) return false;
          return true;
        })
        .sort((a, b) => tsDe(b) - tsDe(a))
        .slice(0, 5);

      const nuevas = vigentes.filter(v => !solicitudesIdsRef.current.has(v.id) && !v.nuevaOferta);
      if (nuevas.length > 0) sonarAlerta();
      solicitudesIdsRef.current = new Set(vigentes.map(v => v.id));
      setSolicitudes(vigentes);
    });

    // Refresco automático: quita solicitudes vencidas aunque nadie toque nada
    const intervaloLimpieza = setInterval(() => {
      const ahora = Date.now();
      const tsDe = (v) => new Date(v.nuevaOferta || v.fechaSolicitud).getTime();
      setSolicitudes(prev => prev.filter(v => {
        const edad = ahora - tsDe(v);
        return edad >= 0 && edad <= VENTANA_MS;
      }));
    }, 10000);

    // Despertador: reconecta la búsqueda cada 10 segundos para que las solicitudes lleguen rápido
    const intervaloRefresco = setInterval(() => {
      setRefrescoListener(r => r + 1);
    }, 10000);

    return () => { unsub(); clearInterval(intervaloLimpieza); clearInterval(intervaloRefresco); };
  }, [activo, tipoVehiculo, refrescoListener]);

  const rechazarSolicitud = useCallback((idViaje) => {
    descartadosRef.current[idViaje] = new Date().toISOString();
    setSolicitudes(prev => prev.filter(s => s.id !== idViaje));
    solicitudesIdsRef.current.delete(idViaje);
  }, []);

  useEffect(() => {
    if (!viajeActual?.id || !fase) return;
    const unsub = onSnapshot(doc(db, 'viajes', viajeActual.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.respuestaPasajero) recibirMensajePasajero(data.respuestaPasajero);
        if (data.estado === 'cancelado' && data.canceladoPor === 'pasajero') {
          clearInterval(contadorRef.current);
          setFase('cancelado_pasajero');
          setViajeActual({ ...viajeActual, razonCancelacion: data.razonCancelacion });
        }
        // G20: si el SERVIDOR cerró el viaje (vencido o expirado), el conductor sale de él y una ventanita le dice por
        // qué. Antes se quedaba en «voy a recoger» o «en viaje» de un viaje que ya no existía. Al conductor ya lo soltó
        // el servidor (`onViajeCerrado`), así que aquí no se escribe nada: solo se deja de enseñar el viaje.
        if (ESTADOS_QUE_CIERRA_EL_SERVIDOR.includes(data.estado)) {
          clearInterval(contadorRef.current);
          setAviso(avisoDelCierre(data, 'conductor'));
          soltarmeDelViaje('sin escribir');
          return;
        }
        if (data.fase === 'en_viaje' && fase !== 'en_viaje') {
          setFase('en_viaje');
          setTiempoLlegada(null); setDistancia(null);
          geocodificarDestino(data.destino);
        }
      }
    });
    return () => unsub();
    // G57: soltarmeDelViaje('sin escribir') usa setters y refs, que no cambian entre dibujos, y `configApp` solo para
    // reponer el contador de espera: si viniera de un dibujo anterior, lo peor es un contador con el tiempo de antes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viajeActual, fase, recibirMensajePasajero]);

  // G60: el destino escrito se convierte en punto con la pieza común (direccionDePunto.js); si falla, no se pinta, como antes.
  const geocodificarDestino = (destinoTexto) => {
    puntoDeDireccion(geocodificadorDe(window.google), destinoTexto, (r) => {
      if (r.ok) setDestinoCoords({ lat: r.lat, lng: r.lng });
    });
  };

  const iniciarFase1 = (viaje) => {
    setViajeActual(viaje);
    setFase('recogiendo');
    faseRef.current = 'recogiendo';
    if (viaje.pasajeroLat && viaje.pasajeroLng) {
      setUbicacionPasajero({ lat: viaje.pasajeroLat, lng: viaje.pasajeroLng });
    }
  };

  // REGLA 9. Este aviso NO es de cortesía: `conductorEnPunto` es justo lo que
  // escucha la app del pasajero para enseñarle «tu conductor llegó»
  // (Solicitar.js:618). Si esta escritura falla y nadie lo dice, el conductor está
  // en la puerta y el pasajero sigue esperando dentro sin saberlo.
  const llegueAlPunto = async () => {
    if (!viajeActual) return;
    // Si no entra, NO se avanza (el candado dice por qué y se puede reintentar).
    const r = await correr(() => updateDoc(doc(db, 'viajes', viajeActual.id), { conductorEnPunto: true, fase: 'en_punto', tiempoEspera: new Date().toISOString() }),
      'llegue', 'Le avisamos al pasajero.', 'avisar que llegaste');
    if (!r || !r.ok) return;
    setRespuestaPasajero(null);
    setFase('en_punto');
    setContador(segundosDeEspera(configApp)); // G26: la misma cuenta que el reloj del pasajero (configApp.js)
    geocodificarDestino(viajeActual.destino);
    contadorRef.current = setInterval(() => {
      setContador(prev => {
        if (prev <= 1) { clearInterval(contadorRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // REGLA 9. `fase: 'en_viaje'` es lo que mira la app del pasajero para pasar a la
  // pantalla del viaje en marcha (Solicitar.js:627), y lo que el panel enseña como
  // «En viaje» (admin/Viajes.js:63). Si falla callado, el viaje ha empezado para
  // el conductor y para nadie más.
  const iniciarViaje = async () => {
    if (!viajeActual) return;
    clearInterval(contadorRef.current);
    const r = await correr(() => updateDoc(doc(db, 'viajes', viajeActual.id), { fase: 'en_viaje' }),
      'iniciar', 'Viaje iniciado.', 'iniciar el viaje');
    if (!r || !r.ok) return;
    setFase('en_viaje');
    geocodificarDestino(viajeActual.destino);
  };

  const intentarIniciar = () => {
    if (!viajeActual) return;
    // Si el viaje tiene código de seguridad, pedirlo. Si no (pasajero registrado antes), iniciar directo.
    // REGLAS 5 y 11 — el código ya no viene dentro del viaje: aquí solo llega el
    // aviso de que lo hay. El código vive en el cajón privado, que esta app NO
    // puede abrir. Los viajes viejos traen 'codigoSeguridad' y siguen valiendo.
    if (viajeActual.tieneCodigo || viajeActual.codigoSeguridad) {
      setCodigoIngresado('');
      setErrorCodigo('');
      setMostrarCodigo(true);
    } else {
      iniciarViaje();
    }
  };

  // REGLAS 5 y 11 — antes se comparaba AQUI, en el celular del conductor, lo que
  // obligaba a que el código viniera dentro del viaje... donde lo leía cualquiera
  // que mirase el mercado. Ahora la comparación la hace el servidor y esta app
  // nunca ve el código: solo pregunta si el que le dijeron es el bueno.
  // Los viajes viejos, que traen el código dentro, se siguen comparando como antes.
  const verificarCodigo = async () => {
    setErrorCodigo('');
    const acertar = () => {
      setMostrarCodigo(false);
      setCodigoIngresado('');
      setErrorCodigo('');
      iniciarViaje();
    };
    if (!viajeActual.tieneCodigo && viajeActual.codigoSeguridad) {
      if (codigoIngresado.trim() === String(viajeActual.codigoSeguridad).trim()) acertar();
      else setErrorCodigo('Código incorrecto. Verifícalo con el pasajero');
      return;
    }
    // El candado bloquea el doble toque; el error se sigue diciendo DENTRO de la ventanita del código, donde el
    // conductor lo está escribiendo («ya avisé yo»: el candado no le pone otra encima).
    const r = await correr(async () => {
      try {
        const preguntar = httpsCallable(getFunctions(), 'verificarCodigoViaje');
        const res = await preguntar({ viajeId: viajeActual.id, codigo: codigoIngresado.trim() });
        return !!(res && res.data && res.data.ok);
      } catch (e) {
        apuntarRechazo('AppConductor.js (verificarCodigo)', e);
        // G40: el motivo lo da la pieza única, igual que el código de descuento (antes: «Revisa tu conexión» siempre).
        setErrorCodigo(motivoDeRechazo(e, 'comprobar el código').texto);
        return { ok: false, avisado: true };
      }
    }, 'codigo', 'Código correcto.', 'comprobar el código');
    if (!r || !r.ok) return;
    // Se inicia DESPUÉS de soltar el candado: iniciar el viaje pasa por él también.
    if (r.valor) acertar();
    else setErrorCodigo('Código incorrecto. Verifícalo con el pasajero');
  };

  // REGLA 9, y con la misma cautela que cerrarViajeFinal: si la cancelación no
  // entra, NO se limpia la pantalla. Limpiarla dejaría el viaje vivo en el
  // servidor —el pasajero seguiría esperando a un conductor que ya se fue— y sin
  // forma de reintentar, porque el viaje ya no estaría delante.
  const cancelarViaje = async (razon) => {
    clearInterval(contadorRef.current);
    if (viajeActual) {
      const r = await correr(() => updateDoc(doc(db, 'viajes', viajeActual.id), { estado: 'cancelado_conductor', canceladoPor: 'conductor', razonCancelacion: razon }),
        'cancelar', 'Viaje cancelado.', 'cancelar el viaje');
      if (!r || !r.ok) return;
    }
    soltarmeDelViaje();
  };

  const [mostrarCodigoDescuento, setMostrarCodigoDescuento] = useState(false);
  const [codigoDescuentoIngresado, setCodigoDescuentoIngresado] = useState('');
  const [errorCodigoDescuento, setErrorCodigoDescuento] = useState('');

  // G57 (29-sep-2026) · SOLTARME DEL VIAJE: la ficha queda libre y la pantalla sale del viaje, en UN solo sitio.
  // Antes estaba escrito a mano en cuatro (cancelar, terminar, «El pasajero canceló» y el cierre del servidor) y cada
  // uno limpiaba una lista distinta: tras «El pasajero canceló» o un cierre del servidor, el viaje SIGUIENTE enseñaba
  // el último mensaje del pasajero anterior y su tiempo de llegada. Tres formas de llamarla:
  //   · sin nada       → el viaje ya se cerró por el candado (cancelar, terminar): se escribe sin volver a trancar la
  //                      pantalla —el candado ya dijo su verdad— y, si no entra, se AVISA; la pantalla sale igual,
  //                      porque el viaje ya no existe y quedarse en él no deja reintentar nada.
  //   · 'por el candado' → «El pasajero canceló»: la escritura ES el botón, así que pasa por el candado y, si no entra,
  //                      NO sale (el conductor se queda para reintentar).
  //   · 'sin escribir' → lo cerró el servidor (G20): `onViajeCerrado` ya soltó al conductor.
  // ¿Y por qué escribe la app si el servidor también suelta (`onViajeCerrado`)? Porque el servidor lo hace DESPUÉS y
  // una sola vez: si esa función falla (solo lo apunta en su registro) o se retrasa, el conductor se queda «ocupado»
  // y `confirmarConductor` le rechaza los viajes siguientes. Las dos escriben lo mismo: da igual cuál llegue primero.
  // Con merge (G02) y siempre `enViajeId: null`: la app nunca PONE un viaje, eso lo hace el servidor al confirmar.
  const soltarmeDelViaje = async (modo) => {
    const user = auth.currentUser;
    if (user && modo !== 'sin escribir') {
      const libre = () => setDoc(doc(db, 'conductores', user.uid), { ocupado: false, enViajeId: null }, { merge: true });
      if (modo === 'por el candado') {
        const r = await correr(libre, 'volver', 'Listo para recibir viajes.', 'liberarte para recibir viajes');
        if (!r || !r.ok) return false;
      } else {
        libre().catch((e) => { apuntarRechazo('AppConductor.js (soltar el viaje)', e); setAviso(motivoDeRechazo(e, 'liberarte para recibir viajes')); });
      }
    }
    setMostrarCancelacion(false); setMostrarCodigo(false);
    setMostrarCodigoDescuento(false); setCodigoDescuentoIngresado(''); setErrorCodigoDescuento('');
    setFase(null); faseRef.current = null;
    setViajeActual(null); setTiempoLlegada(null); setDistancia(null);
    setRespuestaPasajero(null); setMensajeGrande(null); ultimoMensajeRef.current = null;
    setUbicacionPasajero(null); setDestinoCoords(null); setActivo(true); setContador(segundosDeEspera(configApp));
    return true;
  };

  // REGLA 9 · «Nada se rechaza en silencio». Y aquí hace falta MÁS que avisar.
  //
  // Hasta el 5-sep-2026 esto se tragaba el fallo con `catch (err) {}` Y LIMPIABA
  // LA PANTALLA IGUAL. O sea: el viaje NO quedaba marcado como terminado en el
  // servidor, el conductor ya no lo tenía delante, y no había ningún botón para
  // volver a intentarlo. El viaje se quedaba colgado para siempre y el conductor
  // se iba creyendo que había cobrado. Es la peor de las 16 de este archivo, y no
  // por poco: las otras callan; esta además borra la forma de arreglarlo.
  //
  // Por eso, si falla, se AVISA y se SALE SIN LIMPIAR: el viaje se queda en la
  // pantalla y el botón sigue ahí. Volver a tocarlo lo reintenta.
  const cerrarViajeFinal = async () => {
    if (viajeActual) {
      const r = await correr(async () => {
        await updateDoc(doc(db, 'viajes', viajeActual.id), { estado: 'finalizado', fase: 'finalizado' });
        setDatosCalificacion({ viajeId: viajeActual.id, nombrePasajero: viajeActual.pasajeroNombre || 'Pasajero', pasajeroId: viajeActual.pasajeroId || '' });
      }, 'cerrar', 'Viaje cerrado.', 'cerrar el viaje');
      if (!r || !r.ok) {
        // El modal del código de descuento («ANTES DE FINALIZAR») está a zIndex
        // 99999 y la ventanita a 10000: si se queda abierto, TAPA el aviso. Se
        // llega aquí desde su botón «Omitir», así que hay que cerrarlo antes. Sin
        // esto, el conductor toca «Omitir», falla el cierre del viaje y no ve nada
        // — reintenta a ciegas, que es justo lo que la REGLA 9 quiere evitar. Lo
        // encontró la segunda opinión sobre este mismo arreglo a medio hacer.
        // (El motivo lo dice el candado; y se SALE SIN LIMPIAR: el botón sigue ahí.)
        if (r) setMostrarCodigoDescuento(false);
        return;
      }
    }
    soltarmeDelViaje();
  };

  const finalizarViaje = async () => {
    clearInterval(contadorRef.current);
    if (viajeActual?.descuentoInfo && !viajeActual.descuentoInfo.consumido) {
      setCodigoDescuentoIngresado('');
      setErrorCodigoDescuento('');
      setMostrarCodigoDescuento(true);
      return;
    }
    await cerrarViajeFinal();
  };

  const verificarCodigoDescuento = async () => {
    if (!viajeActual) return;
    // El candado bloquea el doble toque (el servidor cobra el descuento: dos toques no pueden ser dos cobros); el
    // error se sigue diciendo DENTRO de la ventanita del código («ya avisé yo»). Y el motivo ya no se calcula aquí
    // («si trae espacios es del servidor»): lo da motivoDeRechazo, la pieza única, que sabe lo mismo (SEGUNDA LEY).
    await correr(async () => {
    try {
      // REGLA 7 — esto ya NO se hace aquí. Hasta el 24-ago-2026 este teléfono
      // comparaba el código, marcaba el descuento como consumido y SE ACREDITABA
      // los créditos a sí mismo. Ahora lo hace el servidor de una pieza
      // (functions: consumirDescuentoViaje): o se marca y se cobra, o no pasa nada.
      // OJO: el código sigue viajando dentro del viaje, que el conductor puede
      // leer — esconderlo (como el código de seguridad, en viajes/{id}/privado)
      // es trabajo aparte, anotado en la función del servidor.
      const consumir = httpsCallable(getFunctions(), 'consumirDescuentoViaje');
      const respuesta = await consumir({ viajeId: viajeActual.id, codigo: codigoDescuentoIngresado });
      const montoDescuento = (respuesta && respuesta.data && respuesta.data.monto) || 0;
      const nuevoSaldo = respuesta && respuesta.data && respuesta.data.saldo;
      if (typeof nuevoSaldo === 'number') setSaldoCreditos(nuevoSaldo);

      // Cerrar el modal del código y mostrar la pantalla de celebración.
      // El cierre real del viaje (y el paso a calificación) ocurre cuando el
      // conductor toca "Continuar" en la celebración.
      setMostrarCodigoDescuento(false);
      setCodigoDescuentoIngresado('');
      setErrorCodigoDescuento('');
      setSaldoVirtualRecibido(montoDescuento);
    } catch (e) {
      // El motivo lo explica el servidor ("Código incorrecto. Verifícalo con el
      // pasajero", "Ese descuento ya se cobró"…) y la pieza única lo respeta tal cual.
      apuntarRechazo('AppConductor.js (verificarCodigoDescuento)', e);
      setErrorCodigoDescuento(motivoDeRechazo(e, 'comprobar el código de descuento').texto);
      return { ok: false, avisado: true };
    }
    }, 'descuento', 'Descuento cobrado.', 'comprobar el código de descuento');
  };

  const omitirCodigoDescuento = async () => {
    await cerrarViajeFinal();
  };
  const enviarMensajeConductor = async () => {
    if (!textoChat.trim() || !viajeActual?.id) return;
    // Antes: `catch (e) {}` — si no salía, nadie lo decía. Y dos Enter seguidos lo mandaban dos veces.
    // Qué se escribe lo decide chatDelViaje.js (G96), la misma pieza que usa el pasajero.
    await correr(async () => {
      await enviarAlChat(textoChat);
      setTextoChat('');
    }, 'mensaje', 'Mensaje enviado.', 'enviar el mensaje');
  };
  if (enLlamada) return <Llamada viajeId={viajeActual?.id} miRol="conductor" nombreOtro={viajeActual?.pasajeroNombre || 'Pasajero'} onCerrar={() => { setEnLlamada(false); }} />;
  if (llamadaEntrante) return <Llamada viajeId={viajeActual?.id} miRol="entrante" nombreOtro={viajeActual?.pasajeroNombre || 'Pasajero'} onCerrar={() => { setLlamadaEntrante(false); }} />;
  const llamarQuienRecibe = () => {
    const tel = viajeActual?.mensajeria?.recibeTel;
    if (tel) window.location.href = 'tel:' + tel;
  };
  const tarjetaMensajeria = (viajeActual?.tipo === 'Mensajería' && viajeActual?.mensajeria) ? (
    <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '14px', marginBottom: '14px', border: '1px solid #FF7A2F' }}>
      <p style={{ color: '#FF7A2F', fontSize: '11px', margin: '0 0 8px', letterSpacing: '1px', fontWeight: '900' }}>📦 DATOS DEL MANDADO</p>
      {viajeActual.mensajeria.queEnvia && <p style={{ color: '#1A1A1E', fontSize: '15px', margin: '0 0 4px', fontWeight: 'bold' }}>📦 Paquete: {viajeActual.mensajeria.queEnvia}</p>}
      <p style={{ color: '#1A1A1E', fontSize: '14px', margin: '0 0 3px' }}>📍 Recoger en: {viajeActual.origen}</p>
      <p style={{ color: '#1A1A1E', fontSize: '14px', margin: '0 0 3px' }}>🏁 Entregar en: {viajeActual.destino}</p>
      {viajeActual.mensajeria.recibeNombre && <p style={{ color: '#1A1A1E', fontSize: '14px', margin: '0 0 3px' }}>🙋 Recibe: {viajeActual.mensajeria.recibeNombre}</p>}
      {viajeActual.mensajeria.nota && <p style={{ color: '#FF7A2F', fontSize: '13px', margin: '0 0 8px', fontWeight: 'bold' }}>📝 {viajeActual.mensajeria.nota}</p>}
      {viajeActual.mensajeria.recibeTel && (
        <button onClick={llamarQuienRecibe} style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #2ECC71, #27AE60)', border: 'none', borderRadius: '12px', color: '#FFFFFF', fontSize: '14px', fontWeight: '900', cursor: 'pointer', marginTop: '4px' }}>📞 Llamar a quien recibe ({viajeActual.mensajeria.recibeTel})</button>
      )}
    </div>
  ) : null;
  const esMandado = viajeActual?.tipo === 'Mensajería';
  const comunicacionCompacta = (
    <div style={{ marginBottom: '10px' }}>
      <button onClick={() => setEnLlamada(true)} style={{ width: '100%', marginBottom: '6px', padding: '9px', background: 'linear-gradient(135deg, #2ECC71, #27AE60)', border: 'none', borderRadius: '10px', color: '#FFFFFF', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>📞 {esMandado ? 'Llamar a quien envía' : 'Llamar al pasajero'}</button>
      <div style={{ background: '#FFFFFF', borderRadius: '10px', padding: '7px', border: '1px solid #ECECEF' }}>
        <div style={{ maxHeight: '70px', overflowY: 'auto', marginBottom: '5px' }}>
          {mensajesChat.length === 0 && <p style={{ color: '#6B7280', fontSize: '11px', textAlign: 'center', margin: '3px 0' }}>Sin mensajes aún</p>}
          {mensajesChat.map(m => (
            <div key={m.id} style={{ display: 'flex', justifyContent: m.autor === 'conductor' ? 'flex-end' : 'flex-start', marginBottom: '4px' }}>
              <div style={{ background: m.autor === 'conductor' ? 'linear-gradient(135deg, #FF7A2F, #D6357E)' : '#ECECEF', borderRadius: '9px', padding: '5px 9px', maxWidth: '80%' }}>
                <p style={{ color: m.autor === 'conductor' ? '#FFFFFF' : '#1A1A1E', fontSize: '12px', margin: '0', lineHeight: '1.3' }}>{m.texto}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input value={textoChat} onChange={e => setTextoChat(e.target.value)} onKeyDown={e => e.key === 'Enter' && enviarMensajeConductor()} placeholder="Escribe un mensaje..." style={{ flex: 1, background: '#FFFFFF', border: '1px solid #ECECEF', borderRadius: '8px', padding: '7px 10px', color: '#1A1A1E', fontSize: '13px', outline: 'none' }} />
          <button onClick={enviarMensajeConductor} disabled={!textoChat.trim() || !!ocupado} style={{ padding: '7px 12px', background: textoChat.trim() ? 'linear-gradient(135deg, #FF7A2F, #D6357E)' : '#ECECEF', border: 'none', borderRadius: '8px', color: textoChat.trim() ? '#FFFFFF' : '#6B7280', fontSize: '16px', cursor: textoChat.trim() ? 'pointer' : 'default' }}>{texto('mensaje', '…', '➤')}</button>
        </div>
      </div>
    </div>
  );
  if (datosCalificacion) return <Calificacion tipo={null} viajeId={datosCalificacion.viajeId} nombreCalificado={datosCalificacion.nombrePasajero} calificadoId={datosCalificacion.pasajeroId} quienCalifica="conductor" onFinalizar={() => setDatosCalificacion(null)} />;
  if (verDelMenu === 'historialConductor') return <HistorialConductor onVolver={() => setVerDelMenu(null)} />;
  if (verCreditos) return <Creditos onVolver={() => setVerCreditos(false)} />;
  if (verPerfil) return <MiPerfil onVolver={() => setVerPerfil(false)} />;
  if (verDelMenu === 'ganancias') return <Ganancias onVolver={() => setVerDelMenu(null)} />;
  if (verSeguridad) return <Seguridad onVolver={() => setVerSeguridad(false)} />;
  if (verAyuda) return <AyudaSoporte onVolver={() => setVerAyuda(false)} />;
  if (verConfig) return <Configuracion onVolver={() => setVerConfig(false)} onCerrarSesion={cerrarSesion} />;
  if (verPromociones) return <Promociones onVolver={() => setVerPromociones(false)} />;
  if (celebrando) return <TratoHecho />;

  if (saldoVirtualRecibido !== null) return (
    <CelebracionConductor
      monto={saldoVirtualRecibido}
      onCerrar={() => { setSaldoVirtualRecibido(null); cerrarViajeFinal(); }}
    />
  );

  if (fase === 'cancelado_pasajero') {
    return (
      <div style={{ backgroundColor: '#FFFFFF', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
        {/* REGLA 9 · aquí vive el botón de soltar el viaje, y hasta el 5-sep-2026
            esta pantalla NO tenía dónde pintar el aviso. El botón podía fallar y
            dejar al conductor marcado «ocupado» —sin recibir viajes— sin que nada
            se lo dijera. Es la tercera vez que muerde lo mismo: archivo correcto,
            pantalla equivocada. */}
        <AvisoModal aviso={aviso} onCerrar={() => setAviso(null)} />
        {mensajeGrande && <MensajeGrande mensaje={mensajeGrande} onCerrar={() => setMensajeGrande(null)} />}
        <div style={{ fontSize: '80px', marginBottom: '24px' }}>😕</div>
        <h2 style={{ color: '#1A1A1E', fontSize: '24px', fontWeight: '900', margin: '0 0 12px', textAlign: 'center' }}>El pasajero canceló el viaje</h2>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 8px', textAlign: 'center' }}>Razón: <span style={{ color: '#FF7A2F' }}>{viajeActual?.razonCancelacion || 'No especificada'}</span></p>
        <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 32px', textAlign: 'center' }}>Puedes activarte para recibir nuevos viajes</p>
        {/* Si no entra, se queda en esta pantalla (el candado dice por qué): antes volvía al inicio igual, y el
            conductor quedaba «ocupado» en el servidor sin recibir viajes y sin saberlo. */}
        <button onClick={() => soltarmeDelViaje('por el candado')} disabled={!!ocupado} style={{ width: '100%', padding: '18px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '16px', color: '#FFFFFF', fontSize: '18px', fontWeight: '900', cursor: 'pointer' }}>{texto('volver', 'Un momento…', 'Volver al inicio')}</button>
      </div>
    );
  }

  if (fase === 'recogiendo' || fase === 'en_punto') {
    return (
      <div style={{ backgroundColor: '#FFFFFF', minHeight: '100vh', position: 'relative' }}>
        <AvisoModal aviso={aviso} onCerrar={() => setAviso(null)} />
        {mensajeGrande && <MensajeGrande mensaje={mensajeGrande} onCerrar={() => setMensajeGrande(null)} />}
        {mostrarCancelacion && <ModalCancelacion razones={RAZONES_CANCELACION_CONDUCTOR} onConfirmar={cancelarViaje} onCerrar={() => setMostrarCancelacion(false)} ocupado={ocupado} />}
        {mostrarCodigo && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9998, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div style={{ background: '#FFFFFF', borderRadius: '28px', padding: '32px 24px', width: '100%', maxWidth: '420px', border: '3px solid #FFCF4D', textAlign: 'center' }}>
              <div style={{ fontSize: '60px', marginBottom: '12px' }}>🔐</div>
              <h2 style={{ color: '#1A1A1E', fontSize: '22px', fontWeight: '900', margin: '0 0 8px' }}>Código de seguridad</h2>
              <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 20px', lineHeight: '1.5' }}>Pídele al pasajero su código de 4 dígitos para iniciar el viaje</p>
              <input
                value={codigoIngresado}
                onChange={e => { setCodigoIngresado(e.target.value.replace(/[^0-9]/g, '').slice(0, 4)); setErrorCodigo(''); }}
                type="tel"
                inputMode="numeric"
                placeholder="••••"
                style={{ width: '100%', background: '#FFFFFF', border: `2px solid ${errorCodigo ? '#FF4444' : '#ECECEF'}`, borderRadius: '16px', padding: '18px', color: '#1A1A1E', fontSize: '32px', fontWeight: '900', textAlign: 'center', letterSpacing: '12px', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' }}
              />
              {errorCodigo && <p style={{ color: '#FF4444', fontSize: '13px', margin: '0 0 12px', fontWeight: 'bold' }}>{errorCodigo}</p>}
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button onClick={() => { setMostrarCodigo(false); setCodigoIngresado(''); setErrorCodigo(''); }} disabled={!!ocupado} style={{ flex: 1, padding: '16px', background: '#FFFFFF', border: '1px solid #ECECEF', borderRadius: '16px', color: '#6B7280', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={verificarCodigo} disabled={codigoIngresado.length < 4 || !!ocupado} style={{ flex: 2, padding: '16px', background: codigoIngresado.length < 4 ? '#ECECEF' : 'linear-gradient(135deg, #2ECC71, #27AE60)', border: 'none', borderRadius: '16px', color: codigoIngresado.length < 4 ? '#6B7280' : '#FFFFFF', fontSize: '16px', fontWeight: '900', cursor: codigoIngresado.length < 4 ? 'default' : 'pointer' }}>{texto('codigo', 'Comprobando…', '✅ Verificar')}</button>
              </div>
            </div>
          </div>
        )}
        <MapaConRuta
          desde={ubicacion}
          hasta={fase === 'en_punto' ? destinoCoords : ubicacionPasajero}
          colorRuta={fase === 'en_punto' ? '#FF7A2F' : '#2ECC71'}
          tipo={viajeActual?.tipo}
          centrarEn="desde"
          tarjetaRef={tarjetaRef}
          onTiempo={(t, d) => { setTiempoLlegada(t); setDistancia(d); }}
        />
        <div style={{ position: 'absolute', top: '16px', left: '16px', right: '16px', zIndex: 10, background: 'rgba(255,255,255,0.95)', borderRadius: '16px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ color: fase === 'en_punto' ? '#FF7A2F' : '#2ECC71', fontSize: '11px', margin: '0', letterSpacing: '1px', fontWeight: 'bold' }}>{fase === 'en_punto' ? '🏁 RUTA AL DESTINO' : '🚗 YENDO A RECOGER'}</p>
            <p style={{ color: '#1A1A1E', fontSize: '15px', fontWeight: '900', margin: '2px 0 0' }}>{fase === 'en_punto' ? viajeActual?.destino : viajeActual?.origen}</p>
          </div>
          {tiempoLlegada && <div style={{ textAlign: 'right' }}><p style={{ color: '#FF7A2F', fontSize: '20px', fontWeight: '900', margin: '0' }}>⏱️ {tiempoLlegada}</p><p style={{ color: '#6B7280', fontSize: '11px', margin: '0' }}>{distancia}</p></div>}
        </div>
        {respuestaPasajero && (
          <div onClick={() => setMensajeGrande(respuestaPasajero)} style={{ position: 'absolute', top: '90px', left: '16px', right: '16px', zIndex: 10, background: 'rgba(255, 122, 47, 0.95)', borderRadius: '12px', padding: '12px 16px', cursor: 'pointer' }}>
            <p style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 'bold', margin: '0' }}>💬 Pasajero: "{respuestaPasajero}"</p>
          </div>
        )}
        <div ref={tarjetaRef} style={{ position: 'absolute', bottom: '0', left: '0', right: '0', zIndex: 10, background: 'rgba(255,255,255,0.97)', borderRadius: '24px 24px 0 0', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div><p style={{ color: '#6B7280', fontSize: '10px', margin: '0' }}>PASAJERO</p><p style={{ color: '#1A1A1E', fontSize: '14px', fontWeight: 'bold', margin: '4px 0 0' }}>{viajeActual?.pasajeroNombre || 'Pasajero'}</p></div>
            <div style={{ textAlign: 'right' }}><p style={{ color: '#6B7280', fontSize: '10px', margin: '0' }}>TARIFA</p><p style={{ color: '#2ECC71', fontSize: '20px', fontWeight: '900', margin: '4px 0 0' }}>{viajeActual?.tarifa}</p></div>
          </div>
          {tarjetaMensajeria}
          {fase === 'recogiendo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {comunicacionCompacta}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setMostrarCancelacion(true)} disabled={!!ocupado} style={{ flex: 1, padding: '14px', background: 'transparent', border: '1px solid #FF4444', borderRadius: '14px', color: '#FF4444', fontSize: '14px', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={llegueAlPunto} disabled={!!ocupado} style={{ flex: 2, padding: '16px', background: 'linear-gradient(135deg, #2ECC71, #27AE60)', border: 'none', borderRadius: '16px', color: '#FFFFFF', fontSize: '16px', fontWeight: '900', cursor: 'pointer' }}>{texto('llegue', 'Avisando…', '📍 Llegué al punto')}</button>
              </div>
            </div>
          )}
          {fase === 'en_punto' && (
            <div>
              <div style={{ background: contador <= 60 ? 'rgba(255,68,68,0.15)' : 'rgba(255,207,77,0.1)', borderRadius: '16px', padding: '16px', marginBottom: '16px', border: `1px solid ${contador <= 60 ? '#FF4444' : '#FFCF4D'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ color: '#6B7280', fontSize: '11px', margin: '0' }}>TIEMPO DE ESPERA</p>
                  <p style={{ color: contador <= 60 ? '#FF4444' : '#FF7A2F', fontSize: '11px', margin: '4px 0 0' }}>{contador === 0 ? '⚠️ Tiempo agotado' : 'Esperando al pasajero...'}</p>
                </div>
                <p style={{ color: contador <= 60 ? '#FF4444' : '#FF7A2F', fontSize: '36px', fontWeight: '900', margin: '0', fontVariantNumeric: 'tabular-nums' }}>{minutosSegundos(contador)}</p>
              </div>
              {respuestaPasajero && (
                <div onClick={() => setMensajeGrande(respuestaPasajero)} style={{ background: 'rgba(255,122,47,0.15)', borderRadius: '12px', padding: '12px 16px', marginBottom: '12px', border: '1px solid #FF7A2F', cursor: 'pointer' }}>
                  <p style={{ color: '#FF7A2F', fontSize: '13px', fontWeight: 'bold', margin: '0' }}>💬 Pasajero: "{respuestaPasajero}"</p>
                </div>
              )}
              <button onClick={() => setEnLlamada(true)} style={{ width: '100%', marginBottom: '10px', padding: '14px', background: 'linear-gradient(135deg, #2ECC71, #27AE60)', border: 'none', borderRadius: '14px', color: '#FFFFFF', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}>📞 Llamar al pasajero</button>
              <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: '10px', border: '1px solid #ECECEF', marginBottom: '12px' }}>
                <div style={{ maxHeight: '120px', overflowY: 'auto', marginBottom: '8px' }}>
                  {mensajesChat.length === 0 && <p style={{ color: '#6B7280', fontSize: '13px', textAlign: 'center', margin: '8px 0' }}>Sin mensajes aún</p>}
                  {mensajesChat.map(m => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: m.autor === 'conductor' ? 'flex-end' : 'flex-start', marginBottom: '6px' }}>
                      <div style={{ background: m.autor === 'conductor' ? 'linear-gradient(135deg, #FF7A2F, #D6357E)' : '#ECECEF', borderRadius: '12px', padding: '8px 12px', maxWidth: '80%' }}>
                        <p style={{ color: m.autor === 'conductor' ? '#FFFFFF' : '#1A1A1E', fontSize: '13px', margin: '0', lineHeight: '1.4' }}>{m.texto}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input value={textoChat} onChange={e => setTextoChat(e.target.value)} onKeyDown={e => e.key === 'Enter' && enviarMensajeConductor()} placeholder="Escribe un mensaje..." style={{ flex: 1, background: '#FFFFFF', border: '1px solid #ECECEF', borderRadius: '10px', padding: '10px 12px', color: '#1A1A1E', fontSize: '14px', outline: 'none' }} />
                  <button onClick={enviarMensajeConductor} disabled={!textoChat.trim() || !!ocupado} style={{ padding: '10px 16px', background: textoChat.trim() ? 'linear-gradient(135deg, #FF7A2F, #D6357E)' : '#ECECEF', border: 'none', borderRadius: '10px', color: textoChat.trim() ? '#FFFFFF' : '#6B7280', fontSize: '18px', cursor: textoChat.trim() ? 'pointer' : 'default' }}>{texto('mensaje', '…', '➤')}</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setMostrarCancelacion(true)} disabled={!!ocupado} style={{ flex: 1, padding: '14px', background: 'transparent', border: '1px solid #FF4444', borderRadius: '14px', color: '#FF4444', fontSize: '14px', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={intentarIniciar} disabled={!!ocupado} style={{ flex: 2, padding: '16px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '16px', color: '#FFFFFF', fontSize: '16px', fontWeight: '900', cursor: 'pointer' }}>{texto('iniciar', 'Iniciando…', '🚀 Iniciar viaje')}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (fase === 'en_viaje' && viajeActual) {
    return (
      <div style={{ backgroundColor: '#FFFFFF', minHeight: '100vh', position: 'relative' }}>
        <AvisoModal aviso={aviso} onCerrar={() => setAviso(null)} />
        {mensajeGrande && <MensajeGrande mensaje={mensajeGrande} onCerrar={() => setMensajeGrande(null)} />}
        {mostrarCodigoDescuento && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9998, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div style={{ background: '#FFFFFF', borderRadius: '28px', padding: '32px 24px', width: '100%', maxWidth: '420px', border: '3px solid #2ECC71', textAlign: 'center' }}>
              <div style={{ fontSize: '60px', marginBottom: '12px' }}>🎁</div>
              <h2 style={{ color: '#1A1A1E', fontSize: '20px', fontWeight: '900', margin: '0 0 8px' }}>Código de promoción</h2>
              <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 20px', lineHeight: '1.5' }}>Este viaje tiene un descuento activo. Pídele al pasajero su código de 4 dígitos para recibir tu saldo</p>
              <input
                value={codigoDescuentoIngresado}
                onChange={e => { setCodigoDescuentoIngresado(e.target.value.replace(/[^0-9]/g, '').slice(0, 4)); setErrorCodigoDescuento(''); }}
                type="tel" inputMode="numeric" placeholder="••••"
                style={{ width: '100%', background: '#FFFFFF', border: `2px solid ${errorCodigoDescuento ? '#FF4444' : '#ECECEF'}`, borderRadius: '16px', padding: '18px', color: '#1A1A1E', fontSize: '32px', fontWeight: '900', textAlign: 'center', letterSpacing: '12px', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' }}
              />
              {errorCodigoDescuento && <p style={{ color: '#FF4444', fontSize: '13px', margin: '0 0 12px', fontWeight: 'bold' }}>{errorCodigoDescuento}</p>}
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button onClick={omitirCodigoDescuento} disabled={!!ocupado} style={{ flex: 1, padding: '16px', background: '#FFFFFF', border: '1px solid #ECECEF', borderRadius: '16px', color: '#6B7280', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>{texto('cerrar', 'Cerrando…', 'Omitir')}</button>
                <button onClick={verificarCodigoDescuento} disabled={codigoDescuentoIngresado.length < 4 || !!ocupado} style={{ flex: 2, padding: '16px', background: codigoDescuentoIngresado.length < 4 ? '#ECECEF' : 'linear-gradient(135deg, #2ECC71, #27AE60)', border: 'none', borderRadius: '16px', color: codigoDescuentoIngresado.length < 4 ? '#6B7280' : '#FFFFFF', fontSize: '15px', fontWeight: '900', cursor: codigoDescuentoIngresado.length < 4 ? 'default' : 'pointer' }}>{texto('descuento', 'Comprobando…', '✅ Verificar')}</button>
              </div>
            </div>
          </div>
        )}
        <MapaConRuta desde={ubicacion} hasta={destinoCoords} colorRuta="#FF7A2F" tipo={viajeActual.tipo} centrarEn="desde" tarjetaRef={tarjetaRef} onTiempo={(t, d) => { setTiempoLlegada(t); setDistancia(d); }} />
        <div style={{ position: 'absolute', top: '16px', left: '16px', right: '16px', zIndex: 10, background: 'rgba(255,255,255,0.95)', borderRadius: '16px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><p style={{ color: '#FF7A2F', fontSize: '11px', margin: '0', letterSpacing: '1px', fontWeight: 'bold' }}>🚀 VIAJE EN CURSO</p><p style={{ color: '#1A1A1E', fontSize: '15px', fontWeight: '900', margin: '2px 0 0' }}>🏁 {viajeActual.destino}</p></div>
          {tiempoLlegada && <div style={{ textAlign: 'right' }}><p style={{ color: '#FF7A2F', fontSize: '20px', fontWeight: '900', margin: '0' }}>⏱️ {tiempoLlegada}</p><p style={{ color: '#6B7280', fontSize: '11px', margin: '0' }}>{distancia}</p></div>}
        </div>
        <div ref={tarjetaRef} style={{ position: 'absolute', bottom: '0', left: '0', right: '0', zIndex: 10, background: 'rgba(255,255,255,0.97)', borderRadius: '24px 24px 0 0', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div><p style={{ color: '#6B7280', fontSize: '10px', margin: '0' }}>PASAJERO</p><p style={{ color: '#1A1A1E', fontSize: '14px', fontWeight: 'bold', margin: '4px 0 0' }}>{viajeActual.pasajeroNombre || 'Pasajero'}</p></div>
            <div style={{ textAlign: 'right' }}><p style={{ color: '#6B7280', fontSize: '10px', margin: '0' }}>TARIFA</p><p style={{ color: '#2ECC71', fontSize: '20px', fontWeight: '900', margin: '4px 0 0' }}>{viajeActual.tarifa}</p></div>
          </div>
          {tarjetaMensajeria}
          {comunicacionCompacta}
          <button onClick={() => { if (viajeActual?.tipo === 'Mensajería') { setConfirmarFin(true); } else { finalizarViaje(); } }} disabled={!!ocupado} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '16px', color: '#FFFFFF', fontSize: '18px', fontWeight: '900', cursor: 'pointer' }}>{texto('cerrar', 'Cerrando…', '🏁 Finalizar viaje')}</button>
          {confirmarFin && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.88)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
              <div style={{ background: '#FFFFFF', borderRadius: '24px', padding: '28px 24px', width: '100%', maxWidth: '420px', border: '2px solid #FF7A2F' }}>
                <div style={{ fontSize: '48px', textAlign: 'center', marginBottom: '8px' }}>📦</div>
                <p style={{ color: '#FF7A2F', fontSize: '13px', margin: '0 0 6px', letterSpacing: '2px', fontWeight: 'bold', textAlign: 'center' }}>ANTES DE FINALIZAR</p>
                <p style={{ color: '#1A1A1E', fontSize: '19px', fontWeight: '900', margin: '0 0 8px', textAlign: 'center' }}>¿Ya entregaste el paquete?</p>
                <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 16px', textAlign: 'center', lineHeight: '1.5' }}>Si finalizas sin entregar, perderás el contacto de quien recibe. Asegúrate de haber entregado.</p>
                {viajeActual?.mensajeria?.recibeNombre && (
                  <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: '14px', marginBottom: '18px', border: '1px solid #ECECEF' }}>
                    <p style={{ color: '#1A1A1E', fontSize: '14px', margin: '0 0 8px', fontWeight: 'bold' }}>🙋 Entregar a: {viajeActual.mensajeria.recibeNombre}</p>
                    {viajeActual.mensajeria.recibeTel && (
                      <button onClick={() => { window.location.href = 'tel:' + viajeActual.mensajeria.recibeTel; }} style={{ width: '100%', padding: '11px', background: 'linear-gradient(135deg, #2ECC71, #27AE60)', border: 'none', borderRadius: '10px', color: '#FFFFFF', fontSize: '14px', fontWeight: '900', cursor: 'pointer' }}>📞 Llamar a quien recibe ({viajeActual.mensajeria.recibeTel})</button>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => setConfirmarFin(false)} style={{ flex: 1, padding: '15px', background: '#FFFFFF', border: '1px solid #ECECEF', borderRadius: '14px', color: '#1A1A1E', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}>No, aún no</button>
                  <button onClick={() => { setConfirmarFin(false); finalizarViaje(); }} disabled={!!ocupado} style={{ flex: 1, padding: '15px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '14px', color: '#FFFFFF', fontSize: '15px', fontWeight: '900', cursor: 'pointer' }}>{texto('cerrar', 'Cerrando…', 'Sí, ya entregué')}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
if (sancionActiva) return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', zIndex: 999999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', overflowY: 'auto' }}>
      <div style={{ background: '#FFFFFF', borderRadius: '28px', padding: '36px 28px', width: '100%', maxWidth: '460px', border: '3px solid #FF4444', textAlign: 'center' }}>
        <div style={{ fontSize: '70px', marginBottom: '18px' }}>🚫</div>
        <p style={{ color: '#FF4444', fontSize: '16px', letterSpacing: '3px', fontWeight: '900', margin: '0 0 16px' }}>CUENTA SANCIONADA</p>
        <p style={{ color: '#1A1A1E', fontSize: '22px', lineHeight: '1.5', fontWeight: 'bold', margin: '0 0 24px' }}>{sancionActiva.razon}</p>
        {sancionActiva.permanente ? (
          <p style={{ color: '#FF4444', fontSize: '24px', fontWeight: '900', margin: '0 0 8px' }}>Suspensión permanente</p>
        ) : (
          <>
            <p style={{ color: '#1A1A1E', fontSize: '17px', fontWeight: 'bold', margin: '0 0 12px' }}>Tiempo restante de la sanción ({sancionActiva.duracion}):</p>
            <p style={{ color: '#FF4444', fontSize: '52px', fontWeight: '900', margin: '0 0 16px', fontVariantNumeric: 'tabular-nums' }}>{contadorSancion}</p>
            <p style={{ color: '#FF7A2F', fontSize: '16px', fontWeight: 'bold', margin: '0' }}>Hasta: {sancionActiva.sancionHasta ? new Date(sancionActiva.sancionHasta).toLocaleString('es-CO') : '—'}</p>
          </>
        )}
      </div>
      <p style={{ color: '#6B7280', fontSize: '16px', margin: '24px 0 0', textAlign: 'center', maxWidth: '420px', lineHeight: '1.5' }}>{sancionActiva.permanente ? 'Contacta al soporte de GuajiraGo para más información.' : 'No podrás recibir viajes hasta que finalice la sanción.'}</p>

      <div style={{ width: '100%', maxWidth: '460px', background: '#FFFFFF', borderRadius: '20px', padding: '16px', marginTop: '20px', border: '1px solid #ECECEF' }}>
        <p style={{ color: '#1A1A1E', fontSize: '15px', fontWeight: 'bold', margin: '0 0 10px' }}>💬 ¿Necesitas explicar tu caso?</p>
        <div style={{ maxHeight: '180px', overflowY: 'auto', marginBottom: '10px' }}>
          {mensajesApelacion.length === 0 && <p style={{ color: '#6B7280', fontSize: '13px', textAlign: 'center', margin: '8px 0' }}>Escríbele a GuajiraGo si crees que esto es un error</p>}
          {mensajesApelacion.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.autor === 'conductor' ? 'flex-end' : 'flex-start', marginBottom: '8px' }}>
              <div style={{ background: m.autor === 'conductor' ? 'linear-gradient(135deg, #FF7A2F, #D6357E)' : '#ECECEF', borderRadius: '12px', padding: '10px 14px', maxWidth: '85%' }}>
                <p style={{ color: m.autor === 'conductor' ? '#FFFFFF' : '#1A1A1E', fontSize: '14px', margin: '0', lineHeight: '1.4' }}>{m.texto}</p>
              </div>
            </div>
          ))}
          <div ref={chatApelacionFinRef} />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input value={textoApelacion} onChange={e => setTextoApelacion(e.target.value)} onKeyDown={e => e.key === 'Enter' && enviarApelacion()} placeholder="Escribe tu mensaje..." style={{ flex: 1, background: '#FFFFFF', border: '1px solid #ECECEF', borderRadius: '12px', padding: '12px 14px', color: '#1A1A1E', fontSize: '15px', outline: 'none' }} />
          <button onClick={enviarApelacion} disabled={!textoApelacion.trim() || !!ocupado} style={{ padding: '12px 18px', background: textoApelacion.trim() ? 'linear-gradient(135deg, #FF7A2F, #D6357E)' : '#ECECEF', border: 'none', borderRadius: '12px', color: textoApelacion.trim() ? '#FFFFFF' : '#6B7280', fontSize: '20px', cursor: textoApelacion.trim() ? 'pointer' : 'default' }}>{texto('apelacion', '…', '➤')}</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ backgroundColor: '#FFFFFF', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      {/* REGLA 9 · esta es la pantalla de la lista de solicitudes: aquí es donde el
          conductor OFERTA. Tampoco tenía dónde pintar el aviso, así que una oferta
          rechazada por el servidor se quedaba muda y la tarjeta decía «enviada»
          igual. Va aquí arriba, sin condición delante: `{algo && <MensajeGrande` lo
          haría depender de que ese «algo» se cumpla. */}
      <AvisoModal aviso={aviso} onCerrar={() => setAviso(null)} />
      {/* G37: el llamado de atención, con la MISMA pieza de la pantalla del pasajero. Como antes, solo sin viaje en curso. */}
      {!fase && <LlamadoAtencion />}
        {mensajeGrande && <MensajeGrande mensaje={mensajeGrande} onCerrar={() => setMensajeGrande(null)} />}
      <div style={{ background: '#FFFFFF', borderBottom: '1.5px solid #ECECEF', padding: '24px 20px', position: 'relative' }}>
        <LogoEsquina tamano="portada" />
        <MenuLateral nombre={nombre} foto={fotoConductor} onIrPerfil={() => setVerPerfil(true)} onIrCreditos={() => setVerCreditos(true)} onIrViajes={() => abrirDelMenu('viajes')} onIrGanancias={() => abrirDelMenu('ganancias')} onIrSeguridad={() => setVerSeguridad(true)} onIrAyuda={() => setVerAyuda(true)} onIrConfig={() => setVerConfig(true)} onIrPromociones={() => setVerPromociones(true)} onCerrarSesion={cerrarSesion} />
        <BotonVolver alVolver={onVolver} lugar="flotante" />
        <div style={{ marginTop: '48px' }}>
          <p style={{ color: '#6B7280', fontSize: '11px', margin: '0', letterSpacing: '2px' }}>CONDUCTOR</p>
          <h2 style={{ color: '#1A1A1E', fontSize: '20px', margin: '4px 0 8px', fontWeight: '900' }}>Hola, {nombre || 'Conductor'} 👋</h2>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {placa && <div style={{ background: '#FFFFFF', borderRadius: '8px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}><span>🚘</span><span style={{ color: '#FF7A2F', fontSize: '13px', fontWeight: 'bold' }}>{placa}</span></div>}
            {vehiculo && <div style={{ background: '#FFFFFF', borderRadius: '8px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}><span>🏷️</span><span style={{ color: '#1A1A1E', fontSize: '13px' }}>{vehiculo}</span></div>}
            {telefono && <div style={{ background: '#FFFFFF', borderRadius: '8px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}><span>📞</span><span style={{ color: '#1A1A1E', fontSize: '13px' }}>{telefono}</span></div>}
          </div>
        </div>
      </div>
      <div style={{ padding: '24px 20px' }}>
        <div onClick={() => setVerCreditos(true)} style={{ background: '#FFFFFF', borderRadius: '14px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #FF7A2F', cursor: 'pointer', marginBottom: '12px' }}>
          <span style={{ fontSize: '24px' }}>💰</span>
          <p style={{ color: '#1A1A1E', fontWeight: '900', fontSize: '15px', margin: '0', flex: 1 }}>Mis créditos</p>
          <p style={{ color: '#2ECC71', fontSize: '20px', fontWeight: '900', margin: '0' }}>{saldoCreditos === null ? '...' : cop(saldoCreditos)}</p>
        </div>
        
        <div style={{ background: '#FFFFFF', border: '1.5px solid #ECECEF', borderRadius: '14px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <p style={{ color: activo ? '#1A1A1E' : '#6B7280', fontWeight: '900', fontSize: '15px', margin: '0' }}>{activo ? '🟢 Estoy disponible' : '⚪ No disponible'}</p>
          <div onClick={() => { desbloquearAudio(); setActivo(!activo); }} style={{ width: '52px', height: '30px', borderRadius: '15px', background: activo ? 'linear-gradient(135deg, #FFCF4D, #FF7A2F)' : '#ECECEF', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 4px', justifyContent: activo ? 'flex-end' : 'flex-start', flexShrink: 0 }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#FFFFFF' }}/>
          </div>
        </div>
        <FranjaSinSaldo saldoCreditos={saldoCreditos} tipoVehiculo={tipoVehiculo} configApp={configApp} onRecargar={() => setVerCreditos(true)} />

        {viajesEscuchando.length > 0 && !fase && (
          <div style={{ background: 'rgba(255,207,77,0.1)', borderRadius: '16px', padding: '14px 16px', marginBottom: '12px', border: '1px solid #FFCF4D', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>⏳</span>
            <p style={{ color: '#FF7A2F', fontSize: '13px', fontWeight: 'bold', margin: '0' }}>
              Ofertas enviadas{viajesEscuchando.length > 1 ? ` (${viajesEscuchando.length} pasajeros)` : ''}...
            </p>
          </div>
        )}
        {activo && solicitudes.length === 0 && (
          <div style={{ background: '#FFFFFF', borderRadius: '20px', padding: '32px 20px', textAlign: 'center', border: '1px dashed #ECECEF' }}>
            <p style={{ fontSize: '40px', margin: '0 0 12px' }}>⏳</p>
            <p style={{ color: '#6B7280', fontSize: '14px', margin: '0' }}>Esperando solicitudes de viaje...</p>
          </div>
        )}
        {!activo && (
          <div onClick={() => abrirDelMenu('viajes')} style={{ background: '#FFFFFF', borderRadius: '20px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid #ECECEF', cursor: 'pointer', marginTop: '4px' }}>
            <span style={{ fontSize: '36px' }}>🕐</span>
            <div><p style={{ color: '#1A1A1E', fontWeight: '900', fontSize: '16px', margin: '0' }}>Mis viajes</p><p style={{ color: '#6B7280', fontSize: '12px', margin: '4px 0 0' }}>Ver historial y ganancias</p></div>
          </div>
        )}
        {activo && solicitudes.length > 0 && (
          <div>
            {solicitudes.length > 1 && (
              <p style={{ color: '#6B7280', fontSize: '11px', letterSpacing: '2px', margin: '0 0 12px', textAlign: 'center' }}>{solicitudes.length} SOLICITUDES DISPONIBLES</p>
            )}
            {solicitudes.map(sol => (
              <TarjetaSolicitud
                key={sol.id}
                solicitud={sol}
                nombre={nombre}
                telefono={telefono}
                placa={placa}
                vehiculo={vehiculo}
                tipoVehiculo={tipoVehiculo}
                fotoConductor={fotoConductor}
                colorConductor={colorConductor}
                saldoCreditos={saldoCreditos}
                configApp={configApp}
                descartadosRef={descartadosRef}
                agregarViajeEscuchando={agregarViajeEscuchando}
                onRechazar={rechazarSolicitud}
                onAviso={setAviso}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// G51: App.js también la abre, cuando la persona es conductor y toca «Mis viajes» antes de entrar (navegacionMenu.js).
export { HistorialConductor };
export default AppConductor;