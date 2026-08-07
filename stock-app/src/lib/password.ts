import bcrypt from "bcryptjs";

/** Hashea una contraseña en texto plano para guardarla. */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/** Compara una contraseña en texto plano contra su hash. */
export async function compararPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
