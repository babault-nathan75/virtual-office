'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const STEPS = [
  {
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
    title: 'Complétez votre profil',
    description: 'Ajoutez vos informations personnelles et votre photo pour inspirer confiance.',
    href: '/dashboard/secretaire/profil',
    color: 'from-blue-500 to-blue-600',
    bgLight: 'bg-blue-50',
  },
  {
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
      </svg>
    ),
    title: 'Vérifiez votre identité',
    description: 'Passez la vérification KYC pour accéder à toutes les fonctionnalités.',
    href: '/dashboard/kyc',
    color: 'from-indigo-500 to-purple-600',
    bgLight: 'bg-indigo-50',
  },
  {
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    title: 'Activez la 2FA',
    description: 'Sécurisez votre compte avec une double authentification.',
    href: '/dashboard/profil/2fa',
    color: 'from-emerald-500 to-teal-600',
    bgLight: 'bg-emerald-50',
  },
];

export default function Onboarding() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(-1);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from('profils')
        .select('onboarding_completed')
        .eq('id', session.user.id)
        .maybeSingle();

      if (data && !data.onboarding_completed) {
        setTimeout(() => { setVisible(true); setCurrentStep(0); }, 1500);
      }
    };
    check();
  }, []);

  const dismiss = async () => {
    setVisible(false);
    setCurrentStep(-1);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase.from('profils').update({ onboarding_completed: true }).eq('id', session.user.id);
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      dismiss();
    }
  };

  const handleGo = () => {
    const step = STEPS[currentStep];
    dismiss();
    router.push(step.href);
  };

  if (!visible || currentStep < 0) return null;
  const step = STEPS[currentStep];
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={dismiss}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeInZoom_0.2s_ease-out]" />
      <div
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-[slideUp_0.3s_cubic-bezier(0.22,1,0.36,1)]"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Bienvenue sur SecrétariatPro"
      >
        {/* Progress bar */}
        <div className="h-1.5 bg-slate-100">
          <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 ease-out rounded-r-full" style={{ width: `${progress}%` }} />
        </div>

        {/* Header */}
        <div className="px-8 pt-8 pb-6 text-center">
          <div className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br ${step.color} text-white flex items-center justify-center mb-5 shadow-lg transition-transform duration-300 hover:scale-110`}>
            {step.icon}
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">{step.title}</h2>
          <p className="text-sm text-slate-500 font-medium leading-relaxed">{step.description}</p>
        </div>

        {/* Steps list */}
        <div className="px-8 pb-6">
          <div className="space-y-2">
            {STEPS.map((s, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${i === currentStep ? 'bg-slate-50 ring-1 ring-slate-200 shadow-sm' : i < currentStep ? 'bg-emerald-50' : 'opacity-40'}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 ${i < currentStep ? 'bg-emerald-100 text-emerald-600 scale-90' : i === currentStep ? `${s.bgLight} text-slate-700 scale-110` : 'bg-slate-100 text-slate-400'}`}>
                  {i < currentStep ? (
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  ) : (
                    <span className="text-xs font-bold">{i + 1}</span>
                  )}
                </div>
                <span className={`text-sm font-semibold transition-colors duration-300 ${i === currentStep ? 'text-slate-900' : 'text-slate-500'}`}>{s.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="px-8 pb-8 flex gap-3">
          <button onClick={dismiss} className="flex-1 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-all duration-200 active:scale-95">
            Passer
          </button>
          <button onClick={handleGo} className="flex-1 py-3 rounded-xl text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-all duration-200 active:scale-95">
            Aller
          </button>
          <button onClick={handleNext} className={`flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all duration-200 active:scale-95 ${currentStep < STEPS.length - 1 ? 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200' : 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200'}`}>
            {currentStep < STEPS.length - 1 ? 'Suivant' : 'Terminer'}
          </button>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 pb-6">
          {STEPS.map((_, i) => (
            <div key={i} className={`rounded-full transition-all duration-300 ${i === currentStep ? 'bg-blue-600 w-5 h-2' : i < currentStep ? 'bg-blue-300 w-2 h-2' : 'bg-slate-200 w-2 h-2'}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
