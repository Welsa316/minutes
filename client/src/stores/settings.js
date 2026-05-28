import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

const STORAGE_KEY = 'minutes:settings';

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      theme: raw.theme || 'system',
      sound: raw.sound ?? false,
    };
  } catch {
    return { theme: 'system', sound: false };
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const initial = load();
  const theme = ref(initial.theme);   // 'light' | 'dark' | 'system'
  const sound = ref(initial.sound);

  function applyTheme() {
    const sys = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = theme.value === 'dark' || (theme.value === 'system' && sys);
    document.documentElement.classList.toggle('dark', dark);
  }

  function cycleTheme() {
    theme.value = theme.value === 'light' ? 'dark' : theme.value === 'dark' ? 'system' : 'light';
  }

  watch([theme, sound], () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: theme.value, sound: sound.value }));
    applyTheme();
  });

  // Re-apply when the system color scheme changes
  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  }

  applyTheme();

  return { theme, sound, applyTheme, cycleTheme };
});
