'use client';

import { useEffect, useState } from 'react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { Skeleton, SkeletonCard } from '@/components/Skeleton';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/components/Toast';
import { formatDate } from '@/lib/i18n';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

type Mission = {
  id: number;
  titre: string;
  statut: string;
  created_at: string;
  entreprise_id: string;
};

type Avis = {
  id: number;
  mission_id: number;
  reviewer_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export default function RatingPage() {
  const [userId, setUserId] = useState('');
  // Le rôle était chargé puis jamais lu : la requête associée a été retirée
  // avec l'état (la page affiche le même contenu pour les deux rôles).
  const [missions, setMissions] = useState<Mission[]>([]);
  const [existingAvis, setExistingAvis] = useState<Avis[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  /*
   * Rechargement automatique au retour sur l'onglet et après une reconnexion.
   *
   * L'écran ne se chargeait qu'au montage : un onglet laissé ouvert affichait
   * indéfiniment un état périmé, et le seul recours était de recharger la page.
   * Incrémenter cette clé rejoue l'effet de chargement existant — y compris sa
   * vérification de session, ce qui est souhaitable après une longue absence.
   */
  const [refreshKey, setRefreshKey] = useState(0);
  useAutoRefresh(() => setRefreshKey(key => key + 1));

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const userId = session.user.id;
      setUserId(userId);

      // Fetch concluded missions where the user is involved
      const { data: offres } = await supabase
        .from('offres')
        .select('mission_id, mission_id!inner(id, titre, statut, created_at, entreprise_id)')
        .eq('statut', 'concluee')
        .or(`entreprise_id.eq.${userId},secretaire_id.eq.${userId}`);

      // La relation imbriquée est renvoyée soit comme objet, soit comme
      // tableau selon l'inférence PostgREST : les deux formes sont traitées.
      const missionsData: Mission[] = [];
      for (const o of offres ?? []) {
        const relation = (o as { mission_id: Mission | Mission[] | null }).mission_id;
        const mission = Array.isArray(relation) ? relation[0] : relation;
        if (mission && mission.statut === 'concluee') {
          missionsData.push(mission);
        }
      }
      setMissions(missionsData);

      // Fetch existing reviews
      // L'erreur était ignorée : la table `avis` n'existant pas, la page
      // affichait « aucun avis » au lieu de signaler le problème.
      const { data: avisData, error: avisError } = await supabase
        .from('avis')
        .select('*')
        .eq('reviewer_id', userId);

      if (avisError) {
        console.error('[avis] Lecture échouée :', avisError);
        toast.error('Impossible de charger vos avis.');
      } else if (avisData) {
        setExistingAvis(avisData);
      }

      setLoading(false);
    };
    fetchData();
  }, [refreshKey]);

  useEscapeKey(selectedMission !== null, () => setSelectedMission(null));

  const hasReviewed = (missionId: number) =>
    existingAvis.some(a => a.mission_id === missionId && a.reviewer_id === userId);

  const submitReview = async () => {
    if (!selectedMission || rating === 0) return;
    setSending(true);

    const { error } = await supabase.from('avis').insert({
      mission_id: selectedMission.id,
      reviewer_id: userId,
      rating,
      comment: comment.trim() || null,
    });

    if (error) {
      if (error.code === '23505') {
        toast.error('Vous avez déjà laissé un avis pour cette mission.');
      } else {
        toast.error('Erreur : ' + error.message);
      }
    } else {
      toast.success('Avis envoyé ! Merci.');
      setExistingAvis(prev => [...prev, {
        id: Date.now(),
        mission_id: selectedMission.id,
        reviewer_id: userId,
        rating,
        comment: comment.trim() || null,
        created_at: new Date().toISOString(),
      }]);
      setSelectedMission(null);
      setRating(0);
      setComment('');
    }
    setSending(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-40" />
          <div className="space-y-3 pt-4">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans antialiased">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 mb-2">Noter une collaboration</h1>
        <p className="text-slate-500 font-medium mb-8">
          Évaluez les missions terminées pour aider la communauté.
        </p>

        {missions.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-200 text-center">
            <p className="text-4xl mb-3">⭐</p>
            <p className="text-slate-500 font-medium">Aucune collaboration terminée à noter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {missions.map(m => {
              const reviewed = hasReviewed(m.id);
              return (
                <div key={m.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center">
                  <div>
                    <h3 className="font-black text-slate-900 tracking-tight">{m.titre}</h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {formatDate(m.created_at)}
                    </p>
                  </div>
                  {reviewed ? (
                    <span className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full text-xs font-black">
                      ✓ Avis donné
                    </span>
                  ) : (
                    <button
                      onClick={() => setSelectedMission(m)}
                      className="bg-blue-600 text-white px-5 py-2 rounded-full text-sm font-bold hover:bg-blue-700 transition"
                    >
                      Noter
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rating Modal */}
      {selectedMission && (
        <div role="dialog" aria-modal="true" aria-label="Noter la collaboration" className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]" onClick={() => setSelectedMission(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-blue-50 p-6 border-b border-blue-100">
              <h3 className="text-xl font-black tracking-tight text-slate-900">
                Noter « {selectedMission.titre} »
              </h3>
            </div>
            <div className="p-6 space-y-5">
              {/* Star Rating */}
              <div className="text-center">
                <p className="text-sm font-bold text-slate-700 mb-3">Votre note</p>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(star)}
                      className={`text-3xl transition-transform hover:scale-110 ${
                        star <= (hoverRating || rating) ? 'text-amber-400' : 'text-slate-200'
                      }`}
                      aria-label={`${star} étoile${star > 1 ? 's' : ''}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <p className="text-xs font-bold text-slate-500 mt-2">
                    {rating}/5 — {['', 'Médiocre', 'Passable', 'Bon', 'Très bon', 'Excellent'][rating]}
                  </p>
                )}
              </div>

              {/* Comment */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  Commentaire (optionnel)
                </label>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  rows={3}
                  placeholder="Décrivez votre expérience..."
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedMission(null)}
                  className="flex-1 bg-white text-slate-600 font-bold py-3 rounded-xl border border-slate-200 hover:bg-slate-100 transition text-sm"
                >
                  Annuler
                </button>
                <button
                  onClick={submitReview}
                  disabled={rating === 0 || sending}
                  className="flex-1 bg-blue-600 text-white font-extrabold py-3 rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? 'Envoi...' : 'Envoyer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
