// Tiny Web Audio "instruments". No assets, no library — just synthesized blips.
// The caller is responsible for checking the user opt-in (settings.sound).

let ctx = null;
function audio() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { ctx = null; }
  }
  return ctx;
}

function tone({ freq, type = 'sine', dur = 0.08, attack = 0.005, decay = 0.07, gain = 0.05 }) {
  const a = audio();
  if (!a) return;
  if (a.state === 'suspended') a.resume();
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, a.currentTime);
  g.gain.setValueAtTime(0, a.currentTime);
  g.gain.linearRampToValueAtTime(gain, a.currentTime + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + attack + decay);
  osc.connect(g).connect(a.destination);
  osc.start();
  osc.stop(a.currentTime + dur);
}

export const sounds = {
  pop()  { tone({ freq: 660, type: 'triangle', dur: 0.08, gain: 0.07 }); },
  click(){ tone({ freq: 880, type: 'sine', dur: 0.05, gain: 0.04 }); },
  whoosh() {
    const a = audio(); if (!a) return;
    if (a.state === 'suspended') a.resume();
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, a.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, a.currentTime + 0.12);
    g.gain.setValueAtTime(0, a.currentTime);
    g.gain.linearRampToValueAtTime(0.04, a.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.18);
    osc.connect(g).connect(a.destination);
    osc.start();
    osc.stop(a.currentTime + 0.2);
  },
};
