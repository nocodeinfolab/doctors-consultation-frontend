import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Search, AlertCircle } from 'lucide-react';
import { Button } from '../../../components/ui';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-premium-purple-plum via-premium-royal to-premium-indigo-deep p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/20 bg-white/10 p-8 text-center shadow-premium-ambient backdrop-blur-sm">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-premium-champagne-gold/20">
          <AlertCircle className="h-10 w-10 text-premium-champagne-gold" />
        </div>

        <h1 className="mb-2 text-3xl font-bold text-white">Page Not Found</h1>

        <p className="mb-8 leading-relaxed text-premium-lilac-light">
          This clinic page is unavailable. The doctor may have changed their booking link or this
          page doesn't exist.
        </p>

        <div className="space-y-4">
          <Button
            as={Link}
            to="/"
            className="w-full bg-premium-champagne-gold font-semibold text-premium-purple-plum hover:bg-premium-champagne-gold/90"
          >
            <Home className="mr-2 h-4 w-4" />
            Return Home
          </Button>

          <Button
            variant="outline"
            as={Link}
            to="/"
            className="w-full border-white/30 text-white hover:bg-white/10"
          >
            <Search className="mr-2 h-4 w-4" />
            Find Another Doctor
          </Button>
        </div>
      </div>
    </div>
  );
}
