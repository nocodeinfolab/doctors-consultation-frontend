import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { clearStoredAuthSession, getAccessToken } from '../services/authStorage';

const DEFAULT_TIMEOUT_MS = Number(import.meta.env.VITE_SESSION_IDLE_TIMEOUT_MS || 30 * 60 * 1000);
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'];

export default function useInactivityLogout(timeoutMs = DEFAULT_TIMEOUT_MS) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!getAccessToken() || location.pathname === '/login') {
      return undefined;
    }

    let timeoutId;
    const expireSession = () => {
      clearStoredAuthSession();
      navigate('/login', {
        replace: true,
        state: { message: 'Session expired. Please log in again.' },
      });
    };

    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(expireSession, timeoutMs);
    };

    resetTimer();
    ACTIVITY_EVENTS.forEach((eventName) =>
      window.addEventListener(eventName, resetTimer, { passive: true })
    );

    return () => {
      window.clearTimeout(timeoutId);
      ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
    };
  }, [location.pathname, navigate, timeoutMs]);
}
