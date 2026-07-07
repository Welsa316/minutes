// Curated warm cover gradients for notes. Stored on the note as a token string
// (or '' for none). Kept as a fixed palette — a cover is its own colored band,
// so it looks intentional in both light and dark editors.
export const COVERS = {
  terracotta: 'linear-gradient(135deg, #C65D3E 0%, #E29070 100%)',
  ember:      'linear-gradient(135deg, #A83F26 0%, #C65D3E 100%)',
  dusk:       'linear-gradient(135deg, #C65D3E 0%, #2B3A55 100%)',
  ink:        'linear-gradient(135deg, #0F1B2D 0%, #2A3C57 100%)',
  sand:       'linear-gradient(135deg, #E8DDD0 0%, #C9B49A 100%)',
  sage:       'linear-gradient(135deg, #3F6B4C 0%, #6E9A79 100%)',
};

export const COVER_KEYS = Object.keys(COVERS);

export function coverStyle(token) {
  return COVERS[token] ? { backgroundImage: COVERS[token] } : null;
}
