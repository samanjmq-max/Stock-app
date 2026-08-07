"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Loader2, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  onDetected: (codigo: string) => void;
  onClose: () => void;
}

// Solo se carga la primera vez que alguien saca una foto — es una
// librería pesada (motor de reconocimiento de texto) y no debe sumarse
// al bundle inicial de la app.
async function reconocerTexto(fuente: HTMLCanvasElement): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    // Limita el reconocimiento a letras mayúsculas y números: los códigos
    // de artículo de este depósito son alfanuméricos, nunca minúsculas
    // ni símbolos, así que restringirlo mejora mucho la precisión.
    await worker.setParameters({
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    });
    const {
      data: { text },
    } = await worker.recognize(fuente);
    return text.replace(/[^A-Z0-9]/g, "").trim();
  } finally {
    await worker.terminate();
  }
}

export function OcrScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [procesando, setProcesando] = useState(false);
  const [codigoDetectado, setCodigoDetectado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch((err) => {
        setError(
          err instanceof Error
            ? `No se pudo acceder a la cámara: ${err.message}`
            : "No se pudo acceder a la cámara"
        );
      });

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capturar = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    setProcesando(true);
    setError(null);
    try {
      const texto = await reconocerTexto(canvas);
      if (!texto) {
        setError("No se pudo leer ningún número o código en la foto. Probá acercar más la cámara o mejorar la luz.");
      } else {
        setCodigoDetectado(texto);
      }
    } catch (err) { const detalle = err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err); setError(`No se pudo procesar la foto: ${detalle || "error desconocido"}`); } finally {
      setProcesando(false);
    }
  }, []);

  function reintentar() {
    setCodigoDetectado(null);
    setError(null);
  }

  function confirmar() {
    if (!codigoDetectado) return;
    onDetected(codigoDetectado);
  }

  function cerrar() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-between p-4">
        <Button variant="ghost" size="icon" onClick={cerrar} className="text-white hover:bg-white/10">
          <X size={20} />
        </Button>
        <p className="text-white text-sm font-medium">Fotografiá el número del artículo</p>
        <div className="w-10" />
      </div>

      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay />
        <canvas ref={canvasRef} className="hidden" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-64 h-24 border-2 border-white/70 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
        </div>
        {procesando && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
            <Loader2 className="animate-spin text-white" size={28} />
            <p className="text-white text-sm">Leyendo número...</p>
          </div>
        )}
        {error && !procesando && (
          <div className="absolute inset-x-4 top-4 bg-destructive/90 text-white text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </div>

      <div className="p-5 space-y-3 bg-black">
        {codigoDetectado ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="codigo-detectado" className="text-white/80">
                Número detectado — revisalo y corregilo si hace falta
              </Label>
              <Input
                id="codigo-detectado"
                value={codigoDetectado}
                onChange={(e) => setCodigoDetectado(e.target.value.toUpperCase())}
                className="text-center text-lg font-medium tracking-wide"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={reintentar}>
                <RotateCcw size={16} />
                Sacar otra foto
              </Button>
              <Button className="flex-1" onClick={confirmar}>
                <Check size={16} />
                Usar este código
              </Button>
            </div>
          </>
        ) : (
          <Button className="w-full" size="lg" onClick={capturar} disabled={procesando}>
            {procesando ? <Loader2 className="animate-spin" size={18} /> : null}
            Capturar
          </Button>
        )}
      </div>
    </div>
  );
}
