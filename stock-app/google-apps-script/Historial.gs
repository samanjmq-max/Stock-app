/**
 * Historial.gs — registro de auditoría. Cada acción sensible del sistema
 * (login, logout, crear/editar/eliminar producto o usuario, guardar
 * conteo, resetear, importar, exportar) queda registrada acá y nunca se
 * borra ni edita desde la aplicación.
 */

function listarHistorial_() {
  return leerHoja_(SHEETS.HISTORIAL);
}

function registrarHistorial_(input) {
  if (!input.usuarioId || !input.accion) {
    throw new Error("usuarioId y accion son obligatorios para registrar historial");
  }
  const { fecha, hora } = ahora_();

  const entrada = {
    id: nuevoId_(),
    usuarioId: input.usuarioId,
    usuarioEmail: input.usuarioEmail || "",
    rol: input.rol || "",
    accion: input.accion,
    entidad: input.entidad || "",
    valorAnterior: input.valorAnterior || "",
    valorNuevo: input.valorNuevo || "",
    observacion: input.observacion || "",
    fecha,
    hora,
    dispositivo: input.dispositivo || "",
    ip: input.ip || "",
  };

  agregarFila_(SHEETS.HISTORIAL, entrada);
  return entrada;
}
