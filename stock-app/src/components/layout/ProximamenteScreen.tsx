import { Construction } from "lucide-react";

export function ProximamenteScreen({ modulo, etapa }: { modulo: string; etapa: string }) {
  return (
    <div className="p-6 flex flex-col items-center justify-center text-center h-[60vh]">
      <div className="h-11 w-11 rounded-xl bg-secondary flex items-center justify-center mb-3">
        <Construction size={18} className="text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{modulo}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">
        Este módulo se construye en la {etapa}, siguiendo el mismo estándar que el resto de la app.
      </p>
    </div>
  );
}
