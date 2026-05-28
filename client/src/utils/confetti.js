import confetti from 'canvas-confetti';

const COLORS = ['#C65D3E', '#0F1B2D', '#E8DDD0', '#7C9082', '#C29A3A'];

// Small celebratory burst — used when the last open action item in a meeting
// flips to done. Tuned to feel like a quick "✓ all clear" — not a parade.
export function celebrate(origin) {
  const opts = {
    particleCount: 60,
    spread: 60,
    startVelocity: 32,
    decay: 0.92,
    scalar: 0.85,
    colors: COLORS,
    origin: origin || { x: 0.5, y: 0.5 },
    disableForReducedMotion: true,
  };
  confetti(opts);
  setTimeout(() => confetti({ ...opts, particleCount: 30, spread: 80, startVelocity: 24 }), 120);
}
