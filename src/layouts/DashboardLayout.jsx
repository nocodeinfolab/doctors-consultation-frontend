import React from 'react';
import Sidebar from '../components/shared/Sidebar';
import Header from '../components/shared/Header';
import { motion } from 'framer-motion';

export default function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen bg-premium-surface">
      <Sidebar />
      <div className="ml-72 flex flex-col min-h-screen">
        <Header />
        <main className="p-10 flex-1 relative overflow-x-hidden">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="max-w-7xl mx-auto"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}