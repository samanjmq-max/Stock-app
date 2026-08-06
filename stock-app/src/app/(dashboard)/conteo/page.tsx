"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Save, Loader2, PackageX, Camera, Clock, WifiOff } from "lucide-react";
import { conteoSchema, type ConteoInput } from "@/lib/validations";
import type { Producto } from "@/types";
import { calcularDiferencia, estadoDesdeDiferencia } from "@/lib/utils";
import { productosService } from "@/services/productos.service";
import { useAuth } from "@/contexts/AuthContext";
import { useHardwareScanner } from "@/hooks/useHardwareScanner";
import { useSync } from "@/hooks/useSync";
import {
  cachearProductos,
  getProductoCachePorCodigo,
  encolarConteo,
  getHistorialLocalDeProducto,
  type ConteoLocal,
} from "@/db/offlineDb";
import { sonidoConteoGuardado, sonidoProductoInexistente, sonidoLecturaIncorrecta } from "@/lib/sonidos";
import { vibrarCorrecto, vibrarAdvertencia } from "@/lib/vibracion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// La librería de escaneo (ZXing) pesa varios cientos de KB y solo la usa
// quien realmente abre la cámara — se carga bajo demanda, no en el bundle
// inicial de la página, para que "Contar stock" abra rápido en 3G/4G.
const BarcodeScanner = dynamic(
  () => import("@/features/escaneo/components/BarcodeScanner").then((m) => m.BarcodeScanner),
  { ssr: false, loading: () => <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"><Loader2 className="animate-spin text-white" size={28} /></div> }
);

export default function ConteoPage() {
  const { user } = useAuth();
  const { isOnline, sincronizarAhora } = useSync();

  const [codigoBuscado, setCodigoBuscado] = useState("");
  const [producto, setProducto] = useState<Producto | null>(null);
  const [noExiste, setNoExiste] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [mostrarCamara, setMostrarCamara] = useState(false);
  const [historialProducto, setHistorialProducto] = useState<ConteoLocal[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ConteoInput>({ resolver: zodResolver(conteoSchema) });

  const cantidadActual = watch("stockContado");

  // Cachea el catálogo de productos en IndexedDB apenas hay conexión,
  // para poder seguir buscando y contando aunque se corte internet.
  useEffect(() => {
    productosService
      .listar()
      .then((productos) => cachearProductos(productos))
      .catch(() => {
        /* sin conexión: se sigue trabajando con lo que ya esté cacheado */
      });
  }, []);

  const buscarCodigo = useCallback(
    async (codigo: string) => {
      const c = codigo.trim();
      if (!c) return;
      setBuscando(true);
      setProducto(null);
      setNoExiste(false);
      setCodigoBuscado(c);
      reset({ codigo: c, stockContado: undefined, observaciones: "" });

      try {
        let encontrado = await getProductoCachePorCodigo(c);
        if (!encontrado) {
          // Si no está en cache local, intenta contra el servidor (puede ser
          // stock recién importado que todavía no se sincronizó al dispositivo).
          encontrado = await productosService.buscarPorCodigo(c);
        }

        if (encontrado) {
          setProducto(encontrado);
        } else {
          setNoExiste(true);
          sonidoLecturaIncorrecta();
        }

        setHistorialProducto(await getHistorialLocalDeProducto(c));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo buscar el producto");
      } finally {
        setBuscando(false);
      }
    },
    [reset]
  );

  // Lector Bluetooth: se comporta como teclado y "tipea" el código + Enter.
  useHardwareScanner((codigo) => buscarCodigo(codigo), true);

  async function onSubmit(data: ConteoInput) {
    const now = new Date();

    const stockSap = producto?.stockSap ?? 0;
    const diferencia = calcularDiferencia(stockSap, data.stockContado);
    const estado = producto ? estadoDesdeDiferencia(diferencia) : "no_existe";

    try {
      await encolarConteo({
        codigo: data.codigo,
        stockContado: data.stockContado,
        observaciones: data.observaciones || "",
        descripcion: producto?.descripcion || "(no existe en SAP)",
        ubicacion: producto?.ubicacion || "",
        stockSap,
        diferencia,
        estado,
        usuarioId: user?.id || "",
        usuarioEmail: user?.email || "",
        fecha: now.toLocaleDateString("es-UY"),
        hora: now.toLocaleTimeString("es-UY"),
      });

      if (estado === "no_existe") {
        sonidoProductoInexistente();
        vibrarAdvertencia();
        toast.warning("Guardado como 'no existe en SAP'", { description: "Un administrador debería revisarlo." });
      } else {
        sonidoConteoGuardado();
        vibrarCorrecto();
        toast.success(isOnline ? "Conteo guardado — sincronizando..." : "Conteo guardado localmente (sin conexión)");
      }

      if (isOnline) sincronizarAhora();

      setTimeout(() => {
        setProducto(null);
        setNoExiste(false);
        setCodigoBuscado("");
        setHistorialProducto([]);
        reset({ codigo: "", stockContado: undefined, observaciones: "" });
      }, 600);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar el conteo");
      sonidoLecturaIncorrecta();
    }
  }

  const diferenciaPreview =
    producto && cantidadActual !== undefined && cantidadActual !== null
      ? calcularDiferencia(producto.stockSap, Number(cantidadActual))
      : null;

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto space-y-4">
      {!isOnline && (
        <div className="flex items-center gap-2 text-xs text-warning-foreground bg-warning/15 rounded-lg px-3 py-2">
          <WifiOff size={14} />
          Sin conexión — los conteos se guardan en el dispositivo y se sincronizan solos al volver internet.
        </div>
      )}

      <Card>
        <CardContent className="pt-5 space-y-3">
          <Label htmlFor="buscador">Código de producto</Label>
          <div className="flex gap-2">
            <Input
              id="buscador"
              placeholder="Escribí, pegá, o escaneá con Bluetooth..."
              value={codigoBuscado}
              onChange={(e) => setCodigoBuscado(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && buscarCodigo(codigoBuscado)}
              autoFocus
            />
            <Button onClick={() => buscarCodigo(codigoBuscado)} disabled={buscando} size="icon">
              {buscando ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
            </Button>
          </div>
          <Button variant="secondary" className="w-full" onClick={() => setMostrarCamara(true)}>
            <Camera size={16} />
            Escanear con la cámara
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Compatible con EAN13, EAN8, UPC, Code128, Code39 y QR — también con lectores Bluetooth.
          </p>
        </CardContent>
      </Card>

      <AnimatePresence mode="wait">
        {noExiste && (
          <motion.div key="no-existe" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="border-warning/40">
              <CardContent className="pt-5 flex items-start gap-3">
                <PackageX className="text-warning-foreground shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="text-sm font-medium">Este código no existe en SAP</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Podés registrarlo igual: quedará marcado como "No existe en SAP" para que un
                    administrador lo revise.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {(producto || noExiste) && (
          <motion.form
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onSubmit={handleSubmit(onSubmit)}
          >
            <Card>
              <CardContent className="pt-5 space-y-4">
                <input type="hidden" {...register("codigo")} value={codigoBuscado} />

                {producto && (
                  <div className="grid grid-cols-2 gap-y-2 text-sm border-b border-border pb-4">
                    <span className="text-muted-foreground">Código</span>
                    <span className="text-right font-medium">{producto.codigo}</span>
                    <span className="text-muted-foreground">Descripción</span>
                    <span className="text-right font-medium">{producto.descripcion}</span>
                    <span className="text-muted-foreground">Ubicación</span>
                    <span className="text-right font-medium">{producto.ubicacion || "—"}</span>
                    <span className="text-muted-foreground">Stock SAP</span>
                    <span className="text-right font-medium">{producto.stockSap}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="stockContado">Cantidad encontrada</Label>
                  <Input id="stockContado" type="number" inputMode="decimal" step="any" {...register("stockContado")} />
                  {errors.stockContado && <p className="text-xs text-destructive">{errors.stockContado.message}</p>}
                </div>

                {producto && diferenciaPreview !== null && (
                  <Badge variant={diferenciaPreview === 0 || diferenciaPreview > 0 ? "success" : "destructive"}>
                    Diferencia: {diferenciaPreview > 0 ? "+" : ""}
                    {diferenciaPreview} ({estadoDesdeDiferencia(diferenciaPreview)})
                  </Badge>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="observaciones">Observaciones (opcional)</Label>
                  <Textarea id="observaciones" rows={2} {...register("observaciones")} />
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  Guardar conteo
                </Button>
              </CardContent>
            </Card>
          </motion.form>
        )}

        {historialProducto.length > 0 && (
          <motion.div key="historial-producto" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card>
              <CardContent className="pt-5 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
                  <Clock size={13} />
                  Conteos anteriores de este producto (en este dispositivo)
                </div>
                {historialProducto.slice(0, 5).map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0"
                  >
                    <span className="text-muted-foreground">
                      {c.fecha} {c.hora} · {c.usuarioEmail}
                    </span>
                    <span className="font-medium">
                      {c.stockContado} ({c.diferencia > 0 ? "+" : ""}
                      {c.diferencia})
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {mostrarCamara && (
        <BarcodeScanner
          onDetected={(codigo) => {
            setMostrarCamara(false);
            buscarCodigo(codigo);
          }}
          onClose={() => setMostrarCamara(false)}
        />
      )}
    </div>
  );
}
