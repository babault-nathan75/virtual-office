'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/components/Toast';

type Message = {
  id: number;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
};

type Conversation = {
  otherId: string;
  otherNom: string;
  lastMessage: string;
  lastDate: string;
  unread: number;
};

type Props = {
  currentUserId: string;
  currentRole: 'entreprise' | 'secretaire' | 'admin';
  adminId?: string;
};

export default function ChatWindow({ currentUserId, currentRole, adminId }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const fetchConversations = async () => {
      if (currentRole === 'admin') {
        // Admin sees all conversations
        const { data: allMessages } = await supabase
          .from('messages')
          .select('id, sender_id, receiver_id, content, is_read, created_at')
          .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
          .order('created_at', { ascending: false });

        if (!allMessages) { setLoading(false); return; }

        const convMap = new Map<string, { lastMessage: string; lastDate: string; unread: number }>();
        for (const m of allMessages) {
          const otherId = m.sender_id === currentUserId ? m.receiver_id : m.sender_id;
          if (!convMap.has(otherId)) {
            convMap.set(otherId, {
              lastMessage: m.content,
              lastDate: m.created_at,
              unread: m.receiver_id === currentUserId && !m.is_read ? 1 : 0,
            });
          }
        }

        const otherIds = Array.from(convMap.keys());
        if (otherIds.length === 0) { setLoading(false); return; }

        const { data: profils } = await supabase.from('profils').select('id, nom').in('id', otherIds);
        const nomMap = new Map((profils ?? []).map(p => [p.id, p.nom]));

        const convs: Conversation[] = otherIds.map(id => ({
          id: id,
          otherId: id,
          otherNom: nomMap.get(id) ?? 'Utilisateur',
          ...convMap.get(id)!,
        }));
        setConversations(convs);
      } else {
        // User sees conversation with admin
        if (!adminId) { setLoading(false); return; }

        const { data: msgs } = await supabase
          .from('messages')
          .select('id, sender_id, receiver_id, content, is_read, created_at')
          .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
          .order('created_at', { ascending: false });

        if (!msgs) { setLoading(false); return; }

        const unread = msgs.filter(m => m.receiver_id === currentUserId && !m.is_read).length;

        const conv: Conversation = {
          otherId: adminId,
          otherNom: 'Administration',
          lastMessage: msgs[0]?.content ?? '',
          lastDate: msgs[0]?.created_at ?? '',
          unread,
        };
        setConversations([conv]);
      }
      setLoading(false);
    };

    fetchConversations();
    const interval = setInterval(fetchConversations, 15_000);
    return () => clearInterval(interval);
  }, [currentUserId, currentRole, adminId]);

  const openConversation = async (conv: Conversation) => {
    setSelectedConv(conv);
    setMessages([]);

    const { data: msgs } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, is_read, created_at')
      .or(
        `and(sender_id.eq.${currentUserId},receiver_id.eq.${conv.otherId}),and(sender_id.eq.${conv.otherId},receiver_id.eq.${currentUserId})`
      )
      .order('created_at', { ascending: true });

    if (msgs) setMessages(msgs);

    // Mark as read
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('receiver_id', currentUserId)
      .eq('sender_id', conv.otherId)
      .eq('is_read', false);

    // Update local unread count
    setConversations(prev => prev.map(c =>
      c.otherId === conv.otherId ? { ...c, unread: 0 } : c
    ));

    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConv) return;
    setSending(true);

    const { error } = await supabase.from('messages').insert({
      sender_id: currentUserId,
      receiver_id: selectedConv.otherId,
      content: newMessage.trim(),
    });

    if (error) {
      toast.error('Erreur : ' + error.message);
    } else {
      setMessages(prev => [...prev, {
        id: Date.now(),
        sender_id: currentUserId,
        receiver_id: selectedConv.otherId,
        content: newMessage.trim(),
        is_read: false,
        created_at: new Date().toISOString(),
      }]);
      setConversations(prev => prev.map(c =>
        c.otherId === selectedConv.otherId
          ? { ...c, lastMessage: newMessage.trim(), lastDate: new Date().toISOString() }
          : c
      ));
      setNewMessage('');
    }
    setSending(false);
    inputRef.current?.focus();
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500 font-medium">Chargement...</div>;
  }

  return (
    <div className="flex h-[70vh] bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-[0_8px_20px_rgba(0,0,0,0.02)]">
      {/* Sidebar conversations */}
      <div className="w-80 border-r border-slate-100 flex flex-col bg-slate-50/50">
        <div className="p-4 border-b border-slate-100">
          <h2 className="font-black tracking-tight text-slate-900">
            {currentRole === 'admin' ? 'Conversations' : 'Contacter l\'administration'}
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <p className="p-4 text-sm text-slate-400 italic text-center font-medium">Aucune conversation</p>
          ) : (
            conversations.map(c => (
              <button
                key={c.otherId}
                onClick={() => openConversation(c)}
                className={`w-full text-left px-4 py-3 border-b border-slate-100 transition ${
                  selectedConv?.otherId === c.otherId
                    ? 'bg-blue-50 border-l-2 border-l-blue-500'
                    : 'hover:bg-white'
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      currentRole === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {c.otherNom.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-900 truncate">{c.otherNom}</p>
                      <p className="text-xs text-slate-400 truncate">{c.lastMessage || 'Aucun message'}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {c.unread > 0 && (
                      <span className="bg-blue-600 text-white text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center">
                        {c.unread}
                      </span>
                    )}
                    {c.lastDate && (
                      <p className="text-[10px] text-slate-400 mt-1">
                        {new Date(c.lastDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {selectedConv ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-white">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                currentRole === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {selectedConv.otherNom.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="font-black text-slate-900 tracking-tight">{selectedConv.otherNom}</h3>
                <p className="text-xs text-slate-400 font-medium">
                  {currentRole === 'admin' ? 'Utilisateur' : 'Administrateur'}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
              {messages.length === 0 ? (
                <p className="text-center text-slate-400 text-sm italic mt-12">
                  Aucun message. Commencez la conversation !
                </p>
              ) : (
                messages.map(m => {
                  const isMine = m.sender_id === currentUserId;
                  return (
                    <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm font-medium ${
                        isMine
                          ? 'bg-blue-600 text-white rounded-br-md'
                          : 'bg-white text-slate-800 border border-slate-100 rounded-bl-md'
                      }`}>
                        <p className="whitespace-pre-wrap">{m.content}</p>
                        <p className={`text-[10px] mt-1 ${isMine ? 'text-blue-200' : 'text-slate-400'}`}>
                          {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-100 bg-white">
              <div className="flex gap-3 items-end">
                <textarea
                  ref={inputRef}
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Votre message..."
                  rows={1}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-blue-200"
                  aria-label="Envoyer le message"
                >
                  {sending ? '...' : '→'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <p className="text-4xl mb-3">💬</p>
              <p className="font-medium">Sélectionnez une conversation</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
