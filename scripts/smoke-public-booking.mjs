import fs from 'fs';
import path from 'path';
import process from 'process';

const root = process.cwd();
const pagePath = path.join(
  root,
  'src',
  'features',
  'publicBooking',
  'pages',
  'PublicBookingPage.jsx'
);
const routerPath = path.join(root, 'src', 'app', 'router', 'index.js');

const page = fs.readFileSync(pagePath, 'utf8');
const router = fs.readFileSync(routerPath, 'utf8');

const checks = [
  {
    name: 'public booking route is registered',
    pass: router.includes("path: '/book/:token'") && router.includes('PublicBookingPage'),
  },
  {
    name: 'CreditCard icon is imported before payment panel renders',
    pass:
      /import\s*{[\s\S]*CreditCard[\s\S]*}\s*from\s*'lucide-react'/.test(page) &&
      page.includes('<CreditCard className='),
  },
  {
    name: 'service/package options can be selected',
    pass:
      page.includes('availableServices.map') &&
      page.includes('handleConsultationServiceSelect(service)') &&
      page.includes('bookingForm.consultation_service_id === service.id'),
  },
  {
    name: 'pricing/payment section appears after service selection',
    pass:
      page.includes('{selectedService && (') &&
      page.includes('Payment Required') &&
      page.includes('selectedConsultationFee'),
  },
  {
    name: 'consent checkbox is present and required',
    pass:
      page.includes('id="patient-consent"') &&
      page.includes('patient_consent_given') &&
      page.includes('required'),
  },
  {
    name: 'emergency acknowledgement checkbox is present and required',
    pass:
      page.includes('id="emergency-acknowledgement"') &&
      page.includes('emergency_acknowledged') &&
      page.includes('required'),
  },
  {
    name: 'submitting without consent has validation messaging',
    pass:
      page.includes('Patient consent and emergency acknowledgement are required') ||
      (page.includes('consentForm.patient_consent_given') &&
        page.includes('consentForm.emergency_acknowledged')),
  },
  {
    name: 'service selection path has no inline ErrorBoundary fallback',
    pass: !page.includes('Dashboard could not render') && !page.includes('ErrorBoundary'),
  },
];

const failures = checks.filter((check) => !check.pass);

for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}`);
}

if (failures.length > 0) {
  console.error(`\nPublic booking smoke test failed: ${failures.length} check(s) failed.`);
  process.exit(1);
}

console.log('\nPublic booking smoke test passed.');
