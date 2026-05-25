import React from 'react';
import { Bell, Search, User, Settings, Command, Sparkles, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

export default function Header() {
  return (
    <header className="h-28 bg-white/60 backdrop-blur-md border-b border-premium-lilac/10 flex items-center justify-between px-12 sticky top-0 z-40 transition-all duration-500">
      {/* Search & Action Hub */}
      <div className="flex items-center gap-10 flex-1 max-w-3xl">
        <div className="relative group w-full">
          <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-premium-purple-plum/20 group-focus-within:text-premium-purple-plum/60 transition-colors" />
          </div>
          <input
            type="text"
            className="block w-full pl-14 pr-4 py-4.5 bg-premium-lilac-light/20 border border-premium-lilac/10 rounded-[1.75rem] focus:outline-none focus:ring-4 focus:ring-premium-purple/5 focus:bg-white/80 focus:border-premium-purple/10 transition-all text-sm text-premium-purple-plum font-semibold placeholder-premium-purple-plum/20"
            placeholder="Search archives, patients, or protocols..."
          />
          <div className="absolute inset-y-0 right-0 pr-5 flex items-center pointer-events-none">
            <div className="bg-white/80 border border-premium-lilac/30 rounded-xl px-2.5 py-1.5 flex items-center gap-2 shadow-sm">
              <Command className="w-3 h-3 text-premium-purple-plum/20" />
              <span className="text-[10px] font-black text-premium-purple-plum/30 uppercase tracking-tighter">K</span>
            </div>
          </div>
        </div>
        
        <button className="flex items-center gap-3 px-6 py-4.5 bg-premium-purple-plum text-white rounded-[1.75rem] shadow-lg hover:bg-premium-purple-dark transition-all duration-300 group whitespace-nowrap">
          <Plus className="w-5 h-5 text-premium-champagne-gold" />
          <span className="text-xs font-black uppercase tracking-[0.15em]">New Record</span>
        </button>
      </div>

      {/* Profile & Intelligence Hub */}
      <div className="flex items-center gap-10">
        <div className="flex items-center gap-3">
          <button className="p-4 rounded-2xl text-premium-purple-plum/30 hover:text-premium-purple-plum hover:bg-white/80 transition-all relative group">
            <Bell className="w-5 h-5" />
            <span className="absolute top-4 right-4 w-2 h-2 bg-premium-champagne-gold rounded-full border-2 border-white" />
          </button>
          <button className="p-4 rounded-2xl text-premium-purple-plum/30 hover:text-premium-purple-plum hover:bg-white/80 transition-all group">
            <Sparkles className="w-5 h-5 text-premium-champagne-gold/60" />
          </button>
          <button className="p-4 rounded-2xl text-premium-purple-plum/30 hover:text-premium-purple-plum hover:bg-white/80 transition-all group">
            <Settings className="w-5 h-5" />
          </button>
        </div>
        
        <div className="h-12 w-px bg-premium-lilac/20" />
        
        <div className="flex items-center gap-5 group cursor-pointer pl-2">
          <div className="flex flex-col items-end">
            <span className="text-sm font-black text-premium-purple-plum transition-colors leading-none tracking-tight">Dr. Sarah Smith</span>
            <span className="text-[10px] font-black text-premium-champagne-gold uppercase tracking-[0.25em] mt-2 flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-premium-champagne-gold" />
              Executive Access
            </span>
          </div>
          <div className="relative">
            <div className="w-16 h-16 rounded-[1.75rem] bg-premium-lilac-light border border-premium-lilac/30 p-1.5 shadow-sm group-hover:shadow-md transition-all duration-500">
              <div className="w-full h-full rounded-[1.25rem] bg-white flex items-center justify-center overflow-hidden border border-premium-lilac/10">
                <User className="w-7 h-7 text-premium-purple-plum/80" />
              </div>
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-premium-champagne-gold border-4 border-white rounded-full flex items-center justify-center" />
          </div>
        </div>
      </div>
    </header>
  );
}