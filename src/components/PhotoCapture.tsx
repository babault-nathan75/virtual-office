'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui';

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
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

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
    return () => {
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [stream]);

  const handleFile = useCallback((file: File) => {
    if (file.size > maxSize) {
      alert(`Fichier trop volumineux. Maximum : ${Math.round(maxSize / 1024 / 1024)} Mo`);
      return;
    }
    setFileName(file.name);
    const url = URL.createObjectURL(file);
    setPreview(url);
    onCapture(file);
    stopStream();
    setShowCamera(false);
  }, [maxSize, onCapture, stopStream]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      setShowCamera(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch {
      setCameraError('Caméra indisponible. Utilisez le bouton ci-dessous pour ouvrir l\'appareil photo.');
    }
  }, []);

  const openNativeCamera = useCallback(() => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
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
    setPreview(null);
    setFileName(null);
    stopStream();
    setShowCamera(false);
  }, [stopStream]);

  if (preview) {
    return (
      <div className="relative">
        <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-200 bg-emerald-50">
          <img src={preview} alt="Aperçu" className="w-full h-48 object-cover" />
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
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  if (showCamera) {
    return (
      <div className="space-y-3">
        <div className="relative rounded-2xl overflow-hidden border-2 border-blue-200 bg-black">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-64 object-cover" />
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

      <div className="flex items-center gap-2 text-xs text-slate-400">
        <div className="flex-1 h-px bg-slate-200" />
        <span>ou</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      <Button type="button" onClick={openNativeCamera} variant="secondary" className="w-full rounded-xl">
        📷 Prendre avec la caméra
      </Button>

      {cameraError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
          <p className="text-xs text-amber-700 font-medium leading-relaxed">{cameraError}</p>
          <Button type="button" onClick={openNativeCamera} variant="secondary" className="text-xs py-1.5 px-3 rounded-lg">
            🔄 Réessayer
          </Button>
        </div>
      )}
    </div>
  );
}
