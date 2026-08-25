import Image from 'next/image';
import Link from '@/components/Link';

type Highlight = {
  icon: 'shield' | 'bolt' | 'lock' | 'check' | 'mail';
  label: string;
};

const ICONS: Record<Highlight['icon'], string> = {
  shield:
    'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  bolt: 'M13 10V3L4 14h7v7l9-11h-7z',
  lock: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  check: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
  mail: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
};

const ACCENTS = {
  blue: 'bg-blue-500/20 text-blue-300',
  indigo: 'bg-indigo-500/20 text-indigo-300',
  emerald: 'bg-emerald-500/20 text-emerald-300',
} as const;

const ACCENT_ORDER = ['blue', 'indigo', 'emerald'] as const;

type Props = {
  /** Titre affiché sur le panneau de marque (desktop uniquement). */
  brandTitle: string;
  brandSubtitle: string;
  badge?: string;
  highlights: Highlight[];
  children: React.ReactNode;
};

/**
 * Enveloppe visuelle commune aux pages d'authentification.
 *
 * Les pages d'inscription, de connexion et de vérification répétaient chacune
 * une centaine de lignes de balisage identique (panneau de marque, lueurs,
 * logo mobile, carte). Toute retouche graphique devait donc être faite trois
 * fois — et l'était rarement, d'où des écarts visibles entre les écrans.
 *
 * Composant serveur : aucun état, donc rien à envoyer au navigateur.
 */
export default function AuthShell({
  brandTitle,
  brandSubtitle,
  badge,
  highlights,
  children,
}: Props) {
  return (
    <main
      id="main-content"
      className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-slate-100/80 font-sans antialiased"
    >
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl shadow-slate-200/80 border border-slate-200/60 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        <aside className="hidden lg:flex lg:col-span-5 bg-slate-900 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-900 via-indigo-950 to-slate-900 p-10 text-white flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <Link href="/" className="inline-flex items-center gap-3 group mb-8">
              <Image
                src="/logo.png"
                alt=""
                width={40}
                height={40}
                priority
                className="rounded-xl object-contain shadow-md ring-2 ring-white/10 group-hover:scale-105 transition"
              />
              <span className="text-xl font-black tracking-tight text-white">
                Secrétariat<span className="text-blue-400">Pro</span>
              </span>
            </Link>

            {badge && (
              <p className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs font-semibold text-blue-200 mb-6">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                {badge}
              </p>
            )}

            <h2 className="text-3xl font-bold leading-tight tracking-tight text-white text-balance">
              {brandTitle}
            </h2>
            <p className="mt-4 text-slate-300 text-sm leading-relaxed">{brandSubtitle}</p>
          </div>

          <ul className="relative z-10 my-8 space-y-3.5 list-none">
            {highlights.map((item, index) => (
              <li
                key={item.label}
                className="flex items-center gap-3.5 p-3.5 rounded-xl bg-white/5 backdrop-blur-md border border-white/10"
              >
                <span className={`p-2 rounded-lg ${ACCENTS[ACCENT_ORDER[index % ACCENT_ORDER.length]]}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={ICONS[item.icon]} />
                  </svg>
                </span>
                <span className="text-xs font-medium text-slate-200">{item.label}</span>
              </li>
            ))}
          </ul>
        </aside>

        <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-center bg-white">
          <div className="lg:hidden text-center mb-6">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <Image
                src="/logo.png"
                alt=""
                width={38}
                height={38}
                priority
                className="rounded-xl object-contain shadow-md"
              />
              <span className="text-xl font-black tracking-tight text-slate-900">
                Secrétariat<span className="text-blue-600">Pro</span>
              </span>
            </Link>
          </div>

          {children}
        </div>
      </div>
    </main>
  );
}

/**
 * Bandeau de message (erreur ou succès) partagé par les écrans d'auth.
 *
 * `role="alert"` fait annoncer le message par les lecteurs d'écran dès son
 * apparition : auparavant, un utilisateur non voyant voyait sa soumission
 * échouer sans qu'aucune information ne lui parvienne.
 */
export function AuthAlert({
  type,
  children,
}: {
  type: 'error' | 'success' | 'info';
  children: React.ReactNode;
}) {
  const styles = {
    error: 'bg-red-50 text-red-700 border-red-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
  }[type];

  const icon =
    type === 'error'
      ? 'M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z'
      : 'M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z';

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={`mb-6 p-4 rounded-2xl border text-sm font-medium flex items-start gap-3 ${styles}`}
    >
      <svg className="w-5 h-5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path fillRule="evenodd" d={icon} clipRule="evenodd" />
      </svg>
      <span>{children}</span>
    </div>
  );
}
