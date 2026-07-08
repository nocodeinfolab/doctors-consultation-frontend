import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { mountPublicBookingPage } from './public-booking';

// This page is intentionally not written in JSX. Everything inside the
// container below is owned by public-booking.js, a plain vanilla JS module
// that renders the booking wizard directly with the DOM.
//
// Nothing outside this file and public-booking.js was touched: routing,
// auth guards, and every other page are unaffected.
export default function PublicBookingPage() {
  const { token } = useParams();
  const containerRef = useRef(null);

  useEffect(() => {
    const cleanup = mountPublicBookingPage(containerRef.current, { token });
    return cleanup;
  }, [token]);

  return <div className="mx-auto max-w-3xl px-4 py-10" ref={containerRef} />;
}
