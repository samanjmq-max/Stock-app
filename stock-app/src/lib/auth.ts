import { SignJWT, jwtVerify } from "jose";
import type { JwtPayload, Perfil, Rol, Agencia } from "@/types";

const secretKey = process.env.JWT_SECRET;
if (!secretKey && process.env.NODE_ENV === "production") {
  throw new Error("Falta la variable de entorno JWT_SECRET en producción");
}
const encodedKey = new TextEncoder().encode(secretKey || "dev-secret-cambiar-en-produccion");

const TOKEN_EXPIRATION = "8h";
export const AUTH_COOKIE_NAME = "stock_session";

/*
  Emisor y audiencia del token. No son secretos -- son etiquetas fijas que
  viajan firmadas dentro del token y se verifican al leerlo. Sirven para que
  un token no pueda "colarse" desde otro sistema que use la misma clave, y
  para poder pinnear el algoritmo de firma. Baratas y sin costo de uso.
*/
const TOKEN_ISSUER = "stockapp";
const TOKEN_AUDIENCE = "stockapp-users";

export async function crearToken(payload: {
  userId: string;
  email: string;
  rol: Rol;
  nombre: string;
  agencia: Agencia;
  /* Perfil y plantas viajan DENTRO del token, no se consultan por request.
     El middleware corre en el Edge y no puede hablar con Apps Script, así
     que si los permisos no viajan en el token no hay forma de verificarlos
     antes de entrar a la ruta. Contrapartida: un cambio de permisos recién
     se aplica cuando la persona vuelve a iniciar sesión (el token dura 8h). */
  perfil?: Perfil;
  agencias?: string;
}): Promise<string> {
  return new SignJWT({
    sub: payload.userId,
    email: payload.email,
    rol: payload.rol,
    nombre: payload.nombre,
    agencia: payload.agencia,
    perfil: payload.perfil,
    agencias: payload.agencias,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(TOKEN_ISSUER)
    .setAudience(TOKEN_AUDIENCE)
    .setExpirationTime(TOKEN_EXPIRATION)
    .sign(encodedKey);
}

export async function verificarToken(token: string): Promise<JwtPayload | null> {
  try {
    /*
      SEC: se fija el algoritmo permitido a HS256 explícitamente, y se exige
      el emisor y la audiencia esperados. Pinnear el algoritmo cierra los
      ataques de "confusión de algoritmo" (que alguien pida verificar con
      otro algoritmo, ej. `none`); issuer/audience descartan cualquier token
      que no haya sido emitido por esta app.
    */
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ["HS256"],
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    });
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}
