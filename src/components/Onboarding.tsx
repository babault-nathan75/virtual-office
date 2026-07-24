'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const STEPS = [
  { target: '[data-tour="dashboard"]', title: 'Tableau de bord', content: 'Bienvenue ! Voici votre espace principal.', position: 'bottom' as const },
  { target: '[data-tour="messages"]', title: 'Discussions', content: 'Contactez l\'administration ici.', position: 'bottom' as const },
  { target: '[data-tour="profile"]', title: 'Mon profil', content: 'Complétez votre profil pour être visible.', position: 'bottom' as const },
  { target: '[data-tour="kyc"]', title: 'Vérification', content: 'Passez la vérification KYC pour accéder à toutes les fonctionnalités.', position: 'bottom' as const },
];

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const checkOnboarding = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from('profils')
        .select('onboarding_completed')
        .eq('id', session.user.id)
        .maybeSingle();

      if (data && !data.onboarding_completed) {
        setTimeout(() => setVisible(true), 1000);
      }
    };

    checkOnboarding();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const step = STEPS[currentStep];
    if (!step) return;

    const el = document.querySelector(step.target);
    if (el) {
      const rect = el.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2,
      });
    }
  }, [currentStep, visible]);

  const next = async () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      setVisible(false);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from('profils').update({ onboarding_completed: true }).eq('id', session.user.id);
      }
    }
  };

  const skip = async () => {
    setVisible(false);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase.from('profils').update({ onboarding_completed: true }).eq('id', session.user.id);
    }
  };

  if (!visible || currentStep >= STEPS.length) return null;

  const step = STEPS[currentStep];

  return (
    <div className="fixed inset-0 z-[200]" onClick={skip}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="absolute z-10 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-gray-700 p-5 max-w-xs animate-in fade-in zoom-in duration-200"
        style={{ top: position.top, left: position.left, transform: 'translateX(-50%)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-black text-sm text-slate-900 dark:text-white">{step.title}</h4>
          <span className="text-[10px] text-slate-400 dark:text-gray-500">{currentStep + 1}/{STEPS.length}</span>
        </div>
        <p className="text-xs text-slate-600 dark:text-gray-400 mb-4">{step.content}</p>
        <div className="flex gap-2">
          <button onClick={skip} className="flex-1 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 py-2 rounded-lg transition">
            Passer
          </button>
          <button onClick={next} className="flex-1 bg-blue-600 text-white text-xs font-bold py-2 rounded-lg hover:bg-blue-700 transition">
            {currentStep < STEPS.length - 1 ? 'Suivant' : 'Terminer'}
          </button>
        </div>
        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mt-3">
          {STEPS.map((_, i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full transition ${i === currentStep ? 'bg-blue-600' : i < currentStep ? 'bg-blue-300' : 'bg-slate-200 dark:bg-gray-600'}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
