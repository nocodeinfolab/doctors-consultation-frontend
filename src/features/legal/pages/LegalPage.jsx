import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const pages = {
  '/privacy': {
    title: 'Privacy Policy',
    intro:
      'KuraMedics is designed with privacy and security in mind for Nigeria-first doctor-owned consultation workflows.',
    sections: [
      [
        'What We Collect',
        'For patients, we may collect name, email or phone, booking information, preferred appointment time, consultation reason or message, payment status and reference, uploaded files where applicable, and consultation history where applicable. For doctors, we may collect name, email or phone, licence and verification details, clinic/profile details, and subscription or payment information where applicable.',
      ],
      [
        'Why We Collect It',
        'We use this information for appointment booking, doctor-patient communication, consultation management, payment confirmation, account security, support, legal record-keeping, and continuity of care.',
      ],
      [
        'Who Can Access It',
        'Patient information is available to the assigned doctor, the patient where applicable, and authorised KuraMedics administrators only when needed for support, compliance, or security.',
      ],
      [
        'Service Providers',
        'We use Paystack for payments. We may also use hosting, database, error monitoring, and logging providers such as Sentry where configured. KuraMedics does not store card details directly.',
      ],
      [
        'Security',
        'We use safeguards including authentication, role-based access control, doctor-specific patient access, HTTPS in production, audit logs, backups, and operational monitoring.',
      ],
      [
        'Your Rights',
        'You may request access, correction, or deletion where legally allowed. Some healthcare, payment, audit, or security records may need to be retained. Contact privacy@kuramedics.com.',
      ],
      ['No Sale of Patient Data', 'KuraMedics does not sell patient data.'],
    ],
  },
  '/terms': {
    title: 'Terms of Use',
    intro: 'These terms explain the basic rules for using KuraMedics during private beta.',
    sections: [
      [
        'Software Infrastructure',
        'KuraMedics provides software infrastructure for doctors to manage bookings, messages, consultation notes, payments, and patient-related information.',
      ],
      [
        'Independent Doctors',
        'Doctors using KuraMedics are independent healthcare providers. KuraMedics is not a hospital and does not provide medical diagnosis, prescriptions, or treatment.',
      ],
      [
        'No Emergencies',
        'Patients should not use KuraMedics for emergencies. If symptoms are severe or urgent, seek immediate medical care.',
      ],
      [
        'Clinical Responsibility',
        'Doctors are responsible for their professional advice, diagnosis, prescriptions, documentation, and patient management. Patients are responsible for providing accurate information.',
      ],
      [
        'Bookings and Payments',
        'Payments, booking requests, confirmations, cancellations, and refunds are subject to the doctor and platform policy shown or agreed at the relevant time. Payment status does not mean an appointment is confirmed until the doctor confirms it.',
      ],
      [
        'Account Safety',
        'Platform access may be suspended for misuse, fraud, abuse, failed verification, or security concerns.',
      ],
      [
        'Liability in Plain English',
        'We work to keep KuraMedics reliable and secure, but the platform is provided as software support. To the extent allowed by law, KuraMedics is not responsible for clinical decisions made by independent doctors or for emergencies handled outside the platform.',
      ],
    ],
  },
  '/doctor-terms': {
    title: 'Doctor Terms',
    intro:
      'These provider terms apply to doctors using KuraMedics to manage patient consultations.',
    sections: [
      [
        'Accurate Professional Information',
        'Doctors must provide accurate legal name, professional, licence, clinic, pricing, and availability information, and keep it updated.',
      ],
      [
        'Lawful Healthcare Use',
        'Doctors must use KuraMedics only for lawful healthcare-related services and must not misuse patient data.',
      ],
      [
        'Clinical Responsibility',
        'Doctors remain responsible for patient care, advice, prescriptions, follow-up, and consultation records.',
      ],
      [
        'Confidentiality',
        'Doctors must protect patient confidentiality and only access patient information for legitimate care or operational purposes.',
      ],
      [
        'Account Security',
        'Doctors must not share login credentials and should report suspected account compromise promptly.',
      ],
      [
        'Suspension',
        'KuraMedics may suspend accounts for failed verification, misuse, fraud, safety concerns, or serious policy breach.',
      ],
      [
        'Commercial Terms',
        'Payments, subscriptions, commissions, and plan features are subject to agreed platform terms.',
      ],
    ],
  },
  '/data-retention': {
    title: 'Data Retention Policy',
    intro:
      'KuraMedics keeps records where needed for care continuity, legal, financial, operational, and security reasons.',
    sections: [
      [
        'Clinical Records',
        'Consultation records, messages, uploaded files, and patient history may be retained to support continuity of care and appropriate record-keeping.',
      ],
      [
        'Archived Records',
        'Completed consultations may be archived instead of permanently deleted. Archived records are hidden from active views but remain available in history or audit context.',
      ],
      [
        'Payments and Audit Logs',
        'Payment records are retained for financial and audit purposes. Audit logs may be retained for security, fraud prevention, support, and compliance review.',
      ],
      [
        'Deletion Requests',
        'Users may request deletion where legally allowed, but some records may need to be retained for healthcare, payment, dispute, audit, or security reasons.',
      ],
      [
        'Ongoing Improvement',
        'We continue to improve our privacy and security practices as KuraMedics moves from private beta toward wider availability.',
      ],
    ],
  },
  '/security': {
    title: 'Security',
    intro:
      'KuraMedics uses practical safeguards to protect patient information and clinic workflows.',
    sections: [
      [
        'Access Control',
        'Role-based access control limits what doctors, patients, and administrators can see. Doctors only access patient data connected to their own clinic workspace.',
      ],
      [
        'Admin Restrictions',
        'Administrator access is reserved for support, compliance, security, and operational needs. Admin actions may be logged.',
      ],
      [
        'Authentication and Sessions',
        'KuraMedics uses secure authentication, JWT access and refresh flows, session timeout, and account protection controls.',
      ],
      [
        'Traffic and Abuse Protection',
        'Rate limiting helps reduce abuse. Production deployments should use HTTPS and secure cookie settings.',
      ],
      [
        'Payments',
        'Payments are handled through Paystack. KuraMedics does not directly store card details.',
      ],
      [
        'Monitoring and Backups',
        'The platform supports error monitoring, operational logging, audit logs, and database backup workflows.',
      ],
      [
        'Responsible Disclosure',
        'Please report security concerns to security@kuramedics.com with enough detail for us to investigate safely.',
      ],
    ],
  },
};

const legalLinks = [
  ['/privacy', 'Privacy'],
  ['/terms', 'Terms'],
  ['/doctor-terms', 'Doctor Terms'],
  ['/data-retention', 'Data Retention'],
  ['/security', 'Security'],
];

export default function LegalPage() {
  const location = useLocation();
  const page = pages[location.pathname] || pages['/privacy'];

  return (
    <main className="min-h-screen bg-premium-surface px-4 py-10 text-premium-purple-plum sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link
          to="/login"
          className="text-sm font-semibold text-premium-purple-plum/65 hover:text-premium-purple-plum"
        >
          KuraMedics
        </Link>
        <h1 className="mt-8 font-display text-4xl font-bold">{page.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-premium-purple-plum/65">
          {page.intro} Last updated May 1, 2026. This private-beta information is not a substitute
          for legal advice.
        </p>

        <div className="mt-8 space-y-4">
          {page.sections.map(([title, body]) => (
            <section
              key={title}
              className="rounded-2xl border border-premium-lilac/20 bg-white/75 p-5"
            >
              <h2 className="font-display text-xl font-bold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-premium-purple-plum/70">{body}</p>
            </section>
          ))}
        </div>

        <nav className="mt-8 flex flex-wrap gap-3 text-sm font-semibold">
          {legalLinks.map(([href, label]) => (
            <Link
              key={href}
              to={href}
              className="rounded-full bg-premium-lilac-light px-4 py-2 text-premium-purple-plum"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
