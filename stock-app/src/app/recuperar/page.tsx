"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, KeyRound, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RecuperarPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (nuevaPassword !== confirmar) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (nuevaPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch("/api/auth/recuperar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, codigo, nuevaPassword }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "No se pudo procesar la solicitud");
        return;
      }
      setExito(true);
    } catch {
      setError("Error de conexión. Probá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  if (exito) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-secondary/30">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 text-center space-y-3">
            <CheckCircle2 className="mx-auto text-success" size={40} />
            <p className="font-medium">Contraseña actualizada</p>
            <p className="text-sm text-muted-foreground">Ya podés iniciar sesión con tu nueva contraseña.</p>
            <Button className="w-full" onClick={() => router.push("/login")}>
              Ir a iniciar sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-secondary/30">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound size={18} />
            Recuperar contraseña
          </CardTitle>
          <CardDescription>
            Esta recuperación solo funciona con el código de recuperación del super administrador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Código de recuperación</Label>
              <Input type="password" value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Nueva contraseña</Label>
              <Input type="password" value={nuevaPassword} onChange={(e) => setNuevaPassword(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Confirmar nueva contraseña</Label>
              <Input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} required />
            </div>

            {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}

            <Button type="submit" className="w-full" disabled={enviando}>
              {enviando && <Loader2 className="animate-spin" size={15} />}
              Cambiar contraseña
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => router.push("/login")}>
              Volver a iniciar sesión
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
