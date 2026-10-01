"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  formatOctoberRoseDate,
  getLocalDayKey,
  getOctoberRoseMessage,
} from "./OctoberRoseMessages";
import { OctoberRoseBadge } from "./OctoberRoseBadge";
import { RibbonRain } from "./RibbonRain";
import styles from "./OctoberRose.module.css";

const PUBLIC_SEEN_KEY = "secretariat-pro-october-rose-seen";
const PUBLIC_DISMISSED_KEY = "secretariat-pro-october-rose-dismissed";
const ADMIN_SEEN_KEY = "secretariat-pro-admin-october-rose-seen";
const PUBLIC_RAIN_MS = 20_000;
const ADMIN_RAIN_MS = 4_000;
const MESSAGE_DELAY_MS = 1_000;
const DAY_CHECK_MS = 60_000;
const PRIVATE_PATHS = [
  "/dashboard",
  "/connexion",
  "/inscription",
  "/reinitialisation",
  "/mot-de-passe-oublie",
  "/verification",
];

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The campaign remains available for this visit if storage is unavailable.
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function OctoberRose() {
  const pathname = usePathname() ?? "/";
  const isDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const isPrivate = isDashboard || PRIVATE_PATHS.some((path) =>
    pathname === path || pathname.startsWith(`${path}/`),
  );
  const [active, setActive] = useState(false);
  const [rain, setRain] = useState(false);
  const [open, setOpen] = useState(false);
  const [dayKey, setDayKey] = useState("");
  const openRef = useRef(false);
  const activeDayRef = useRef("");

  const updateOpen = useCallback((value: boolean) => {
    openRef.current = value;
    setOpen(value);
  }, []);

  const dismiss = useCallback(() => {
    if (dayKey) writeStorage(PUBLIC_DISMISSED_KEY, dayKey);
    updateOpen(false);
  }, [dayKey, updateOpen]);

  useEffect(() => {
    let publicTimer: ReturnType<typeof setTimeout> | undefined;
    let messageTimer: ReturnType<typeof setTimeout> | undefined;
    let adminTimer: ReturnType<typeof setTimeout> | undefined;
    let midnightTimer: ReturnType<typeof setTimeout> | undefined;

    function checkCampaign() {
      const now = new Date();
      const today = getLocalDayKey(now);
      setDayKey(today);

      if (now.getMonth() !== 9 || (!isDashboard && isPrivate)) {
        setActive(false);
        setRain(false);
        if (!isDashboard) updateOpen(false);
        return;
      }

      setActive(true);
      const dismissedToday = readStorage(PUBLIC_DISMISSED_KEY) === today;

      if (isDashboard) {
        setRain(false);
        updateOpen(false);
        if (readStorage(ADMIN_SEEN_KEY) === today || prefersReducedMotion()) return;
        writeStorage(ADMIN_SEEN_KEY, today);
        setRain(true);
        adminTimer = setTimeout(() => setRain(false), ADMIN_RAIN_MS);
        return;
      }

      if (activeDayRef.current === today) return;
      const cardWasOpen = openRef.current;
      activeDayRef.current = today;

      if (readStorage(PUBLIC_SEEN_KEY) === today) {
        setRain(false);
        updateOpen(!dismissedToday);
        return;
      }

      writeStorage(PUBLIC_SEEN_KEY, today);
      if (cardWasOpen) {
        setRain(false);
        updateOpen(true);
        return;
      }
      if (prefersReducedMotion()) {
        setRain(false);
        updateOpen(!dismissedToday);
        return;
      }

      setRain(true);
      updateOpen(false);
      publicTimer = setTimeout(() => {
        setRain(false);
        messageTimer = setTimeout(() => {
          if (getLocalDayKey(new Date()) === today &&
            readStorage(PUBLIC_DISMISSED_KEY) !== today) {
            updateOpen(true);
          }
        }, MESSAGE_DELAY_MS);
      }, PUBLIC_RAIN_MS);
    }

    function scheduleMidnightCheck() {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      midnightTimer = setTimeout(() => {
        checkCampaign();
        scheduleMidnightCheck();
      }, Math.max(1, nextMidnight.getTime() - now.getTime() + 50));
    }

    const initial = setTimeout(checkCampaign, 0);
    const interval = setInterval(checkCampaign, DAY_CHECK_MS);
    scheduleMidnightCheck();
    document.addEventListener("visibilitychange", checkCampaign);
    return () => {
      clearTimeout(initial);
      clearTimeout(publicTimer);
      clearTimeout(messageTimer);
      clearTimeout(adminTimer);
      clearTimeout(midnightTimer);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", checkCampaign);
    };
  }, [isDashboard, isPrivate, updateOpen]);

  useEffect(() => {
    if (!open) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [dismiss, open]);

  if (!active || !dayKey || dayKey.slice(5, 7) !== "10") return null;

  if (isDashboard) {
    return rain
      ? <RibbonRain durationMs={ADMIN_RAIN_MS} particleCount={2_400} testId="rose-admin-rain" />
      : null;
  }

  const day = Number(dayKey.slice(8, 10));

  return (
    <>
      {rain && <RibbonRain />}
      <OctoberRoseBadge open={open} onOpen={() => updateOpen(true)} />
      {open && (
        <div
          className={styles.alertOverlay}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) dismiss();
          }}
        >
          <aside
            id="october-rose-card"
            className={styles.card}
            aria-labelledby="october-rose-title"
            role="alertdialog"
            aria-modal="true"
            aria-live="polite"
            aria-atomic="true"
          >
            <Image
              src="/octobre-rose/ruban-removebg-preview.png"
              alt=""
              width={442}
              height={442}
              className={styles.backgroundRibbon}
              aria-hidden="true"
            />
            <time className={styles.date} dateTime={dayKey}>
              {formatOctoberRoseDate(dayKey)} · Le message du jour
            </time>
            <button
              type="button"
              className={styles.close}
              onClick={dismiss}
              aria-label="Fermer le message Octobre Rose"
            >
              ×
            </button>
            <p className={styles.eyebrow}>
              <Image
                src="/octobre-rose/123.jfif"
                alt=""
                width={34}
                height={34}
                className={styles.cardRibbon}
                unoptimized
              />
              Octobre Rose · Ensemble
            </p>
            <h2 id="october-rose-title">{getOctoberRoseMessage(day)}</h2>
            <p className={styles.description}>
              SecrétariatPro soutient Octobre Rose, le mois de sensibilisation au
              cancer du sein. Ensemble, informons-nous et prenons soin les uns des autres.
            </p>
            <div className={styles.actions}>
              <a
                href="https://www.sante.gouv.ci/index.php/actualite/1881"
                target="_blank"
                rel="noopener noreferrer"
              >
                En savoir plus
                <span className="sr-only"> sur le site du ministère ivoirien de la Santé (nouvel onglet)</span>
                <span aria-hidden="true">↗</span>
              </a>
              <button type="button" onClick={dismiss}>Continuer sur le site</button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
