"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Save, Loader2, PackageX, Camera, Clock, WifiOff, ScanText, MapPin, MapPinOff, Filter, ListChecks } from "lucide-react";
import { conteoSchema, type ConteoInput } from "@/lib/validations";
import { AGENCIAS, type Agencia, type Producto } from "@/types";
import { calcularDiferencia, estadoDesdeDiferencia } from "@/lib/utils";
import { productosService } from "@/services/productos.service";
import { conteosService } from "@/services/conteos.service";
import { esContable, normalizarCodigo } from "@/hooks/useDashboardData";
import { useAuth } from "@/contexts/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { PendientesTable } from "@/components/dashboard/PendientesTable";
import { useHardwareScanner } from "@/hooks/useHardwareScanner";
import { useSync } from "@/hooks/useSync";
import {
  cachearProductos,
  getProductoCachePorCodigo,
  getConteosLocales,
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

const BarcodeScanner = dynamic(
  () => import("@/features/escaneo/components/BarcodeScanner").then((m) => m.BarcodeScanner),
  { ssr: false, loading: () => <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"><Loader2 className="animate-spin text-white" size={28} /></div> }
);
const OcrScanner = dynamic(
  () => import("@/features/escaneo/components/OcrScanner").then((m) => m.OcrScanner),
  { ssr: false, loading: () => <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"><Loader2 className="animate-spin text-white" size={28} /></div> }
);

export default function ConteoPage() {
  const { user, agencia, esSuperAdmin } = useAuth();
  const { isOnline, sincronizarAhora } = useSync();

  // Excepción exclusiva del super-admin: puede elegir contar para cualquier
  // planta (ej. Lascano) en vez de quedar fijo a la agencia de su propio
  // usuario (Centro Logístico). Para cualquier otro usuario esto nunca se
  // usa -- agenciaOperativa siempre termina siendo `agencia`, sin cambios
  // de comportamiento.
  const [agenciaSeleccionada, setAgenciaSeleccionada] = useState<Agencia | undefined>(undefined);
  const agenciaOperativa: Agencia = (esSuperAdmin ? agenciaSeleccionada : undefined) ?? agencia ?? "Centro Logístico";

  // Filtro por ubicación/familia para conteo cíclico: acota qué hay que
  // contar en vez de manejar el catálogo entero de la agencia de una.
  // Nota: hoy sigue trayendo el catálogo completo del servidor (el backend
  // de Apps Script todavía no filtra por ubicación/familia) -- lo que este
  // filtro ya resuelve es la parte que se puede hacer sin tocar Apps Script:
  // acotar qué se cuenta y mostrar el avance real de la zona, no de toda
  // la agencia.
  const [ubicacionFiltro, setUbicacionFiltro] = useState<string[]>([]);
  const [familiaFiltro, setFamiliaFiltro] = useState<string[]>([]);
  const [catalogoAgencia, setCatalogoAgencia] = useState<Producto[]>([]);
  const [conteosAgencia, setConteosAgencia] = useState<{ codigo: string }[]>([]);
  const [localesPendientes, setLocalesPendientes] = useState<{ codigo: string }[]>([]);
  const [mostrarPendientesZona, setMostrarPendientesZona] = useState(false);

  const [codigoBuscado, setCodigoBuscado] = useState("");
  const [producto, setProducto] = useState<Producto | null>(null);
  const [noExiste, setNoExiste] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [mostrarCamara, setMostrarCamara] = useState(false);
  const [mostrarCamaraOcr, setMostrarCamaraOcr] = useState(false);
  const [historialProducto, setHistorialProducto] = useState<ConteoLocal[]>([]);
  const [ubicacionIncorrecta, setUbicacionIncorrecta] = useState(false);
  const [ubicacionNueva, setUbicacionNueva] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ConteoInput>({ resolver: zodResolver(conteoSchema) });

  const cantidadActual = watch("stockContado");

  useEffect(() => {
    // Al cambiar de agencia, las ubicaciones/familias de la planta anterior
    // ya no aplican -- se resetea el filtro para no dejarlo "vacío" en
    // silencio mostrando cero productos.
    setUbicacionFiltro([]);
    setFamiliaFiltro([]);

    // Cachea los productos de la agencia operativa actual (la del usuario,
    // salvo que el super-admin haya elegido otra planta arriba), y de paso
    // trae los conteos ya registrados en el servidor para poder calcular el
    // avance real de una zona (ubicación/familia), no solo de toda la agencia.
    productosService
      .listar(agenciaOperativa)
      .then((productos) => {
        setCatalogoAgencia(productos);
        cachearProductos(productos);
      })
      .catch(() => { /* trabaja con lo que ya esté cacheado */ });

    conteosService
      .listar(agenciaOperativa)
      .then(setConteosAgencia)
      .catch(() => { /* el avance de zona queda con lo local nomás */ });
  }, [agenciaOperativa]);

  // Conteos todavía sin sincronizar en este dispositivo -- se suman a los
  // del servidor para que el avance de la zona no "olvide" lo recién
  // contado offline hasta que se sincronice.
  useEffect(() => {
    getConteosLocales().then(setLocalesPendientes).catch(() => {});
  }, [producto, noExiste]);

  const opcionesUbicacion = Array.from(new Set(catalogoAgencia.map((p) => p.ubicacion).filter(Boolean))).sort();
  const opcionesFamilia = Array.from(new Set(catalogoAgencia.map((p) => p.familia).filter(Boolean))).sort();

  const productosZona = catalogoAgencia.filter(
    (p) =>
      esContable(p) &&
      (ubicacionFiltro.length === 0 || ubicacionFiltro.includes(p.ubicacion)) &&
      (familiaFiltro.length === 0 || familiaFiltro.includes(p.familia))
  );
  const codigosContadosZona = new Set(
    [...conteosAgencia, ...localesPendientes].map((c) => normalizarCodigo(c.codigo))
  );
  const pendientesZona = productosZona.filter((p) => !codigosContadosZona.has(normalizarCodigo(p.codigo)));
  const hayFiltroZona = ubicacionFiltro.length > 0 || familiaFiltro.length > 0;

  const buscarCodigo = useCallback(
    async (codigo: string) => {
      const c = codigo.trim();
      if (!c) return;
      setBuscando(true);
      setProducto(null);
      setNoExiste(false);
      setCodigoBuscado(c);
      setUbicacionIncorrecta(false);
      setUbicacionNueva("");
      reset({ codigo: c, stockContado: undefined, observaciones: "", ubicacionNueva: "" });

      try {
        let encontrado = await getProductoCachePorCodigo(c);
        if (!encontrado) {
          // Si no está en caché, busca contra el servidor (agencia operativa actual).
          const todos = await productosService.listar(agenciaOperativa);
          encontrado = todos.find((p) => p.codigo.toLowerCase() === c.toLowerCase());
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
    [reset, agenciaOperativa]
  );

  useHardwareScanner((codigo) => buscarCodigo(codigo), true);

  async function onSubmit(data: ConteoInput) {
    if (ubicacionIncorrecta && !ubicacionNueva.trim()) {
      toast.error("Escribí la nueva ubicación, o marcá que la ubicación es correcta");
      return;
    }

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
        ubicacionNueva: ubicacionIncorrecta ? ubicacionNueva.trim() : "",
        agencia: agenciaOperativa,
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
        setUbicacionIncorrecta(false);
        setUbicacionNueva("");
        reset({ codigo: "", stockContado: undefined, observaciones: "", ubicacionNueva: "" });
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

      {esSuperAdmin ? (
        <div className="flex items-center gap-2 text-xs bg-muted/40 rounded-lg px-3 py-1.5">
          <span className="text-muted-foreground shrink-0">Contando para:</span>
          <Select
            value={agenciaOperativa}
            onValueChange={(v) => setAgenciaSeleccionada(v as Agencia)}
          >
            <SelectTrigger className="h-7 w-auto min-w-40 border-none bg-transparent px-2 font-medium text-foreground shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGENCIAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      ) : agencia && (
        <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-1.5">
          Contando para: <span className="font-medium text-foreground">{agencia}</span>
        </div>
      )}

      {/* Filtro por ubicación/familia para conteo cíclico -- acota qué hace
          falta contar en vez de manejar toda la agencia de una. */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Filter size={13} />
            Conteo cíclico — acotar por zona
          </div>
          <div className="grid grid-cols-2 gap-2">
            <SearchableSelect
              value={ubicacionFiltro}
              onValueChange={setUbicacionFiltro}
              options={opcionesUbicacion}
              allLabel="Todas las ubicaciones"
              placeholder="Buscar ubicación..."
            />
            <SearchableSelect
              value={familiaFiltro}
              onValueChange={setFamiliaFiltro}
              options={opcionesFamilia}
              allLabel="Todas las familias"
              placeholder="Buscar familia..."
            />
          </div>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs text-muted-foreground">
              {hayFiltroZona ? (
                <>
                  <span className="font-medium text-foreground">{productosZona.length - pendientesZona.length}</span>
                  {" de "}
                  <span className="font-medium text-foreground">{productosZona.length}</span>
                  {" contados en esta zona"}
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground">{productosZona.length}</span> productos contables en {agenciaOperativa}
                </>
              )}
            </p>
            {productosZona.length > 0 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setMostrarPendientesZona((v) => !v)}
              >
                <ListChecks size={13} />
                {mostrarPendientesZona ? "Ocultar pendientes" : `Ver pendientes (${pendientesZona.length})`}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {mostrarPendientesZona && (
        <PendientesTable productos={pendientesZona} onQuitarFiltro={() => setMostrarPendientesZona(false)} />
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
            <Camera size={16} /> Escanear con la cámara
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => setMostrarCamaraOcr(true)}>
            <ScanText size={16} /> Tomar foto del número
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
                  <p className="text-sm font-medium">Este código no existe en SAP para {agenciaOperativa}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Podés registrarlo igual — quedará marcado como "No existe en SAP".
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {(producto || noExiste) && (
          <motion.form key="form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            onSubmit={handleSubmit(onSubmit)}>
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

                <div className="space-y-2">
                  <Button type="button" variant={ubicacionIncorrecta ? "default" : "secondary"} className="w-full"
                    onClick={() => setUbicacionIncorrecta((v) => !v)}>
                    {ubicacionIncorrecta ? <MapPinOff size={16} /> : <MapPin size={16} />}
                    {ubicacionIncorrecta ? "La ubicación no es correcta" : "La ubicación es correcta"}
                  </Button>
                  {ubicacionIncorrecta && (
                    <div className="space-y-1.5">
                      <Label htmlFor="ubicacionNueva">Ubicación real (dónde se encontró)</Label>
                      <Input id="ubicacionNueva" placeholder="Ej: Pasillo 4, Estante B"
                        value={ubicacionNueva} onChange={(e) => setUbicacionNueva(e.target.value)} />
                    </div>
                  )}
                </div>

                {producto && diferenciaPreview !== null && (
                  <Badge variant={diferenciaPreview === 0 || diferenciaPreview > 0 ? "success" : "destructive"}>
                    Diferencia: {diferenciaPreview > 0 ? "+" : ""}{diferenciaPreview} ({estadoDesdeDiferencia(diferenciaPreview)})
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
                  <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0">
                    <span className="text-muted-foreground">{c.fecha} {c.hora} · {c.usuarioEmail}</span>
                    <span className="font-medium">{c.stockContado} ({c.diferencia > 0 ? "+" : ""}{c.diferencia})</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {mostrarCamara && (
        <BarcodeScanner
          onDetected={(codigo) => { setMostrarCamara(false); buscarCodigo(codigo); }}
          onClose={() => setMostrarCamara(false)}
        />
      )}
      {mostrarCamaraOcr && (
        <OcrScanner
          onDetected={(codigo) => { setMostrarCamaraOcr(false); buscarCodigo(codigo); }}
          onClose={() => setMostrarCamaraOcr(false)}
        />
      )}
    </div>
  );
}
