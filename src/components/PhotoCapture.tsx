"use client";

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type ChangeEvent,
} from "react";
import { Button } from "@/components/ui";

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
  accept = "image/*",
  maxSize = 5 * 1024 * 1024,
  icon = "📷",
}: PhotoCaptureProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isImagePreview, setIsImagePreview] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraReady(false);
  }, []);

  const releasePreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!showCamera) return;

    const video = videoRef.current;
    const mediaStream = streamRef.current;

    if (!video || !mediaStream) return;

    video.srcObject = mediaStream;

    const startPlayback = async () => {
      try {
        await video.play();

        if (mountedRef.current) {
          setCameraReady(video.videoWidth > 0 && video.videoHeight > 0);
        }
      } catch (error) {
        console.warn("[PhotoCapture] Video playback unavailable:", error);

        if (mountedRef.current) {
          setCameraError(
            "La caméra est ouverte, mais son aperçu ne peut pas être affiché.",
          );
        }
      }
    };

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      void startPlayback();
    } else {
      video.addEventListener("loadedmetadata", startPlayback, { once: true });
    }

    return () => {
      video.removeEventListener("loadedmetadata", startPlayback);

      if (video.srcObject === mediaStream) {
        video.srcObject = null;
      }
    };
  }, [showCamera]);

  const handleFile = useCallback(
    (file: File) => {
      if (file.size > maxSize) {
        alert(
          `Fichier trop volumineux. Maximum : ${Math.round(maxSize / 1024 / 1024)} Mo`,
        );
        return;
      }

      releasePreviewUrl();

      setFileName(file.name);
      setIsImagePreview(file.type.startsWith("image/"));

      const url = URL.createObjectURL(file);
      previewUrlRef.current = url;
      setPreview(url);

      onCapture(file);
      stopStream();
      setShowCamera(false);
      setCameraError(null);
    },
    [maxSize, onCapture, releasePreviewUrl, stopStream],
  );

  const handleFileInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCameraReady(false);
    stopStream();

    if (!window.isSecureContext) {
      setCameraError(
        "La caméra nécessite une connexion sécurisée HTTPS. Utilisez localhost ou une version déployée en HTTPS.",
      );
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "Votre navigateur ne prend pas en charge l'accès à la caméra.",
      );
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (!mountedRef.current) {
        mediaStream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = mediaStream;
      setShowCamera(true);
    } catch (error) {
      console.warn("[PhotoCapture] Camera unavailable:", error);

      if (!mountedRef.current) return;

      setShowCamera(false);
      stopStream();

      const errorName =
        error instanceof DOMException ? error.name : "UnknownError";

      switch (errorName) {
        case "NotFoundError":
        case "DevicesNotFoundError":
          setCameraError(
            "Aucune caméra n'a été détectée. Vérifiez qu'elle est activée dans Windows ou importez une photo.",
          );
          break;
        case "NotAllowedError":
        case "PermissionDeniedError":
          setCameraError(
            "L'accès à la caméra a été refusé. Autorisez-le dans les paramètres du navigateur puis réessayez.",
          );
          break;
        case "NotReadableError":
        case "TrackStartError":
          setCameraError(
            "La caméra est détectée, mais elle est déjà utilisée ou bloquée. Fermez les autres applications puis réessayez.",
          );
          break;
        case "OverconstrainedError":
        case "ConstraintNotSatisfiedError":
          setCameraError(
            "La caméra ne prend pas en charge les paramètres demandés.",
          );
          break;
        case "SecurityError":
          setCameraError(
            "Le navigateur bloque l'accès à la caméra pour des raisons de sécurité.",
          );
          break;
        default:
          setCameraError(
            "Impossible d'ouvrir la caméra. Vérifiez les autorisations du navigateur et de Windows.",
          );
      }
    }
  }, [stopStream]);

  const takePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      setCameraError(
        "La caméra est encore en cours d'initialisation. Réessayez dans un instant.",
      );
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setCameraError("La photo n'a pas pu être préparée.");
      return;
    }

    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `photo-${Date.now()}.jpg`, {
            type: "image/jpeg",
          });
          handleFile(file);
        } else {
          setCameraError("La photo n'a pas pu être créée. Veuillez réessayer.");
        }
      },
      "image/jpeg",
      0.92,
    );
  }, [handleFile]);

  const reset = useCallback(() => {
    releasePreviewUrl();
    setPreview(null);
    setFileName(null);
    setIsImagePreview(false);
    setCameraError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    stopStream();
    setShowCamera(false);
  }, [releasePreviewUrl, stopStream]);

  const cancelCamera = useCallback(() => {
    stopStream();
    setShowCamera(false);
    setCameraError(null);
  }, [stopStream]);

  if (preview) {
    return (
      <div className="relative">
        <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-200 bg-emerald-50">
          {isImagePreview ? (
            <img
              src={preview}
              alt="Aperçu"
              className="w-full h-48 object-cover"
            />
          ) : (
            <div className="h-48 flex flex-col items-center justify-center bg-slate-50 text-slate-600">
              <span className="text-4xl" aria-hidden="true">
                📄
              </span>
              <span className="mt-2 text-sm font-semibold">
                Document sélectionné
              </span>
            </div>
          )}
          <div className="absolute top-2 right-2">
            <button
              onClick={reset}
              aria-label="Supprimer le fichier sélectionné"
              className="bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shadow-lg hover:bg-red-600 transition"
              type="button"
            >
              ✕
            </button>
          </div>
          <div className="p-3 flex items-center gap-2">
            <span className="text-emerald-500 text-lg">✓</span>
            <span className="text-sm font-bold text-slate-700 truncate">
              {fileName}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (showCamera) {
    return (
      <div className="space-y-3">
        <div className="relative rounded-2xl overflow-hidden border-2 border-blue-200 bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-64 object-cover"
          />
          {!cameraReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-sm font-semibold text-white">
              Initialisation de la caméra…
            </div>
          )}
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
            <Button
              type="button"
              onClick={takePhoto}
              disabled={!cameraReady}
              variant="primary"
              className="rounded-full px-6 disabled:cursor-not-allowed disabled:opacity-60"
            >
              📸 Prendre la photo
            </Button>
            <Button
              type="button"
              onClick={cancelCamera}
              variant="secondary"
              className="rounded-full px-4"
            >
              Annuler
            </Button>
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />

        {cameraError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium leading-relaxed text-amber-700">
              {cameraError}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFileInput}
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="block w-full border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition"
      >
        <p className="text-3xl mb-2">{icon}</p>
        <p className="text-sm font-bold text-slate-600">{label}</p>
        <p className="text-xs text-slate-400 mt-1">
          {sublabel ||
            `${accept.toLowerCase().includes("pdf") ? "JPG, PNG ou PDF" : "JPG ou PNG"} (max ${Math.round(maxSize / 1024 / 1024)} Mo)`}
        </p>
      </button>

      <div className="flex items-center gap-2 text-xs text-slate-400">
        <div className="flex-1 h-px bg-slate-200" />
        <span>ou</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      <Button
        type="button"
        onClick={startCamera}
        variant="secondary"
        className="w-full rounded-xl"
      >
        📷 Prendre avec la caméra
      </Button>

      {cameraError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
          <p className="text-xs text-amber-700 font-medium leading-relaxed">
            {cameraError}
          </p>
          <Button
            type="button"
            onClick={startCamera}
            variant="secondary"
            className="text-xs py-1.5 px-3 rounded-lg"
          >
            🔄 Réessayer
          </Button>
        </div>
      )}
    </div>
  );
}
