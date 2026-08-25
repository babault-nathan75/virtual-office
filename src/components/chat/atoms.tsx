'use client';

import type { ReactNode } from 'react';
import { SkeletonChat } from '@/components/Skeleton';
import { getInitials } from './helpers';
import { AlertTriangleIcon, RefreshIcon } from './icons';

/**
 * Composants de présentation de la messagerie.
 *
 * Sans état et sans effet : ils reçoivent des données et les affichent.
 */

export function ChatLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-full min-h-[560px] w-full items-center justify-center rounded-[28px] border border-slate-200 bg-white px-6 text-center shadow-sm">
      <div className="max-w-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600">
          <AlertTriangleIcon />
        </div>
        <h3 className="mt-4 text-lg font-black tracking-tight text-slate-950">
          La messagerie est indisponible
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Vérifiez votre connexion, puis réessayez. Aucun message n&apos;a été
          perdu.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <RefreshIcon />
          Réessayer
        </button>
      </div>
    </div>
  );
}

export function MessageListSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-4xl flex-col gap-4 py-3"
      aria-label="Chargement des messages"
    >
      {[42, 64, 48, 72, 38].map((width, index) => (
        <div
          key={`${width}-${index}`}
          className={`flex ${index % 2 === 0 ? "justify-start" : "justify-end"}`}
        >
          <div
            className="h-14 animate-pulse rounded-[20px] bg-slate-100"
            style={{ width: `${width}%` }}
          />
        </div>
      ))}
    </div>
  );
}

export function ChatWindowSkeleton() {
  return (
    <div className="flex h-full min-h-[560px] w-full overflow-hidden bg-white md:rounded-[28px] md:border md:border-slate-200/80 md:shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
      <div className="w-full shrink-0 border-r border-slate-200 bg-slate-50/60 p-4 md:w-[360px]">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-3 w-20 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="h-10 w-24 animate-pulse rounded-xl bg-slate-200" />
        </div>
        <div className="mt-4 h-10 animate-pulse rounded-xl bg-slate-200/80" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-2xl bg-white/70 p-3"
            >
              <div className="h-11 w-11 animate-pulse rounded-full bg-slate-200" />
              <div className="min-w-0 flex-1">
                <div className="h-3 w-2/5 animate-pulse rounded bg-slate-200" />
                <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="hidden flex-1 items-center justify-center p-6 md:flex">
        <SkeletonChat />
      </div>
    </div>
  );
}

export function ChatAvatar({
  name,
  role,
  src,
  size = "md",
}: {
  name: string;
  role: string;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "xl";
}) {
  const sizes = {
    xs: "h-8 w-8 text-[11px]",
    sm: "h-10 w-10 text-xs",
    md: "h-11 w-11 text-sm",
    xl: "h-20 w-20 text-xl",
  };

  const palette =
    role === "admin"
      ? "bg-gradient-to-br from-amber-100 to-orange-100 text-amber-800"
      : role === "entreprise"
        ? "bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-800"
        : "bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-800";

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={`${sizes[size]} rounded-full object-cover ring-1 ring-black/5`}
      />
    );
  }

  return (
    <span
      className={`${sizes[size]} ${palette} grid shrink-0 select-none place-items-center rounded-full font-black uppercase tracking-tight ring-1 ring-black/5`}
      aria-label={name}
    >
      {getInitials(name)}
    </span>
  );
}

export function DaySeparator({ label }: { label: string }) {
  return (
    <div className="my-5 flex items-center gap-3">
      <span className="h-px flex-1 bg-slate-100" />
      <span className="rounded-full border px-3 py-1 text-[9px] font-bold uppercase tracking-[0.08em] border-slate-200 bg-white text-slate-400">
        {label}
      </span>
      <span className="h-px flex-1 bg-slate-100" />
    </div>
  );
}

export function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border p-3.5 border-slate-200 bg-slate-50/70">
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}

export function MessageAction({
  title,
  onClick,
  danger = false,
  children,
}: {
  title: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`grid h-7 w-7 place-items-center rounded-lg transition ${
        danger
          ? "text-rose-500 hover:bg-rose-50"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      }`}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}

export function ComposerTool({
  title,
  onClick,
  active,
  danger = false,
  disabled = false,
  children,
}: {
  title: string;
  onClick: () => void;
  active: boolean;
  danger?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition disabled:cursor-wait disabled:opacity-60 ${
        danger
          ? "bg-rose-50 text-rose-600"
          : active
            ? "bg-purple-50 text-purple-700"
            : "text-slate-500 hover:bg-white hover:text-slate-700"
      }`}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}
