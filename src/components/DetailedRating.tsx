'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/components/Toast';

const CRITERIA = [
  { key: 'ponctualite', label: 'Ponctualité', icon: '⏰' },
  { key: 'qualite', label: 'Qualité du travail', icon: '✨' },
  { key: 'communication', label: 'Communication', icon: '💬' },
  { key: 'reactivite', label: 'Réactivité', icon: '⚡' },
  { key: 'professionnalisme', label: 'Professionnalisme', icon: '💼' },
] as const;

type RatingCriteria = typeof CRITERIA[number]['key'];

type Props = {
  targetUserId: string;
  missionId?: string;
  onRated?: () => void;
};

export default function DetailedRating({ targetUserId, missionId, onRated }: Props) {
  const [ratings, setRatings] = useState<Record<RatingCriteria, number>>({
    ponctualite: 0,
    qualite: 0,
    communication: 0,
    reactivite: 0,
    professionnalisme: 0,
  });
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const average = Object.values(ratings).filter(v => v > 0).length > 0
    ? (Object.values(ratings).filter(v => v > 0).reduce((a, b) => a + b, 0) / Object.values(ratings).filter(v => v > 0).length).toFixed(1)
    : '—';

  const handleSubmit = async () => {
    const filledRatings = Object.entries(ratings).filter(([, v]) => v > 0);
    if (filledRatings.length < 3) {
      toast.error('Veuillez noter au moins 3 critères.');
      return;
    }

    setSubmitting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error('Non autorisé.'); setSubmitting(false); return; }

    const { error } = await supabase.from('detailed_ratings').insert({
      reviewer_id: session.user.id,
      target_id: targetUserId,
      mission_id: missionId || null,
      ponctualite: ratings.ponctualite || null,
      qualite: ratings.qualite || null,
      communication: ratings.communication || null,
      reactivite: ratings.reactivite || null,
      professionnalisme: ratings.professionnalisme || null,
      average: parseFloat(average),
      comment: comment.trim() || null,
    });

    if (error) {
      toast.error('Erreur : ' + error.message);
    } else {
      toast.success('Merci pour votre évaluation !');
      setSubmitted(true);
      onRated?.();
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-3">🙏</div>
        <p className="font-bold text-slate-900">Merci pour votre évaluation !</p>
        <p className="text-sm text-slate-500 mt-1">Votre avis aide la communauté.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="text-2xl font-black text-slate-900">{average}</p>
        <p className="text-xs text-slate-400">Note moyenne</p>
      </div>

      <div className="space-y-3">
        {CRITERIA.map(c => (
          <div key={c.key} className="flex items-center gap-3">
            <span className="text-lg w-8">{c.icon}</span>
            <span className="text-sm font-medium text-slate-700 w-36">{c.label}</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRatings(prev => ({ ...prev, [c.key]: star }))}
                  className={`text-xl transition ${star <= ratings[c.key] ? 'text-amber-400 scale-110' : 'text-slate-200 hover:text-amber-300'}`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Commentaire optionnel..."
        rows={3}
        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 text-slate-900 resize-none"
      />

      <button
        onClick={handleSubmit}
        disabled={submitting || Object.values(ratings).filter(v => v > 0).length < 3}
        className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitting ? 'Envoi...' : 'Envoyer l\'évaluation'}
      </button>
    </div>
  );
}
