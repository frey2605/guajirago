import React, { useState } from 'react';
import Splash from './Splash';
import Login from './Login';
import Home from './Home';
import AppConductor from './AppConductor';

function App() {
  const [screen, setScreen] = useState('splash');
  const [tipoUsuario, setTipoUsuario] = useState('');
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [telefonoUsuario, setTelefonoUsuario] = useState('');
  const [placaUsuario, setPlacaUsuario] = useState('');
  const [vehiculoUsuario, setVehiculoUsuario] = useState('');

  if (screen === 'splash') {
    return <Splash onFinish={() => setScreen('login')} />;
  }

  if (screen === 'login') {
    return <Login onEntrar={(tipo, nombre, telefono, placa, vehiculo) => {
      setTipoUsuario(tipo);
      setNombreUsuario(nombre);
      setTelefonoUsuario(telefono);
      setPlacaUsuario(placa);
      setVehiculoUsuario(vehiculo);
      setScreen('home');
    }} />;
  }

  if (screen === 'home') {
    if (tipoUsuario === 'conductor') {
      return (
        <AppConductor
          nombre={nombreUsuario}
          telefono={telefonoUsuario}
          placa={placaUsuario}
          vehiculo={vehiculoUsuario}
        />
      );
    }
    return <Home nombre={nombreUsuario} />;
  }
}

export default App;