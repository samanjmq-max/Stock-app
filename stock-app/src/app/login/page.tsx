"use client";
import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Package, Loader2, Eye, EyeOff } from "lucide-react";
import { loginSchema, type LoginInput } from "@/lib/validations";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { RiceFieldVideoBackground } from "@/components/login/RiceFieldVideoBackground";
import { TiltCard } from "@/components/login/TiltCard";

export default function LoginPage() {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
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

  return (
    <div className="relative min-h-dvh flex items-center justify-center bg-background px-4 overflow-hidden">
      <RiceFieldVideoBackground />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[400px]"
      >
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
            <Package size={20} />
          </div>
          <h1 className="text-lg font-semibold">StockApp</h1>
          <p className="text-sm text-foreground">StockApp — Rice Logistics Intelligence</p>
        </div>

        <TiltCard>
          {/* Menos blur y menos opacidad que antes (blur-xl/30% -> blur-md/18%):
              con blur-xl el vidrio quedaba tan difuminado que el arrozal de
              fondo se veía como una mancha verde plana en vez de imagen --
              con menos blur se sigue leyendo "vidrio esmerilado" pero el
              video se nota bastante más detrás (pedido del usuario). */}
          <Card className="bg-card/[0.18] backdrop-blur-md border-white/20">
            <CardHeader>
              <p className="text-sm font-medium text-foreground">Iniciar sesión</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="tu@empresa.com"
                    className="h-11 bg-background/30 backdrop-blur-sm border-white/25 shadow-inner"
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
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="h-11 pr-10 bg-background/30 backdrop-blur-sm border-white/25 shadow-inner"
                      aria-invalid={!!errors.password}
                      aria-describedby={errors.password ? "password-error" : undefined}
                      {...register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground cursor-pointer"
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
                  <p role="alert" className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <Button type="submit" size="lg" className="w-full btn-shiny" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : null}
                  {isSubmitting ? "Ingresando..." : "Ingresar"}
                </Button>

                <p className="text-center text-sm">
                  <Link href="/recuperar" className="text-muted-foreground hover:text-primary underline underline-offset-2">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </p>
              </form>
            </CardContent>
          </Card>
        </TiltCard>
      </motion.div>
    </div>
  );
}
