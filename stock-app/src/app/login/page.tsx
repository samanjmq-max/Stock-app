"use client";
import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, useReducedMotion } from "framer-motion";
import { Package, Eye, EyeOff } from "lucide-react";
import { loginSchema, type LoginInput } from "@/lib/validations";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RiceFieldVideoBackground } from "@/components/login/RiceFieldVideoBackground";
import { TiltCard } from "@/components/login/TiltCard";

/*
  El login no usa el componente Card ni los estilos de superficie del resto
  de la app: acá el protagonista es el video, y una tarjeta con fondo propio
  lo tapaba. El formulario flota sobre la imagen -- sin recuadros, sin campos
  blancos -- y la legibilidad la resuelven la gradación del video, un halo
  difuminado detrás del texto y el filo de luz del panel.

  Por la misma razón el texto es siempre claro, sin importar si la app está
  en modo claro u oscuro: esta pantalla es una superficie de medios, no una
  pantalla de interfaz.
*/
export default function LoginPage() {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  // Lógica de autenticación sin cambios: misma validación, mismo login(), mismo manejo de error.
  async function onSubmit(data: LoginInput) {
    setError(null);
    try {
      await login(data.email, data.password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    }
  }

  /*
    Entrada escalonada: marca, título y formulario aparecen de arriba a abajo
    al mismo ritmo que baja la línea del escáner. Con prefers-reduced-motion
    todo se resuelve en cero y la pantalla aparece ya armada.
  */
  const contenedor = {
    oculto: {},
    visible: {
      transition: prefersReducedMotion
        ? { staggerChildren: 0, delayChildren: 0 }
        : { staggerChildren: 0.09, delayChildren: 0.18 },
    },
  };
  const elemento = prefersReducedMotion
    ? { oculto: { opacity: 1, y: 0 }, visible: { opacity: 1, y: 0 } }
    : {
        oculto: { opacity: 0, y: 12 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.45, ease: [0.2, 0.8, 0.2, 1] as const },
        },
      };

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4">
      <RiceFieldVideoBackground />

      {/* Halo: oscurece muy difuminado justo detrás del formulario. Sin
          bordes, así que se lee como profundidad y no como una caja. */}
      <div aria-hidden="true" className="login-halo pointer-events-none absolute inset-0 z-[5]" />

      <motion.div
        variants={contenedor}
        initial="oculto"
        animate="visible"
        className="relative z-10 w-full max-w-[380px] text-white"
      >
        <motion.div variants={elemento} className="mb-8 flex flex-col items-center gap-2.5">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground"
            style={{ boxShadow: "0 0 0 1px hsl(var(--primary) / 0.4), 0 0 32px -4px hsl(var(--primary) / 0.75)" }}
          >
            <Package size={22} />
          </div>
          <h1
            className="font-display text-2xl font-bold tracking-tight"
            style={{ textShadow: "0 2px 18px hsl(20 25% 4% / 0.9)" }}
          >
            StockApp
          </h1>
          <p
            className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-white/75"
            style={{ textShadow: "0 1px 12px hsl(20 25% 4% / 0.9)" }}
          >
            Rice Logistics Intelligence
          </p>
        </motion.div>

        <motion.div variants={elemento}>
          <TiltCard>
            <div className="login-glass relative overflow-hidden rounded-xl p-6">
              {/* Barre una vez al entrar; mientras se valida el ingreso vuelve
                  a barrer en loop -- la app "te está leyendo". */}
              <span className="login-scan" aria-hidden="true" data-repetir={isSubmitting ? "true" : undefined} />

              <p className="mb-5 text-sm font-medium text-white/90">Iniciar sesión</p>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-white/75">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="tu@empresa.com"
                    className="login-field h-11"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    {...register("email")}
                  />
                  {errors.email && (
                    <p id="email-error" className="text-xs text-destructive">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-white/75">Contraseña</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="login-field h-11 pr-10"
                      aria-invalid={!!errors.password}
                      aria-describedby={errors.password ? "password-error" : undefined}
                      {...register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex cursor-pointer items-center px-3 text-white/55 hover:text-white"
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      aria-pressed={showPassword}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p id="password-error" className="text-xs text-destructive">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                {error && (
                  <p role="alert" className="rounded-lg bg-destructive/25 px-3 py-2 text-sm text-white">
                    {error}
                  </p>
                )}

                {/* En reposo late y destella; al enviar se acelera y se
                    enciende. El texto se mantiene, nunca queda una rueda muda. */}
                <Button
                  type="submit"
                  size="lg"
                  className="btn-enter w-full"
                  data-entrando={isSubmitting ? "true" : undefined}
                  loading={isSubmitting}
                >
                  {isSubmitting ? "Ingresando..." : "Ingresar"}
                </Button>

                <p className="text-center text-sm">
                  <Link href="/recuperar" className="text-white/60 underline underline-offset-2 hover:text-primary">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </p>
              </form>
            </div>
          </TiltCard>
        </motion.div>
      </motion.div>
    </div>
  );
}
