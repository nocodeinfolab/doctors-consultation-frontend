import { getAccessToken, setStoredAuthSession } from './authStorage';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').trim().replace(/\/+$/, '');

const buildHeaders = (headers = {}) => ({
  Accept: 'application/json',
  'Cache-Control': 'no-cache',
  ...headers,
});

export const getCsrfToken = async () => {
  const response = await fetch(`${API_BASE_URL}/csrf-token`, {
    method: 'GET',
    credentials: 'include',
    headers: buildHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || 'Could not initialize secure session');
  }

  return data.csrfToken || response.headers.get('X-CSRF-Token');
};

const request = async (
  path,
  {
    method = 'GET',
    body,
    requiresAuth = false,
    optionalAuth = false,
    requiresCsrf = false,
    authErrorMessage = 'Authentication is required',
  } = {}
) => {
  const makeRequest = async (isRetry = false) => {
    const headers = buildHeaders();
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

    if (body !== undefined && !isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    const token = getAccessToken();

    if (requiresAuth) {
      if (!token) {
        throw new Error(authErrorMessage);
      }
      headers.Authorization = `Bearer ${token}`;
    } else if (optionalAuth && token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (requiresCsrf) {
      const csrfToken = await getCsrfToken();
      headers['X-CSRF-Token'] = csrfToken;
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: 'include',
      headers,
      cache: 'no-store',
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      // If we get a 401 and haven't retried yet, try to refresh the token
      if (response.status === 401 && !isRetry && requiresAuth) {
        try {
          const newToken = await refreshAccessToken();
          // Update stored session with new token
          const currentSession = JSON.parse(
            window.localStorage.getItem('kuramedics_auth_session') || '{}'
          );
          currentSession.accessToken = newToken;
          setStoredAuthSession(currentSession);
          // Retry the request with the new token
          return makeRequest(true);
        } catch (refreshError) {
          // If refresh fails, throw the original error
          const error = new Error(data?.message || data?.error || 'Request failed');
          error.status = response.status;
          throw error;
        }
      }
      const error = new Error(data?.message || data?.error || 'Request failed');
      error.status = response.status;
      throw error;
    }

    return data.data ?? data;
  };

  return makeRequest();
};

export const loginUser = async ({ email, password }) => {
  const data = await request('/auth/login', {
    method: 'POST',
    body: { email, password },
  });

  return {
    user: data.user,
    accessToken: data.accessToken,
  };
};

export const registerPatient = async ({ full_name, email, password, whatsapp_number }) => {
  return request('/auth/register/patient', {
    method: 'POST',
    body: { full_name, email, password, whatsapp_number },
  });
};

export const registerDoctor = async ({
  full_name,
  email,
  password,
  specialization,
  subscription_plan,
}) => {
  return request('/auth/register/doctor', {
    method: 'POST',
    body: { full_name, email, password, specialization, subscription_plan },
  });
};

export const googleAuth = async ({
  credential,
  role = 'patient',
  specialization,
  whatsapp_number,
  full_name,
  subscription_plan,
}) => {
  const data = await request('/auth/google', {
    method: 'POST',
    body: { credential, role, specialization, whatsapp_number, full_name, subscription_plan },
  });

  return {
    user: data.user,
    accessToken: data.accessToken,
  };
};

export const forgotPassword = async (email) => {
  return request('/auth/forgot-password', {
    method: 'POST',
    body: { email },
  });
};

export const resetPassword = async ({ token, password }) => {
  return request('/auth/reset-password', {
    method: 'POST',
    body: { token, password },
  });
};

export const changePassword = async ({ current_password, new_password }) => {
  return request('/auth/change-password', {
    method: 'POST',
    body: { current_password, new_password },
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in to update your password',
  });
};

export const logoutUser = async () => {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || data?.error || 'Could not log out');
  }

  return data.data ?? data;
};

export const resendVerificationEmail = async (email) => {
  return request('/auth/resend-verification', {
    method: 'POST',
    body: { email },
  });
};

export const getCurrentUser = async () => {
  const data = await request('/auth/me', {
    requiresAuth: true,
    authErrorMessage: 'Please sign in to continue',
  });

  return data.user;
};

export const refreshAccessToken = async () => {
  const data = await request('/auth/refresh', {
    method: 'POST',
    requiresCsrf: true,
  });

  return data.accessToken;
};

export const getAdminDashboardStats = async () => {
  return request('/admin/stats', {
    requiresAuth: true,
    authErrorMessage: 'Please sign in as an admin to view platform analytics',
  });
};

export const getAdminDoctorVerifications = async (status = 'all') => {
  return request(`/admin/doctor-verifications?status=${encodeURIComponent(status)}`, {
    requiresAuth: true,
    authErrorMessage: 'Please sign in as an admin to view verification reviews',
  });
};

export const getAdminAiInsights = async (days = 30) => {
  return request(`/admin/ai-insights?days=${encodeURIComponent(days)}`, {
    requiresAuth: true,
    authErrorMessage: 'Please sign in as an admin to view AI usage insights',
  });
};

export const updateAdminSubscriptionSettings = async (payload) => {
  return request('/admin/subscription-settings', {
    method: 'PATCH',
    body: payload,
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in as an admin to update doctor subscription fees',
  });
};

export const updateAdminUserAccess = async (userId, payload) => {
  return request(`/admin/users/${userId}/access`, {
    method: 'PATCH',
    body: payload,
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in as an admin to manage profile access',
  });
};

export const reviewDoctorVerification = async (doctorId, payload) => {
  return request(`/admin/doctor-verifications/${doctorId}`, {
    method: 'PATCH',
    body: payload,
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in as an admin to review doctor verifications',
  });
};

export const getMySubscription = async () => {
  return request('/subscription/me', {
    requiresAuth: true,
    authErrorMessage: 'Please sign in as a doctor to view your billing details',
  });
};

export const updateSubscriptionPreferences = async (payload = {}) => {
  return request('/subscription/preferences', {
    method: 'PATCH',
    body: payload,
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in as a doctor to update your billing settings',
  });
};

export const initializeSubscriptionRenewal = async (payload = {}) => {
  return request('/subscription/renew', {
    method: 'POST',
    body: payload,
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in as a doctor to renew your subscription',
  });
};

export const verifySubscriptionRenewal = async (reference) => {
  return request(`/subscription/verify/${encodeURIComponent(reference)}`, {
    requiresAuth: true,
    authErrorMessage: 'Please sign in as a doctor to verify your subscription renewal',
  });
};

export const getDoctorProfile = async () => {
  return request('/doctor-profile/me', {
    requiresAuth: true,
    authErrorMessage: 'Please sign in as a doctor to load your clinic profile',
  });
};

export const getPatientProfile = async () => {
  return request('/patient-profile/me', {
    requiresAuth: true,
    authErrorMessage: 'Please sign in as a patient to load your profile',
  });
};

export const updatePatientProfile = async (payload) => {
  return request('/patient-profile/me', {
    method: 'PUT',
    body: payload,
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in as a patient to update your profile',
  });
};

export const updateDoctorProfile = async (payload) => {
  return request('/doctor-profile/me', {
    method: 'PUT',
    body: payload,
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in as a doctor to update your clinic profile',
  });
};

export const getDoctorConsultationServices = async () => {
  return request('/doctor/services', {
    requiresAuth: true,
    authErrorMessage: 'Please sign in as a doctor to load consultation services',
  });
};

export const createDoctorConsultationService = async (payload) => {
  return request('/doctor/services', {
    method: 'POST',
    body: payload,
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in as a doctor to manage consultation services',
  });
};

export const updateDoctorConsultationService = async (serviceId, payload) => {
  return request(`/doctor/services/${encodeURIComponent(serviceId)}`, {
    method: 'PATCH',
    body: payload,
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in as a doctor to manage consultation services',
  });
};

export const deleteDoctorConsultationService = async (serviceId) => {
  return request(`/doctor/services/${encodeURIComponent(serviceId)}`, {
    method: 'DELETE',
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in as a doctor to manage consultation services',
  });
};

export const uploadDoctorAvatar = async (formData) => {
  return request('/doctor-profile/me/avatar', {
    method: 'POST',
    body: formData,
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in as a doctor to upload a profile photo',
  });
};

export const getDoctorBookings = async () => {
  const data = await request('/bookings?page=1&limit=50', {
    requiresAuth: true,
    authErrorMessage: 'Please sign in as a doctor to view bookings',
  });
  return data.items || [];
};

export const getDashboardSummary = async () => {
  return request('/bookings/dashboard-summary', {
    requiresAuth: true,
    authErrorMessage: 'Please sign in as a doctor to view dashboard',
  });
};

export const getMyBookings = async () => {
  return request('/bookings?page=1&limit=50', {
    requiresAuth: true,
    authErrorMessage: 'Please sign in to view your appointment history',
  });
};

export const cancelMyBooking = async (bookingId) => {
  return request(`/bookings/${bookingId}/patient-cancel`, {
    method: 'PATCH',
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in as a patient to cancel this booking',
  });
};

export const getMyNotifications = async () => {
  return request('/notifications?page=1&limit=20', {
    requiresAuth: true,
    authErrorMessage: 'Please sign in to view your care updates',
  });
};

export const getDoctorPayments = async () => {
  return request('/payments?page=1&limit=100', {
    requiresAuth: true,
    authErrorMessage: 'Please sign in as a doctor to view payments',
  });
};

export const analyzeReasonForVisit = async ({
  input,
  previous_activity = [],
  regenerate_key = 0,
}) => {
  return request('/ai/reason-for-visit', {
    method: 'POST',
    body: { input, previous_activity, regenerate_key },
    requiresCsrf: true,
  });
};

export const generateConsultationDraft = async ({
  raw_notes,
  patient_reason,
  regenerate_key = 0,
}) => {
  return request('/ai/consultation-draft', {
    method: 'POST',
    body: { raw_notes, patient_reason, regenerate_key },
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in as a doctor to generate AI consultation notes',
  });
};

export const getAiBookingGuidance = async (history = []) => {
  return request('/ai/booking-guidance', {
    method: 'POST',
    body: { history },
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in as a patient to get AI booking guidance',
  });
};

export const trackAiInteraction = async ({ feature, action, changed = false, context = '' }) => {
  return request('/ai/track', {
    method: 'POST',
    body: { feature, action, changed, context },
    optionalAuth: true,
    requiresCsrf: true,
  });
};

export const createConsultation = async ({ booking_id, doctor_notes }) => {
  return request('/consultations', {
    method: 'POST',
    body: { booking_id, doctor_notes },
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in as a doctor to save consultation notes',
  });
};

export const getConsultationByBooking = async (bookingId) => {
  return request(`/consultations/booking/${encodeURIComponent(bookingId)}`, {
    requiresAuth: true,
    authErrorMessage: 'Please sign in to view consultation notes',
  });
};

export const createPayment = async ({
  booking_id,
  amount,
  currency = 'NGN',
  provider = 'paystack',
  return_path,
}) => {
  return request('/payments', {
    method: 'POST',
    body: { booking_id, amount, currency, provider, return_path },
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in as a patient to complete payment',
  });
};

export const verifyPaymentReference = async (reference) => {
  return request(`/payments/verify/${encodeURIComponent(reference)}`, {
    requiresAuth: true,
    authErrorMessage: 'Please sign in as a patient to verify your payment',
  });
};

export const cancelPaymentReference = async (
  reference,
  reason = 'Patient declined the pending payment'
) => {
  return request(`/payments/verify/${encodeURIComponent(reference)}/cancel`, {
    method: 'PATCH',
    body: { reason },
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in as a patient to cancel this payment',
  });
};

export const regenerateBookingLink = async () => {
  return request('/doctor-profile/me/booking-link/regenerate', {
    method: 'POST',
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in as a doctor to manage your booking link',
  });
};

export const updateBookingStatus = async (bookingId, status) => {
  return request(`/bookings/${bookingId}/status`, {
    method: 'PATCH',
    body: { status },
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in as a doctor to manage bookings',
  });
};

export const confirmBookingAppointment = async (
  bookingId,
  { booking_date, confirmation_note } = {}
) => {
  return request(`/bookings/${bookingId}/confirm`, {
    method: 'PATCH',
    body: { booking_date, confirmation_note },
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in as a doctor to confirm bookings',
  });
};

export const suggestBookingTime = async (bookingId, { booking_date, confirmation_note } = {}) => {
  return request(`/bookings/${bookingId}/suggest-time`, {
    method: 'PATCH',
    body: { booking_date, confirmation_note },
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in as a doctor to suggest appointment times',
  });
};

export const declineBooking = async (bookingId, { reason } = {}) => {
  return request(`/bookings/${bookingId}/decline`, {
    method: 'PATCH',
    body: { reason },
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in as a doctor to decline bookings',
  });
};

export const archiveCompletedBookings = async ({ booking_ids, patient_id, all } = {}) => {
  return request('/bookings/archive-completed', {
    method: 'PATCH',
    body: { booking_ids, patient_id, all },
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in as a doctor to archive consultations',
  });
};

export const archiveCompletedBooking = async (bookingId) => {
  return request(`/bookings/${encodeURIComponent(bookingId)}/archive`, {
    method: 'PATCH',
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in as a doctor to archive consultations',
  });
};

export const updateBookingInternalNotes = async (bookingId, notes) => {
  return request(`/bookings/${bookingId}/internal-notes`, {
    method: 'PATCH',
    body: { notes },
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in as a doctor to save internal booking notes',
  });
};

export const getPatientInternalNotes = async (patientId) => {
  return request(`/patients/${encodeURIComponent(patientId)}/notes`, {
    requiresAuth: true,
    authErrorMessage: 'Please sign in as a doctor to view patient notes',
  });
};

export const createChatConversation = async (payload) => {
  return request('/chat/conversations', {
    method: 'POST',
    body: payload,
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in to start secure messaging',
  });
};

export const getChatConversations = async () => {
  return request('/chat/conversations', {
    requiresAuth: true,
    authErrorMessage: 'Please sign in to view secure messages',
  });
};

export const getBookingChatAccess = async (bookingId) => {
  return request(`/chat/bookings/${encodeURIComponent(bookingId)}`, {
    requiresAuth: true,
    authErrorMessage: 'Please sign in to access this secure chat',
  });
};

export const initiateBookingChat = async (bookingId) => {
  return request(`/chat/bookings/${encodeURIComponent(bookingId)}/initiate`, {
    method: 'POST',
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in to start secure messaging',
  });
};

export const getChatMessages = async (conversationId) => {
  return request(`/chat/conversations/${encodeURIComponent(conversationId)}/messages`, {
    requiresAuth: true,
    authErrorMessage: 'Please sign in to view secure messages',
  });
};

export const sendChatMessage = async (conversationId, payload) => {
  return request(`/chat/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    body: payload,
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in to send secure messages',
  });
};

export const markChatMessageRead = async (messageId) => {
  return request(`/chat/messages/${encodeURIComponent(messageId)}/read`, {
    method: 'PATCH',
    requiresAuth: true,
    requiresCsrf: true,
  });
};

export const markChatConversationRead = async (conversationId) => {
  return request(`/chat/conversations/${encodeURIComponent(conversationId)}/read`, {
    method: 'PATCH',
    requiresAuth: true,
    requiresCsrf: true,
  });
};

export const updateChatConversationStatus = async (conversationId, status) => {
  return request(`/chat/conversations/${encodeURIComponent(conversationId)}/status`, {
    method: 'PATCH',
    body: { status },
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in as a doctor to manage secure conversations',
  });
};

export const uploadChatAttachment = async (messageId, formData) => {
  return request(`/chat/messages/${encodeURIComponent(messageId)}/attachments`, {
    method: 'POST',
    body: formData,
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in to upload results',
  });
};

export const organiseChatConversation = async (conversationId) => {
  return request(`/chat/conversations/${encodeURIComponent(conversationId)}/ai-organise`, {
    method: 'POST',
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in as a doctor to organise clinical drafts',
  });
};

export const getChatAiSummary = async (conversationId) => {
  return request(`/chat/conversations/${encodeURIComponent(conversationId)}/ai-summary`, {
    requiresAuth: true,
    authErrorMessage: 'Please sign in to view AI drafts',
  });
};

export const getPatientChatHistory = async (patientId) => {
  return request(`/patients/${encodeURIComponent(patientId)}/chat-history`, {
    requiresAuth: true,
    authErrorMessage: 'Please sign in to view patient chat history',
  });
};

export const getPatientResults = async (patientId) => {
  return request(`/patients/${encodeURIComponent(patientId)}/results`, {
    requiresAuth: true,
    authErrorMessage: 'Please sign in to view patient results',
  });
};

export const getPatientTimeline = async (patientId) => {
  return request(`/patients/${encodeURIComponent(patientId)}/timeline`, {
    requiresAuth: true,
    authErrorMessage: 'Please sign in to view patient timeline',
  });
};

export const getPatientAiDrafts = async (patientId) => {
  return request(`/patients/${encodeURIComponent(patientId)}/ai-drafts`, {
    requiresAuth: true,
    authErrorMessage: 'Please sign in to view patient AI drafts',
  });
};

export const getChatAttachmentUrl = (messageId, attachmentId) =>
  `${API_BASE_URL}/chat/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`;

export const updatePatientInternalNotes = async (patientId, notes) => {
  return request(`/patients/${encodeURIComponent(patientId)}/notes`, {
    method: 'PATCH',
    body: { notes },
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in as a doctor to save patient notes',
  });
};

export const getConsultationDraft = async (bookingId) => {
  return request(`/consultations/booking/${encodeURIComponent(bookingId)}/draft`, {
    requiresAuth: true,
    authErrorMessage: 'Please sign in as a doctor to view consultation drafts',
  });
};

export const updateConsultationDraft = async (bookingId, payload) => {
  return request(`/consultations/booking/${encodeURIComponent(bookingId)}/draft`, {
    method: 'PATCH',
    body: payload,
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in as a doctor to save consultation drafts',
  });
};

export const rescheduleBooking = async (bookingId, { booking_date, reason }) => {
  return request(`/bookings/${bookingId}/reschedule`, {
    method: 'PATCH',
    body: { booking_date, reason },
    requiresAuth: true,
    requiresCsrf: true,
    authErrorMessage: 'Please sign in as a doctor to reschedule bookings',
  });
};

export const verifyEmailToken = async (token) => {
  return request('/auth/verify-email', {
    method: 'POST',
    body: { token },
  });
};

export const buildPublicBookingUrl = (bookingLinkPath) => {
  if (!bookingLinkPath || typeof window === 'undefined') {
    return '';
  }

  const token = String(bookingLinkPath).split('/').filter(Boolean).pop();
  return token ? `${window.location.origin}/book/${token}` : '';
};

export const getPublicBookingContext = async (token) => {
  return request(`/public/book/${token}`);
};

export const createPublicBooking = async (token, payload) => {
  return request(`/public/book/${token}/bookings`, {
    method: 'POST',
    body: payload,
    requiresAuth: true,
    requiresCsrf: true,
  });
};

export default {
  getCsrfToken,
  loginUser,
  registerPatient,
  registerDoctor,
  googleAuth,
  forgotPassword,
  resetPassword,
  changePassword,
  logoutUser,
  resendVerificationEmail,
  getCurrentUser,
  getDoctorProfile,
  getAdminDashboardStats,
  getAdminDoctorVerifications,
  getAdminAiInsights,
  reviewDoctorVerification,
  updateDoctorProfile,
  getDoctorConsultationServices,
  createDoctorConsultationService,
  updateDoctorConsultationService,
  deleteDoctorConsultationService,
  uploadDoctorAvatar,
  getDoctorBookings,
  getMyBookings,
  cancelMyBooking,
  getMyNotifications,
  getDoctorPayments,
  analyzeReasonForVisit,
  generateConsultationDraft,
  getAiBookingGuidance,
  trackAiInteraction,
  createConsultation,
  getConsultationByBooking,
  createPayment,
  verifyPaymentReference,
  cancelPaymentReference,
  regenerateBookingLink,
  updateBookingStatus,
  confirmBookingAppointment,
  suggestBookingTime,
  declineBooking,
  updateBookingInternalNotes,
  getPatientInternalNotes,
  updatePatientInternalNotes,
  createChatConversation,
  getChatConversations,
  getBookingChatAccess,
  initiateBookingChat,
  getChatMessages,
  sendChatMessage,
  markChatMessageRead,
  markChatConversationRead,
  updateChatConversationStatus,
  uploadChatAttachment,
  organiseChatConversation,
  getChatAiSummary,
  getPatientChatHistory,
  getPatientResults,
  getPatientTimeline,
  getPatientAiDrafts,
  getConsultationDraft,
  updateConsultationDraft,
  rescheduleBooking,
  verifyEmailToken,
  buildPublicBookingUrl,
  getPublicBookingContext,
  createPublicBooking,
};
