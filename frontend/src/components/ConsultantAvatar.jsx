/** Avatar del asistente: consultor de call center con diadema y micrófono. */
export default function ConsultantAvatar({ className = "h-6 w-6" }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="cbg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="23" fill="url(#cbg)" />
      {/* hombros / traje */}
      <path d="M7 44c0-7 7-11 17-11s17 4 17 11v3H7v-3z" fill="#0F172A" />
      <path d="M21 33l3 6 3-6-3-2-3 2z" fill="#F8FAFC" />
      <path d="M23 36h2l-1 5-1-5z" fill="#22D3EE" />
      {/* cuello y cabeza */}
      <rect x="21" y="26" width="6" height="6" rx="2" fill="#EAB88A" />
      <circle cx="24" cy="19" r="8" fill="#F5C99B" />
      {/* cabello */}
      <path d="M16 18c0-6 4-9 8-9s8 3 8 9c-2-3-4-4-8-4s-6 1-8 4z" fill="#2B2118" />
      {/* rostro */}
      <circle cx="21" cy="19.5" r="1" fill="#0F172A" />
      <circle cx="27" cy="19.5" r="1" fill="#0F172A" />
      <path d="M21.5 23.5c1.5 1.2 3.5 1.2 5 0" stroke="#0F172A" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      {/* diadema */}
      <path d="M14 21C14 9 34 9 34 21" stroke="#0F172A" strokeWidth="3" fill="none" strokeLinecap="round" />
      <rect x="11.5" y="17" width="4.5" height="8" rx="2.25" fill="#0F172A" />
      <rect x="32" y="17" width="4.5" height="8" rx="2.25" fill="#0F172A" />
      {/* micrófono */}
      <path d="M34.5 25c0 5-4 7-7.5 5.5" stroke="#0F172A" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <circle cx="26" cy="30" r="2.2" fill="#0F172A" />
      <circle cx="26" cy="30" r="1" fill="#22D3EE" />
    </svg>
  );
}
