import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, MailWarning } from 'lucide-react';
import { Button, Card, LoadingState } from '../../../components/ui';
import { verifyEmailToken } from '../../../services/api';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Verifying your email now...');

  useEffect(() => {
    const runVerification = async () => {
      if (!token) {
        setStatus('error');
        setMessage('This verification link is missing its token.');
        return;
      }

      try {
        await verifyEmailToken(token);
        setStatus('success');
        setMessage(
          'Your email has been verified successfully. You can now return to KuraMedics and continue your next step.'
        );
      } catch (error) {
        setStatus('error');
        setMessage(error.message || 'This verification link is invalid or has expired.');
      }
    };

    runVerification();
  }, [token]);

  if (status === 'loading') {
    return (
      <LoadingState
        className="min-h-screen"
        title="Verifying email"
        message="Securing your KuraMedics account..."
      />
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-premium-surface px-4 py-8">
      <Card className="w-full max-w-xl text-center">
        <div className="space-y-6">
          <div
            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-3xl ${status === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}
          >
            {status === 'success' ? (
              <CheckCircle2 className="h-8 w-8" />
            ) : (
              <MailWarning className="h-8 w-8" />
            )}
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-premium-purple-plum">
              {status === 'success' ? 'Email verified' : 'Verification issue'}
            </h1>
            <p className="mt-3 text-sm text-premium-purple-plum/65">{message}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {status === 'success' ? (
              <Button onClick={() => navigate(-1)}>Return to previous page</Button>
            ) : null}
            <Link to="/login">
              <Button variant={status === 'success' ? 'secondary' : 'primary'}>
                {status === 'success' ? 'Go to sign in' : 'Back to sign in'}
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
