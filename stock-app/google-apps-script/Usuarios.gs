/**
 * Usuarios.gs — el hash de la contraseña SIEMPRE llega ya calculado desde
 * Next.js (bcryptjs, en el servidor). Este script nunca hashea ni compara
 * contraseñas: solo persiste lo que recibe. La comparación en el login
 * también la hace Next.js, después de pedir el usuario por email acá.
 */

function listarUsuarios_() {
  return leerHoja_(SHEETS.USUARIOS).map(sinPasswordHash_);
}

function obtenerUsuarioPorEmail_(email) {
  const usuarios = leerHoja_(SHEETS.USUARIOS);
  const encontrado = usuarios.find((u) => String(u.email).toLowerCase() === String(email).toLowerCase());
  return encontrado || null; // este SÍ incluye passwordHash: lo necesita el login en Next.js
}

function crearUsuario_(input) {
  if (!input.email || !input.nombre || !input.passwordHash || !input.rol) {
    throw new Error("Faltan campos obligatorios para crear el usuario");
  }
  const existente = obtenerUsuarioPorEmail_(input.email);
  if (existente) throw new Error(`Ya existe un usuario con el email ${input.email}`);

  const usuario = {
    id: nuevoId_(),
    nombre: input.nombre,
    email: String(input.email).toLowerCase().trim(),
    passwordHash: input.passwordHash,
    rol: input.rol,
    activo: true,
    creadoEn: ahora_().iso,
  };
  agregarFila_(SHEETS.USUARIOS, usuario);
  logAccion_("crearUsuario", usuario.email);
  return sinPasswordHash_(usuario);
}

function actualizarUsuario_(input) {
  if (!input.id) throw new Error("Falta el id del usuario a actualizar");
  const fila = buscarFilaPor_(SHEETS.USUARIOS, "id", input.id);
  if (fila === -1) throw new Error("Usuario no encontrado");

  const cambios = {};
  ["nombre", "email", "passwordHash", "rol", "activo"].forEach((campo) => {
    if (input[campo] !== undefined) cambios[campo] = input[campo];
  });
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
