import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { AlertCircle, MessageCircle } from 'lucide-react';
import { Card, ErrorState, LoadingState } from '../../../components/ui';
import { getAccessToken, getStoredUser } from '../../../services/authStorage';
import {
  getChatAiSummary,
  getChatConversations,
  getChatMessages,
  markChatConversationRead,
  organiseChatConversation,
  sendChatMessage,
  updateChatConversationStatus,
  uploadChatAttachment,
} from '../../../services/api';
import ConversationList from '../components/ConversationList';
import ChatWindow from '../components/ChatWindow';
import UpgradeChatPrompt from '../components/UpgradeChatPrompt';

const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;

export default function ChatPage() {
  const location = useLocation();
  const currentUser = useMemo(() => getStoredUser(), []);
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState([]);
  const [aiSummary, setAiSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [typing, setTyping] = useState(false);

  const selectedConversation =
    conversations.find((conversation) => conversation.id === selectedId) || null;

  const loadConversations = async ({ preserveSelection = true } = {}) => {
    const items = await getChatConversations();
    const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
    setConversations(safeItems);
    setSelectedId((current) => {
      if (preserveSelection && current && safeItems.some((item) => item?.id === current)) {
        return current;
      }
      return safeItems[0]?.id || '';
    });
    return safeItems;
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setError('');
        const items = await getChatConversations();
        if (cancelled) return;
        const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
        setConversations(safeItems);
        setSelectedId((current) => {
          const requestedId = location.state?.conversationId;
          if (requestedId && safeItems.some((item) => item?.id === requestedId)) {
            return requestedId;
          }
          return current || safeItems?.[0]?.id || '';
        });
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load secure messages');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [location.state?.conversationId]);

  useEffect(() => {
    if (!selectedId) return undefined;
    let cancelled = false;
    const loadThread = async () => {
      try {
        setError('');
        const [threadMessages, summary] = await Promise.all([
          getChatMessages(selectedId),
          getChatAiSummary(selectedId).catch(() => null),
        ]);
        if (!cancelled) {
          setMessages(threadMessages || []);
          setAiSummary(summary);
          markChatConversationRead(selectedId)
            .then(() => loadConversations())
            .catch(() => null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load this conversation');
      }
    };
    loadThread();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token || !selectedId) return undefined;

    const socket = io(socketUrl, { auth: { token }, transports: ['websocket', 'polling'] });
    socket.emit('conversation:join', { conversationId: selectedId });
    socket.on('message:new', (message) => {
      if (message.conversation_id === selectedId) {
        setMessages((current) => [...current, message]);
      }
      getChatConversations()
        .then((items) => setConversations(Array.isArray(items) ? items.filter(Boolean) : []))
        .catch(() => null);
    });
    socket.on('message:edited', (message) => {
      setMessages((current) => current.map((item) => (item.id === message.id ? message : item)));
    });
    socket.on('message:deleted', (message) => {
      setMessages((current) => current.map((item) => (item.id === message.id ? message : item)));
    });
    socket.on('attachment:uploaded', () => {
      getChatMessages(selectedId)
        .then(setMessages)
        .catch(() => null);
    });
    socket.on('typing:start', () => setTyping(true));
    socket.on('typing:stop', () => setTyping(false));

    return () => socket.disconnect();
  }, [selectedId]);

  const refreshConversations = async () => loadConversations();

  const handleSend = async ({ body, file, category }) => {
    if (!selectedId) return;
    setBusy(true);
    setError('');
    try {
      const message = await sendChatMessage(selectedId, {
        body: body.trim() || (file ? 'Shared a clinical file.' : ''),
        message_type: file ? 'file' : 'text',
      });
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('attachment_category', category);
        formData.append('conversation_id', selectedId);
        await uploadChatAttachment(message.id, formData);
      }
      const nextMessages = await getChatMessages(selectedId);
      setMessages(nextMessages || []);
      await refreshConversations();
    } catch (err) {
      setError(err.message || 'Could not send message');
    } finally {
      setBusy(false);
    }
  };

  const handleOrganise = async () => {
    if (!selectedId) return;
    setBusy(true);
    setError('');
    try {
      setAiSummary(await organiseChatConversation(selectedId));
    } catch (err) {
      setError(err.message || 'Could not organise this chat');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleConversationStatus = async () => {
    if (!selectedConversation?.id) return;
    setBusy(true);
    setError('');
    try {
      const nextStatus = selectedConversation.status === 'closed' ? 'open' : 'closed';
      const updated = await updateChatConversationStatus(selectedConversation.id, nextStatus);
      setConversations((current) =>
        current.map((item) => (item?.id === updated?.id ? { ...item, ...updated } : item))
      );
    } catch (err) {
      setError(err.message || 'Could not update conversation status');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <LoadingState title="Loading secure messages" message="Checking clinical access..." />;
  }

  const upgradeRequired =
    error.includes('Upgrade to Professional') || error.includes('secure patient messaging');

  if (error && !upgradeRequired && conversations.length === 0) {
    return (
      <ErrorState
        icon={AlertCircle}
        title="Could not load secure messages"
        message={error || 'Something went wrong. Please try again.'}
        actionLabel="Try again"
        onAction={() => {
          setLoading(true);
          setError('');
          loadConversations({ preserveSelection: false })
            .catch((err) => setError(err.message || 'Could not load secure messages'))
            .finally(() => setLoading(false));
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-premium-purple-plum">
          Secure Messaging
        </h1>
        <p className="mt-2 text-premium-purple-plum/70">
          Doctor-first clinical conversations linked to paid bookings, results, and patient records.
        </p>
      </div>

      {upgradeRequired && <UpgradeChatPrompt />}
      {error && !upgradeRequired && <p className="text-sm font-semibold text-rose-600">{error}</p>}

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card
          title="Patients"
          subtitle="Collapsible secure message threads"
          className="overflow-hidden p-0"
        >
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </Card>
        <div>
          {conversations.length === 0 && !upgradeRequired ? (
            <Card>
              <div className="flex items-center gap-3 text-premium-purple-plum/65">
                <MessageCircle className="h-5 w-5" />
                Chat opens after a paid booking creates a secure doctor-patient context.
              </div>
            </Card>
          ) : (
            <ChatWindow
              conversation={selectedConversation}
              messages={messages}
              currentUser={currentUser}
              onSend={handleSend}
              onOrganise={handleOrganise}
              onToggleStatus={handleToggleConversationStatus}
              aiSummary={aiSummary}
              typing={typing}
              busy={busy}
            />
          )}
        </div>
      </div>
    </div>
  );
}
