const AUTH_STORAGE_KEY = 'kuramedics_auth_session';

export const getStoredAuthSession = () => {
  try {
    const rawValue = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch {
    return null;
  }
};

export const setStoredAuthSession = (session) => {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
};

export const clearStoredAuthSession = () => {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
};

export const getStoredUser = () => getStoredAuthSession()?.user || null;

export const getAccessToken = () => getStoredAuthSession()?.accessToken || null;

export const isDoctorAuthenticated = () => {
  const session = getStoredAuthSession();
  return Boolean(
    session?.accessToken && ['doctor', 'patient', 'admin'].includes(session?.user?.role)
  );
};

export default {
  getStoredAuthSession,
  setStoredAuthSession,
  clearStoredAuthSession,
  getStoredUser,
  getAccessToken,
  isDoctorAuthenticated,
};
