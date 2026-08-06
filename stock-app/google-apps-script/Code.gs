/**
 * Code.gs — punto de entrada del Web App de Google Apps Script.
 *
 * Cómo publicarlo:
 *   1. Extensiones > Apps Script (desde tu planilla de Google Sheets).
 *   2. Pegá cada archivo .gs de esta carpeta como un archivo del proyecto.
 *   3. Ejecutá una vez la función `configurarProyecto` (Utils.gs) para que
 *      cree todas las hojas necesarias con sus encabezados.
 *   4. Extensiones > Propiedades del script > agregá API_KEY (una clave
 *      larga y aleatoria — no reutilices contraseñas).
 *   5. Implementar > Nueva implementación > tipo "Aplicación web".
 *      - Ejecutar como: Yo (tu cuenta)
 *      - Quién tiene acceso: Cualquier usuario
 *   6. Copiá la URL que te da (".../exec") a GAS_WEB_APP_URL en el .env de
 *      Next.js, y la misma API_KEY a GAS_API_KEY.
 *
 * GET  -> operaciones de lectura (?action=...&apiKey=...&...params)
 * POST -> operaciones de escritura (body JSON: { action, apiKey, ...datos })
 *
 * Se usa LockService en las operaciones de escritura para evitar
 * condiciones de carrera cuando dos personas cuentan al mismo tiempo.
 */

const ACCIONES_GET = {
  listarUsuarios: () => listarUsuarios_(),
  obtenerUsuarioPorEmail: (p) => obtenerUsuarioPorEmail_(p.email),
  listarProductos: () => listarProductos_(),
  obtenerProductoPorCodigo: (p) => obtenerProductoPorCodigo_(p.codigo),
  listarConteos: () => listarConteos_(),
  listarHistorial: () => listarHistorial_(),
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
  resetearConteos: () => resetearConteos_(),

  registrarHistorial: (b) => registrarHistorial_(b),
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
