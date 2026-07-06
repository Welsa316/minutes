<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const mode = ref('signin'); // 'signin' | 'signup'
const isSignup = computed(() => mode.value === 'signup');

const email = ref('');
const password = ref('');
const name = ref('');

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
// Google's OAuth popup doesn't work reliably inside the Electron desktop shell,
// so only offer it in a real browser. Desktop users sign in with a password.
const isElectron = typeof navigator !== 'undefined' && /electron/i.test(navigator.userAgent);
const showGoogle = GOOGLE_CLIENT_ID && !isElectron;
let tokenClient = null;

function toggleMode() {
  mode.value = isSignup.value ? 'signin' : 'signup';
  auth.error = null;
}

function goAfterAuth() {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/home';
  router.replace(redirect);
}

async function onSubmit() {
  const ok = isSignup.value
    ? await auth.register(email.value.trim(), password.value, name.value.trim())
    : await auth.login(email.value.trim(), password.value);
  if (ok) goAfterAuth();
}

// Google Identity Services: load the script, render Google's own button, and
// hand the returned ID token to the server. Only runs if a client id is set —
// otherwise the button silently doesn't appear.
function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    let s = document.getElementById('gsi-script');
    if (s) { s.addEventListener('load', () => resolve()); s.addEventListener('error', reject); return; }
    s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true; s.id = 'gsi-script';
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function onGoogleToken(resp) {
  if (!resp?.access_token) {
    if (resp?.error && resp.error !== 'popup_closed' && resp.error !== 'access_denied') {
      auth.error = 'Google sign-in failed.';
    }
    return;
  }
  const ok = await auth.loginWithGoogle({ access_token: resp.access_token });
  if (ok) goAfterAuth();
}

onMounted(async () => {
  if (!showGoogle) return;
  try {
    await loadGoogleScript();
    // Token (implicit) flow so we can drive Google from our own button.
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'openid email profile',
      callback: onGoogleToken,
    });
  } catch { /* offline or blocked — email/password still works */ }
});

function signInWithGoogle() {
  auth.error = null;
  tokenClient?.requestAccessToken();
}
</script>

<template>
  <div class="min-h-dvh flex items-center justify-center bg-warm px-4">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <div class="inline-flex h-14 w-14 items-center justify-center rounded-xl font-serif text-3xl mb-4" style="background-color:#C65D3E;color:#FBF8F3">m</div>
        <h1 class="text-3xl font-serif text-ink">Minutes</h1>
      </div>

      <form @submit.prevent="onSubmit" class="card space-y-4">
        <div v-if="isSignup">
          <label class="label" for="name">Name</label>
          <input id="name" v-model="name" autocomplete="name" class="input" placeholder="Optional" />
        </div>

        <div>
          <label class="label" for="email">{{ isSignup ? 'Email' : 'Email or username' }}</label>
          <input
            id="email"
            v-model="email"
            :type="isSignup ? 'email' : 'text'"
            :autocomplete="isSignup ? 'email' : 'username'"
            required
            class="input"
          />
        </div>

        <div>
          <label class="label" for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            :autocomplete="isSignup ? 'new-password' : 'current-password'"
            :minlength="isSignup ? 8 : undefined"
            required
            class="input"
          />
          <p v-if="isSignup" class="text-xs text-slate-warm mt-1">At least 8 characters.</p>
        </div>

        <p v-if="auth.error" class="text-sm text-terracotta">{{ auth.error }}</p>

        <button type="submit" :disabled="auth.loading" class="btn-primary w-full">
          <template v-if="isSignup">{{ auth.loading ? 'Creating…' : 'Create account' }}</template>
          <template v-else>{{ auth.loading ? 'Signing in…' : 'Sign in' }}</template>
        </button>

        <template v-if="showGoogle">
          <div class="flex items-center gap-3 text-xs text-slate-warm">
            <span class="h-px flex-1 bg-sand" />
            or
            <span class="h-px flex-1 bg-sand" />
          </div>
          <div class="flex justify-center">
            <button
              type="button"
              class="g-btn"
              :disabled="auth.loading"
              @click="signInWithGoogle"
              aria-label="Continue with Google"
              title="Continue with Google"
            >
              <svg class="g-icon" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
            </button>
          </div>
        </template>
      </form>

      <p class="text-center text-sm text-slate-warm mt-4">
        <template v-if="isSignup">
          Have an account?
          <button type="button" class="text-terracotta hover:underline" @click="toggleMode">Sign in</button>
        </template>
        <template v-else>
          New here?
          <button type="button" class="text-terracotta hover:underline" @click="toggleMode">Create an account</button>
        </template>
      </p>
    </div>
  </div>
</template>

<style scoped>
/* Icon-only "Continue with Google": a floating circular button in Minutes
   chrome around the official Google mark. Adapts to warm dark mode via vars. */
.g-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 56px; height: 56px; border-radius: 50%;
  background: rgb(var(--c-surface));
  border: 1px solid rgb(var(--c-sand));
  cursor: pointer;
  box-shadow: 0 10px 22px -12px rgba(15, 27, 45, 0.30);
  transition: transform .28s cubic-bezier(.2,.8,.2,1), box-shadow .28s ease, border-color .28s ease;
}
.g-btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 18px 34px -14px rgba(15, 27, 45, 0.42);
  border-color: rgb(var(--c-terracotta));
}
.g-btn:active { transform: translateY(0); box-shadow: 0 8px 18px -12px rgba(15, 27, 45, 0.34); }
.g-btn:focus-visible { outline: 2px solid rgb(var(--c-terracotta) / 0.6); outline-offset: 3px; }
.g-btn:disabled { opacity: 0.6; cursor: default; transform: none; }
.g-icon { width: 24px; height: 24px; }

@media (prefers-reduced-motion: reduce) {
  .g-btn { transition: none; }
  .g-btn:hover, .g-btn:active { transform: none; }
}
</style>
