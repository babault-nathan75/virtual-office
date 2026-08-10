'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { useRouter } from 'next/navigation';

import Link from '@/components/Link';
import { SkeletonChat } from '@/components/Skeleton';
import { toast } from '@/components/Toast';
import { EmptyState } from '@/components/ui';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { supabase } from '@/lib/supabaseClient';

type UserRole = 'entreprise' | 'secretaire' | 'admin';

type Profile = {
  id: string;
  nom: string;
  role: UserRole;
  email?: string | null;
  telephone?: string | null;
  avatar_url?: string | null;
  last_seen?: string | null;
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

type PresenceInfo = {
  text: string;
  dotClass: string;
};

const MESSAGE_SELECT =
  'id, sender_id, receiver_id, content, read, read_at, closed, closed_by, closed_at, created_at';

const PROFILE_SELECT =
  'id, nom, role, email, telephone, avatar_url, last_seen';

function isUserRole(value: unknown): value is UserRole {
  return value === 'entreprise' || value === 'secretaire' || value === 'admin';
}

function getPresenceInfo(lastSeen: string | null | undefined, now: number): PresenceInfo {
  if (!lastSeen) {
    return {
      text: 'Hors ligne',
      dotClass: 'bg-slate-300',
    };
  }

  const lastSeenTime = new Date(lastSeen).getTime();

  if (Number.isNaN(lastSeenTime)) {
    return {
      text: 'Hors ligne',
      dotClass: 'bg-slate-300',
    };
  }

  const diffMinutes = Math.max(0, Math.floor((now - lastSeenTime) / 60_000));

  if (diffMinutes < 3) {
    return {
      text: 'En ligne',
      dotClass: 'bg-emerald-500',
    };
  }

  if (diffMinutes < 60) {
    return {
      text: `Actif il y a ${diffMinutes} min`,
      dotClass: 'bg-amber-400',
    };
  }

  if (diffMinutes < 1_440) {
    const hours = Math.floor(diffMinutes / 60);
    return {
      text: `Actif il y a ${hours} h`,
      dotClass: 'bg-slate-300',
    };
  }

  const days = Math.floor(diffMinutes / 1_440);

  if (days === 1) {
    return {
      text: 'Actif hier',
      dotClass: 'bg-slate-300',
    };
  }

  return {
    text: `Actif il y a ${days} j`,
    dotClass: 'bg-slate-300',
  };
}

function getRoleLabel(role: UserRole): string {
  if (role === 'admin') return 'Administration';
  if (role === 'secretaire') return 'Secrétaire';
  return 'Entreprise';
}

function formatMessageTime(date: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

function formatDayLabel(date: string): string {
  const messageDate = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(messageDate, today)) return "Aujourd'hui";
  if (sameDay(messageDate, yesterday)) return 'Hier';

  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: messageDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  }).format(messageDate);
}

function isSameCalendarDay(first: string, second: string): boolean {
  const a = new Date(first);
  const b = new Date(second);

  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function MessagesPage() {
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState('');
  const [currentRole, setCurrentRole] = useState<UserRole>('entreprise');
  const [loading, setLoading] = useState(true);
  const [contactsLoading, setContactsLoading] = useState(false);

  const [contacts, setContacts] = useState<Profile[]>([]);
  const [activeContact, setActiveContact] = useState<Profile | null>(null);
  const [contactSearch, setContactSearch] = useState('');

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationActionLoading, setConversationActionLoading] = useState(false);

  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(0);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const conversationClosed = useMemo(
    () => messages.some((message) => message.closed),
    [messages],
  );

  const filteredContacts = useMemo(() => {
    const query = contactSearch.trim().toLocaleLowerCase('fr-FR');

    if (!query) return contacts;

    return contacts.filter((contact) => {
      const searchable = [
        contact.nom,
        getRoleLabel(contact.role),
        contact.email ?? '',
        contact.telephone ?? '',
      ]
        .join(' ')
        .toLocaleLowerCase('fr-FR');

      return searchable.includes(query);
    });
  }, [contactSearch, contacts]);

  const activePresence = activeContact
    ? getPresenceInfo(activeContact.last_seen, now)
    : null;

  const dashboardHref = currentRole === 'admin' ? '/admin' : '/dashboard';

  // Session + profil courant.
  useEffect(() => {
    let cancelled = false;

    const initSession = async () => {
      try {
        setLoading(true);

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (!session) {
          router.replace('/connexion');
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profils')
          .select(PROFILE_SELECT)
          .eq('id', session.user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        if (!profile || !isUserRole(profile.role)) {
          toast.error('Votre profil est introuvable ou invalide.');
          router.replace('/connexion');
          return;
        }

        if (cancelled) return;

        setCurrentRole(profile.role);
        setCurrentUserId(session.user.id);
      } catch (error) {
        console.error('Initialisation de la messagerie impossible :', error);
        toast.error('Impossible de charger votre session.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void initSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // Heartbeat de présence du compte courant.
  useEffect(() => {
    if (!currentUserId) return;

    const updatePresence = async () => {
      const { error } = await supabase
        .from('profils')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', currentUserId);

      if (error) {
        console.warn('Mise à jour de présence impossible :', error.message);
      }
    };

    void updatePresence();
    const presenceInterval = window.setInterval(() => {
      void updatePresence();
    }, 30_000);

    return () => window.clearInterval(presenceInterval);
  }, [currentUserId]);

  // Horloge locale pour actualiser les libellés de présence.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // Liste des contacts autorisés selon le rôle.
  useEffect(() => {
    if (!currentUserId) return;

    let cancelled = false;

    const fetchContacts = async () => {
      setContactsLoading(true);

      try {
        if (currentRole === 'admin') {
          const { data, error } = await supabase
            .from('profils')
            .select(PROFILE_SELECT)
            .neq('id', currentUserId)
            .in('role', ['entreprise', 'secretaire'])
            .order('nom', { ascending: true });

          if (error) throw error;
          if (cancelled) return;

          const nextContacts = (data ?? []) as Profile[];
          setContacts(nextContacts);
          setActiveContact((previous) => {
            if (previous && nextContacts.some((contact) => contact.id === previous.id)) {
              return nextContacts.find((contact) => contact.id === previous.id) ?? previous;
            }

            return nextContacts[0] ?? null;
          });
        } else {
          const { data, error } = await supabase
            .from('profils')
            .select(PROFILE_SELECT)
            .eq('role', 'admin')
            .order('nom', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (error) throw error;
          if (cancelled) return;

          const admin = data as Profile | null;
          setContacts(admin ? [admin] : []);
          setActiveContact(admin);
        }
      } catch (error) {
        console.error('Chargement des contacts impossible :', error);
        toast.error('Impossible de charger les conversations.');
      } finally {
        if (!cancelled) setContactsLoading(false);
      }
    };

    void fetchContacts();

    return () => {
      cancelled = true;
    };
  }, [currentRole, currentUserId]);

  // Présence et informations profil en temps réel.
  useEffect(() => {
    if (!currentUserId) return;

    const profileChannel = supabase
      .channel(`profiles-presence:${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profils' },
        (payload) => {
          const updated = payload.new as Profile;

          setContacts((previous) =>
            previous.map((contact) =>
              contact.id === updated.id ? { ...contact, ...updated } : contact,
            ),
          );

          setActiveContact((previous) =>
            previous?.id === updated.id ? { ...previous, ...updated } : previous,
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(profileChannel);
    };
  }, [currentUserId]);

  const markConversationAsRead = useCallback(async () => {
    if (!currentUserId || !activeContact) return;

    const { error } = await supabase
      .from('messages')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('sender_id', activeContact.id)
      .eq('receiver_id', currentUserId)
      .eq('read', false);

    if (error) {
      console.warn('Marquage des messages comme lus impossible :', error.message);
    }
  }, [activeContact, currentUserId]);

  const fetchMessages = useCallback(async () => {
    if (!currentUserId || !activeContact) {
      setMessages([]);
      return;
    }

    const { data, error } = await supabase
      .from('messages')
      .select(MESSAGE_SELECT)
      .or(
        `and(sender_id.eq.${currentUserId},receiver_id.eq.${activeContact.id}),and(sender_id.eq.${activeContact.id},receiver_id.eq.${currentUserId})`,
      )
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Chargement des messages impossible :', error);
      toast.error('Impossible de charger les messages.');
      return;
    }

    setMessages((data ?? []) as Message[]);
    await markConversationAsRead();
  }, [activeContact, currentUserId, markConversationAsRead]);

  // Chargement + Realtime de la conversation active.
  useEffect(() => {
    if (!currentUserId || !activeContact) {
      setMessages([]);
      return;
    }

    previousMessageCountRef.current = 0;
    void fetchMessages();

    const belongsToActiveConversation = (message: Message) =>
      (message.sender_id === currentUserId && message.receiver_id === activeContact.id) ||
      (message.sender_id === activeContact.id && message.receiver_id === currentUserId);

    const messageChannel = supabase
      .channel(`chat:${currentUserId}:${activeContact.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const inserted = payload.new as Message;
          if (!belongsToActiveConversation(inserted)) return;

          setMessages((previous) => {
            if (previous.some((message) => message.id === inserted.id)) return previous;
            return [...previous, inserted];
          });

          if (inserted.sender_id === activeContact.id && inserted.receiver_id === currentUserId) {
            void supabase
              .from('messages')
              .update({ read: true, read_at: new Date().toISOString() })
              .eq('id', inserted.id);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const updated = payload.new as Message;
          if (!belongsToActiveConversation(updated)) return;

          setMessages((previous) =>
            previous.map((message) =>
              message.id === updated.id ? { ...message, ...updated } : message,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(messageChannel);
    };
  }, [activeContact, currentUserId, fetchMessages]);

  // Auto-scroll uniquement lorsqu'un nouveau message est ajouté.
  useEffect(() => {
    if (messages.length > previousMessageCountRef.current) {
      messagesEndRef.current?.scrollIntoView({
        behavior: previousMessageCountRef.current === 0 ? 'auto' : 'smooth',
        block: 'end',
      });
    }

    previousMessageCountRef.current = messages.length;
  }, [messages.length]);

  // Auto-resize du champ de saisie.
  useEffect(() => {
    const textarea = composerRef.current;
    if (!textarea) return;

    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, [newMessage]);

  // Fermeture du panneau profil avec Échap.
  useEffect(() => {
    if (!showProfileDrawer) return;

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setShowProfileDrawer(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showProfileDrawer]);

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const content = newMessage.trim();

    if (!content || !activeContact || !currentUserId || sending || conversationClosed) {
      return;
    }

    setSending(true);
    setNewMessage('');

    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: currentUserId,
        receiver_id: activeContact.id,
        content,
        read: false,
      })
      .select(MESSAGE_SELECT)
      .single();

    if (error) {
      console.error("Envoi du message impossible :", error);
      toast.error("Erreur lors de l'envoi du message.");
      setNewMessage(content);
      setSending(false);
      return;
    }

    const sentMessage = data as Message;
    setMessages((previous) => {
      if (previous.some((message) => message.id === sentMessage.id)) return previous;
      return [...previous, sentMessage];
    });

    setSending(false);
    composerRef.current?.focus();
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const closeConversation = async () => {
    if (!activeContact || !currentUserId || messages.length === 0 || conversationActionLoading) {
      return;
    }

    setConversationActionLoading(true);
    const closedAt = new Date().toISOString();

    const { error } = await supabase
      .from('messages')
      .update({
        closed: true,
        closed_by: currentUserId,
        closed_at: closedAt,
      })
      .or(
        `and(sender_id.eq.${currentUserId},receiver_id.eq.${activeContact.id}),and(sender_id.eq.${activeContact.id},receiver_id.eq.${currentUserId})`,
      )
      .eq('closed', false);

    if (error) {
      console.error('Fermeture de la discussion impossible :', error);
      toast.error('Erreur lors de la fermeture de la discussion.');
    } else {
      setMessages((previous) =>
        previous.map((message) => ({
          ...message,
          closed: true,
          closed_by: currentUserId,
          closed_at: closedAt,
        })),
      );
      toast.success('Discussion fermée.');
    }

    setConversationActionLoading(false);
  };

  const reopenConversation = async () => {
    if (!activeContact || !currentUserId || conversationActionLoading) return;

    setConversationActionLoading(true);

    const { error } = await supabase
      .from('messages')
      .update({
        closed: false,
        closed_by: null,
        closed_at: null,
      })
      .or(
        `and(sender_id.eq.${currentUserId},receiver_id.eq.${activeContact.id}),and(sender_id.eq.${activeContact.id},receiver_id.eq.${currentUserId})`,
      )
      .eq('closed', true);

    if (error) {
      console.error('Réouverture de la discussion impossible :', error);
      toast.error('Erreur lors de la réouverture de la discussion.');
    } else {
      setMessages((previous) =>
        previous.map((message) => ({
          ...message,
          closed: false,
          closed_by: null,
          closed_at: null,
        })),
      );
      toast.success('Discussion rouverte.');
    }

    setConversationActionLoading(false);
  };

  const renderTicks = (message: Message) => {
    if (message.sender_id !== currentUserId) return null;

    if (message.read_at || message.read) {
      return (
        <span
          className="inline-flex text-sky-200"
          title={message.read_at ? 'Lu' : 'Distribué'}
          aria-label={message.read_at ? 'Message lu' : 'Message distribué'}
        >
          <DoubleCheckIcon />
        </span>
      );
    }

    return (
      <span
        className="inline-flex text-white/60"
        title="Envoyé"
        aria-label="Message envoyé"
      >
        <CheckIcon />
      </span>
    );
  };

  const {
    pulling,
    refreshing,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  } = usePullToRefresh(fetchMessages);

  if (loading) {
    return <MessagesPageSkeleton />;
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#eff6ff_0,_#f8fafc_32rem,_#f8fafc_100%)] px-3 py-4 font-sans antialiased sm:px-5 md:px-8 md:py-7">
      <div className="mx-auto w-full max-w-[1480px]">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href={dashboardHref}
              className="group mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
            >
              <span className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 bg-white shadow-sm transition group-hover:-translate-x-0.5 group-hover:border-slate-300">
                <ArrowLeftIcon />
              </span>
              {currentRole === 'admin' ? "Console d'administration" : 'Tableau de bord'}
            </Link>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                Messagerie
              </span>
            </div>

            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Discussions
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500 sm:text-base">
              {currentRole === 'admin'
                ? 'Centralisez les échanges avec les entreprises et les secrétaires.'
                : "Échangez directement avec l'administration de Secrétariat Pro."}
            </p>
          </div>

          <div className="hidden rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur sm:block">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Espace actif
            </p>
            <p className="mt-1 text-sm font-bold text-slate-800">
              {getRoleLabel(currentRole)}
            </p>
          </div>
        </div>

        <section className="relative grid h-[calc(100dvh-215px)] min-h-[620px] max-h-[900px] overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)] md:grid-cols-[330px_minmax(0,1fr)]">
          {currentRole === 'admin' && (
            <aside
              className={`${activeContact ? 'hidden md:flex' : 'flex'} min-h-0 flex-col border-r border-slate-100 bg-slate-50/70`}
            >
              <div className="border-b border-slate-100 bg-white/90 p-4 backdrop-blur">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-extrabold text-slate-900">Conversations</h2>
                    <p className="mt-0.5 text-xs font-medium text-slate-400">
                      {contacts.length} contact{contacts.length > 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-white shadow-sm">
                    <ChatIcon />
                  </span>
                </div>

                <label className="relative block">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                    <SearchIcon />
                  </span>
                  <input
                    type="search"
                    value={contactSearch}
                    onChange={(event) => setContactSearch(event.target.value)}
                    placeholder="Rechercher une conversation"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100/70"
                  />
                </label>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
                {contactsLoading ? (
                  <ContactListSkeleton />
                ) : filteredContacts.length === 0 ? (
                  <div className="grid min-h-52 place-items-center px-6 text-center">
                    <div>
                      <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-100">
                        <SearchIcon />
                      </span>
                      <p className="mt-3 text-sm font-bold text-slate-700">
                        Aucun résultat
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        Essayez un nom, un rôle, un email ou un numéro.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredContacts.map((contact) => {
                      const status = getPresenceInfo(contact.last_seen, now);
                      const selected = activeContact?.id === contact.id;

                      return (
                        <button
                          key={contact.id}
                          type="button"
                          onClick={() => {
                            setActiveContact(contact);
                            setShowProfileDrawer(false);
                          }}
                          className={`group w-full rounded-2xl p-3 text-left transition-all ${
                            selected
                              ? 'bg-white shadow-sm ring-1 ring-slate-200'
                              : 'hover:bg-white/80'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar profile={contact} presence={status} />

                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 items-center justify-between gap-2">
                                <h3 className="truncate text-sm font-extrabold text-slate-900">
                                  {contact.nom}
                                </h3>
                                {selected && (
                                  <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                                )}
                              </div>

                              <div className="mt-1 flex min-w-0 items-center gap-2">
                                <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                                  {getRoleLabel(contact.role)}
                                </span>
                                <span className="truncate text-[11px] font-medium text-slate-400">
                                  {status.text}
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </aside>
          )}

          <div
            className={`${
              currentRole === 'admin' && !activeContact ? 'hidden md:flex' : 'flex'
            } relative min-h-0 min-w-0 flex-col bg-white ${
              currentRole !== 'admin' ? 'md:col-span-2' : ''
            }`}
          >
            {activeContact ? (
              <>
                <header className="z-10 flex min-h-[76px] shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-white/95 px-3 py-3 backdrop-blur sm:px-5">
                  <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                    {currentRole === 'admin' && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveContact(null);
                          setShowProfileDrawer(false);
                        }}
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 md:hidden"
                        aria-label="Retour aux conversations"
                      >
                        <ArrowLeftIcon />
                      </button>
                    )}

                    <Avatar
                      profile={activeContact}
                      presence={activePresence ?? getPresenceInfo(null, now)}
                      large
                    />

                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <h2 className="truncate text-sm font-extrabold text-slate-950 sm:text-base">
                          {activeContact.nom}
                        </h2>
                        <span className="hidden rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 sm:inline">
                          {getRoleLabel(activeContact.role)}
                        </span>
                      </div>

                      <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs font-medium text-slate-400">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${activePresence?.dotClass ?? 'bg-slate-300'}`}
                        />
                        {activePresence?.text ?? 'Hors ligne'}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      onClick={() => setShowProfileDrawer(true)}
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                      aria-label={`Afficher le profil de ${activeContact.nom}`}
                    >
                      <ProfileIcon />
                      <span className="hidden sm:inline">Profil</span>
                    </button>

                    {conversationClosed ? (
                      <button
                        type="button"
                        onClick={() => void reopenConversation()}
                        disabled={conversationActionLoading}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-50 px-3 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <UnlockIcon />
                        <span className="hidden sm:inline">Rouvrir</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void closeConversation()}
                        disabled={messages.length === 0 || conversationActionLoading}
                        title={messages.length === 0 ? 'Aucun message à fermer' : 'Fermer la discussion'}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-rose-50 px-3 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ArchiveIcon />
                        <span className="hidden sm:inline">Fermer</span>
                      </button>
                    )}
                  </div>
                </header>

                {conversationClosed && (
                  <div className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-100 bg-amber-50/80 px-4 py-2.5 sm:px-5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700">
                        <ArchiveIcon />
                      </span>
                      <p className="truncate text-xs font-semibold text-amber-800">
                        Cette discussion est fermée. L’envoi de nouveaux messages est suspendu.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void reopenConversation()}
                      disabled={conversationActionLoading}
                      className="shrink-0 text-xs font-extrabold text-emerald-700 transition hover:text-emerald-900 disabled:opacity-50"
                    >
                      Rouvrir
                    </button>
                  </div>
                )}

                <div
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                  className={`relative min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_70%)] px-3 py-5 transition sm:px-6 ${
                    pulling ? 'translate-y-1' : ''
                  } ${refreshing ? 'opacity-60' : ''}`}
                >
                  {(pulling || refreshing) && (
                    <div className="sticky top-0 z-10 mx-auto mb-3 w-fit rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-[11px] font-bold text-slate-500 shadow-sm backdrop-blur">
                      {refreshing ? 'Actualisation…' : 'Relâchez pour actualiser'}
                    </div>
                  )}

                  {messages.length === 0 ? (
                    <div className="grid h-full min-h-72 place-items-center">
                      <EmptyState
                        icon="💬"
                        title={`Aucune discussion avec ${activeContact.nom}`}
                        description="Envoyez un premier message pour démarrer la conversation."
                      />
                    </div>
                  ) : (
                    <div className="mx-auto w-full max-w-4xl space-y-2">
                      {messages.map((message, index) => {
                        const isMe = message.sender_id === currentUserId;
                        const previousMessage = messages[index - 1];
                        const showDaySeparator =
                          !previousMessage ||
                          !isSameCalendarDay(previousMessage.created_at, message.created_at);

                        return (
                          <div key={message.id}>
                            {showDaySeparator && (
                              <div className="my-5 flex items-center gap-3" aria-hidden="true">
                                <div className="h-px flex-1 bg-slate-200/80" />
                                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-bold capitalize tracking-wide text-slate-400 shadow-sm">
                                  {formatDayLabel(message.created_at)}
                                </span>
                                <div className="h-px flex-1 bg-slate-200/80" />
                              </div>
                            )}

                            <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <div
                                className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm shadow-sm sm:max-w-[72%] ${
                                  isMe
                                    ? 'rounded-br-md bg-slate-900 text-white shadow-slate-900/10'
                                    : 'rounded-bl-md border border-slate-200/80 bg-white text-slate-800'
                                }`}
                              >
                                <p className="whitespace-pre-wrap break-words leading-6">
                                  {message.content}
                                </p>
                                <div
                                  className={`mt-1.5 flex items-center justify-end gap-1.5 ${
                                    isMe ? 'text-white/60' : 'text-slate-400'
                                  }`}
                                >
                                  <time
                                    dateTime={message.created_at}
                                    className="text-[10px] font-semibold"
                                  >
                                    {formatMessageTime(message.created_at)}
                                  </time>
                                  {renderTicks(message)}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                {!conversationClosed ? (
                  <form
                    onSubmit={handleSendMessage}
                    className="shrink-0 border-t border-slate-100 bg-white p-3 sm:p-4"
                  >
                    <div className="mx-auto flex w-full max-w-4xl items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-sm transition focus-within:border-blue-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100/60">
                      <textarea
                        ref={composerRef}
                        value={newMessage}
                        onChange={(event) => setNewMessage(event.target.value)}
                        onKeyDown={handleComposerKeyDown}
                        rows={1}
                        maxLength={2_000}
                        placeholder={`Écrire à ${activeContact.nom}…`}
                        className="max-h-[120px] min-h-[42px] flex-1 resize-none bg-transparent px-2 py-2.5 text-sm font-medium leading-5 text-slate-800 outline-none placeholder:text-slate-400"
                        aria-label={`Écrire un message à ${activeContact.nom}`}
                      />

                      <button
                        type="submit"
                        disabled={sending || !newMessage.trim()}
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                        aria-label={sending ? 'Envoi en cours' : 'Envoyer le message'}
                      >
                        {sending ? <SpinnerIcon /> : <SendIcon />}
                      </button>
                    </div>

                    <div className="mx-auto mt-2 hidden max-w-4xl items-center justify-between px-1 text-[10px] font-medium text-slate-400 sm:flex">
                      <span>Entrée pour envoyer · Maj + Entrée pour aller à la ligne</span>
                      <span>{newMessage.length}/2000</span>
                    </div>
                  </form>
                ) : (
                  <div className="shrink-0 border-t border-slate-100 bg-slate-50 px-4 py-4 text-center">
                    <p className="text-xs font-semibold text-slate-500">
                      La discussion est fermée. Rouvrez-la pour envoyer un message.
                    </p>
                  </div>
                )}

                {showProfileDrawer && (
                  <>
                    <button
                      type="button"
                      aria-label="Fermer le panneau de profil"
                      onClick={() => setShowProfileDrawer(false)}
                      className="absolute inset-0 z-20 bg-slate-950/15 backdrop-blur-[1px]"
                    />

                    <aside
                      className="absolute inset-y-0 right-0 z-30 flex w-[min(92vw,360px)] flex-col border-l border-slate-200 bg-white shadow-[-24px_0_60px_rgba(15,23,42,0.14)]"
                      aria-label={`Profil de ${activeContact.nom}`}
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                            Contact
                          </p>
                          <h3 className="mt-0.5 text-base font-black text-slate-950">
                            Informations du profil
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowProfileDrawer(false)}
                          className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          aria-label="Fermer"
                        >
                          <CloseIcon />
                        </button>
                      </div>

                      <div className="min-h-0 flex-1 overflow-y-auto p-5">
                        <div className="flex flex-col items-center rounded-3xl bg-slate-50 px-5 py-6 text-center ring-1 ring-slate-100">
                          <Avatar
                            profile={activeContact}
                            presence={activePresence ?? getPresenceInfo(null, now)}
                            extraLarge
                          />
                          <h4 className="mt-4 text-lg font-black text-slate-950">
                            {activeContact.nom}
                          </h4>
                          <span className="mt-2 rounded-full bg-blue-50 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-blue-700">
                            {getRoleLabel(activeContact.role)}
                          </span>
                          <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                            <span
                              className={`h-2 w-2 rounded-full ${activePresence?.dotClass ?? 'bg-slate-300'}`}
                            />
                            {activePresence?.text ?? 'Hors ligne'}
                          </p>
                        </div>

                        <div className="mt-5 space-y-3">
                          <ProfileField
                            label="Email"
                            value={activeContact.email || 'Non renseigné'}
                          />
                          <ProfileField
                            label="Téléphone"
                            value={activeContact.telephone || 'Non renseigné'}
                          />
                          <ProfileField
                            label="Dernière activité"
                            value={activePresence?.text ?? 'Hors ligne'}
                          />
                        </div>
                      </div>
                    </aside>
                  </>
                )}
              </>
            ) : (
              <div className="grid h-full min-h-[500px] place-items-center bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-8 text-center">
                <div className="max-w-sm">
                  <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-slate-900 text-white shadow-xl shadow-slate-900/10">
                    <ChatIcon large />
                  </span>
                  <h2 className="mt-5 text-xl font-black text-slate-900">
                    Sélectionnez une conversation
                  </h2>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                    Choisissez un contact dans la liste pour consulter l’historique et poursuivre la discussion.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function MessagesPageSkeleton() {
  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 sm:px-5 md:px-8 md:py-7">
      <div className="mx-auto w-full max-w-[1480px]">
        <div className="mb-5">
          <div className="mb-4 h-8 w-48 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-5 w-24 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-3 h-10 w-56 animate-pulse rounded-xl bg-slate-200" />
          <div className="mt-3 h-5 w-full max-w-xl animate-pulse rounded-lg bg-slate-200" />
        </div>

        <div className="grid h-[calc(100dvh-215px)] min-h-[620px] max-h-[900px] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm md:grid-cols-[330px_minmax(0,1fr)]">
          <div className="hidden border-r border-slate-100 bg-slate-50/70 p-4 md:block">
            <div className="mb-4 h-10 w-full animate-pulse rounded-xl bg-slate-200" />
            <ContactListSkeleton />
          </div>
          <div className="grid place-items-center">
            <SkeletonChat />
          </div>
        </div>
      </div>
    </main>
  );
}

function ContactListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-2xl bg-white/60 p-3">
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-slate-200" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-1/2 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Avatar({
  profile,
  presence,
  large = false,
  extraLarge = false,
}: {
  profile: Profile;
  presence: PresenceInfo;
  large?: boolean;
  extraLarge?: boolean;
}) {
  const sizeClass = extraLarge
    ? 'h-20 w-20'
    : large
      ? 'h-11 w-11 sm:h-12 sm:w-12'
      : 'h-11 w-11';

  return (
    <div className="relative shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={profile.avatar_url || '/avatar-placeholder.png'}
        alt={`Avatar de ${profile.nom}`}
        className={`${sizeClass} rounded-full border border-slate-200 bg-slate-100 object-cover shadow-sm`}
      />
      <span
        className={`absolute bottom-0 right-0 rounded-full border-2 border-white ${
          extraLarge ? 'h-4 w-4' : 'h-3.5 w-3.5'
        } ${presence.dotClass}`}
        title={presence.text}
      />
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-1.5 break-words text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4" aria-hidden="true">
      <circle cx="11" cy="11" r="7" strokeWidth="2" />
      <path d="m20 20-3.5-3.5" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChatIcon({ large = false }: { large?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className={large ? 'h-7 w-7' : 'h-4 w-4'}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        d="M21 12a8 8 0 0 1-8 8H7l-4 2 1.5-4A8 8 0 1 1 21 12Z"
      />
      <path strokeLinecap="round" strokeWidth="1.8" d="M8 10h8M8 14h5" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4" aria-hidden="true">
      <circle cx="12" cy="8" r="3" strokeWidth="1.8" />
      <path d="M5 20a7 7 0 0 1 14 0" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M4 7h16v13H4z" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M3 4h18v3H3zM9 11h6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UnlockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2" strokeWidth="1.8" />
      <path d="M9 10V7a3 3 0 0 1 5.5-1.7" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="m7 7 10 10M17 7 7 17" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="m4 4 17 8-17 8 3-8-3-8Z" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M7 12h14" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="m5 12 4 4L19 6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DoubleCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="m2.5 12 4 4 8-9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m9.5 15.5 2 2 10-11" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 animate-spin" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}