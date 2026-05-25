import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { Button, Card } from '../../../components/ui';
import { resetPassword } from '../../../services/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!token) {
      setError('This reset link is missing its token.');
      return;
    }

    if (password.length < 12) {
      setError('Use at least 12 characters for your new password.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await resetPassword({ token, password });
      setSuccess(response.message || 'Password reset successful. You can now sign in.');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message || 'Could not reset your password.');
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
                Set a new password
              </h1>
              <p className="mt-2 text-sm text-premium-purple-plum/65">
                Create a fresh password to restore access to your clinic workspace.
              </p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-premium-lilac-light text-premium-purple-plum">
              {success ? <CheckCircle2 className="h-6 w-6" /> : <KeyRound className="h-6 w-6" />}
            </div>
          </div>

          {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
          {success && <p className="text-sm font-semibold text-emerald-700">{success}</p>}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-semibold text-premium-purple-plum">
                New password
              </label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="premium-input"
                placeholder="Use a strong new password"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-premium-purple-plum">
                Confirm password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="premium-input"
                placeholder="Repeat your new password"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Updating password...' : 'Reset password'}
            </Button>
          </form>

          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm font-semibold text-premium-purple-plum hover:text-premium-purple-dark"
          >
            Back to sign in
          </Link>
        </div>
      </Card>
    </div>
  );
}
