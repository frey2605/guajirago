import React, { useState } from 'react';
import Splash from './Splash';
import Login from './Login';
import Home from './Home';
import AppConductor from './AppConductor';

function App() {
  const [screen, setScreen] = useState('splash');
  const [tipoUsuario, setTipoUsuario] = useState('');

  if (screen === 'splash') {
    return <Splash onFinish={() => setScreen('login')} />;
  }

  if (screen === 'login') {
    return <Login onEntrar={(tipo) => {
      setTipoUsuario(tipo);
      setScreen('home');
    }} />;
  }

  if (screen === 'home') {
    if (tipoUsuario === 'conductor') {
      return <AppConductor />;
    }
    return <Home />;
  }
}

export default App;