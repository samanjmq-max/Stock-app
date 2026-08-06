/**
 * scripts/generar-hash.js
 *
 * Antes de tener el primer usuario, no hay con qué loguearse para crear
 * el primer usuario (huevo y gallina). Este script genera el hash bcrypt
 * de una contraseña para que pegues la fila del primer administrador
 * directamente en la hoja "Usuarios" de tu Google Sheet.
 *
 * Uso:
 *   node scripts/generar-hash.js "tuContraseñaSegura"
 *
 * Después, en la hoja "Usuarios", agregá una fila con:
 *   id            -> cualquier string único (ej: usa un generador de UUID online, o "admin-001")
 *   nombre        -> tu nombre
 *   email         -> tu email (con el que vas a loguearte)
 *   passwordHash  -> el hash que imprime este script
 *   rol           -> administrador
 *   activo        -> TRUE
 *   creadoEn      -> la fecha de hoy en formato ISO (ej: 2026-07-31T00:00:00.000Z)
 */

const bcrypt = require("bcryptjs");

const password = process.argv[2];

if (!password) {
  console.error("Uso: node scripts/generar-hash.js \"tuContraseña\"");
  process.exit(1);
}

bcrypt.genSalt(10).then((salt) =>
  bcrypt.hash(password, salt).then((hash) => {
    console.log("\nHash generado:\n");
    console.log(hash);
    console.log("\nPegalo en la columna 'passwordHash' de la fila del primer administrador en la hoja 'Usuarios'.\n");
  })
);
