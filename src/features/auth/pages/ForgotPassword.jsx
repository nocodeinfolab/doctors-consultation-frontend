import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { Button, Card } from '../../../components/ui';
import { forgotPassword } from '../../../services/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resetLink, setResetLink] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setResetLink('');
    setIsSubmitting(true);

    try {
      const response = await forgotPassword(email);
      setSuccess(
        response.message || 'If this email is registered, a password reset link has been sent.'
      );
      if (response.resetLink) {
        setResetLink(response.resetLink);
      }
    } catch (err) {
      setError(err.message || 'Could not send password reset instructions.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-premium-surface px-4 py-8">
      <Card className="w-full max-w-xl">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-premium-purple-plum">
                Forgot password
              </h1>
              <p className="mt-2 text-sm text-premium-purple-plum/65">
                Enter your doctor account email to receive a secure reset link.
              </p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-premium-lilac-light text-premium-purple-plum">
              <MailCheck className="h-6 w-6" />
            </div>
          </div>

          {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
          {success && <p className="text-sm font-semibold text-emerald-700">{success}</p>}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-semibold text-premium-purple-plum">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="premium-input"
                placeholder="doctor@clinic.com"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Sending link...' : 'Send reset link'}
            </Button>
          </form>

          {resetLink && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <p className="mb-2 font-semibold">Development reset link</p>
              <a href={resetLink} className="break-all underline">
                {resetLink}
              </a>
            </div>
          )}

          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm font-semibold text-premium-purple-plum hover:text-premium-purple-dark"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </div>
      </Card>
    </div>
  );
}
