/** Ticker's mark (logo B2): rising dots, a gold star upper left and a gold ball lower right. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M9.6 21.6L13 19M19.3 13.2L21.6 11.4" stroke="#2a9d8f" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="6.5" cy="24" r="3.6" fill="none" stroke="#2a9d8f" strokeWidth="2.6" />
      <circle cx="16" cy="16.5" r="4.2" fill="#2a9d8f" />
      <circle cx="25" cy="8" r="5.2" fill="#e76f51" />
      <path d="M7 3.5l1.2 2.8 2.8 1.2-2.8 1.2L7 11.5 5.8 8.7 3 7.5l2.8-1.2z" fill="#e9c46a" />
      <circle cx="25.5" cy="24.5" r="4" fill="#e9c46a" />
    </svg>
  );
}
