import { ref, onBeforeUnmount } from 'vue';

// Thin wrapper over the browser's Web Speech API (SpeechRecognition).
// 100% on-device/cloud via the browser — NO API key, NO AI integration, free.
// Supported on Chrome (desktop + Android) and Safari/iOS 14.5+. Requires HTTPS
// (or localhost). Returns supported=false elsewhere so callers can hide the UI.

const SR = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

export function useSpeech() {
  const supported = !!SR;
  const listening = ref(false);
  const transcript = ref('');
  const error = ref(null);
  let recognition = null;

  function start({ lang = 'en-US', interim = true, continuous = false } = {}, onResult) {
    if (!supported) { error.value = 'not-supported'; return; }
    error.value = null;
    transcript.value = '';
    recognition = new SR();
    recognition.lang = lang;
    recognition.interimResults = interim;
    recognition.continuous = continuous;

    recognition.onresult = (e) => {
      let finalText = '';
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += chunk;
        else interimText += chunk;
      }
      transcript.value = (finalText || interimText).trim();
      onResult?.(transcript.value, !!finalText);
    };
    recognition.onerror = (e) => {
      // 'no-speech', 'not-allowed' (mic denied), 'aborted', etc.
      error.value = e.error || 'error';
      listening.value = false;
    };
    recognition.onend = () => { listening.value = false; };

    try {
      recognition.start();
      listening.value = true;
    } catch {
      // start() throws if already running — ignore.
    }
  }

  function stop() {
    try { recognition?.stop(); } catch {}
    listening.value = false;
  }

  onBeforeUnmount(stop);

  return { supported, listening, transcript, error, start, stop };
}
