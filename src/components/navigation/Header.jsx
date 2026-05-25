import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Link2, LogOut, Search, Settings, Plus, Menu, X } from 'lucide-react';
import { Avatar } from '../ui';
import { clearStoredAuthSession, getStoredUser } from '../../services/authStorage';
import { logoutUser } from '../../services/api';

const getDisplayText = (value, fallback) => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return fallback;
};

export default function Header({ onMobileMenuToggle, isMobileMenuOpen }) {
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const isAdmin = currentUser?.role === 'admin';
  const displayName = getDisplayText(
    currentUser?.full_name,
    isAdmin ? 'Admin Portal' : 'Doctor Portal'
  );
  const sessionLabel = isAdmin
    ? 'Admin session'
    : getDisplayText(currentUser?.specialization, 'Doctor session');
  const [searchQuery, setSearchQuery] = React.useState('');

  const handleQuickSearch = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();

      if (isAdmin) {
        navigate('/admin/dashboard');
        return;
      }

      navigate('/bookings', { state: { search: searchQuery.trim() } });
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch {
      // Ignore network logout issues and clear local state regardless.
    } finally {
      clearStoredAuthSession();
      navigate('/login', { replace: true });
    }
  };

  const bookingPath = currentUser?.booking_link_path
    ? `/book/${currentUser.booking_link_path.split('/').pop()}`
    : null;

  return (
    <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-premium-lilac/25 bg-premium-pearl/95 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <button
          type="button"
          onClick={onMobileMenuToggle}
          className="rounded-lg p-2 text-premium-purple-plum/70 transition-colors hover:bg-premium-lilac-light hover:text-premium-purple-plum md:hidden"
          aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="group relative hidden w-full max-w-xl md:block">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="h-4 w-4 text-premium-purple-plum/30 transition-colors group-focus-within:text-premium-purple-plum" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={handleQuickSearch}
              className="kura-input block py-2.5 pl-11 pr-4"
              placeholder={
                isAdmin
                  ? 'Search submitted licence reviews...'
                  : 'Search the consultation queue or patient records...'
              }
            />
            <div className="pointer-events-none absolute inset-y-0 right-0 hidden items-center pr-3 md:flex">
              <span className="rounded-md border border-premium-lilac/30 bg-premium-lilac-light/70 px-2 py-1 text-[10px] font-semibold text-premium-purple-plum/45">
                Enter
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate(isAdmin ? '/admin/verifications' : '/bookings')}
            className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-premium-royal/20 bg-premium-royal px-3 py-2 text-white transition-colors hover:bg-premium-purple-dark"
          >
            <Plus className="h-4 w-4" />
            <span className="text-xs font-semibold">
              {isAdmin ? 'Review queue' : 'Open queue'}
            </span>
          </button>
          {!isAdmin && bookingPath && (
            <button
              type="button"
              onClick={() => window.open(bookingPath, '_blank', 'noopener,noreferrer')}
              className="hidden items-center gap-2 whitespace-nowrap rounded-lg border border-premium-lilac/35 bg-white px-3 py-2 text-xs font-semibold text-premium-purple-plum transition-colors hover:bg-premium-lilac-light lg:flex"
            >
              <Link2 className="h-4 w-4 text-premium-champagne-gold" />
              Booking link
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigate(isAdmin ? '/admin/dashboard' : '/payments')}
            className="relative rounded-lg p-2.5 text-premium-purple-plum/70 transition-colors hover:bg-premium-lilac-light hover:text-premium-purple-plum"
            aria-label={isAdmin ? 'Open admin dashboard' : 'Open financial summary'}
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-3 top-3 h-2 w-2 rounded-full border border-white bg-premium-champagne-gold" />
          </button>
          <button
            type="button"
            onClick={() => navigate(isAdmin ? '/admin/dashboard' : '/settings')}
            className="rounded-lg p-2.5 text-premium-purple-plum/70 transition-colors hover:bg-premium-lilac-light hover:text-premium-purple-plum"
            aria-label={isAdmin ? 'Open admin dashboard' : 'Open settings'}
          >
            <Settings className="h-5 w-5" />
          </button>
          <button
            onClick={handleLogout}
            className="hidden items-center gap-2 rounded-lg px-3 py-2 text-premium-purple-plum/70 transition-colors duration-200 hover:bg-rose-600 hover:text-white sm:flex"
          >
            <LogOut className="h-4 w-4" />
            <span className="text-xs font-semibold">Log out</span>
          </button>
        </div>

        <div className="hidden h-9 w-px bg-premium-lilac/35 sm:block" />

        <button
          type="button"
          onClick={() => navigate(isAdmin ? '/admin/dashboard' : '/settings')}
          className="flex cursor-pointer items-center gap-3 pl-1"
        >
          <div className="hidden flex-col items-end sm:flex">
            <span className="max-w-44 truncate text-sm font-semibold leading-none tracking-normal text-premium-purple-plum">
              {displayName}
            </span>
            <span className="mt-1 flex max-w-44 items-center gap-1.5 truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-premium-purple-plum/52">
              <span className="h-1 w-1 rounded-full bg-emerald-500" />
              {sessionLabel}
            </span>
          </div>
          <div className="relative">
            <div className="h-10 w-10 rounded-lg border border-premium-lilac/35 bg-white p-1">
              <Avatar
                src={currentUser?.avatar_url}
                name={displayName}
                className="h-full w-full rounded-md border border-premium-lilac/20"
                textClassName="text-xs"
              />
            </div>
            <div className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full border-2 border-white bg-emerald-500" />
          </div>
        </button>
      </div>
    </header>
  );
}
