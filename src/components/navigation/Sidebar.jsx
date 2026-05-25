import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Stethoscope,
  CreditCard,
  MessageCircle,
  Settings,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { clearStoredAuthSession, getStoredUser } from '../../services/authStorage';
import { logoutUser } from '../../services/api';
import { Avatar } from '../ui';

const cn = (...inputs) => twMerge(clsx(inputs));

const getDisplayText = (value, fallback) => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return fallback;
};

const doctorNavItems = [
  { icon: LayoutDashboard, label: 'Clinic Overview', path: '/dashboard' },
  { icon: Calendar, label: 'Consultation Queue', path: '/bookings' },
  { icon: Users, label: 'Patient Records', path: '/patients' },
  { icon: MessageCircle, label: 'Secure Messages', path: '/chat' },
  { icon: Stethoscope, label: 'Consultations', path: '/consultations' },
  { icon: CreditCard, label: 'Financial Summary', path: '/payments' },
  { icon: CreditCard, label: 'Billing', path: '/billing' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

const adminNavItems = [
  { icon: LayoutDashboard, label: 'Admin Dashboard', path: '/admin/dashboard' },
  { icon: ShieldCheck, label: 'Verification Queue', path: '/admin/verifications' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const navItems = currentUser?.role === 'admin' ? adminNavItems : doctorNavItems;
  const displayName = getDisplayText(
    currentUser?.full_name,
    currentUser?.role === 'admin' ? 'Admin Portal' : 'Doctor Portal'
  );
  const roleLabel =
    currentUser?.role === 'admin'
      ? 'Internal admin review'
      : getDisplayText(currentUser?.specialization, 'Authenticated doctor');
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

  return (
    <div className="flex h-screen w-64 flex-col border-r border-white/10 bg-premium-indigo-deep shadow-premium-ambient">
      {/* Branding Area */}
      <div className="border-b border-white/10 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10">
              <Stethoscope className="h-5 w-5 text-premium-pearl" />
          </div>
          <div>
            <h1 className="font-sans text-lg font-bold tracking-normal">
              <span className="text-white">Kura</span>
              <span className="text-premium-champagne-gold">Medics</span>
            </h1>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-premium-lilac/62">
              Private Clinic OS
            </p>
          </div>
        </div>
      </div>

      {/* Navigation System */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-colors duration-200',
                isActive
                  ? 'border-white/12 bg-white/10 text-white'
                  : 'text-premium-lilac/70 hover:bg-white/10 hover:text-white'
              )
            }
          >
            <item.icon
              className={cn(
                'relative z-10 h-4 w-4 transition-colors duration-200',
                'group-[.active]:text-premium-champagne-gold'
              )}
            />

            <span className="relative z-10 text-sm font-medium tracking-normal">{item.label}</span>

            {/* Active Indicator */}
            <div
              className={cn(
                'relative z-10 ml-auto transition-opacity duration-200',
                'opacity-0 group-[.active]:opacity-100'
              )}
            >
              <div className="h-5 w-0.5 rounded-full bg-premium-champagne-gold" />
            </div>
          </NavLink>
        ))}
      </nav>

      {/* Footer / User Section */}
      <div className="border-t border-white/10 p-3">
        <div className="rounded-xl border border-white/10 bg-white/10 p-3">
          <div className="relative z-10">
            <div className="mb-3 flex items-center gap-3">
              <div className="relative">
                <Avatar
                  src={currentUser?.avatar_url}
                  name={displayName}
                  className="h-9 w-9 rounded-lg border border-white/15"
                  textClassName="text-sm"
                />
                <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-none text-white">
                  {displayName}
                </p>
                <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-premium-lilac/62">
                  {roleLabel}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/10 py-2.5 text-[11px] font-semibold text-premium-pearl transition-colors duration-200 hover:bg-rose-600 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" />
              Log Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
