// Deterministic per-client color from a palette of 8. Same client name always
// hashes to the same color so the eye can scan lists by hue.
const PALETTE = [
  { name: 'terracotta', bg: '#C65D3E', soft: '#F4D9CE', text: '#7A2E1A' },
  { name: 'ink',        bg: '#0F1B2D', soft: '#CFD4DC', text: '#0F1B2D' },
  { name: 'sage',       bg: '#7C9082', soft: '#D9E1D9', text: '#3D4E40' },
  { name: 'mustard',    bg: '#C29A3A', soft: '#EFE2BD', text: '#5D4716' },
  { name: 'rust',       bg: '#A2493A', soft: '#E8C8C0', text: '#5E2418' },
  { name: 'plum',       bg: '#7C4A6E', soft: '#DDCCD7', text: '#3F2238' },
  { name: 'forest',     bg: '#3F6B4C', soft: '#C7D8CD', text: '#1E3525' },
  { name: 'slate',      bg: '#4A5568', soft: '#D5D9E0', text: '#26303D' },
];

function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function clientColor(name) {
  if (!name) return PALETTE[0];
  return PALETTE[hash(name) % PALETTE.length];
}

export function initials(name) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}
