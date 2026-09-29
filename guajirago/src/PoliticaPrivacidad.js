import React from 'react';
import PaginaLegal, { seccion } from './PaginaLegal';
import { CORREO_SOPORTE } from './correoSoporte';

function PoliticaPrivacidad({ onVolver }) {
  return (
    <PaginaLegal titulo="Política de privacidad" actualizacion="junio de 2026" onVolver={onVolver}>
      {seccion('1. Introducción', 'En GuajiraGo valoramos y protegemos tu privacidad. Esta política explica qué datos personales recopilamos, cómo los usamos y cómo los protegemos, en cumplimiento de la Ley 1581 de 2012 de Protección de Datos Personales de Colombia (Habeas Data).')}

      {seccion('2. Datos que recopilamos', 'Recopilamos la información que nos proporcionas al registrarte: nombre, correo electrónico, número de celular, fecha de nacimiento y contacto de emergencia. Si eres conductor, también recopilamos los datos de tu vehículo (placa, marca, modelo, color), tu documento de identidad y fotografías tuyas y de tu cédula. Durante el uso de la app recopilamos tu ubicación en tiempo real para conectar viajes.')}

      {seccion('3. Cómo usamos tus datos', 'Usamos tus datos para: conectarte con conductores o pasajeros, mostrar tu ubicación durante los viajes, procesar las solicitudes de viaje, generar tu código de seguridad, permitir la comunicación entre usuarios, y mejorar el servicio. Nunca vendemos tus datos a terceros con fines publicitarios.')}

      {seccion('4. Ubicación', 'GuajiraGo necesita acceder a tu ubicación para funcionar correctamente. La ubicación se usa para mostrar dónde estás, calcular rutas y conectar pasajeros con conductores cercanos. Puedes desactivar el acceso a la ubicación desde la configuración de tu celular, pero esto limitará el funcionamiento de la app.')}

      {seccion('5. Compartir información', 'Cuando solicitas o aceptas un viaje, compartimos cierta información entre pasajero y conductor (nombre, foto, datos del vehículo, ubicación) para hacer posible el servicio. Tu número de teléfono personal no se comparte directamente; las llamadas se hacen a través de la app. Solo compartimos datos con tu contacto de confianza cuando tú usas la función de compartir ubicación.')}

      {seccion('6. Protección de datos', 'Almacenamos tus datos de forma segura en servidores protegidos (Firebase de Google). Aplicamos medidas técnicas para evitar accesos no autorizados. Sin embargo, ningún sistema es completamente infalible, por lo que te recomendamos proteger tu contraseña y no compartirla con nadie.')}

      {seccion('7. Tus derechos', `De acuerdo con la ley colombiana, tienes derecho a conocer, actualizar, rectificar y solicitar la eliminación de tus datos personales. Para ejercer estos derechos, escríbenos a ${CORREO_SOPORTE} y atenderemos tu solicitud.`)}

      {seccion('8. Retención de datos', 'Conservamos tus datos mientras tu cuenta esté activa. Si eliminas tu cuenta, eliminaremos o anonimizaremos tu información personal, salvo aquella que debamos conservar por obligaciones legales.')}

      {seccion('9. Menores de edad', 'GuajiraGo está dirigido a personas mayores de edad. Si eres menor, debes contar con la autorización de tus padres o tutores para usar la aplicación y para el tratamiento de tus datos.')}

      {seccion('10. Cambios en la política', 'Podemos actualizar esta política de privacidad en cualquier momento. Te notificaremos los cambios importantes a través de la app. Te recomendamos revisar esta política periódicamente.')}

      {seccion('11. Contacto', `Si tienes preguntas sobre esta política o sobre el manejo de tus datos personales, escríbenos a ${CORREO_SOPORTE}. Estamos para ayudarte.`)}
    </PaginaLegal>
  );
}

export default PoliticaPrivacidad;