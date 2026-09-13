"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType, NotFoundException } from "@zxing/library";
import {
  X,
  FlashlightOff,
  Flashlight,
  RefreshCw,
  Loader2,
  Check,
  PackageX,
  AlertTriangle,
  Clock,
  ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sonidoLecturaCorrecta, sonidoProductoInexistente, sonidoLecturaIncorrecta } from "@/lib/sonidos";
import { vibrarCorrecto, vibrarAdvertencia, vibrarError } from "@/lib/vibracion";

const FORMATOS_SOPORTADOS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.QR_CODE,
];

/**
 * Lo que la pantalla de conteo le contesta al escáner cuando éste le pregunta
 * "¿qué es este código?". El escáner no sabe nada de SAP ni del catálogo: solo
 * sabe mostrar cada uno de estos cuatro desenlaces.
 */
export type ResultadoEscaneo =
  | { tipo: "encontrado"; descripcion: string; ubicacion?: string; stockSap?: number }
  | { tipo: "no_existe" }
  | { tipo: "ya_contado"; descripcion: string; usuarioEmail: string; fecha: string; hora: string }
  | { tipo: "error"; mensaje: string };

/*
  Los siete estados del escáner (design-system MASTER.md, "Escáner").

  Antes había uno solo: la cámara leía, sonaba un beep y el modal se cerraba
  de golpe. Todo lo que pasaba después -- buscar el código en el catálogo,
  descubrir que no existe, descubrir que ya lo contó otro -- ocurría en la
  pantalla de atrás, con el operario ya mirando otra cosa. En el depósito,
  con guantes y una caja en la otra mano, eso significa escanear tres veces
  el mismo código sin entender por qué.

  Ahora el escáner se queda abierto y cuenta lo que está pasando:

    buscando     marco tenue + barrido lento terracota
    detectado    el marco se cierra sobre el código + vibración corta
    consultando  pulso azul (--info): el color de "estoy hablando con el server"
    encontrado   verde + beep + vibración simple -> pasa a la ficha en 280ms
    no_existe    ámbar, NO rojo: no es un error, es un hallazgo que hay que registrar
    error        rojo + vibración doble + la causa escrita
    ya_contado   ámbar + con quién y a qué hora, y la opción de contarlo igual
*/
type Estado = "buscando" | "detectado" | "consultando" | "encontrado" | "no_existe" | "error" | "ya_contado";

interface Props {
  /** Se llama cuando el código queda confirmado y hay que pasar a la ficha. */
  onDetected: (codigo: string) => void;
  onClose: () => void;
  /**
   * Resuelve qué es el código recién leído. Si no se pasa, el escáner se
   * comporta como antes (lee y cierra), así que el componente sigue siendo
   * usable desde cualquier otra pantalla sin obligarla a saber de SAP.
   */
  onResolver?: (codigo: string) => Promise<ResultadoEscaneo>;
}

/** Estilo del marco para cada estado: color del borde y halo. */
const MARCO: Record<Estado, string> = {
  buscando: "border-white/45",
  detectado: "border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.62),0_0_26px_2px_hsl(var(--primary)/0.55)]",
  consultando: "border-info shadow-[0_0_0_9999px_rgba(0,0,0,0.62),0_0_26px_2px_hsl(var(--info)/0.5)]",
  encontrado: "border-success shadow-[0_0_0_9999px_rgba(0,0,0,0.62),0_0_30px_3px_hsl(var(--success)/0.55)]",
  no_existe: "border-warning shadow-[0_0_0_9999px_rgba(0,0,0,0.62),0_0_26px_2px_hsl(var(--warning)/0.5)]",
  ya_contado: "border-warning shadow-[0_0_0_9999px_rgba(0,0,0,0.62),0_0_26px_2px_hsl(var(--warning)/0.5)]",
  error: "border-destructive shadow-[0_0_0_9999px_rgba(0,0,0,0.62),0_0_26px_2px_hsl(var(--destructive)/0.5)]",
};

export function BarcodeScanner({ onDetected, onClose, onResolver }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const yaDetectadoRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const montadoRef = useRef(true);

  // El lector de zxing se arma una sola vez y se queda con el callback que
  // tenía en ese momento. Guardando las props en refs, una lectura hecha diez
  // segundos después sigue consultando el catálogo con los datos de AHORA y
  // no con los de cuando se abrió la cámara.
  const onResolverRef = useRef(onResolver);
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onResolverRef.current = onResolver;
    onDetectedRef.current = onDetected;
  });

  const [dispositivos, setDispositivos] = useState<MediaDeviceInfo[]>([]);
  const [dispositivoActualId, setDispositivoActualId] = useState<string | undefined>(undefined);
  const [linternaActiva, setLinternaActiva] = useState(false);
  const [linternaDisponible, setLinternaDisponible] = useState(false);

  const [estado, setEstado] = useState<Estado>("buscando");
  const [codigo, setCodigo] = useState("");
  const [resultado, setResultado] = useState<ResultadoEscaneo | null>(null);
  /** Error de cámara (permiso denegado, sin dispositivo): distinto de un error de lectura. */
  const [errorCamara, setErrorCamara] = useState<string | null>(null);

  function programar(fn: () => void, ms: number) {
    const t = setTimeout(() => {
      if (montadoRef.current) fn();
    }, ms);
    timersRef.current.push(t);
  }

  const iniciarLectura = useCallback(
    async (deviceId?: string) => {
      setErrorCamara(null);
      yaDetectadoRef.current = false;

      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATOS_SOPORTADOS);
      hints.set(DecodeHintType.TRY_HARDER, true);

      const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });

      try {
        const controls = await reader.decodeFromVideoDevice(deviceId, videoRef.current!, (result, err) => {
          if (result && !yaDetectadoRef.current) {
            yaDetectadoRef.current = true;
            controls.stop();
            manejarLectura(result.getText().trim());
          }
          if (err && !(err instanceof NotFoundException)) {
            // Errores de decodificación frame a frame son normales (no hay
            // código en cuadro); solo logueamos algo inesperado.
          }
        });
        controlsRef.current = controls;

        // Detectar si el dispositivo soporta linterna (torch)
        const stream = videoRef.current?.srcObject as MediaStream | undefined;
        const track = stream?.getVideoTracks()[0];
        trackRef.current = track || null;

        // Fuerza reenfoque automático continuo: en la cámara trasera de muchos
        // celulares, el autofoco por default enfoca una sola vez y se queda
        // fijo, por lo que el segundo/tercer código queda desenfocado.
        try {
          await track?.applyConstraints({ advanced: [{ focusMode: "continuous" } as any] });
        } catch {
          // Este celular/navegador no permite reenfoque automático continuo; se ignora.
        }

        const capabilities = track?.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
        setLinternaDisponible(Boolean(capabilities?.torch));
      } catch (err) {
        setErrorCamara(
          err instanceof Error ? `No se pudo acceder a la cámara: ${err.message}` : "No se pudo acceder a la cámara"
        );
      }
    },
    // `manejarLectura` se define abajo y es estable en la práctica (lee refs y
    // props); no se lista para no re-crear el lector en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /*
    El recorrido completo de una lectura. Cada paso tiene su propio tiempo
    porque cada uno significa algo distinto: los 220ms de "detectado" son el
    acuse de recibo (el marco se cierra, vibra), no un delay decorativo; los
    280ms de "encontrado" son el tiempo que tarda el verde en registrarse
    antes de que la pantalla cambie a la ficha.
  */
  async function manejarLectura(codigoLeido: string) {
    setCodigo(codigoLeido);
    setEstado("detectado");
    vibrarCorrecto();

    // Sin resolver, el componente se comporta como siempre: lee y cierra.
    const resolver = onResolverRef.current;
    if (!resolver) {
      sonidoLecturaCorrecta();
      programar(() => onDetectedRef.current(codigoLeido), 220);
      return;
    }

    programar(async () => {
      setEstado("consultando");
      let res: ResultadoEscaneo;
      try {
        res = await resolver(codigoLeido);
      } catch (err) {
        res = { tipo: "error", mensaje: err instanceof Error ? err.message : "No se pudo consultar el código" };
      }
      if (!montadoRef.current) return;

      setResultado(res);
      setEstado(res.tipo === "encontrado" ? "encontrado" : res.tipo === "error" ? "error" : res.tipo);

      if (res.tipo === "encontrado") {
        sonidoLecturaCorrecta();
        vibrarCorrecto();
        programar(() => onDetectedRef.current(codigoLeido), 280);
      } else if (res.tipo === "error") {
        sonidoLecturaIncorrecta();
        vibrarError();
      } else {
        // no_existe y ya_contado: ámbar. No son errores -- son hallazgos que
        // el operario tiene que poder registrar igual.
        sonidoProductoInexistente();
        vibrarAdvertencia();
      }
    }, 220);
  }

  useEffect(() => {
    montadoRef.current = true;
    navigator.mediaDevices?.enumerateDevices().then((devices) => {
      const cams = devices.filter((d) => d.kind === "videoinput");
      setDispositivos(cams);
      // Preferir la cámara trasera si el label la identifica
      const trasera = cams.find((d) => /back|trasera|rear|environment/i.test(d.label));
      const inicial = trasera?.deviceId || cams[0]?.deviceId;
      setDispositivoActualId(inicial);
      iniciarLectura(inicial);
    });

    const timers = timersRef.current;
    return () => {
      montadoRef.current = false;
      controlsRef.current?.stop();
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Vuelve al estado "buscando" y reanuda la cámara. */
  function escanearOtro() {
    setResultado(null);
    setCodigo("");
    setEstado("buscando");
    controlsRef.current?.stop();
    iniciarLectura(dispositivoActualId);
  }

  function cambiarCamara() {
    if (dispositivos.length < 2) return;
    const idxActual = dispositivos.findIndex((d) => d.deviceId === dispositivoActualId);
    const siguiente = dispositivos[(idxActual + 1) % dispositivos.length];
    if (!siguiente) return;
    controlsRef.current?.stop();
    setDispositivoActualId(siguiente.deviceId);
    setLinternaActiva(false);
    setEstado("buscando");
    setResultado(null);
    iniciarLectura(siguiente.deviceId);
  }

  async function toggleLinterna() {
    const track = trackRef.current;
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !linternaActiva } as any] });
      setLinternaActiva(!linternaActiva);
    } catch {
      // Algunos navegadores no permiten cambiar torch en runtime; se ignora.
    }
  }

  function cerrar() {
    controlsRef.current?.stop();
    onClose();
  }

  const enResultado = estado === "encontrado" || estado === "no_existe" || estado === "ya_contado" || estado === "error";
  const marcoCerrado = estado !== "buscando";

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-between p-4">
        <Button variant="ghost" size="icon" onClick={cerrar} className="text-white hover:bg-white/10">
          <X size={20} />
        </Button>
        <p className="text-white text-sm font-medium">Escaneá el código de barras</p>
        <div className="w-11" />
      </div>

      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {/* El marco ES el indicador de estado: se cierra sobre el código al
              detectarlo y cambia de color según el desenlace. */}
          <div
            className={cn(
              "relative w-72 h-40 rounded-xl border-2 transition-all duration-300 ease-out",
              "shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]",
              MARCO[estado],
              marcoCerrado && "scale-[0.94]",
              estado === "consultando" && "escaneo-pulso"
            )}
          >
            {estado === "buscando" && (
              <div className="escaneo-barrido absolute left-2 right-2 top-1 h-0.5 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_14px_2px_hsl(var(--primary)/0.7)]" />
            )}
          </div>
        </div>

        {/* Estado escrito, siempre debajo del marco: el color nunca es la única
            señal (design-system: "el color es información, pero nunca la única"). */}
        <div className="absolute inset-x-0 bottom-4 flex justify-center px-5 pointer-events-none">
          <EtiquetaEstado estado={estado} codigo={codigo} resultado={resultado} />
        </div>

        {errorCamara && (
          <div className="absolute inset-x-4 top-4 bg-destructive text-destructive-foreground text-sm rounded-lg px-3 py-2">
            {errorCamara}
          </div>
        )}
      </div>

      <div className="p-5 pb-7 space-y-3 bg-black">
        {enResultado && estado !== "encontrado" ? (
          <div className="flex gap-2">
            <Button variant="secondary" size="lg" className="flex-1" onClick={escanearOtro}>
              <RefreshCw size={16} />
              Escanear otro
            </Button>
            {estado !== "error" && (
              <Button size="lg" className="flex-1" onClick={() => onDetected(codigo)}>
                <Check size={16} />
                {estado === "ya_contado" ? "Contar igual" : "Registrar igual"}
              </Button>
            )}
            {estado === "error" && (
              <Button size="lg" className="flex-1" onClick={escanearOtro}>
                <ScanLine size={16} />
                Reintentar
              </Button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3">
            {linternaDisponible && (
              <Button
                variant="secondary"
                size="icon"
                onClick={toggleLinterna}
                aria-label={linternaActiva ? "Apagar linterna" : "Encender linterna"}
                className="rounded-full h-12 w-12"
              >
                {linternaActiva ? <Flashlight size={18} /> : <FlashlightOff size={18} />}
              </Button>
            )}
            {dispositivos.length > 1 && (
              <Button
                variant="secondary"
                size="icon"
                onClick={cambiarCamara}
                aria-label="Cambiar de cámara"
                className="rounded-full h-12 w-12"
              >
                <RefreshCw size={18} />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function EtiquetaEstado({
  estado,
  codigo,
  resultado,
}: {
  estado: Estado;
  codigo: string;
  resultado: ResultadoEscaneo | null;
}) {
  const base = "max-w-full rounded-xl px-3.5 py-2.5 backdrop-blur-sm text-sm flex items-start gap-2.5 shadow-elev-2";

  if (estado === "buscando") {
    return (
      <p className="text-white/75 text-xs text-center">Apuntá al código de barras — se lee solo</p>
    );
  }

  if (estado === "detectado") {
    return (
      <div className={cn(base, "bg-primary/90 text-primary-foreground")}>
        <ScanLine size={16} className="shrink-0 mt-0.5" />
        <span className="font-mono text-xs tracking-wide break-all">{codigo}</span>
      </div>
    );
  }

  if (estado === "consultando") {
    return (
      <div className={cn(base, "bg-black/75 text-white")}>
        <Loader2 size={16} className="shrink-0 mt-0.5 animate-spin" />
        <div className="min-w-0">
          <p className="font-medium">Consultando SAP…</p>
          <p className="font-mono text-[11px] text-white/60 break-all">{codigo}</p>
        </div>
      </div>
    );
  }

  if (estado === "encontrado" && resultado?.tipo === "encontrado") {
    return (
      <div className={cn(base, "bg-success text-success-foreground")}>
        <Check size={16} className="shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="font-medium truncate">{resultado.descripcion}</p>
          <p className="text-[11px] opacity-80">
            {resultado.ubicacion ? `${resultado.ubicacion} · ` : ""}
            Stock SAP: {resultado.stockSap ?? "—"}
          </p>
        </div>
      </div>
    );
  }

  if (estado === "no_existe") {
    return (
      <div className={cn(base, "bg-warning text-warning-foreground")}>
        <PackageX size={16} className="shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="font-medium">No existe en SAP</p>
          <p className="text-[11px] opacity-85">Se puede registrar igual — queda marcado para revisar.</p>
        </div>
      </div>
    );
  }

  if (estado === "ya_contado" && resultado?.tipo === "ya_contado") {
    return (
      <div className={cn(base, "bg-warning text-warning-foreground")}>
        <Clock size={16} className="shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="font-medium truncate">Ya contado hoy</p>
          <p className="text-[11px] opacity-85 break-words">
            {resultado.usuarioEmail} · {resultado.hora}
          </p>
        </div>
      </div>
    );
  }

  if (estado === "error" && resultado?.tipo === "error") {
    return (
      <div className={cn(base, "bg-destructive text-destructive-foreground")}>
        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="font-medium">No se pudo leer</p>
          <p className="text-[11px] opacity-85 break-words">{resultado.mensaje}</p>
        </div>
      </div>
    );
  }

  return null;
}
