import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Stethoscope, 
  CreditCard, 
  Settings, 
  LogOut,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Calendar, label: 'Bookings', path: '/bookings' },
  { icon: Users, label: 'Patients', path: '/patients' },
  { icon: Stethoscope, label: 'Consultations', path: '/consultations' },
  { icon: CreditCard, label: 'Payments', path: '/payments' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-80 bg-premium-purple-plum z-50 flex flex-col shadow-xl">
      {/* Branding Area */}
      <div className="p-10 pb-12 flex items-center gap-4">
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-premium-lilac flex items-center justify-center">
            <Stethoscope className="text-premium-purple-plum w-7 h-7" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-premium-champagne-gold rounded-full border-4 border-premium-purple-plum flex items-center justify-center">
            <ShieldCheck className="w-2.5 h-2.5 text-premium-purple-plum" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-white tracking-tight">CuraBase</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <p className="text-[10px] uppercase tracking-[0.25em] text-premium-lilac/30 font-black">Clinical OS</p>
          </div>
        </div>
      </div>

      {/* Navigation System */}
      <nav className="flex-1 px-6 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 group relative",
              isActive 
                ? "bg-white/5 text-white" 
                : "text-premium-lilac/30 hover:text-white hover:bg-white/[0.03]"
            )}
          >
            <item.icon className={cn(
              "w-5 h-5 transition-all duration-300 relative z-10",
              "group-[.active]:text-premium-champagne-gold"
            )} />
            
            <span className="font-bold text-sm tracking-wide relative z-10">{item.label}</span>
            
            {/* Active Indicator */}
            <div className={cn(
              "ml-auto transition-all duration-500 relative z-10",
              "opacity-0 group-[.active]:opacity-100"
            )}>
              <div className="w-1.5 h-1.5 rounded-full bg-premium-champagne-gold" />
            </div>
          </NavLink>
        ))}
      </nav>

      {/* Footer / User Section */}
      <div className="p-8">
        <div className="bg-white/5 rounded-[2.5rem] p-6 border border-white/5 relative group transition-colors hover:bg-white/[0.08]">
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-6">
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-premium-lilac flex items-center justify-center border-2 border-white/10 overflow-hidden">
                  <span className="text-sm font-black text-premium-purple-plum">SS</span>
                </div>
                <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-premium-purple-plum rounded-full" />
              </div>
              <div>
                <p className="text-sm font-black text-white leading-none">Dr. Sarah Smith</p>
                <p className="text-[10px] font-bold text-premium-lilac/20 uppercase tracking-[0.2em] mt-2">Executive Access</p>
              </div>
            </div>
            
            <button className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-white/5 border border-white/5 text-white text-[10px] font-black uppercase tracking-[0.25em] hover:bg-white hover:text-premium-purple-plum transition-all duration-300">
              <LogOut className="w-3.5 h-3.5" />
              Terminate Session
            </button>
          </div>
        </div>
        
        <p className="text-center text-[9px] font-bold text-premium-lilac/10 uppercase tracking-[0.3em] mt-8">
          System Version 2.4.0-A
        </p>
      </div>
    </aside>
  );
}