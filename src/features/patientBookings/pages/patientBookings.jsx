import { useEffect, useRef } from 'react';
import { mountPatientBookings } from './patient-bookings';

// Patient-facing page (no dashboard sidebar) — same standalone-page
// convention as PatientBookingChatPage.jsx. Everything inside the container
// is owned by patient-bookings.js.
export default function PatientBookings() {
  const containerRef = useRef(null);

  useEffect(() => {
    const cleanup = mountPatientBookings(containerRef.current);
    return cleanup;
  }, []);

  return <div ref={containerRef} />;
}
