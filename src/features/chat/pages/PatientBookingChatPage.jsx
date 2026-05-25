import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { ArrowLeft, CalendarDays, ShieldAlert } from 'lucide-react';
import { Card, LoadingState } from '../../../components/ui';
import { getAccessToken, getStoredUser } from '../../../services/authStorage';
import {
  getBookingChatAccess,
  getChatMessages,
  sendChatMessage,
  uploadChatAttachment,
} from '../../../services/api';
import ChatComposer from '../components/ChatComposer';
import MessageBubble from '../components/MessageBubble';

const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;

export default function PatientBookingChatPage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const currentUser = useMemo(() => getStoredUser(), []);
  const [access, setAccess] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const conversationId = access?.conversation?.id;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const nextAccess = await getBookingChatAccess(bookingId);
        const nextMessages = await getChatMessages(nextAccess.conversation.id);
        if (!cancelled) {
          setAccess(nextAccess);
          setMessages(nextMessages || []);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Access denied');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token || !conversationId) return undefined;
    const socket = io(socketUrl, { auth: { token }, transports: ['websocket', 'polling'] });
    socket.emit('conversation:join', { conversationId });
    socket.on('message:new', (message) => {
      if (message.conversation_id === conversationId) {
        setMessages((current) => [...current, message]);
      }
    });
    socket.on('attachment:uploaded', () => {
      getChatMessages(conversationId)
        .then(setMessages)
        .catch(() => null);
    });
    return () => socket.disconnect();
  }, [conversationId]);

  const handleSend = async ({ body, file, category }) => {
    if (!conversationId) return;
    setBusy(true);
    setError('');
    try {
      const message = await sendChatMessage(conversationId, {
        body: body.trim() || (file ? 'Shared a clinical file.' : ''),
        message_type: file ? 'file' : 'text',
      });
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('attachment_category', category);
        formData.append('conversation_id', conversationId);
        await uploadChatAttachment(message.id, formData);
      }
      setMessages(await getChatMessages(conversationId));
    } catch (err) {
      setError(err.message || 'Could not send message');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <LoadingState title="Opening secure chat" message="Verifying booking and payment..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-premium-surface p-4">
        <Card className="mx-auto mt-8 max-w-xl">
          <p className="font-bold text-premium-purple-plum">{error}</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-4 inline-flex text-sm font-bold text-premium-royal"
          >
            Return to booking page
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-premium-surface p-3 sm:p-5">
      <div className="mx-auto flex max-w-3xl flex-col overflow-hidden rounded-2xl border border-premium-lilac/25 bg-white shadow-premium-soft">
        <div className="border-b border-premium-lilac/25 bg-premium-pearl p-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-premium-purple-plum/65"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="font-display text-2xl font-bold text-premium-purple-plum">
            Dr. {access.booking.doctor_name}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-premium-purple-plum/65">
            <CalendarDays className="h-4 w-4" />
            {new Date(access.booking.booking_date).toLocaleString()}
          </p>
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            This chat is not for emergencies. If symptoms are severe or urgent, seek immediate
            medical care.
          </p>
        </div>

        <div className="h-[58vh] space-y-3 overflow-y-auto p-4">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} currentUser={currentUser} />
          ))}
        </div>

        <ChatComposer onSend={handleSend} disabled={busy} />
      </div>
    </div>
  );
}
