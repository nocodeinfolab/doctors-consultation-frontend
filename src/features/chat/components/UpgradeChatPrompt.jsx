import React from 'react';
import { LockKeyhole } from 'lucide-react';
import { Card } from '../../../components/ui';

export default function UpgradeChatPrompt() {
  return (
    <Card className="border-premium-champagne-gold/30 bg-premium-champagne-soft/60">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-premium-purple-plum">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <div>
          <p className="font-bold text-premium-purple-plum">Secure messaging is locked</p>
          <p className="mt-1 text-sm text-premium-purple-plum/70">
            Upgrade to Professional to unlock secure patient messaging.
          </p>
        </div>
      </div>
    </Card>
  );
}
