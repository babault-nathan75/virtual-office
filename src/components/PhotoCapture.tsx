'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui';
import { toast } from '@/components/Toast';

type PhotoCaptureProps = {
  onCapture: (file: File) => void;
  label: string;
  sublabel?: string;
  accept?: string;
  maxSize?: number;
  icon?: string;
};

export function PhotoCapture({
  onCapture,
  label,
  sublabel,
  accept = 'image/*',
  maxSize = 5 * 1024 * 1024,
  icon = '📷',
}: PhotoCaptureProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
  }, [stream]);

  useEffect(() => {
    const checkCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraAvailable(false);
        return;
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasCamera = devices.some(d => d.kind === 'videoinput');
        setCameraAvailable(hasCamera);
      } catch {
        setCameraAvailable(false);
      }
    };
    checkCamera();
  }, []);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [stream]);

  useEffect(() => {
    if (!showCamera) return;
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [showCamera, stream]);

  const handleFile = useCallback((file: File) => {
    if (file.size > maxSize) {
      toast.error(`Fichier trop volumineux. Maximum : ${Math.round(maxSize / 1024 / 1024)} Mo`);
      return;
    }
    setFileName(file.name);
    setIsPdf(file.type === 'application/pdf');
    // L'URL objet précédente est libérée : sans révocation, chaque nouveau
    // choix de fichier laissait un blob en mémoire jusqu'au rechargement.
    setPreview(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    onCapture(file);
    stopStream();
    setShowCamera(false);
  }, [maxSize, onCapture, stopStream]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      setShowCamera(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch {
      // Fallback: ouvrir la caméra native du téléphone
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      }
    }
  }, []);

  const takePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
        handleFile(file);
      }
    }, 'image/jpeg', 0.92);
  }, [handleFile]);

  const reset = useCallback(() => {
    setPreview(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setFileName(null);
    setIsPdf(false);
    stopStream();
    setShowCamera(false);
  }, [stopStream]);

  if (preview) {
    return (
      <div className="relative">
        <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-200 bg-emerald-50">
          {/* Un PDF ne s'affiche pas dans une balise <img> : on montre une
              vignette explicite plutôt qu'une image cassée. */}
          {isPdf ? (
            <div className="w-full h-48 flex flex-col items-center justify-center bg-slate-50 text-slate-500">
              <span className="text-4xl mb-2">📄</span>
              <span className="text-xs font-bold">Document PDF</span>
            </div>
          ) : (
            /* `preview` est une blob: URL locale (URL.createObjectURL), que
               l'optimiseur d'images de Next.js ne peut pas charger. */
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Aperçu" className="w-full h-48 object-cover" />
          )}
          <div className="absolute top-2 right-2">
            <button
              onClick={reset}
              className="bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shadow-lg hover:bg-red-600 transition"
              type="button"
            >
              ✕
            </button>
          </div>
          <div className="p-3 flex items-center gap-2">
            <span className="text-emerald-500 text-lg">✓</span>
            <span className="text-sm font-bold text-slate-700 truncate">{fileName}</span>
          </div>
        </div>
      </div>
    );
  }

  if (showCamera) {
    return (
      <div className="space-y-3">
        <div className="relative rounded-2xl overflow-hidden border-2 border-blue-200 bg-black">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-64 object-cover" />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
            <Button type="button" onClick={takePhoto} variant="primary" className="rounded-full px-6">
              📸 Prendre la photo
            </Button>
            <Button type="button" onClick={() => { stopStream(); setShowCamera(false); }} variant="secondary" className="rounded-full px-4">
              Annuler
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input ref={fileInputRef} type="file" accept={accept} className="hidden" onChange={handleFileInput} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleFileInput} />

      <label
        onClick={() => fileInputRef.current?.click()}
        className="block w-full border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition"
      >
        <p className="text-3xl mb-2">{icon}</p>
        <p className="text-sm font-bold text-slate-600">{label}</p>
        <p className="text-xs text-slate-400 mt-1">{sublabel || 'JPG, PNG ou PDF (max 5 Mo)'}</p>
      </label>

      {cameraAvailable !== false && (
        <>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <div className="flex-1 h-px bg-slate-200" />
            <span>ou</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <Button type="button" onClick={startCamera} variant="secondary" className="w-full rounded-xl">
            📷 Prendre avec la caméra
          </Button>
        </>
      )}
    </div>
  );
}
