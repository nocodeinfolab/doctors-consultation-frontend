import React from 'react';
import { Card, Button, Badge } from '../components/ui';
import { 
  Users, 
  Calendar, 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownRight, 
  MoreVertical, 
  Phone, 
  Video,
  ChevronRight,
  Clock,
  Activity,
  CalendarCheck,
  AlertCircle,
  FileText,
  Plus,
  ArrowRight,
  ClipboardList
} from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

const summaryStats = [
  { 
    label: "Today's Bookings", 
    value: '24', 
    change: '+4', 
    trend: 'up', 
    icon: CalendarCheck,
    color: 'text-premium-purple-plum bg-premium-lilac-light'
  },
  { 
    label: 'Pending Consultations', 
    value: '12', 
    change: '-2', 
    trend: 'down', 
    icon: StethoscopeIcon,
    color: 'text-blue-600 bg-blue-50'
  },
  { 
    label: 'Paid Today', 
    value: '$4,250', 
    change: '+15%', 
    trend: 'up', 
    icon: CreditCard,
    color: 'text-emerald-600 bg-emerald-50'
  },
  { 
    label: 'Outstanding Payments', 
    value: '$1,120', 
    change: '+5%', 
    trend: 'up', 
    icon: AlertCircle,
    color: 'text-rose-600 bg-rose-50'
  },
];

function StethoscopeIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.8 2.3A.3.3 0 1 0 5 2a.3.3 0 1 0-.2.3Z" />
      <path d="M10 22v-2" />
      <path d="M16 18a2 2 0 0 0 2-2v-4a6 6 0 1 0-12 0v4a2 2 0 0 0 2 2" />
      <path d="M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    </svg>
  );
}

const todaySchedule = [
  {
    id: 1,
    time: '09:00 AM',
    patient: 'Alexander Knight',
    reason: 'Hypertension Follow-up',
    type: 'In-person',
    status: 'Ready'
  },
  {
    id: 2,
    time: '09:45 AM',
    patient: 'Eleanor Shellstrop',
    reason: 'Acute Chest Pain',
    type: 'Emergency',
    status: 'Waiting'
  },
  {
    id: 3,
    time: '10:30 AM',
    patient: 'Tahani Al-Jamil',
    reason: 'Annual Physical',
    type: 'In-person',
    status: 'Scheduled'
  },
  {
    id: 4,
    time: '11:15 AM',
    patient: 'Chidi Anagonye',
    reason: 'Migraine Consultation',
    type: 'Video Call',
    status: 'Scheduled'
  },
];

const recentPatients = [
  { id: 1, name: 'Jason Mendoza', condition: 'Arrhythmia', lastVisit: '2 days ago', initials: 'JM' },
  { id: 2, name: 'Janet Delauney', condition: 'Post-op Recovery', lastVisit: '3 days ago', initials: 'JD' },
  { id: 3, name: 'Michael Realman', condition: 'Type 2 Diabetes', lastVisit: '1 week ago', initials: 'MR' },
  { id: 4, name: 'Vicky Lopez', condition: 'General Wellness', lastVisit: '1 week ago', initials: 'VL' },
];

const alerts = [
  { id: 1, type: 'critical', message: 'Lab results for Patient #442 require urgent review', time: '10m ago' },
  { id: 2, type: 'info', message: 'New consultation request from Sarah Jenkins', time: '1h ago' },
];

const draftNotes = [
  { id: 1, patient: 'Alexander Knight', preview: 'Patient shows improvement in blood pressure...', date: 'Today, 08:45 AM' },
  { id: 2, patient: 'Eleanor Shellstrop', preview: 'Prescribed 50mg Atenolol for acute symptoms...', date: 'Yesterday' },
];

export default function Dashboard() {
  return (
    <div className="space-y-12">
      {/* Executive Welcome */}
      <section className="flex items-end justify-between px-2">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-premium-champagne-gold/40" />
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-premium-champagne-gold">Clinical Command Centre</p>
          </div>
          <h2 className="text-4xl font-display font-bold text-premium-purple-plum leading-tight">Clinic Overview</h2>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="secondary" size="md">Protocol Library</Button>
          <Button size="md">
            <Plus className="w-4 h-4" />
            New Appointment
          </Button>
        </div>
      </section>

      {/* Summary Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {summaryStats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="p-0 border-none bg-white/40 hover:bg-white group transition-all duration-500">
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div className={clsx(
                    "p-4 rounded-2xl transition-all duration-500 group-hover:scale-110 shadow-premium-soft",
                    stat.color
                  )}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <div className={clsx(
                    "flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest",
                    stat.trend === 'up' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                  )}>
                    {stat.trend === 'up' ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {stat.change}
                  </div>
                </div>
                <div>
                  <h4 className="text-3xl font-bold text-premium-purple-plum tracking-tight">{stat.value}</h4>
                  <p className="text-[11px] font-bold text-premium-purple-plum/40 uppercase tracking-[0.15em] mt-2">{stat.label}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Main Schedule Section */}
        <div className="lg:col-span-2 space-y-10">
          <Card 
            title="Today's Schedule" 
            subtitle="Main productivity focus"
            headerAction={<Button variant="ghost" size="sm">View Full Calendar <ChevronRight className="w-3 h-3 ml-1" /></Button>}
          >
            <div className="space-y-4">
              {todaySchedule.length > 0 ? (
                todaySchedule.map((apt) => (
                  <div key={apt.id} className="flex items-center justify-between p-6 rounded-3xl hover:bg-premium-lilac-light/30 transition-all duration-500 border border-transparent hover:border-premium-lilac/20 group cursor-pointer">
                    <div className="flex items-center gap-8">
                      <div className="text-center min-w-[80px]">
                        <p className="text-sm font-black text-premium-purple-plum">{apt.time}</p>
                        <p className="text-[10px] font-bold text-premium-purple-plum/30 uppercase tracking-widest mt-1">Start</p>
                      </div>
                      <div className="h-10 w-px bg-premium-lilac/20" />
                      <div className="space-y-1.5">
                        <h5 className="text-lg font-bold text-premium-purple-plum tracking-tight">{apt.patient}</h5>
                        <div className="flex items-center gap-4 text-xs font-bold text-premium-purple-plum/40 uppercase tracking-widest">
                          <span className="flex items-center gap-2">{apt.type === 'Video Call' ? <Video className="w-4 h-4 text-premium-purple" /> : <Users className="w-4 h-4 text-premium-purple" />} {apt.reason}</span>
                          <span className="w-1 h-1 rounded-full bg-premium-lilac" />
                          <Badge variant={apt.status === 'Ready' ? 'success' : apt.status === 'Waiting' ? 'warning' : 'premium'}>{apt.status}</Badge>
                        </div>
                      </div>
                    </div>
                    <Button size="sm" className={clsx(
                      "opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-500",
                      apt.status === 'Ready' && "bg-premium-purple-plum text-white shadow-premium-layered"
                    )}>
                      Start Consultation
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              ) : (
                <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-3xl bg-premium-surface flex items-center justify-center text-premium-purple/20">
                    <Calendar className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-premium-purple-plum">No appointments for today</p>
                    <p className="text-xs text-premium-purple-plum/40">Your schedule is currently clear.</p>
                  </div>
                  <Button variant="outline" size="sm" className="mt-4">Schedule One Now</Button>
                </div>
              )}
            </div>
          </Card>

          {/* Lower Content Section - Recent Patients */}
          <Card 
            title="Recent Patients" 
            subtitle="Patient lifecycle overview"
            headerAction={<Button variant="ghost" size="sm">View Directory <ChevronRight className="w-3 h-3 ml-1" /></Button>}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {recentPatients.map((patient) => (
                <div key={patient.id} className="flex items-center gap-5 p-5 rounded-3xl bg-premium-pearl-tint/50 border border-premium-lilac/10 hover:border-premium-purple/30 hover:bg-white hover:shadow-premium-layered transition-all duration-500 group cursor-pointer">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-premium-lilac to-white flex items-center justify-center text-premium-purple-plum font-black border border-premium-lilac/30 shadow-premium-soft group-hover:scale-105 transition-transform duration-500">
                    {patient.initials}
                  </div>
                  <div className="space-y-1 flex-1">
                    <h6 className="font-bold text-premium-purple-plum tracking-tight">{patient.name}</h6>
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold text-premium-purple-plum/40 uppercase tracking-widest">{patient.condition}</p>
                      <p className="text-[10px] font-bold text-premium-purple-plum/20 uppercase tracking-tighter">{patient.lastVisit}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Side Utility Panels */}
        <div className="space-y-10">
          {/* Quick Actions */}
          <Card title="Quick Actions" subtitle="Fast task completion">
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: FileText, label: 'New Note' },
                { icon: ClipboardList, label: 'Protocol' },
                { icon: Users, label: 'Add Patient' },
                { icon: CreditCard, label: 'Invoice' }
              ].map((action) => (
                <button key={action.label} className="flex flex-col items-center gap-4 p-6 rounded-3xl bg-premium-pearl-tint/50 border border-premium-lilac/10 hover:border-premium-purple/30 hover:bg-white hover:shadow-premium-layered transition-all duration-500 group">
                  <div className="p-4 rounded-2xl bg-white text-premium-purple-plum shadow-premium-soft group-hover:bg-premium-purple-plum group-hover:text-white transition-all duration-500">
                    <action.icon className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-black text-premium-purple-plum uppercase tracking-[0.2em]">{action.label}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Alerts */}
          <Card title="Urgent Alerts" subtitle="Action required">
            <div className="space-y-4">
              {alerts.map((alert) => (
                <div key={alert.id} className={clsx(
                  "p-5 rounded-3xl border flex gap-4 transition-all duration-300",
                  alert.type === 'critical' ? "bg-rose-50/50 border-rose-100 hover:bg-rose-50" : "bg-blue-50/50 border-blue-100 hover:bg-blue-50"
                )}>
                  <div className={clsx(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                    alert.type === 'critical' ? "bg-rose-100 text-rose-600" : "bg-blue-100 text-blue-600"
                  )}>
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-premium-purple-plum leading-relaxed">{alert.message}</p>
                    <p className="text-[10px] font-bold opacity-30 uppercase tracking-widest">{alert.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Draft Notes */}
          <Card title="Draft Notes" subtitle="Continue working">
            <div className="space-y-6">
              {draftNotes.map((note) => (
                <div key={note.id} className="space-y-3 group cursor-pointer">
                  <div className="flex items-center justify-between">
                    <h6 className="text-[11px] font-black text-premium-purple-plum uppercase tracking-widest">{note.patient}</h6>
                    <span className="text-[10px] font-bold text-premium-purple-plum/20 uppercase tracking-tighter">{note.date}</span>
                  </div>
                  <div className="p-5 rounded-3xl bg-premium-lilac-light/30 border border-premium-lilac/10 group-hover:border-premium-purple/20 transition-all duration-300">
                    <p className="text-xs text-premium-purple-plum/60 italic leading-relaxed line-clamp-2">“{note.preview}”</p>
                  </div>
                </div>
              ))}
              <Button variant="ghost" className="w-full mt-4 text-[10px] font-black uppercase tracking-[0.2em] py-4 border-t border-premium-lilac/10 rounded-none">
                View All Drafts
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}