/**
 * Usuarios.gs — el hash de la contraseña SIEMPRE llega ya calculado desde
 * Next.js (bcryptjs, en el servidor). Este script nunca hashea ni compara
 * contraseñas: solo persiste lo que recibe. La comparación en el login
 * también la hace Next.js, después de pedir el usuario por email acá.
 *
 * PERFILES (agregado 2026-09)
 * ---------------------------
 * Cada usuario tiene ahora un `perfil` y una lista de plantas `agencias`:
 *
 *   operario   cuenta y corrige. No borra. Solo su planta.
 *   encargado  cuenta, corrige y borra líneas de conteo. Solo su planta.
 *   jefe       todo lo operativo + catálogo, etiquetas, historial y alta de
 *              usuarios de SUS plantas. Puede tener varias a cargo.
 *   gerente    todos los permisos sobre todas las plantas.
 *
 * `rol` NO desaparece: se deriva del perfil y se sigue guardando, porque es
 * el control grueso que usa el middleware de Next. Se calcula acá también,
 * y no se confía en el que venga en el input: si alguien lograra mandar
 * rol="administrador" con perfil="operario", gana el perfil.
 *
 * Vaciar el inventario NO es un perfil: es exclusivo del super
 * administrador, que sale de una variable de entorno en Next y nunca de
 * esta planilla. Por eso no hay ningún campo acá que lo habilite.
 */

const PERFILES_VALIDOS = ["operario", "encargado", "jefe", "gerente"];

/** El rol grueso que le corresponde a cada perfil. Nunca se carga a mano. */
function rolDePerfil_(perfil) {
  return perfil === "jefe" || perfil === "gerente" ? "administrador" : "operador";
}

/**
 * Perfil efectivo. Los usuarios cargados antes de que esto existiera tienen
 * la celda vacía, así que se deduce del rol que sí tienen: administrador ->
 * jefe, operador -> operario. Con eso nadie cambia de permisos el día que
 * esto entra en producción.
 */
function perfilEfectivo_(usuario) {
  const declarado = String(usuario.perfil || "").trim().toLowerCase();
  if (PERFILES_VALIDOS.indexOf(declarado) !== -1) return declarado;
  return usuario.rol === "administrador" ? "jefe" : "operario";
}

/**
 * Normaliza la lista de plantas. Llega como texto separado por barras
 * ("Tres Gomensoro|Salto") porque una celda no puede guardar una lista de
 * verdad. Descarta lo que no sea una agencia real y lo repetido.
 */
function normalizarAgencias_(texto, agenciaBase) {
  const lista = String(texto || "")
    .split("|")
    .map(function (a) { return String(a).trim(); })
    .filter(function (a) { return a && AGENCIAS.indexOf(a) !== -1; });

  const sinRepetir = [];
  lista.forEach(function (a) {
    if (sinRepetir.indexOf(a) === -1) sinRepetir.push(a);
  });

  if (sinRepetir.length > 0) return sinRepetir.join("|");
  return agenciaBase ? String(agenciaBase) : "";
}

function listarUsuarios_() {
  return leerHoja_(SHEETS.USUARIOS).map(sinPasswordHash_);
}

function obtenerUsuarioPorEmail_(email) {
  const usuarios = leerHoja_(SHEETS.USUARIOS);
  const encontrado = usuarios.find((u) => String(u.email).toLowerCase() === String(email).toLowerCase());
  return encontrado || null; // este SÍ incluye passwordHash: lo necesita el login en Next.js
}

function crearUsuario_(input) {
  if (!input.email || !input.nombre || !input.passwordHash || !input.agencia) {
    throw new Error("Faltan campos obligatorios para crear el usuario (nombre, email, contraseña, agencia)");
  }
  if (AGENCIAS.indexOf(String(input.agencia)) === -1) {
    throw new Error("La agencia '" + input.agencia + "' no es una planta válida");
  }
  const existente = obtenerUsuarioPorEmail_(input.email);
  if (existente) throw new Error(`Ya existe un usuario con el email ${input.email}`);

  // El perfil manda. Si no viene, se deduce del rol para no romper a quien
  // todavía llame a esta función con el formato viejo.
  const perfil = perfilEfectivo_({ perfil: input.perfil, rol: input.rol });
  const agencias = normalizarAgencias_(input.agencias, input.agencia);

  const usuario = {
    id: nuevoId_(),
    nombre: input.nombre,
    email: String(input.email).toLowerCase().trim(),
    passwordHash: input.passwordHash,
    rol: rolDePerfil_(perfil),
    perfil: perfil,
    agencia: input.agencia,
    agencias: agencias,
    activo: true,
    creadoEn: ahora_().iso,
  };
  agregarFila_(SHEETS.USUARIOS, usuario);
  logAccion_("crearUsuario", `${usuario.email} (${perfil} — ${agencias || usuario.agencia})`);
  return sinPasswordHash_(usuario);
}

function actualizarUsuario_(input) {
  if (!input.id) throw new Error("Falta el id del usuario a actualizar");
  const fila = buscarFilaPor_(SHEETS.USUARIOS, "id", input.id);
  if (fila === -1) throw new Error("Usuario no encontrado");

  const actual = leerHoja_(SHEETS.USUARIOS).find((u) => u.id === input.id);
  if (!actual) throw new Error("Usuario no encontrado");

  const cambios = {};
  ["nombre", "email", "passwordHash", "agencia", "activo"].forEach((campo) => {
    if (input[campo] !== undefined) cambios[campo] = input[campo];
  });

  if (cambios.agencia !== undefined && AGENCIAS.indexOf(String(cambios.agencia)) === -1) {
    throw new Error("La agencia '" + cambios.agencia + "' no es una planta válida");
  }

  /*
    Perfil y rol se mueven juntos, siempre. Si viene un perfil nuevo, el rol
    se recalcula solo; el `rol` que venga en el input se ignora a propósito,
    para que no exista la posibilidad de dejar a alguien con perfil de
    operario y rol de administrador.
  */
  if (input.perfil !== undefined) {
    const perfil = perfilEfectivo_({ perfil: input.perfil, rol: actual.rol });
    cambios.perfil = perfil;
    cambios.rol = rolDePerfil_(perfil);
  }

  if (input.agencias !== undefined) {
    const agenciaBase = cambios.agencia !== undefined ? cambios.agencia : actual.agencia;
    cambios.agencias = normalizarAgencias_(input.agencias, agenciaBase);
  }

  actualizarFila_(SHEETS.USUARIOS, fila, cambios);
  logAccion_("actualizarUsuario", input.id);

  const actualizado = leerHoja_(SHEETS.USUARIOS).find((u) => u.id === input.id);
  return sinPasswordHash_(actualizado);
}

function eliminarUsuario_(input) {
  if (!input.id) throw new Error("Falta el id del usuario a eliminar");
  const fila = buscarFilaPor_(SHEETS.USUARIOS, "id", input.id);
  if (fila === -1) throw new Error("Usuario no encontrado");
  eliminarFila_(SHEETS.USUARIOS, fila);
  logAccion_("eliminarUsuario", input.id);
  return { id: input.id };
}

function sinPasswordHash_(usuario) {
  if (!usuario) return usuario;
  const { passwordHash, ...resto } = usuario;
  return resto;
}

/** Devuelve la lista de agencias disponibles para el selector de usuario/importación. */
function listarAgencias_() {
  return AGENCIAS;
}
