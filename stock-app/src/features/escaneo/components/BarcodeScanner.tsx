"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType, NotFoundException } from "@zxing/library";
import { X, FlashlightOff, Flashlight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sonidoLecturaCorrecta } from "@/lib/sonidos";
import { vibrarCorrecto } from "@/lib/vibracion";

const FORMATOS_SOPORTADOS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.QR_CODE,
];

interface Props {
  onDetected: (codigo: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const yaDetectadoRef = useRef(false);

  const [dispositivos, setDispositivos] = useState<MediaDeviceInfo[]>([]);
  const [dispositivoActualId, setDispositivoActualId] = useState<string | undefined>(undefined);
  const [linternaActiva, setLinternaActiva] = useState(false);
  const [linternaDisponible, setLinternaDisponible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const iniciarLectura = useCallback(async (deviceId?: string) => {
    setError(null);
    yaDetectadoRef.current = false;

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATOS_SOPORTADOS);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });

    try {
      const controls = await reader.decodeFromVideoDevice(
        deviceId,
        videoRef.current!,
        (result, err) => {
          if (result && !yaDetectadoRef.current) {
            yaDetectadoRef.current = true;
            sonidoLecturaCorrecta();
            vibrarCorrecto();
            onDetected(result.getText().trim());
            controls.stop();
          }
          if (err && !(err instanceof NotFoundException)) {
            // Errores de decodificación frame a frame son normales (no hay
            // código en cuadro); solo logueamos algo inesperado.
          }
        }
      );
      controlsRef.current = controls;

      // Detectar si el dispositivo soporta linterna (torch)
      const stream = videoRef.current?.srcObject as MediaStream | undefined;
      const track = stream?.getVideoTracks()[0];
      trackRef.current = track || null;
      try { await track?.applyConstraints({ advanced: [{ focusMode: "continuous" }] as any }); } catch { // Este celular/navegador no permite reenfoque automático continuo; se ignora. }
      const capabilities = track?.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
      setLinternaDisponible(Boolean(capabilities?.torch));
    } catch (err) {
      setError(
        err instanceof Error
          ? `No se pudo acceder a la cámara: ${err.message}`
          : "No se pudo acceder a la cámara"
      );
    }
  }, [onDetected]);

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices().then((devices) => {
      const cams = devices.filter((d) => d.kind === "videoinput");
      setDispositivos(cams);
      // Preferir la cámara trasera si el label la identifica
      const trasera = cams.find((d) => /back|trasera|rear|environment/i.test(d.label));
      const inicial = trasera?.deviceId || cams[0]?.deviceId;
      setDispositivoActualId(inicial);
      iniciarLectura(inicial);
    });

    return () => {
      controlsRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cambiarCamara() {
    if (dispositivos.length < 2) return;
    const idxActual = dispositivos.findIndex((d) => d.deviceId === dispositivoActualId);
    const siguiente = dispositivos[(idxActual + 1) % dispositivos.length];
    controlsRef.current?.stop();
    setDispositivoActualId(siguiente.deviceId);
    setLinternaActiva(false);
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

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-between p-4">
        <Button variant="ghost" size="icon" onClick={cerrar} className="text-white hover:bg-white/10">
          <X size={20} />
        </Button>
        <p className="text-white text-sm font-medium">Escaneá el código de barras</p>
        <div className="w-10" />
      </div>

      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-72 h-40 border-2 border-white/70 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
        </div>
        {error && (
          <div className="absolute inset-x-4 top-4 bg-destructive/90 text-white text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-3 p-6">
        {linternaDisponible && (
          <Button variant="secondary" size="icon" onClick={toggleLinterna} className="rounded-full h-12 w-12">
            {linternaActiva ? <Flashlight size={18} /> : <FlashlightOff size={18} />}
          </Button>
        )}
        {dispositivos.length > 1 && (
          <Button variant="secondary" size="icon" onClick={cambiarCamara} className="rounded-full h-12 w-12">
            <RefreshCw size={18} />
          </Button>
        )}
      </div>
    </div>
  );
}
