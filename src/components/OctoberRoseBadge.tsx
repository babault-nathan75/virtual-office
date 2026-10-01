"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./OctoberRose.module.css";

type Position = { x: number; y: number };
type DragOrigin = { pointerId: number; x: number; y: number; left: number; top: number };
const POSITION_KEY = "secretariat-pro-rose-badge-corner";
const SIDE_GAP = 12;

export function OctoberRoseBadge({
  open,
  onOpen,
}: {
  open: boolean;
  onOpen: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const drag = useRef<DragOrigin | null>(null);
  const moved = useRef(false);
  const positionRef = useRef<Position>({ x: SIDE_GAP, y: 92 });
  const [position, setPosition] = useState<Position>({ x: SIDE_GAP, y: 92 });

  const clamp = useCallback((x: number, y: number): Position => {
    const rect = ref.current?.getBoundingClientRect();
    const isMobile = window.innerWidth < 640;
    const width = rect?.width || (isMobile ? 164 : 196);
    const height = rect?.height || (isMobile ? 46 : 52);
    const maxX = Math.max(SIDE_GAP, window.innerWidth - width - SIDE_GAP);
    const maxY = Math.max(12, window.innerHeight - height - 20);
    return {
      x: Math.max(SIDE_GAP, Math.min(maxX, x)),
      y: Math.max(Math.min(80, maxY), Math.min(maxY, y)),
    };
  }, []);

  const place = useCallback((x: number, y: number) => {
    const next = clamp(x, y);
    positionRef.current = next;
    setPosition(next);
  }, [clamp]);

  useEffect(() => {
    let corner = Math.floor(Math.random() * 4);
    try {
      const storedCorner = sessionStorage.getItem(POSITION_KEY);
      const previous = storedCorner === null ? Number.NaN : Number(storedCorner);
      if (Number.isInteger(previous) && previous >= 0 && previous < 4) {
        corner = (previous + 1) % 4;
      }
      sessionStorage.setItem(POSITION_KEY, String(corner));
    } catch {
      // A random corner still works when session storage is unavailable.
    }
    const isMobile = window.innerWidth < 640;
    const right = window.innerWidth -
      (ref.current?.getBoundingClientRect().width || (isMobile ? 164 : 196)) - SIDE_GAP;
    const bottom = window.innerHeight -
      (ref.current?.getBoundingClientRect().height || (isMobile ? 46 : 52)) - 20;
    const placementFrame = requestAnimationFrame(() => {
      place(corner % 2 ? right : SIDE_GAP, corner < 2 ? 92 : bottom);
    });
    const resize = () => place(positionRef.current.x, positionRef.current.y);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(placementFrame);
      window.removeEventListener("resize", resize);
    };
  }, [place]);

  return (
    <button
      ref={ref}
      type="button"
      className={styles.badge}
      style={{ left: position.x, top: position.y }}
      aria-expanded={open}
      aria-controls="october-rose-card"
      aria-label="Flows Nation soutient Octobre Rose — rouvrir la carte"
      title="Cliquez pour relire · Glissez pour déplacer · Flèches au clavier"
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return;
        moved.current = false;
        drag.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          left: position.x,
          top: position.y,
        };
        if ("setPointerCapture" in event.currentTarget) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
      }}
      onPointerMove={(event) => {
        const origin = drag.current;
        if (!origin || origin.pointerId !== event.pointerId) return;
        const dx = event.clientX - origin.x;
        const dy = event.clientY - origin.y;
        if (Math.hypot(dx, dy) > 5) moved.current = true;
        if (moved.current) place(origin.left + dx, origin.top + dy);
      }}
      onPointerUp={(event) => {
        if (drag.current?.pointerId !== event.pointerId) return;
        drag.current = null;
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => {
        drag.current = null;
        moved.current = true;
      }}
      onClick={(event) => {
        if (moved.current && event.detail !== 0) {
          moved.current = false;
          return;
        }
        onOpen();
      }}
      onKeyDown={(event) => {
        const shifts: Record<string, [number, number]> = {
          ArrowLeft: [-20, 0],
          ArrowRight: [20, 0],
          ArrowUp: [0, -20],
          ArrowDown: [0, 20],
        };
        const shift = shifts[event.key];
        if (!shift) return;
        event.preventDefault();
        place(position.x + shift[0], position.y + shift[1]);
      }}
    >
      <span className={styles.badgeText}>
        Flows Nation soutient <strong>Octobre Rose</strong>
      </span>
      <span className={styles.dragHint} aria-hidden="true">⠿</span>
    </button>
  );
}
