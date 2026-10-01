/**
 * Code.gs — punto de entrada del Web App de Google Apps Script.
 *
 * GET  -> operaciones de lectura (?action=...&apiKey=...&...params)
 * POST -> operaciones de escritura (body JSON: { action, apiKey, ...datos })
 */

const ACCIONES_GET = {
  listarUsuarios: () => listarUsuarios_(),
  obtenerUsuarioPorEmail: (p) => obtenerUsuarioPorEmail_(p.email),

  // IMPORTANTE: estas acciones SÍ tienen que reenviar la agencia que pide el
  // servidor. Si no se la pasan, la función devuelve TODO y el selector "Ver
  // agencia" del Dashboard no cambia nada (muestra siempre la misma planta).
  listarProductos: (p) => listarProductos_(p.agencia),
  obtenerProductoPorCodigo: (p) => obtenerProductoPorCodigo_(p.codigo, p.agencia),
  listarConteos: (p) =>
    p && p.agencia
      ? listarConteos_().filter((c) => String(c.agencia) === String(p.agencia))
      : listarConteos_(),

  listarHistorial: () => listarHistorial_(),
  listarAgencias: () => listarAgencias_(),

  // Cierre de cíclico / retención (ver Retencion.gs).
  listarResumenMensual: () => listarResumenMensual_(),
};

const ACCIONES_POST = {
  crearUsuario: (b) => crearUsuario_(b),
  actualizarUsuario: (b) => actualizarUsuario_(b),
  eliminarUsuario: (b) => eliminarUsuario_(b),

  crearProducto: (b) => crearProducto_(b),
  actualizarProducto: (b) => actualizarProducto_(b),
  eliminarProducto: (b) => eliminarProducto_(b),
  importarProductos: (b) => importarProductos_(b),

  guardarConteo: (b) => guardarConteo_(b),
  guardarConteosLote: (b) => guardarConteosLote_(b),
  editarConteo: (b) => editarConteo_(b),
  eliminarConteo: (b) => eliminarConteo_(b),
  eliminarConteos: (b) => eliminarConteos_(b),
  // Reiniciar inventario: borra SOLO la planta pedida (o todas si no viene
  // agencia). Va por borrarConteosDeAgencia_ (Retencion.gs), NO por
  // resetearConteos_, que borra la hoja entera sin mirar la agencia.
  resetearConteos: (b) => borrarConteosDeAgencia_(b && b.agencia),

  registrarHistorial: (b) => registrarHistorial_(b),

  // Cierre de cíclico / retención (ver Retencion.gs).
  cerrarCiclo: (b) => cerrarCiclo_(b),
  eliminarResumen: (b) => eliminarResumen_(b),
};

function doGet(e) {
  const params = (e && e.parameter) || {};
  try {
    validarApiKey_(params.apiKey);
    const accion = ACCIONES_GET[params.action];
    if (!accion) throw new Error(`Acción GET desconocida: ${params.action}`);
    const data = accion(params);
    return respuestaOk_(data);
  } catch (err) {
    logAccion_(params.action || "GET", "", err.message);
    return respuestaError_(err.message);
  }
}

function doPost(e) {
  let body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return respuestaError_("Body inválido: se esperaba JSON");
  }

  let lockAdquirido = false;
  const lock = LockService.getScriptLock();
  try {
    validarApiKey_(body.apiKey);
    const accion = ACCIONES_POST[body.action];
    if (!accion) throw new Error(`Acción POST desconocida: ${body.action}`);

    lock.waitLock(10000); // hasta 10s esperando el lock antes de fallar
    lockAdquirido = true;
    const data = accion(body);
    return respuestaOk_(data);
  } catch (err) {
    logAccion_(body.action || "POST", "", err.message);
    return respuestaError_(err.message);
  } finally {
    if (lockAdquirido) lock.releaseLock();
  }
}
