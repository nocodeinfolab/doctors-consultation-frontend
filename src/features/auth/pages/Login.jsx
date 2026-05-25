import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import GoogleAuthButton from '../../../components/auth/GoogleAuthButton';
import { googleAuth, loginUser, registerDoctor } from '../../../services/api';
import { clearStoredAuthSession, setStoredAuthSession } from '../../../services/authStorage';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '' });
  const [signupForm, setSignupForm] = useState({
    full_name: '',
    email: '',
    password: '',
    specialization: '',
    subscription_plan: 'starter',
  });
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [error, setError] = useState(location.state?.message || '');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const doctorPlans = [
    {
      code: 'starter',
      title: 'Starter',
      price: '₦5,000/month',
      commission: '5% commission',
      note: 'Best for a simple clinic launch.',
    },
    {
      code: 'professional',
      title: 'Professional',
      price: '₦10,000/month',
      commission: '3% commission',
      note: 'Balanced for growing practices.',
    },
    {
      code: 'premium',
      title: 'Premium',
      price: '₦20,000/month',
      commission: '1–2% commission',
      note: 'Lowest commission for high-volume doctors.',
    },
  ];

  const routeAuthenticatedUser = (session) => {
    if (!['doctor', 'admin'].includes(session.user?.role)) {
      clearStoredAuthSession();
      throw new Error(
        'Only doctor or admin accounts can access the internal dashboard. Patients must use their doctor booking link.'
      );
    }

    setStoredAuthSession(session);

    const requestedPath = location.state?.from?.pathname;
    const destination =
      session.user?.role === 'admin'
        ? '/admin/dashboard'
        : requestedPath && !requestedPath.startsWith('/admin')
          ? requestedPath
          : '/dashboard';

    navigate(destination, { replace: true });
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSignupChange = (event) => {
    const { name, value } = event.target;
    setSignupForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      const session = await loginUser(form);
      routeAuthenticatedUser(session);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleAccess = async (credential) => {
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      if (mode === 'signup' && !signupForm.specialization.trim()) {
        throw new Error('Specialty is required before creating a doctor account with Google');
      }

      const session = await googleAuth({
        credential,
        role: 'doctor',
        specialization: mode === 'signup' ? signupForm.specialization.trim() : undefined,
        full_name: mode === 'signup' ? signupForm.full_name.trim() : undefined,
        subscription_plan: mode === 'signup' ? signupForm.subscription_plan : undefined,
      });

      routeAuthenticatedUser(session);
    } catch (err) {
      setError(err.message || 'Google sign-in failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDoctorSignup = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      await registerDoctor(signupForm);
      setSuccess(
        'Your doctor account has been created. Check your email for verification, then sign in to complete your clinic setup.'
      );
      setMode('login');
      setForm({ email: signupForm.email, password: signupForm.password });
    } catch (err) {
      setError(err.message || 'Doctor signup failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="kura-page flex min-h-screen items-center justify-center px-4 py-8">
      <div className="kura-card-light relative z-10 w-full max-w-2xl p-12">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="mb-2 font-display text-2xl font-bold text-premium-purple-plum">
              KuraMedics access
            </h1>
            <p className="text-sm text-premium-purple-plum/60">
              Welcome to your private clinic workspace.
            </p>
            <p className="mt-2 text-xs text-premium-purple-plum/50">
              Your data is secure and used only for clinic management.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
                setSuccess('');
              }}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors duration-200 ${mode === 'login' ? 'bg-premium-purple-plum text-white' : 'bg-premium-lilac-light text-premium-purple-plum'}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError('');
                setSuccess('');
              }}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors duration-200 ${mode === 'signup' ? 'bg-premium-purple-plum text-white' : 'bg-premium-lilac-light text-premium-purple-plum'}`}
            >
              Create doctor account
            </button>
          </div>
        </div>

        {error && (
          <p id="login-error" className="mb-4 text-sm font-semibold text-rose-600" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p
            id="login-success"
            className="mb-4 text-sm font-semibold text-emerald-700"
            role="alert"
          >
            {success}
          </p>
        )}

        {mode === 'login' ? (
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="kura-label mb-2 block text-sm">Email</label>
              <input
                name="email"
                value={form.email}
                onChange={handleChange}
                type="email"
                className="kura-input"
                placeholder="doctor@kuramedics.com"
                required
                aria-describedby={error ? 'login-error' : undefined}
              />
            </div>
            <div>
              <label className="kura-label mb-2 block text-sm">Password</label>
              <input
                name="password"
                value={form.password}
                onChange={handleChange}
                type={showLoginPassword ? 'text' : 'password'}
                className="kura-input"
                placeholder="Enter your password"
                required
                aria-describedby={error ? 'login-error' : undefined}
              />
              <label className="mt-2 inline-flex items-center gap-2 text-xs text-premium-purple-plum/70">
                <input
                  type="checkbox"
                  checked={showLoginPassword}
                  onChange={(event) => setShowLoginPassword(event.target.checked)}
                />
                Show password
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-premium-purple-plum/55">
                Need to recover access to your clinic session?
              </p>
              <Link
                to="/forgot-password"
                className="text-sm font-semibold text-premium-purple-plum hover:text-premium-purple-dark"
              >
                Forgot password?
              </Link>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="kura-primary-button w-full py-3.5"
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs text-premium-purple-plum/45">
                <span className="h-px flex-1 bg-premium-lilac/40" />
                <span>or</span>
                <span className="h-px flex-1 bg-premium-lilac/40" />
              </div>
              <GoogleAuthButton
                text="signin_with"
                disabled={isSubmitting}
                onCredential={handleGoogleAccess}
                onError={setError}
              />
            </div>
          </form>
        ) : (
          <form className="grid gap-5 md:grid-cols-2" onSubmit={handleDoctorSignup}>
            <div className="md:col-span-2">
              <label className="kura-label mb-2 block text-sm">Full name</label>
              <input
                name="full_name"
                value={signupForm.full_name}
                onChange={handleSignupChange}
                type="text"
                className="kura-input"
                placeholder="Dr. Jane Smith"
                required
              />
            </div>
            <div>
              <label className="kura-label mb-2 block text-sm">Email</label>
              <input
                name="email"
                value={signupForm.email}
                onChange={handleSignupChange}
                type="email"
                className="kura-input"
                placeholder="doctor@clinic.com"
                required
              />
            </div>
            <div>
              <label className="kura-label mb-2 block text-sm">Specialty</label>
              <input
                name="specialization"
                value={signupForm.specialization}
                onChange={handleSignupChange}
                type="text"
                className="kura-input"
                placeholder="Cardiology"
                required
              />
            </div>
            <div className="rounded-3xl border border-premium-lilac/20 bg-premium-pearl-tint/40 p-4 md:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-premium-purple-plum">
                    Choose your clinic plan
                  </p>
                  <p className="text-sm text-premium-purple-plum/60">
                    Start your private clinic and begin seeing patients today.
                  </p>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  30-day free trial
                </span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {doctorPlans.map((plan) => (
                  <button
                    key={plan.code}
                    type="button"
                    onClick={() =>
                      setSignupForm((current) => ({ ...current, subscription_plan: plan.code }))
                    }
                    className={`rounded-2xl border p-4 text-left transition-all ${signupForm.subscription_plan === plan.code ? 'border-premium-purple-plum bg-white shadow-premium-soft' : 'border-premium-lilac/20 bg-white/70'}`}
                  >
                    <p className="font-bold text-premium-purple-plum">{plan.title}</p>
                    <p className="mt-2 text-lg font-semibold text-premium-purple-plum">
                      {plan.price}
                    </p>
                    <p className="mt-1 text-sm text-premium-purple-plum/70">{plan.commission}</p>
                    <p className="mt-2 text-xs text-premium-purple-plum/55">{plan.note}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="kura-label mb-2 block text-sm">Password</label>
              <input
                name="password"
                value={signupForm.password}
                onChange={handleSignupChange}
                type={showSignupPassword ? 'text' : 'password'}
                className="kura-input"
                placeholder="Use a strong 12+ character password"
                required
              />
              <label className="mt-2 inline-flex items-center gap-2 text-xs text-premium-purple-plum/70">
                <input
                  type="checkbox"
                  checked={showSignupPassword}
                  onChange={(event) => setShowSignupPassword(event.target.checked)}
                />
                Show password
              </label>
              <p className="mt-2 text-xs text-premium-purple-plum/55">
                Use at least 12 characters with an uppercase letter, a number, and a special
                character.
              </p>
            </div>
            <div className="space-y-3 md:col-span-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="kura-primary-button w-full px-6 py-3.5"
              >
                {isSubmitting ? 'Creating account...' : 'Create doctor account'}
              </button>
              <div className="flex items-center gap-3 text-xs text-premium-purple-plum/45">
                <span className="h-px flex-1 bg-premium-lilac/40" />
                <span>or</span>
                <span className="h-px flex-1 bg-premium-lilac/40" />
              </div>
              <GoogleAuthButton
                text="signup_with"
                disabled={isSubmitting}
                onCredential={handleGoogleAccess}
                onError={setError}
              />
            </div>
          </form>
        )}

        <footer className="mt-8 flex flex-wrap justify-center gap-x-4 gap-y-2 border-t border-premium-lilac/20 pt-5 text-xs font-semibold text-premium-purple-plum/55">
          <Link to="/privacy" className="hover:text-premium-purple-plum">
            Privacy Policy
          </Link>
          <Link to="/terms" className="hover:text-premium-purple-plum">
            Terms of Use
          </Link>
          <Link to="/doctor-terms" className="hover:text-premium-purple-plum">
            Doctor Terms
          </Link>
          <Link to="/security" className="hover:text-premium-purple-plum">
            Security
          </Link>
          <Link to="/data-retention" className="hover:text-premium-purple-plum">
            Data Retention
          </Link>
        </footer>
      </div>
    </div>
  );
}
