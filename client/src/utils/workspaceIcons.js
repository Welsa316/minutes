// Curated minimalist line icons for workspaces (Lucide-flavored, stroke-only).
// Stored on the workspace as the key string; legacy single-letter icons still
// render as text via WorkspaceIcon's fallback.
export const WS_ICONS = {
  sparkles:  ['M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z', 'M18.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z'],
  briefcase: ['M4 8h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z', 'M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2', 'M4 12h16'],
  rocket:    ['M9 15l-3 3-1 4 4-1 3-3', 'M14 4c3 0 6 3 6 6l-6 6-6-6c0-3 3-6 6-6z', 'M12 9h.01'],
  folder:    ['M3 7a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z'],
  layers:    ['M12 3l9 5-9 5-9-5z', 'M3 12l9 5 9-5', 'M3 16l9 5 9-5'],
  flag:      ['M5 21V4', 'M5 4h13l-2.5 4L18 12H5'],
  bolt:      ['M13 2L4 14h7l-1 8 9-12h-7z'],
  leaf:      ['M4 20c0-9 7-15 16-15 0 9-6 16-15 16', 'M4 20c3-4 7-6 11-7'],
  compass:   ['M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z', 'M15.5 8.5l-2 5-5 2 2-5z'],
  target:    ['M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z', 'M12 8a4 4 0 1 0 0 8 4 4 0 1 0 0-8z', 'M12 11.6a.4.4 0 1 0 0 .8.4.4 0 1 0 0-.8z'],
  globe:     ['M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z', 'M3 12h18', 'M12 3c2.5 2.5 3.6 6 3.6 9s-1.1 6.5-3.6 9c-2.5-2.5-3.6-6-3.6-9s1.1-6.5 3.6-9z'],
  heart:     ['M12 20s-6.5-4.3-9-8.5C1.5 8.5 3.5 5 6.8 5 9 5 12 7.5 12 7.5S15 5 17.2 5C20.5 5 22.5 8.5 21 11.5 18.5 15.7 12 20 12 20z'],
  star:      ['M12 3l2.6 5.5 6 .8-4.4 4.2 1.1 6L12 16.9 6.7 19.5l1.1-6L3.4 9.3l6-.8z'],
  book:      ['M5 4h12a1 1 0 0 1 1 1v15H6a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1z', 'M4 18a2 2 0 0 1 2-2h12'],
  pen:       ['M4 20l1-4L15 6l3 3L8 19z', 'M13 8l3 3'],
  grid:      ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
};

export const WS_ICON_KEYS = Object.keys(WS_ICONS);
