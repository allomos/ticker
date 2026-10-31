// Small line icons for the signed-out pages, drawn in the current text colour.
const base = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export const SearchIcon = () => (
  <svg {...base}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M20 20l-4.8-4.8" />
  </svg>
);

export const ListIcon = () => (
  <svg {...base}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1" />
    <circle cx="4.5" cy="12" r="1" />
    <circle cx="4.5" cy="18" r="1" />
  </svg>
);

export const ChartIcon = () => (
  <svg {...base}>
    <path d="M4 19h16" />
    <path d="M4 15l5-5 4 3 7-7" />
  </svg>
);

export const MailIcon = () => (
  <svg {...base}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3.5 6.5l8.5 6 8.5-6" />
  </svg>
);

export const MailCheckIcon = () => (
  <svg {...base}>
    <path d="M13 19H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" />
    <path d="M3.5 6.5l8.5 6 8.5-6" />
    <path d="M15 19l2 2 4-4" />
  </svg>
);
