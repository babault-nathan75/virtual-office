"use client";

import { useEffect, useRef } from "react";
import styles from "./OctoberRose.module.css";

export const PUBLIC_RIBBON_RAIN_DURATION_MS = 20_000;
export const PUBLIC_RIBBON_RAIN_PARTICLE_COUNT = 24_000;

type Ribbon = {
  x: number;
  delay: number;
  size: number;
  duration: number;
  phase: number;
  wind: number;
  opacity: number;
  useImage: boolean;
};

function bellCurveSample(): number {
  let value = Math.random();
  let acceptance = Math.random();
  while (acceptance > 4 * value * (1 - value)) {
    value = Math.random();
    acceptance = Math.random();
  }
  return value;
}

export function RibbonRain({
  durationMs = PUBLIC_RIBBON_RAIN_DURATION_MS,
  particleCount = PUBLIC_RIBBON_RAIN_PARTICLE_COUNT,
  testId = "rose-rain",
}: {
  durationMs?: number;
  particleCount?: number;
  testId?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const canvasElement = canvas;
    const drawingContext = context;

    const emojiSprite = document.createElement("canvas");
    emojiSprite.width = emojiSprite.height = 48;
    const emojiContext = emojiSprite.getContext("2d");
    if (!emojiContext) return;
    emojiContext.font = '36px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    emojiContext.textAlign = "center";
    emojiContext.textBaseline = "middle";
    emojiContext.fillText("🎀", 24, 25);

    const imageSprite = document.createElement("canvas");
    imageSprite.width = imageSprite.height = 48;
    const image = new Image();
    let imageReady = false;
    image.onload = () => {
      const spriteContext = imageSprite.getContext("2d");
      if (!spriteContext) return;
      const scan = document.createElement("canvas");
      scan.width = image.naturalWidth;
      scan.height = image.naturalHeight;
      const scanContext = scan.getContext("2d");
      if (!scanContext) return;
      scanContext.drawImage(image, 0, 0);
      const pixels = scanContext.getImageData(0, 0, scan.width, scan.height).data;
      let left = scan.width;
      let top = scan.height;
      let right = -1;
      let bottom = -1;
      for (let y = 0; y < scan.height; y++) {
        for (let x = 0; x < scan.width; x++) {
          if (pixels[(y * scan.width + x) * 4 + 3] <= 16) continue;
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
      }
      if (right < left) return;
      const sourceWidth = right - left + 1;
      const sourceHeight = bottom - top + 1;
      const scale = 44 / Math.max(sourceWidth, sourceHeight);
      const drawWidth = sourceWidth * scale;
      const drawHeight = sourceHeight * scale;
      spriteContext.drawImage(
        image,
        left,
        top,
        sourceWidth,
        sourceHeight,
        (48 - drawWidth) / 2,
        (48 - drawHeight) / 2,
        drawWidth,
        drawHeight,
      );
      imageReady = true;
    };
    image.src = "/octobre-rose/ruban-removebg-preview.png";

    let width = 0;
    let height = 0;
    let ribbons: Ribbon[] = [];
    const emissionMs = durationMs * 0.7;

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvasElement.width = width;
      canvasElement.height = height;
      drawingContext.setTransform(1, 0, 0, 1, 0, 0);
      if (ribbons.length) return;

      ribbons = Array.from({ length: particleCount }, (_, index) => {
        const delay = bellCurveSample() * emissionMs;
        const remaining = durationMs - delay;
        return {
          x: Math.random(),
          delay,
          size: 14 + Math.random() * 12,
          duration: Math.min(
            remaining,
            (height + 28) / (250 + Math.random() * 90) * 1000,
          ),
          phase: Math.random() * Math.PI * 2,
          wind: -72 + Math.random() * 144,
          opacity: 0.45 + Math.random() * 0.3,
          useImage: index % 2 === 0,
        };
      });
    }

    resize();
    let frame = 0;
    let lastPaint = 0;
    const start = performance.now();

    function draw(now: number) {
      const elapsed = now - start;
      if (now - lastPaint < 33 && elapsed < durationMs) {
        frame = requestAnimationFrame(draw);
        return;
      }
      lastPaint = now;
      drawingContext.clearRect(0, 0, width, height);

      for (const ribbon of ribbons) {
        if (elapsed < ribbon.delay) continue;
        const progress = (elapsed - ribbon.delay) / ribbon.duration;
        if (progress < 0 || progress >= 1) continue;

        const y = -ribbon.size + progress * (height + ribbon.size * 2);
        const x = (ribbon.x * width + ribbon.wind * progress +
          Math.sin(elapsed / 700 + ribbon.phase) * 14 + width) % width;
        const fadeIn = Math.min(1, progress / 0.12);
        const fadeOut = progress > 0.86 ? (1 - progress) / 0.14 : 1;
        drawingContext.globalAlpha = ribbon.opacity * Math.max(0, Math.min(fadeIn, fadeOut));
        const sprite = ribbon.useImage && imageReady ? imageSprite : emojiSprite;
        drawingContext.save();
        drawingContext.translate(x, y);
        drawingContext.rotate(Math.sin(elapsed / 500 + ribbon.phase) * 0.16);
        drawingContext.drawImage(
          sprite,
          -ribbon.size / 2,
          -ribbon.size / 2,
          ribbon.size,
          ribbon.size,
        );
        drawingContext.restore();
      }

      drawingContext.globalAlpha = 1;
      if (elapsed < durationMs) frame = requestAnimationFrame(draw);
    }

    frame = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    return () => {
      image.onload = null;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [durationMs, particleCount]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.rain}
      style={{ width: "100%", height: "100%" }}
      aria-hidden="true"
      data-testid={testId}
    />
  );
}
