import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

const STORAGE_KEY = 'minutes:settings';

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      theme: raw.theme || 'system',
      sound: raw.sound ?? false,
      density: raw.density || 'comfortable',
    };
  } catch {
    return { theme: 'system', sound: false, density: 'comfortable' };
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const initial = load();
  const theme = ref(initial.theme);   // 'light' | 'dark' | 'system'
  const sound = ref(initial.sound);
  const density = ref(initial.density); // 'comfortable' | 'compact'

  function applyTheme() {
    const sys = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = theme.value === 'dark' || (theme.value === 'system' && sys);
    document.documentElement.classList.toggle('dark', dark);
  }

  function applyDensity() {
    document.documentElement.setAttribute('data-density', density.value);
  }

  function cycleTheme() {
    theme.value = theme.value === 'light' ? 'dark' : theme.value === 'dark' ? 'system' : 'light';
  }

  function toggleDensity() {
    density.value = density.value === 'comfortable' ? 'compact' : 'comfortable';
  }

  watch([theme, sound, density], () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: theme.value, sound: sound.value, density: density.value }));
    applyTheme();
    applyDensity();
  });

  // Re-apply when the system color scheme changes
  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  }

  applyTheme();
  applyDensity();

  return { theme, sound, density, applyTheme, applyDensity, cycleTheme, toggleDensity };
});
