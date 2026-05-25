import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearStoredAuthSession } from '../services/authStorage';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_TIME_MS = 5 * 60 * 1000; // 5 minutes before expiry

export function useSessionTimeout() {
  const navigate = useNavigate();
  const timeoutRef = useRef(null);
  const warningRef = useRef(null);

  const resetTimer = () => {
    // Clear existing timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);

    // Set warning timer (25 minutes from now)
    warningRef.current = setTimeout(() => {
      // Show warning (could be enhanced with a toast notification)
      console.warn('Your session will expire in 5 minutes. Please save your work.');
    }, SESSION_TIMEOUT_MS - WARNING_TIME_MS);

    // Set logout timer (30 minutes from now)
    timeoutRef.current = setTimeout(() => {
      clearStoredAuthSession();
      navigate('/login', {
        state: { message: 'Session expired. Please log in again.' },
      });
    }, SESSION_TIMEOUT_MS);
  };

  const clearTimer = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
  };

  useEffect(() => {
    // Reset timer on mount
    resetTimer();

    // Reset timer on user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    const resetTimerOnActivity = () => resetTimer();

    events.forEach((event) => {
      document.addEventListener(event, resetTimerOnActivity, true);
    });

    // Cleanup
    return () => {
      clearTimer();
      events.forEach((event) => {
        document.removeEventListener(event, resetTimerOnActivity, true);
      });
    };
  }, [navigate]);

  return { resetTimer, clearTimer };
}
