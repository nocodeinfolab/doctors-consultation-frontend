import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { mountPatientLogin } from './patient-login';

export default function PatientLogin() {
  const containerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const cleanup = mountPatientLogin(containerRef.current, {
      onSignedIn: () => navigate('/patient/bookings', { replace: true }),
    });
    return cleanup;
  }, [navigate]);

  return <div ref={containerRef} />;
}
