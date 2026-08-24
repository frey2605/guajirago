/**
 * LA TARIFA MÍNIMA — UNA SOLA CALCULADORA
 *
 * SEGUNDA LEY del proyecto: «No se pueden usar dos calculadoras para un mismo
 * proceso.» Hasta el 23-ago-2026 la tarifa mínima se calculaba en TRES sitios de
 * la misma app, y los tres decían cosas distintas:
 *
 *   · Solicitar.js            NO conocía la mensajería.
 *   · SolicitarMensajeria.js  sí la conocía. Era la única de las tres.
 *   · AppConductor.js         no conocía NI la mensajería NI el mototaxi, y además
 *                             no leía la configuración: usaba siempre el respaldo.
 *
 * Nadie se dio cuenta porque cada pantalla, por casualidad, solo recibía el tipo
 * de viaje que su copia sí sabía calcular. Eso no es estar bien: es tener suerte.
 *
 * DE DÓNDE SALEN LOS NÚMEROS DE VERDAD: de `config/global` en la base de datos,
 * que es lo que el dueño edita en el panel (Superadmin → tarifas). Los valores de
 * aquí abajo son el PARACAÍDAS por si esa configuración no carga — y valen lo
 * mismo que tenía cada copia antes, para no cambiar nada sin querer.
 *
 * CÓMO SE USA: se le pasa el tipo de viaje y la config ya cargada.
 *
 *     calcularTarifaMinima('Mototaxi', configApp)
 *
 * ⚠ EL PRIMER PARÁMETRO ES EL TIPO, NO LA CONFIG. Se avisa porque la copia vieja
 * de AppConductor.js recibía la config de primero, y confundirlos NO da error: la
 * config entraría como «tipo», no coincidiría con nada, y saldría el paracaídas
 * en vez del precio que el dueño puso en el panel — mal precio, y en silencio.
 *
 * EL TERCER PARÁMETRO (`ahora`) EXISTE PARA PODER PROBARLA. La tarifa de noche
 * depende de la hora, y una prueba que dependiera del reloj de verdad pasaría de
 * día y fallaría de noche — o al revés. Pasándole una hora fija se puede
 * comprobar el día Y la noche a cualquier hora. Nadie más se lo pasa.
 */

// ANOTADO: solo la mensajería tiene paracaídas propio dentro de la función. Si
// `config/global` llegara SIN tarifaMinimaDia, Noche o Mototaxi, la cuenta daría
// «undefined». Ya era así en las tres copias viejas —esto no lo trajo el cambio—
// pero ahora que este archivo es la única autoridad, conviene que esté dicho.
export const CONFIG_TARIFAS_DEFECTO = {
  tarifaMinimaDia: 8000,
  tarifaMinimaNoche: 10000,
  tarifaMinimaMototaxi: 3000,
  tarifaMinimaMensajeria: 5000,
  horaInicioNoche: 18,
  horaFinNoche: 6,
};

/**
 * Cuánto es lo MENOS que se puede ofrecer por un viaje de este tipo.
 *
 * Un mandado (Mensajería) y un mototaxi tienen su propio mínimo y no miran la
 * hora. El taxi sí: de noche cuesta más.
 */
export function calcularTarifaMinima(tipo, cfg = CONFIG_TARIFAS_DEFECTO, ahora = new Date()) {
  // OJO: es `||` y no `??`, igual que estaba antes. La diferencia es que con `||`
  // un mínimo de $0 puesto en el panel se ignora y se usa el paracaídas. Se deja
  // como estaba para no cambiar de comportamiento a escondidas; queda anotado.
  if (tipo === 'Mensajería') return cfg.tarifaMinimaMensajeria || CONFIG_TARIFAS_DEFECTO.tarifaMinimaMensajeria;
  if (tipo === 'Mototaxi') return cfg.tarifaMinimaMototaxi;
  const hora = ahora.getHours();
  // Noche: desde horaInicioNoche hasta horaFinNoche → tarifa más alta.
  // Cruza la medianoche, por eso es «o» y no «y».
  return (hora >= cfg.horaInicioNoche || hora < cfg.horaFinNoche) ? cfg.tarifaMinimaNoche : cfg.tarifaMinimaDia;
}
