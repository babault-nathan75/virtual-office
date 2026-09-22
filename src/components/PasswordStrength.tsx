'use client';

import { COMMON_PASSWORDS } from '@/lib/validations';

function getStrength(password: string): { score: number; label: string; color: string; hasCommon: boolean } {
  let score = 0;
  const hasCommon = COMMON_PASSWORDS.has(password.toLowerCase());
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  // special char is optional but adds strength
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (hasCommon || score <= 1) return { score: Math.min(score, 1), label: 'Trop faible', color: 'bg-red-500', hasCommon: true };
  if (score <= 2) return { score, label: 'Faible', color: 'bg-red-500', hasCommon };
  if (score <= 3) return { score, label: 'Moyen', color: 'bg-amber-500', hasCommon };
  if (score <= 4) return { score, label: 'Bon', color: 'bg-blue-500', hasCommon };
  return { score, label: 'Fort', color: 'bg-emerald-500', hasCommon };
}

export default function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const { score, label, color, hasCommon } = getStrength(password);
  const width = `${Math.min((score / 5) * 100, 100)}%`;

  return (
    <div className="mt-2 animate-[fadeSlideIn_0.2s_ease-out]" role="status" aria-label={`Force du mot de passe : ${label}`}>
      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div className={`h-1.5 rounded-full transition-all duration-500 ease-out ${color}`} style={{ width }} />
      </div>
      <p className={`text-[11px] font-bold mt-1 transition-colors duration-300 ${
        hasCommon ? 'text-red-600' : score <= 2 ? 'text-red-600' : score <= 3 ? 'text-amber-600' : score <= 4 ? 'text-blue-600' : 'text-emerald-600'
      }`}>
        {hasCommon ? 'Mot de passe trop courant' : label}
      </p>
    </div>
  );
}