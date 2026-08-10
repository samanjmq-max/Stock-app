import { SignJWT, jwtVerify } from "jose";
import type { JwtPayload, Rol, Agencia } from "@/types";

const secretKey = process.env.JWT_SECRET;
if (!secretKey && process.env.NODE_ENV === "production") {
  throw new Error("Falta la variable de entorno JWT_SECRET en producción");
}
const encodedKey = new TextEncoder().encode(secretKey || "dev-secret-cambiar-en-produccion");

const TOKEN_EXPIRATION = "8h";
export const AUTH_COOKIE_NAME = "stock_session";

export async function crearToken(payload: {
  userId: string;
  email: string;
  rol: Rol;
  nombre: string;
  agencia: Agencia;
}): Promise<string> {
  return new SignJWT({
    sub: payload.userId,
    email: payload.email,
    rol: payload.rol,
    nombre: payload.nombre,
    agencia: payload.agencia,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRATION)
    .sign(encodedKey);
}

export async function verificarToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedKey);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}
