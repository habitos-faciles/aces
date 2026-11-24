/**
 * Servidor del sorteo "Puedes llevarte 01 Bicicleta".
 * Recibe los registros del sorteo y los pedidos del aplicativo, los guarda en una hoja de
 * cálculo de Google y envía cada uno por correo.
 *
 * Cómo ponerlo en marcha (una sola vez):
 * 1. Entra a script.google.com y abre tu proyecto. Pega todo este texto y guarda.
 * 2. Si quieres recibir los correos en otra dirección, escríbela en CORREO_DESTINO.
 *    Si lo dejas vacío, llegan a la cuenta de Google con la que creaste el proyecto.
 * 3. Elige la función configurar y pulsa Ejecutar. Acepta los permisos.
 *    En el registro aparecerá el enlace de la hoja donde se guardan los datos.
 * 4. Pulsa Implementar > Nueva implementación > tipo Aplicación web.
 *    Ejecutar como: Yo. Quién tiene acceso: Cualquier persona. Pulsa Implementar.
 * 5. Copia la URL de la aplicación web (termina en /exec) y pégala en el aplicativo,
 *    en CONFIG.urlServidor del archivo index.html.
 *
 * Si ya tenías el servidor puesto en marcha y solo quieres que los correos lleven el
 * nombre nuevo: pega este texto, guarda, y entra a Implementar > Administrar implementaciones
 * > Editar > Versión nueva > Implementar. La URL no cambia.
 */

var CORREO_DESTINO = '';
var NOMBRE_NEGOCIO = 'Puedes llevarte 01 Bicicleta';

var COLUMNAS_REGISTROS = ['Código', 'Fecha', 'Nombres', 'Apellidos', 'Tipo doc.', 'N.° doc.', 'Fecha nac.', 'Estado civil',
  'Grado de instrucción', 'Celular', 'Correo', 'Dirección', 'Distrito', 'Provincia', 'Departamento', 'Colegio', 'Distrito del colegio', 'Intereses', 'Ocupación', 'Busca', 'Acepta novedades', 'Condiciones', 'Documento repetido'];
var COLUMNAS_PEDIDOS = ['Pedido', 'Fecha', 'Cliente', 'Celular', 'Correo', 'Código participante', 'Entrega', 'Dirección',
  'Ubicación', 'Comentarios', 'Productos', 'Total'];

function configurar() {
  var libro = libro_();
  hoja_(libro, 'Registros', COLUMNAS_REGISTROS);
  hoja_(libro, 'Pedidos', COLUMNAS_PEDIDOS);
  Logger.log('Hoja de datos: ' + libro.getUrl());
  Logger.log('Los correos llegarán a: ' + destino_());
}

function doGet() {
  return salida_('Servidor activo - ' + NOMBRE_NEGOCIO);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    if (!e || !e.postData || !e.postData.contents || e.postData.contents.length > 30000) return salida_('error');
    var d = JSON.parse(e.postData.contents);
    if (d.tipo === 'registro') procesarRegistro_(d);
    else if (d.tipo === 'pedido') procesarPedido_(d);
    else return salida_('tipo-invalido');
    return salida_('ok');
  } catch (err) {
    console.error(err);
    return salida_('error');
  } finally {
    try { lock.releaseLock(); } catch (x) { /* sin bloqueo */ }
  }
}

function procesarRegistro_(d) {
  var libro = libro_();
  var hoja = hoja_(libro, 'Registros', COLUMNAS_REGISTROS);
  var id = t_(d.id, 20);
  if (!id || existe_(hoja, 1, id)) return;               // ya estaba guardado (reintento)
  var repetido = existe_(hoja, 6, t_(d.numDoc, 20)) ? 'SÍ' : '';
  var intereses = Array.isArray(d.intereses) ? d.intereses.map(function (x) { return t_(x, 40); }).join(', ') : '';
  var fila = [id, t_(d.fecha, 40), t_(d.nombres, 80), t_(d.apellidos, 80), t_(d.tipoDoc, 30), t_(d.numDoc, 20),
    t_(d.fechaNac, 12), t_(d.estadoCivil, 30), t_(d.grado, 20), t_(d.celular, 15), t_(d.correo, 120), t_(d.direccion, 200),
    t_(d.distrito, 80), t_(d.provincia, 80), t_(d.departamento, 40), t_(d.colegio, 120), t_(d.distritoColegio, 80),
    intereses, t_(d.ocupacion, 80), t_(d.busca, 500),
    d.novedades ? 'Sí' : 'No', t_(d.condiciones, 20), repetido];
  hoja.appendRow(fila);

  var lineas = [
    'Nuevo registro al sorteo "' + NOMBRE_NEGOCIO + '"', '',
    'Código: ' + id + (repetido ? '   (ATENCIÓN: este documento ya estaba registrado)' : ''),
    'Fecha: ' + fila[1], '',
    'DATOS PERSONALES',
    'Nombres: ' + fila[2], 'Apellidos: ' + fila[3], 'Documento: ' + fila[4] + ' ' + fila[5],
    'Fecha de nacimiento: ' + fila[6], 'Estado civil: ' + fila[7], 'Grado de instrucción: ' + fila[8], '',
    'CONTACTO', 'Celular: ' + fila[9], 'Correo: ' + fila[10], '',
    'DIRECCIÓN', fila[11] + ', ' + fila[12] + ', ' + fila[13] + ', ' + fila[14], '',
    'COLEGIO', 'Colegio: ' + fila[15], 'Distrito del colegio: ' + fila[16], '',
    'INTERESES', intereses, '',
    'Ocupación: ' + fila[18], 'Busca: ' + fila[19],
    'Acepta novedades: ' + fila[20],
    '', 'Hoja con todos los registros: ' + libro.getUrl()
  ];
  enviarCorreo_('Nuevo registro al sorteo: ' + fila[2] + ' ' + fila[3] + ' (' + id + ')', lineas.join('\n'), fila[10]);
}

function procesarPedido_(d) {
  var libro = libro_();
  var hoja = hoja_(libro, 'Pedidos', COLUMNAS_PEDIDOS);
  var id = t_(d.id, 30);
  if (!id || existe_(hoja, 1, id)) return;
  var items = Array.isArray(d.items) ? d.items.slice(0, 60) : [];
  var detalle = items.map(function (i) {
    return Number(i.cantidad) + ' x ' + t_(i.nombre, 120) + ' (S/ ' + Number(i.subtotal).toFixed(2) + ')';
  }).join('\n');
  var total = Number(d.total) || 0;
  var fila = [id, t_(d.fecha, 40), t_(d.cliente, 160), t_(d.celular, 15), t_(d.correo, 120), t_(d.codigoParticipante, 20),
    t_(d.entrega, 30), t_(d.direccion, 200), t_(d.ubicacion, 200), t_(d.comentarios, 300), detalle, total];
  hoja.appendRow(fila);

  var lineas = [
    'Nuevo pedido - ' + NOMBRE_NEGOCIO, '',
    'Pedido: ' + id, 'Fecha: ' + fila[1], '',
    'PRODUCTOS', detalle, '', 'TOTAL: S/ ' + total.toFixed(2), '',
    'ENTREGA: ' + fila[6]
  ];
  if (fila[7]) lineas.push('Dirección: ' + fila[7]);
  if (fila[8]) lineas.push('Ubicación: ' + fila[8]);
  if (fila[9]) lineas.push('Comentarios: ' + fila[9]);
  lineas.push('', 'CLIENTE', fila[2], 'Celular: ' + fila[3], 'Correo: ' + fila[4], 'Código de participante: ' + fila[5]);
  enviarCorreo_('Nuevo pedido ' + id + ' - S/ ' + total.toFixed(2), lineas.join('\n'), fila[4]);
}

/* ===== Apoyo ===== */

function destino_() {
  return CORREO_DESTINO || Session.getEffectiveUser().getEmail();
}

function enviarCorreo_(asunto, cuerpo, correoCliente) {
  var opciones = { to: destino_(), subject: asunto, body: cuerpo, name: NOMBRE_NEGOCIO };
  if (/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/.test(correoCliente || '')) opciones.replyTo = correoCliente;
  MailApp.sendEmail(opciones);
}

function libro_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('LIBRO_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* se crea uno nuevo */ }
  }
  var libro = SpreadsheetApp.create('Datos - ' + NOMBRE_NEGOCIO);
  props.setProperty('LIBRO_ID', libro.getId());
  return libro;
}

function hoja_(libro, nombre, columnas) {
  var hoja = libro.getSheetByName(nombre);
  if (!hoja) {
    hoja = libro.getSheets().length === 1 && libro.getSheets()[0].getLastRow() === 0 && libro.getSheets()[0].getName() !== 'Registros' && libro.getSheets()[0].getName() !== 'Pedidos'
      ? libro.getSheets()[0].setName(nombre)
      : libro.insertSheet(nombre);
    hoja.appendRow(columnas);
    hoja.setFrozenRows(1);
    hoja.getRange(1, 1, 1, columnas.length).setFontWeight('bold');
  }
  return hoja;
}

function existe_(hoja, columna, valor) {
  if (!valor || hoja.getLastRow() < 2) return false;
  var datos = hoja.getRange(2, columna, hoja.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < datos.length; i++) {
    if (String(datos[i][0]) === String(valor)) return true;
  }
  return false;
}

// Limpia el texto y evita que una celda empiece como fórmula.
function t_(v, max) {
  var s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max || 200);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function salida_(texto) {
  return ContentService.createTextOutput(texto).setMimeType(ContentService.MimeType.TEXT);
}
