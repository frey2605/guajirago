import React from 'react';

function TerminosCondiciones({ onVolver }) {
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
        <h2 style={{ color: '#FFFFFF', margin: '0 auto', fontSize: '18px', fontWeight: '900' }}>Términos y condiciones</h2>
      </div>

      <div style={{ padding: '24px 20px' }}>
        <p style={{ color: '#555', fontSize: '12px', margin: '0 0 20px' }}>Última actualización: junio de 2026</p>

        {seccion('1. Aceptación de los términos', 'Al registrarte y usar GuajiraGo, aceptas estos términos y condiciones en su totalidad. Si no estás de acuerdo con alguno de ellos, no debes usar la aplicación. GuajiraGo es una plataforma tecnológica que conecta pasajeros con conductores de taxi y mototaxi en Riohacha, La Guajira, Colombia.')}

        {seccion('2. Naturaleza del servicio', 'GuajiraGo es únicamente un intermediario tecnológico que facilita el contacto entre pasajeros y conductores. GuajiraGo no presta directamente el servicio de transporte, no es propietario de los vehículos ni emplea a los conductores. El servicio de transporte es prestado de manera independiente por cada conductor.')}

        {seccion('3. Registro de usuario', 'Para usar GuajiraGo debes crear una cuenta con información veraz y actualizada, incluyendo tu nombre, correo, número de celular, fecha de nacimiento y un contacto de emergencia. Eres responsable de mantener la confidencialidad de tu contraseña y de toda actividad que ocurra en tu cuenta. Debes ser mayor de edad o contar con autorización de tus padres o tutores.')}

        {seccion('4. Uso de la plataforma', 'Te comprometes a usar GuajiraGo de manera responsable y legal. No puedes usar la app para actividades ilícitas, fraudulentas o que pongan en riesgo a otros usuarios. El incumplimiento puede resultar en la suspensión o eliminación de tu cuenta.')}

        {seccion('5. Tarifas y pagos', 'Las tarifas de los viajes se acuerdan entre el pasajero y el conductor a través del sistema de negociación de la app. El pago del viaje se realiza directamente al conductor. Los conductores pagan una comisión a GuajiraGo por cada viaje completado, descontada de su saldo de créditos dentro de la app.')}

        {seccion('6. Responsabilidades del conductor', 'Los conductores son responsables de contar con los documentos legales vigentes para prestar el servicio de transporte, mantener su vehículo en buen estado, y cumplir con las normas de tránsito. GuajiraGo no se hace responsable por incumplimientos legales de los conductores.')}

        {seccion('7. Seguridad', 'GuajiraGo ofrece herramientas de seguridad como el código de verificación, el botón de emergencia y la opción de compartir tu viaje. Sin embargo, eres responsable de tomar precauciones razonables durante tus viajes. En caso de emergencia, comunícate con las autoridades a través de la línea 123.')}

        {seccion('8. Limitación de responsabilidad', 'GuajiraGo no se hace responsable por daños, pérdidas, accidentes, lesiones o conflictos que ocurran durante o como consecuencia de los viajes, ya que actúa únicamente como plataforma de conexión. El uso del servicio de transporte es bajo tu propia responsabilidad.')}

        {seccion('9. Cancelaciones', 'Tanto pasajeros como conductores pueden cancelar un viaje bajo las condiciones establecidas en la app. El abuso de las cancelaciones puede resultar en sanciones dentro de la plataforma.')}

        {seccion('10. Modificaciones', 'GuajiraGo se reserva el derecho de modificar estos términos en cualquier momento. Los cambios serán notificados a través de la app. El uso continuado de la aplicación después de una modificación implica la aceptación de los nuevos términos.')}

        {seccion('11. Contacto', 'Para cualquier duda o reclamo relacionado con estos términos, puedes escribirnos al correo soporte@guajirago.com.co.')}

        <div style={{ height: '20px' }} />
      </div>
    </div>
  );
}

export default TerminosCondiciones;