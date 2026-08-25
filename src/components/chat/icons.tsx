/**
 * Pictogrammes de la messagerie.
 *
 * Vingt-six composants SVG sans état, tous construits sur le même `Icon` :
 * 285 lignes qui n'avaient aucune raison de partager un fichier avec la
 * logique de conversation.
 */

import type { ReactNode } from 'react';

export type IconProps = { large?: boolean };

export function Icon({
  children,
  large = false,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={large ? "h-8 w-8" : "h-4 w-4"}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.9}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function SearchIcon() {
  return (
    <Icon>
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="m20 20-3.5-3.5" />
    </Icon>
  );
}

export function PlusIcon() {
  return (
    <Icon>
      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function MessageIcon({ large = false }: IconProps) {
  return (
    <Icon large={large}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12a8 8 0 0 1-8 8H7l-4 2 1.4-4A8 8 0 1 1 21 12Z"
      />
      <path strokeLinecap="round" d="M8 10h8M8 14h5" />
    </Icon>
  );
}

export function ArchiveIcon() {
  return (
    <Icon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7h16M6 7v12h12V7M9 11h6"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 4h14l1 3H4l1-3Z"
      />
    </Icon>
  );
}

export function ShieldIcon() {
  return (
    <Icon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3 19 6v5c0 4.6-2.8 8.1-7 10-4.2-1.9-7-5.4-7-10V6l7-3Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" />
    </Icon>
  );
}

export function AlertTriangleIcon() {
  return (
    <Icon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 4 21 20H3L12 4Z"
      />
      <path strokeLinecap="round" d="M12 9v5M12 17.5h.01" />
    </Icon>
  );
}

export function RefreshIcon() {
  return (
    <Icon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 7v5h-5M4 17v-5h5"
      />
      <path
        strokeLinecap="round"
        d="M18.2 10A7 7 0 0 0 6.1 7.4L4 10M5.8 14A7 7 0 0 0 17.9 16.6L20 14"
      />
    </Icon>
  );
}

export function ProfileIcon() {
  return (
    <Icon>
      <circle cx="12" cy="8" r="3" />
      <path strokeLinecap="round" d="M5.5 19c.8-3.4 3-5 6.5-5s5.7 1.6 6.5 5" />
    </Icon>
  );
}

export function MoreIcon() {
  return (
    <Icon>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function DownloadIcon() {
  return (
    <Icon>
      <path strokeLinecap="round" d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" />
    </Icon>
  );
}

export function DocumentIcon() {
  return (
    <Icon>
      <path strokeLinejoin="round" d="M7 3h7l4 4v14H7zM14 3v5h4" />
      <path strokeLinecap="round" d="M10 13h5M10 17h5" />
    </Icon>
  );
}

export function UnlockIcon() {
  return (
    <Icon>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path strokeLinecap="round" d="M9 10V7a3 3 0 0 1 5.4-1.8" />
    </Icon>
  );
}

export function BackIcon() {
  return (
    <Icon>
      <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
    </Icon>
  );
}

export function ChevronRightIcon() {
  return (
    <Icon>
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
    </Icon>
  );
}

export function ChevronUpIcon() {
  return (
    <Icon>
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 15 6-6 6 6" />
    </Icon>
  );
}

export function CloseIcon() {
  return (
    <Icon>
      <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
    </Icon>
  );
}

export function PaperclipIcon() {
  return (
    <Icon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m15.5 7-6.7 6.7a2.5 2.5 0 0 0 3.5 3.6l6.3-6.4a4.5 4.5 0 0 0-6.4-6.3L5.8 11a6.5 6.5 0 0 0 9.2 9.2l5.5-5.5"
      />
    </Icon>
  );
}

export function ClockIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M12 7v5l3 2" />
    </Icon>
  );
}

export function MicIcon() {
  return (
    <Icon>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path strokeLinecap="round" d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
    </Icon>
  );
}

export function StopIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

export function SendIcon() {
  return (
    <Icon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 4 21 12 4 20l3-8-3-8Zm3 8h7"
      />
    </Icon>
  );
}

export function SpinnerIcon() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden="true"
    />
  );
}


export function CopyIcon() {
  return (
    <Icon>
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </Icon>
  );
}

export function ReplyIcon() {
  return (
    <Icon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m10 8-5 4 5 4v-3h4c3 0 5 1.5 6 4-.2-5.5-2.7-8-7-8h-3V8Z"
      />
    </Icon>
  );
}


export function EditIcon() {
  return (
    <Icon>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m4 20 4.5-1 9.8-9.8-3.5-3.5L5 15.5 4 20ZM13.8 6.7l3.5 3.5"
      />
    </Icon>
  );
}
