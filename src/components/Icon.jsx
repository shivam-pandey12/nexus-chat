const ICON_PATHS = {
  close: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
  user: (
    <>
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="8" r="4" />
    </>
  ),
  login: (
    <>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="m10 17 5-5-5-5" />
      <path d="M15 12H3" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </>
  ),
  sparkle: (
    <>
      <path d="m12 3 1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8Z" />
      <path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9Z" />
      <path d="m5 15 .8 1.7L7.5 17.5 5.8 18.3 5 20l-.8-1.7-1.7-.8 1.7-.8Z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m9 12 2 2 4-5" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  wifiOff: (
    <>
      <path d="M12 20h.01" />
      <path d="M8.5 16.5a5 5 0 0 1 7 0" />
      <path d="M2 8.8a15.9 15.9 0 0 1 5.2-3" />
      <path d="M16.8 5.8A15.9 15.9 0 0 1 22 8.8" />
      <path d="M5 12.2a10.8 10.8 0 0 1 14 0" />
      <path d="m2 2 20 20" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </>
  ),
  smartphone: (
    <>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </>
  ),
  calendar: (
    <>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect x="3" y="4" width="18" height="18" rx="3" />
      <path d="M3 10h18" />
      <path d="M8 14h.01" />
      <path d="M12 14h.01" />
      <path d="M16 14h.01" />
      <path d="M8 18h.01" />
      <path d="M12 18h.01" />
    </>
  ),
  pricing: (
    <>
      <path d="M20 13.5V7a2 2 0 0 0-2-2h-6.5L4 12.5a2 2 0 0 0 0 2.8l4.7 4.7a2 2 0 0 0 2.8 0Z" />
      <circle cx="16" cy="9" r="1.4" />
    </>
  ),
  store: (
    <>
      <path d="M4 9h16" />
      <path d="M6 9v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9" />
      <path d="m5 9 1.4-5h11.2L19 9" />
      <path d="M9 13h6" />
    </>
  ),
  rooms: (
    <>
      <path d="M5 5h6v6H5z" />
      <path d="M13 5h6v6h-6z" />
      <path d="M5 13h6v6H5z" />
      <path d="M13 13h6v6h-6z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </>
  ),
  moon: <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.8 6.8 0 0 0 21 12.8Z" />,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  menu: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22Z" />
      <path d="M8 3v17" />
      <path d="M12 8h5" />
    </>
  ),
  code: (
    <>
      <path d="m8 9-4 3 4 3" />
      <path d="m16 9 4 3-4 3" />
      <path d="m14 5-4 14" />
    </>
  ),
  gamepad: (
    <>
      <path d="M6.5 8h11A4.5 4.5 0 0 1 22 12.5v2A3.5 3.5 0 0 1 18.5 18c-1.3 0-2.1-.7-3-2H8.5c-.9 1.3-1.7 2-3 2A3.5 3.5 0 0 1 2 14.5v-2A4.5 4.5 0 0 1 6.5 8Z" />
      <path d="M7 11v4" />
      <path d="M5 13h4" />
      <path d="M16 12h.01" />
      <path d="M19 14h.01" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3a9 9 0 1 0 0 18h1.2a2 2 0 0 0 0-4H12a1.5 1.5 0 0 1 0-3h2a5 5 0 0 0 0-10Z" />
      <path d="M7.5 10h.01" />
      <path d="M9.5 6.8h.01" />
      <path d="M14.2 6.5h.01" />
    </>
  ),
  shuffle: (
    <>
      <path d="M16 3h5v5" />
      <path d="m4 20 6.4-6.4" />
      <path d="M21 16v5h-5" />
      <path d="m15 15 6 6" />
      <path d="m4 4 5 5" />
      <path d="M15 9 21 3" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.8 9a2.4 2.4 0 1 1 3.8 2c-.9.7-1.6 1.1-1.6 2.4" />
      <path d="M12 17h.01" />
    </>
  ),
  badge: (
    <>
      <path d="m12 3 2.2 2.1 3-.2.4 3 2.4 1.9-1.4 2.7.8 2.9-2.9.9-1 2.8-2.8-.8L10 20l-1.9-2.4-3 .4-.4-3L2.3 13l1.4-2.7-.8-2.9 2.9-.9 1-2.8 2.8.8Z" />
      <path d="m9 12 2 2 4-5" />
    </>
  ),
};

export default function Icon({ name, size = 20, strokeWidth = 2, className = '' }) {
  return (
    <svg
      className={`ui-icon ${className}`.trim()}
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICON_PATHS[name] || ICON_PATHS.sparkle}
    </svg>
  );
}
