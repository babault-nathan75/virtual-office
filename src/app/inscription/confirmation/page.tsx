import Link from '@/components/Link';
import Image from 'next/image';

export default function InscriptionConfirmation() {
  return (
    <main className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50 to-blue-50/40 font-sans antialiased">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <Link href="/" className="inline-flex flex-col items-center hover:opacity-90 transition">
          <Image
            src="/logo.png"
            alt="Logo SecrétariatPro"
            width={72}
            height={72}
            priority
            className="rounded-2xl mb-3 object-contain shadow-lg shadow-blue-100"
          />
          <span className="text-2xl font-black tracking-tight text-slate-900">
            Secrétariat<span className="text-blue-600">Pro</span>
          </span>
        </Link>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-12 px-8 sm:px-10 rounded-3xl border border-slate-100 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] text-center">

          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-50 flex items-center justify-center">
            <span className="text-4xl">📧</span>
          </div>

          <h2 className="text-2xl font-black tracking-tight text-slate-900 mb-4">
            Vérifiez votre email
          </h2>

          <p className="text-slate-600 font-medium leading-relaxed mb-8">
            Un email de confirmation vous a été envoyé.
            <br />
            Vérifiez votre boîte de réception et cliquez sur le lien pour valider votre inscription.
          </p>

          <div className="space-y-3">
            <Link
              href="/connexion"
              className="block w-full py-3.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm tracking-tight transition shadow-lg shadow-blue-200"
            >
              Retour à la connexion
            </Link>
            <Link
              href="/"
              className="block w-full py-3.5 rounded-full border-2 border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 font-bold text-sm transition"
            >
              Retour à l&apos;accueil
            </Link>
          </div>

        </div>
      </div>
    </main>
  );
}
