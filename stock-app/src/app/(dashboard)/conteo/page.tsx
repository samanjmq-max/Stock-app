"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Save, Loader2, PackageX, Camera, Clock, WifiOff, ScanText } from "lucide-react";
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
const OcrScanner = dynamic(
  () => import("@/features/escaneo/components/OcrScanner").then((m) => m.OcrScanner),
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
  const [mostrarCamaraOcr, setMostrarCamaraOcr] = useState(false);
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
      reset({ codigo: c, stockContado: undefined,
