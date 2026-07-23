'use client';

function getStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: 'Faible', color: 'bg-red-500' };
  if (score <= 2) return { score, label: 'Moyen', color: 'bg-amber-500' };
  if (score <= 3) return { score, label: 'Bon', color: 'bg-blue-500' };
  return { score, label: 'Excellent', color: 'bg-emerald-500' };
}

export default function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const { score, label, color } = getStrength(password);
  const width = `${(score / 5) * 100}%`;

  return (
    <div className="mt-1.5" role="status" aria-label={`Force du mot de passe : ${label}`}>
      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div className={`h-1.5 rounded-full transition-all duration-300 ${color}`} style={{ width }} />
      </div>
      <p className={`text-[11px] font-bold mt-0.5 ${
        score <= 1 ? 'text-red-600' : score <= 2 ? 'text-amber-600' : score <= 3 ? 'text-blue-600' : 'text-emerald-600'
      }`}>
        {label}
      </p>
    </div>
  );
}
