'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from '@/components/Link';
import Image from 'next/image';
import { toast } from '@/components/Toast';
import { SkeletonChat } from '@/components/Skeleton';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { EmptyState } from '@/components/ui';

type Profile = {
  id: string;
  nom: string;
  role: 'entreprise' | 'secretaire' | 'admin';
  email?: string;
  telephone?: string;
  avatar_url?: string;
  last_seen?: string;
};

type Message = {
  id: number;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read: boolean;
  read_at: string | null;
  closed: boolean;
  closed_by: string | null;
  closed_at: string | null;
};

export default function MessagesPage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentRole, setCurrentRole] = useState<'entreprise' | 'secretaire' | 'admin'>('entreprise');
  const [loading, setLoading] = useState(true);

  // Pour Admin : Liste des contacts et contact actif
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [activeContact, setActiveContact] = useState<Profile | null>(null);

  // Messages et saisie
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Panneau de profil latéral (pour l'admin)
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);

  // Discussion fermée
  const [showClosed, setShowClosed] = useState(false);

  // 1. Initialisation & Heartbeat de présence
  useEffect(() => {
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/connexion');
        return;
      }

      const userId = session.user.id;
      setCurrentUserId(userId);

      // Récupérer le profil
      const { data: profil } = await supabase
        .from('profils')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profil) {
        setCurrentRole(profil.role as 'entreprise' | 'secretaire' | 'admin');
      }

      setLoading(false);
    };

    initSession();

    // Mettre à jour last_seen toutes les 30 secondes pour montrer l'activité
    const updatePresence = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase
          .from('profils')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', session.user.id);
      }
    };

    updatePresence();
    const presenceInterval = setInterval(updatePresence, 30_000);
    return () => clearInterval(presenceInterval);
  }, [router]);

  // 2. Chargement des contacts selon le rôle
  useEffect(() => {
    if (!currentUserId) return;

    const fetchContacts = async () => {
      if (currentRole === 'admin') {
        // L'admin voit toutes les entreprises et secrétaires
        const { data } = await supabase
          .from('profils')
          .select('*')
          .neq('id', currentUserId)
          .order('nom', { ascending: true });

        if (data && data.length > 0) {
          setContacts(data);
          setActiveContact(data[0]); // Sélectionner le premier par défaut
        }
      } else {
        // Entreprise ou Secrétaire : discute avec l'Admin
        const { data } = await supabase
          .from('profils')
          .select('*')
          .eq('role', 'admin')
          .limit(1)
          .maybeSingle();

        if (data) {
          setContacts([data]);
          setActiveContact(data);
        }
      }
    };

    fetchContacts();
  }, [currentUserId, currentRole]);

  // 3. Charger les messages avec le contact actif et abonnement Realtime
  useEffect(() => {
    if (!currentUserId || !activeContact) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, content, read, read_at, closed, closed_by, closed_at, created_at')
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${activeContact.id}),and(sender_id.eq.${activeContact.id},receiver_id.eq.${currentUserId})`)
        .order('created_at', { ascending: true });

      if (data) setMessages(data);

      // Marquer comme lus
      await supabase
        .from('messages')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('sender_id', activeContact.id)
        .eq('receiver_id', currentUserId)
        .eq('read', false);
    };

    fetchMessages();

    // Abonnement Realtime pour les messages
    const channel = supabase
      .channel(`chat:${currentUserId}-${activeContact.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as Message;
          if (
            (newMsg.sender_id === currentUserId && newMsg.receiver_id === activeContact.id) ||
            (newMsg.sender_id === activeContact.id && newMsg.receiver_id === currentUserId)
          ) {
            setMessages((prev) => [...prev, newMsg]);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, activeContact]);

  // Défilement automatique vers le bas des messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Envoyer un message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeContact || sending) return;

    setSending(true);
    const contentToSend = newMessage.trim();
    setNewMessage('');

    const { error } = await supabase.from('messages').insert({
      sender_id: currentUserId,
      receiver_id: activeContact.id,
      content: contentToSend,
      read: false,
    });

    if (error) {
      toast.error("Erreur lors de l'envoi du message.");
      setNewMessage(contentToSend);
    }
    setSending(false);
  };

  // Fermer la discussion
  const closeConversation = async () => {
    if (!activeContact) return;
    const { error } = await supabase
      .from('messages')
      .update({ closed: true, closed_by: currentUserId, closed_at: new Date().toISOString() })
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${activeContact.id}),and(sender_id.eq.${activeContact.id},receiver_id.eq.${currentUserId})`)
      .eq('closed', false);

    if (error) {
      toast.error('Erreur lors de la fermeture.');
    } else {
      setMessages(prev => prev.map(m => ({ ...m, closed: true, closed_by: currentUserId, closed_at: new Date().toISOString() })));
      toast.success('Discussion fermée.');
    }
  };

  // Rouvrir la discussion
  const reopenConversation = async () => {
    if (!activeContact) return;
    const { error } = await supabase
      .from('messages')
      .update({ closed: false, closed_by: null, closed_at: null })
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${activeContact.id}),and(sender_id.eq.${activeContact.id},receiver_id.eq.${currentUserId})`)
      .eq('closed', true);

    if (error) {
      toast.error("Erreur lors de la réouverture.");
    } else {
      setMessages(prev => prev.map(m => ({ ...m, closed: false, closed_by: null, closed_at: null })));
      toast.success('Discussion rouverte.');
    }
  };

  // Ticks de lecture
  const renderTicks = (msg: Message) => {
    if (msg.sender_id !== currentUserId) return null;
    if (msg.read_at) {
      return (
        <span className="text-blue-400 ml-1" title="Lu">
          <svg className="w-4 h-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
      );
    }
    if (msg.read) {
      return (
        <span className="text-blue-400 ml-1" title="Envoyé">
          <svg className="w-4 h-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      );
    }
    return (
      <span className="text-slate-300 ml-1" title="Envoyé">
        <svg className="w-4 h-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  };

  // Calcul du statut "En ligne" ou "Il y a X temps"
  const getStatusInfo = (lastSeen?: string) => {
    if (!lastSeen) return { text: 'Hors ligne', online: false, color: 'bg-slate-300' };

    const diffMinutes = Math.floor((new Date().getTime() - new Date(lastSeen).getTime()) / 60000);

    if (diffMinutes < 3) {
      return { text: 'En ligne', online: true, color: 'bg-emerald-500 animate-pulse' };
    } else if (diffMinutes < 60) {
      return { text: `Actif il y a ${diffMinutes} min`, online: false, color: 'bg-amber-400' };
    } else if (diffMinutes < 1440) {
      const hours = Math.floor(diffMinutes / 60);
      return { text: `Actif il y a ${hours}h`, online: false, color: 'bg-slate-300' };
    } else {
      return { text: 'Hors ligne', online: false, color: 'bg-slate-300' };
    }
  };

  const fetchMessages = useCallback(async () => {
    if (!currentUserId || !activeContact) return;
    const { data } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, read, read_at, closed, closed_by, closed_at, created_at')
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${activeContact.id}),and(sender_id.eq.${activeContact.id},receiver_id.eq.${currentUserId})`)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  }, [currentUserId, activeContact]);

  const { pulling, refreshing, onTouchStart, onTouchMove, onTouchEnd } = usePullToRefresh(fetchMessages);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="h-6 bg-slate-200 rounded animate-pulse w-32 mb-6" />
          <div className="h-8 bg-slate-200 rounded animate-pulse w-48 mb-6" />
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[600px]">
            <div className="md:col-span-4 border-r border-slate-100 p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-200 rounded animate-pulse w-1/2" />
                    <div className="h-2 bg-slate-200 rounded animate-pulse w-3/4" />
                  </div>
                </div>
              ))}
            </div>
            <div className="md:col-span-8 flex items-center justify-center">
              <SkeletonChat />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans antialiased">
      <div className="max-w-7xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-sm font-bold text-blue-600 hover:text-blue-800 mb-4 transition"
        >
          ← Tableau de bord
        </Link>

        <header className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Discussions</h1>
            <p className="text-slate-500 font-medium mt-1">
              {currentRole === 'admin'
                ? 'Gérez les échanges avec les secrétaires et entreprises.'
                : 'Discutez directement avec l\'administration de SecrétariatPro.'}
            </p>
          </div>
        </header>

        {/* Interface Chat Container */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[600px] relative">
          
          {/* Sidebar des contacts (Visible pour admin ou si multi-contacts) */}
          {currentRole === 'admin' && (
            <div className="md:col-span-4 border-r border-slate-100 flex flex-col bg-slate-50/50">
              <div className="p-4 border-b border-slate-100">
                <h2 className="font-bold text-sm text-slate-800">Conversations ({contacts.length})</h2>
              </div>
              <div className="overflow-y-auto flex-1 divide-y divide-slate-50">
                {contacts.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-400">Aucun contact trouvé</p>
                ) : (
                  contacts.map((contact) => {
                    const status = getStatusInfo(contact.last_seen);
                    const isSelected = activeContact?.id === contact.id;

                    return (
                      <button
                        key={contact.id}
                        onClick={() => {
                          setActiveContact(contact);
                          setShowProfileDrawer(false);
                        }}
                        className={`w-full text-left p-4 flex items-center gap-3 transition hover:bg-white ${
                          isSelected ? 'bg-white shadow-sm border-l-4 border-blue-600' : 'opacity-80 hover:opacity-100'
                        }`}
                      >
                        <div className="relative shrink-0">
                          <Image
                            src={contact.avatar_url || '/avatar-placeholder.png'}
                            alt={contact.nom}
                            width={42}
                            height={42}
                            className="rounded-full object-cover w-10 h-10 border border-slate-200"
                          />
                          <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${status.color}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-900 truncate">{contact.nom}</h3>
                          </div>
                          <p className="text-xs text-slate-400 capitalize mt-0.5">{contact.role}</p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Fenêtre de discussion principale */}
          <div className={`${currentRole === 'admin' ? 'md:col-span-8' : 'md:col-span-12'} flex flex-col bg-white relative`}>
            {activeContact ? (
              <>
                {/* En-tête de la discussion */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white z-10">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Image
                        src={activeContact.avatar_url || '/avatar-placeholder.png'}
                        alt={activeContact.nom}
                        width={40}
                        height={40}
                        className="rounded-full object-cover w-10 h-10 border border-slate-200"
                      />
                      <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${getStatusInfo(activeContact.last_seen).color}`} />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">{activeContact.nom}</h2>
                      <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span className={`w-2 h-2 rounded-full inline-block ${getStatusInfo(activeContact.last_seen).color}`} />
                        {getStatusInfo(activeContact.last_seen).text}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Bouton profil (admin et autres rôles) */}
                    <button
                      onClick={() => setShowProfileDrawer(!showProfileDrawer)}
                      className="text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg transition flex items-center gap-1.5"
                    >
                      <span>🪪</span>
                      <span>Profil</span>
                    </button>

                    {/* Bouton fermer/rouvrir */}
                    {messages.some(m => m.closed) ? (
                      <button
                        onClick={reopenConversation}
                        className="text-xs font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-3 py-2 rounded-lg transition"
                      >
                        🔓 Rouvrir
                      </button>
                    ) : (
                      <button
                        onClick={closeConversation}
                        className="text-xs font-bold bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-lg transition"
                      >
                        🗄️ Fermer
                      </button>
                    )}
                  </div>
                </div>

                {/* Bannière discussion fermée */}
                {messages.some(m => m.closed) && (
                  <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-center justify-between">
                    <p className="text-xs font-bold text-amber-700">Cette discussion a été fermée.</p>
                    <button
                      onClick={reopenConversation}
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-800 transition"
                    >
                      Rouvrir la discussion
                    </button>
                  </div>
                )}

                {/* Corps des messages */}
                <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} className={`flex-1 p-4 md:p-6 overflow-y-auto space-y-4 bg-slate-50/30 max-h-[500px] transition ${pulling ? 'translate-y-2' : ''} ${refreshing ? 'opacity-60' : ''}`}>
                  {messages.length === 0 ? (
                    <EmptyState
                      icon="💬"
                      title={`Aucune discussion avec ${activeContact.nom}`}
                      description="Envoyez un message pour démarrer la conversation."
                    />
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.sender_id === currentUserId;
                      return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                              isMe
                                ? 'bg-blue-600 text-white rounded-br-none'
                                : 'bg-white text-slate-800 border border-slate-100 rounded-bl-none'
                            }`}
                          >
                            <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                            <div className={`flex items-center justify-end gap-1 mt-1 ${isMe ? 'text-blue-100' : 'text-slate-400'}`}>
                              <p className="text-[10px] font-medium">
                                {new Date(msg.created_at).toLocaleTimeString('fr-FR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                              {renderTicks(msg)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Formulaire d'envoi */}
                {!messages.some(m => m.closed) ? (
                  <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100 bg-white flex gap-2 items-center">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder={`Écrire un message à ${activeContact.nom}...`}
                      className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                    />
                    <button
                      type="submit"
                      disabled={sending || !newMessage.trim()}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-3 rounded-xl text-sm font-bold shadow-md transition shrink-0"
                    >
                      Envoyer
                    </button>
                  </form>
                ) : (
                  <div className="p-4 border-t border-slate-100 bg-slate-50 text-center">
                    <p className="text-xs text-slate-400 font-medium">Discussion fermée</p>
                  </div>
                )}

                {/* Panneau latéral des coordonnées (Profil) */}
                {showProfileDrawer && (
                  <div className="absolute top-0 right-0 w-80 h-full bg-white border-l border-slate-200 shadow-xl z-20 flex flex-col p-6 animate-in slide-in-from-right duration-200">
                    <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                      <h3 className="font-black text-slate-900 text-base">Coordonnées</h3>
                      <button
                        onClick={() => setShowProfileDrawer(false)}
                        className="text-slate-400 hover:text-slate-600 font-bold p-1"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="flex flex-col items-center text-center mb-6">
                      <Image
                        src={activeContact.avatar_url || '/avatar-placeholder.png'}
                        alt={activeContact.nom}
                        width={72}
                        height={72}
                        className="rounded-full object-cover w-18 h-18 border-2 border-slate-100 shadow-sm mb-3"
                      />
                      <h4 className="font-bold text-slate-900 text-lg">{activeContact.nom}</h4>
                      <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold uppercase rounded-full mt-1">
                        {activeContact.role}
                      </span>
                    </div>

                    <div className="space-y-4 text-sm flex-1">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="block text-xs text-slate-400 font-bold uppercase tracking-wider">Email</span>
                        <span className="font-semibold text-slate-800 break-all">{activeContact.email || 'Non renseigné'}</span>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="block text-xs text-slate-400 font-bold uppercase tracking-wider">Téléphone</span>
                        <span className="font-semibold text-slate-800">{activeContact.telephone || 'Non renseigné'}</span>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="block text-xs text-slate-400 font-bold uppercase tracking-wider">Dernière activité</span>
                        <span className="font-semibold text-slate-800">{getStatusInfo(activeContact.last_seen).text}</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-12 text-center text-slate-400">
                <p>Sélectionnez une conversation pour commencer.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}