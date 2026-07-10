import { lazy } from 'react';

// Lazy load pages for better performance
const Login = lazy(() => import('../../features/auth/pages/Login'));
const ForgotPassword = lazy(() => import('../../features/auth/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('../../features/auth/pages/ResetPassword'));
const VerifyEmail = lazy(() => import('../../features/auth/pages/VerifyEmail'));
const PublicBookingPage = lazy(
  () => import('../../features/publicBooking/pages/PublicBookingPage')
);
const HomeRedirect = lazy(() => import('./HomeRedirect'));
const Dashboard = lazy(() => import('../../features/dashboard/pages/Dashboard'));
const AdminDashboard = lazy(() => import('../../features/admin/pages/AdminDashboard'));
const DoctorVerifications = lazy(() => import('../../features/admin/pages/DoctorVerifications'));
const Bookings = lazy(() => import('../../features/bookings/pages/Bookings'));
const Patients = lazy(() => import('../../features/patients/pages/Patients'));
const Consultations = lazy(() => import('../../features/consultations/pages/Consultations'));
const Payments = lazy(() => import('../../features/payments/pages/Payments'));
const Billing = lazy(() => import('../../features/billing/pages/Billing'));
const Settings = lazy(() => import('../../features/settings/pages/Settings'));
const ChatPage = lazy(() => import('../../features/chat/pages/ChatPage'));
const PatientBookingChatPage = lazy(
  () => import('../../features/chat/pages/PatientBookingChatPage')
);
const PatientBookings = lazy(
  () => import('../../features/patientBookings/pages/patientBookings')
);
const PatientLogin = lazy(
  () => import('../../features/patientBookings/pages/PatientLogin')
);
const LegalPage = lazy(() => import('../../features/legal/pages/LegalPage'));
const NotFound = lazy(() => import('../../features/errors/pages/NotFound'));

export const routes = [
  {
    path: '/login',
    element: Login,
    isPublic: true,
  },
  {
    path: '/forgot-password',
    element: ForgotPassword,
    isPublic: true,
  },
  {
    path: '/reset-password',
    element: ResetPassword,
    isPublic: true,
  },
  {
    path: '/auth/reset-password',
    element: ResetPassword,
    isPublic: true,
  },
  {
    path: '/verify-email',
    element: VerifyEmail,
    isPublic: true,
  },
  {
    path: '/book/:token',
    element: PublicBookingPage,
    isPublic: true,
  },
  {
    path: '/privacy',
    element: LegalPage,
    isPublic: true,
  },
  {
    path: '/terms',
    element: LegalPage,
    isPublic: true,
  },
  {
    path: '/doctor-terms',
    element: LegalPage,
    isPublic: true,
  },
  {
    path: '/data-retention',
    element: LegalPage,
    isPublic: true,
  },
  {
    path: '/security',
    element: LegalPage,
    isPublic: true,
  },
  {
    path: '/',
    element: HomeRedirect,
    isPublic: false,
    allowedRoles: ['doctor', 'admin'],
  },
  {
    path: '/dashboard',
    element: Dashboard,
    isPublic: false,
    allowedRoles: ['doctor'],
  },
  {
    path: '/admin/dashboard',
    element: AdminDashboard,
    isPublic: false,
    allowedRoles: ['admin'],
  },
  {
    path: '/admin/verifications',
    element: DoctorVerifications,
    isPublic: false,
    allowedRoles: ['admin'],
  },
  {
    path: '/bookings',
    element: Bookings,
    isPublic: false,
    allowedRoles: ['doctor'],
  },
  {
    path: '/patients',
    element: Patients,
    isPublic: false,
    allowedRoles: ['doctor'],
  },
  {
    path: '/chat',
    element: ChatPage,
    isPublic: false,
    allowedRoles: ['doctor'],
  },
  {
    path: '/patient/login',
    element: PatientLogin,
    isPublic: true,
  },
  {
    path: '/patient/bookings',
    element: PatientBookings,
    isPublic: false,
    allowedRoles: ['patient'],
    useLayout: false,
  },
  {
    path: '/patient/bookings/:bookingId/chat',
    element: PatientBookingChatPage,
    isPublic: false,
    allowedRoles: ['patient'],
    useLayout: false,
  },
  {
    path: '/consultations',
    element: Consultations,
    isPublic: false,
    allowedRoles: ['doctor'],
  },
  {
    path: '/payments',
    element: Payments,
    isPublic: false,
    allowedRoles: ['doctor'],
  },
  {
    path: '/billing',
    element: Billing,
    isPublic: false,
    allowedRoles: ['doctor'],
  },
  {
    path: '/settings',
    element: Settings,
    isPublic: false,
    allowedRoles: ['doctor'],
  },
  {
    path: '*',
    element: NotFound,
    isPublic: true,
  },
];
