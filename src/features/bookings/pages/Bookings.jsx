import { useEffect, useRef } from 'react';
import { mountConsultationQueue } from './bookings-queue';

// This page is intentionally not written in JSX. Everything inside the
// container below is owned by bookings-queue.js, a plain vanilla JS module
// that renders and manages the consultation queue directly with the DOM.
//
// Nothing outside this file and bookings-queue.js was touched: routing,
// auth guards, the app layout/sidebar, and every other page are unaffected.
export default function Bookings() {
  const containerRef = useRef(null);

  useEffect(() => {
    const cleanup = mountConsultationQueue(containerRef.current);
    return cleanup;
  }, []);

  return <div ref={containerRef} />;
}
