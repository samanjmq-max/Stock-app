/**
 * Define quién es el "usuario madre" (super administrador) del sistema.
 * Un super admin puede operar sobre cualquier agencia; el resto de los
 * administradores ("jefes de planta") quedan limitados a la suya propia.
 */
export function esSuperAdmin(email: string | null): boolean {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  if (!superAdminEmail || !email) return false;
  return email.toLowerCase().trim() === superAdminEmail.toLowerCase().trim();
}
