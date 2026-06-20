import React, { useState, useEffect } from 'react';
import Splash from './Splash';
import Login from './Login';
import Home from './Home';
import AppConductor from './AppConductor';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const STORAGE_KEY = 'guajirago_usuario';

function guardarLocal(datos) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(datos)); } catch (e) {}
}

function cargarLocal() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { return null; }
}

function App() {
  const [screen, setScreen] = useState('splash');
  const [tipoUsuario, setTipoUsuario] = useState('');
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [telefonoUsuario, setTelefonoUsuario] = useState('');
  const [placaUsuario, setPlacaUsuario] = useState('');
  const [vehiculoUsuario, setVehiculoUsuario] = useState('');

  useEffect(() => {
    // Revisar localStorage primero (funciona en iPhone PWA sin depender de Firebase Auth)
    const local = cargarLocal();
    if (local && local.tipo) {
      setTipoUsuario(local.tipo);
      setNombreUsuario(local.nombre || '');
      setTelefonoUsuario(local.telefono || '');
      setPlacaUsuario(local.placa || '');
      setVehiculoUsuario(local.vehiculo || '');
      // Esperar un momento para que el splash se vea y luego ir a home
      setTimeout(() => setScreen('home'), 2000);
      return;
    }

    // Sin datos locales: esperar a Firebase Auth y luego decidir
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const snap = await getDoc(doc(db, 'usuarios', user.uid));
          if (snap.exists()) {
            const datos = snap.data();
            setTipoUsuario(datos.tipo || '');
            setNombreUsuario(datos.nombre || '');
            setTelefonoUsuario(datos.telefono || '');
            setPlacaUsuario(datos.placa || '');
            setVehiculoUsuario(datos.vehiculo || '');
            guardarLocal(datos);
            setTimeout(() => setScreen('home'), 2000);
            return;
          }
        } catch (e) {}
      }
      setTimeout(() => setScreen('login'), 2000);
    });
    return () => unsub();
  }, []);

  const handleEntrar = (tipo, nombre, telefono, placa, vehiculo) => {
    setTipoUsuario(tipo);
    setNombreUsuario(nombre);
    setTelefonoUsuario(telefono);
    setPlacaUsuario(placa);
    setVehiculoUsuario(vehiculo);
    // Guardar localmente al iniciar sesión
    guardarLocal({ tipo, nombre, telefono, placa, vehiculo });
    setScreen('home');
  };

  const handleCerrarSesion = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    setScreen('login');
  };

  if (screen === 'splash') {
    return <Splash onFinish={() => {}} />;
  }

  if (screen === 'login') {
    return <Login onEntrar={handleEntrar} />;
  }

  if (screen === 'home') {
    if (tipoUsuario === 'conductor') {
      return (
        <AppConductor
          nombre={nombreUsuario}
          telefono={telefonoUsuario}
          placa={placaUsuario}
          vehiculo={vehiculoUsuario}
          onCerrarSesion={handleCerrarSesion}
        />
      );
    }
    return <Home nombre={nombreUsuario} onCerrarSesion={handleCerrarSesion} />;
  }
}

export default App;