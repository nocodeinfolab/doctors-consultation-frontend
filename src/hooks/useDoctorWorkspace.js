import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getCurrentUser,
  getDoctorBookings,
  getDoctorPayments,
  getDoctorProfile,
} from '../services/api';
import { getStoredAuthSession, setStoredAuthSession } from '../services/authStorage';
import {
  calculateProfileCompletion,
  deriveActivityFeed,
  deriveConsultations,
  derivePatients,
  derivePaymentRecords,
  toItems,
} from '../utils/doctorWorkspace';

export default function useDoctorWorkspace({ loadPayments = true } = {}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [doctorUser, setDoctorUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [user, doctorProfile, bookingData, paymentData] = await Promise.all([
        getCurrentUser(),
        getDoctorProfile(),
        getDoctorBookings(),
        loadPayments ? getDoctorPayments() : Promise.resolve([]),
      ]);

      const nextBookings = toItems(bookingData);
      const nextPayments = toItems(paymentData);

      setDoctorUser(user);
      setProfile(doctorProfile);
      setBookings(nextBookings);
      setPayments(nextPayments);

      const session = getStoredAuthSession();
      if (session) {
        setStoredAuthSession({
          ...session,
          user: {
            ...session.user,
            ...user,
            full_name: doctorProfile?.full_name || user?.full_name || session.user?.full_name,
            specialization:
              doctorProfile?.specialization || user?.specialization || session.user?.specialization,
            avatar_url: doctorProfile?.avatar_url || session.user?.avatar_url || null,
            clinic_name: doctorProfile?.clinic_name || session.user?.clinic_name || null,
          },
        });
      }
    } catch (err) {
      setError(err.message || 'Could not load your clinic workspace');
    } finally {
      setLoading(false);
    }
  }, [loadPayments]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const activityFeed = useMemo(() => deriveActivityFeed(bookings, payments), [bookings, payments]);
  const patients = useMemo(() => derivePatients(bookings, payments), [bookings, payments]);
  const consultations = useMemo(
    () => deriveConsultations(bookings, payments),
    [bookings, payments]
  );
  const paymentRecords = useMemo(
    () => derivePaymentRecords(payments, bookings, profile),
    [payments, bookings, profile]
  );
  const profileCompletion = useMemo(
    () => calculateProfileCompletion(profile, doctorUser),
    [profile, doctorUser]
  );

  return {
    loading,
    error,
    refresh,
    doctorUser,
    profile,
    bookings,
    payments,
    activityFeed,
    patients,
    consultations,
    paymentRecords,
    profileCompletion,
  };
}
