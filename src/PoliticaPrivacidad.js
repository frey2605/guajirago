import React from 'react';

function PoliticaPrivacidad({ onVolver }) {
  const seccion = (titulo, texto) => (
    <div style={{ marginBottom: '20px' }}>
      <h3 style={{ color: '#FF7A2F', fontSize: '15px', fontWeight: '900', margin: '0 0 8px' }}>{titulo}</h3>
      <p style={{ color: '#AAAAAA', fontSize: '14px', margin: '0', lineHeight: '1.6' }}>{texto}</p>
    </div>
  );

  return (
    <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)', padding: '24px 20px', position: 'relative', display: 'flex', alignItems: 'center' }}>
        <div onClick={onVolver} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.12)', borderRadius: '12px', color: '#FFFFFF', fontSize: '14px', fontWeight: '500', padding: '8px 16px', cursor: 'pointer' }}>
          <span style={{ fontSize: '20px', fontWeight: '900', lineHeight: '1', position: 'relative', top: '-1px' }}>‹</span> Volver
        </div>
        <h2 style={{ color: '#FFFFFF', margin: '0 auto', fontSize: '18px', fontWeight: '900' }}>Política de privacidad</h2>
      </div>

      <div style={{ padding: '24px 20px' }}>
        <p style={{ color: '#555', fontSize: '12px', margin: '0 0 20px' }}>Última actualización: junio de 2026</p>

        {seccion('1. Introducción', 'En GuajiraGo valoramos y protegemos tu privacidad. Esta política explica qué datos personales recopilamos, cómo los usamos y cómo los protegemos, en cumplimiento de la Ley 1581 de 2012 de Protección de Datos Personales de Colombia (Habeas Data).')}

        {seccion('2. Datos que recopilamos', 'Recopilamos la información que nos proporcionas al registrarte: nombre, correo electrónico, número de celular, fecha de nacimiento y contacto de emergencia. Si eres conductor, también recopilamos los datos de tu vehículo (placa, marca, modelo, color), tu documento de identidad y fotografías tuyas y de tu cédula. Durante el uso de la app recopilamos tu ubicación en tiempo real para conectar viajes.')}

        {seccion('3. Cómo usamos tus datos', 'Usamos tus datos para: conectarte con conductores o pasajeros, mostrar tu ubicación durante los viajes, procesar las solicitudes de viaje, generar tu código de seguridad, permitir la comunicación entre usuarios, y mejorar el servicio. Nunca vendemos tus datos a terceros con fines publicitarios.')}

        {seccion('4. Ubicación', 'GuajiraGo necesita acceder a tu ubicación para funcionar correctamente. La ubicación se usa para mostrar dónde estás, calcular rutas y conectar pasajeros con conductores cercanos. Puedes desactivar el acceso a la ubicación desde la configuración de tu celular, pero esto limitará el funcionamiento de la app.')}

        {seccion('5. Compartir información', 'Cuando solicitas o aceptas un viaje, compartimos cierta información entre pasajero y conductor (nombre, foto, datos del vehículo, ubicación) para hacer posible el servicio. Tu número de teléfono personal no se comparte directamente; las llamadas se hacen a través de la app. Solo compartimos datos con tu contacto de confianza cuando tú usas la función de compartir ubicación.')}

        {seccion('6. Protección de datos', 'Almacenamos tus datos de forma segura en servidores protegidos (Firebase de Google). Aplicamos medidas técnicas para evitar accesos no autorizados. Sin embargo, ningún sistema es completamente infalible, por lo que te recomendamos proteger tu contraseña y no compartirla con nadie.')}

        {seccion('7. Tus derechos', 'De acuerdo con la ley colombiana, tienes derecho a conocer, actualizar, rectificar y solicitar la eliminación de tus datos personales. Para ejercer estos derechos, escríbenos a soporte@guajirago.com.co y atenderemos tu solicitud.')}

        {seccion('8. Retención de datos', 'Conservamos tus datos mientras tu cuenta esté activa. Si eliminas tu cuenta, eliminaremos o anonimizaremos tu información personal, salvo aquella que debamos conservar por obligaciones legales.')}

        {seccion('9. Menores de edad', 'GuajiraGo está dirigido a personas mayores de edad. Si eres menor, debes contar con la autorización de tus padres o tutores para usar la aplicación y para el tratamiento de tus datos.')}

        {seccion('10. Cambios en la política', 'Podemos actualizar esta política de privacidad en cualquier momento. Te notificaremos los cambios importantes a través de la app. Te recomendamos revisar esta política periódicamente.')}

        {seccion('11. Contacto', 'Si tienes preguntas sobre esta política o sobre el manejo de tus datos personales, escríbenos a soporte@guajirago.com.co. Estamos para ayudarte.')}

        <div style={{ height: '20px' }} />
      </div>
    </div>
  );
}

export default PoliticaPrivacidad;