import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { JwtPayload, Rol } from "@/types";

const secretKey = process.env.JWT_SECRET;
if (!secretKey && process.env.NODE_ENV === "production") {
  throw new Error("Falta la variable de entorno JWT_SECRET en producción");
}
const encodedKey = new TextEncoder().encode(secretKey || "dev-secret-cambiar-en-produccion");

const TOKEN_EXPIRATION = "8h";
export const AUTH_COOKIE_NAME = "stock_session";

/** Genera un JWT firmado con los datos mínimos necesarios del usuario. */
export async function crearToken(payload: {
  userId: string;
  email: string;
  rol: Rol;
  nombre: string;
}): Promise<string> {
  return new SignJWT({
    sub: payload.userId,
    email: payload.email,
    rol: payload.rol,
    nombre: payload.nombre,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRATION)
    .sign(encodedKey);
}

/** Verifica y decodifica un JWT. Devuelve null si es inválido o expiró. */
export async function verificarToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedKey);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

/** Hashea una contraseña en texto plano para guardarla. */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/** Compara una contraseña en texto plano contra su hash. */
export async function compararPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
