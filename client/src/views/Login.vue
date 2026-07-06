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
  if (!GOOGLE_CLIENT_ID) return;
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
        <div class="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-ink text-warm font-serif text-3xl mb-4">m</div>
        <h1 class="text-3xl font-serif text-ink">Minutes</h1>
      </div>

      <form @submit.prevent="onSubmit" class="card space-y-4">
        <div v-if="isSignup">
          <label class="label" for="name">Name</label>
          <input id="name" v-model="name" autocomplete="name" class="input" placeholder="Optional" />
        </div>

        <div>
          <label class="label" for="email">Email</label>
          <input id="email" v-model="email" type="email" autocomplete="email" required class="input" />
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

        <template v-if="GOOGLE_CLIENT_ID">
          <div class="flex items-center gap-3 text-xs text-slate-warm">
            <span class="h-px flex-1 bg-sand" />
            or
            <span class="h-px flex-1 bg-sand" />
          </div>
          <button type="button" class="g-btn" :disabled="auth.loading" @click="signInWithGoogle">
            <svg class="g-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21.6 12A9.6 9.6 0 1 0 18 19.4" />
              <path d="M21.6 12H13" />
            </svg>
            <span>Continue with Google</span>
          </button>
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
/* On-theme "Continue with Google": a floating pill in Minutes colours with a
   single-tone outlined G. Adapts to warm dark mode via the shared CSS vars. */
.g-btn {
  display: flex; align-items: center; justify-content: center; gap: 0.65rem;
  width: 100%; height: 48px; padding: 0 1rem;
  border-radius: 9999px;
  background: rgb(var(--c-surface));
  border: 1px solid rgb(var(--c-sand));
  color: rgb(var(--c-ink));
  font-family: inherit; font-size: 0.95rem; font-weight: 500; cursor: pointer;
  box-shadow: 0 10px 22px -12px rgba(15, 27, 45, 0.30);
  transition: transform .28s cubic-bezier(.2,.8,.2,1), box-shadow .28s ease,
              border-color .28s ease, background .2s ease;
}
.g-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 32px -14px rgba(15, 27, 45, 0.42);
  border-color: rgb(var(--c-terracotta));
}
.g-btn:active { transform: translateY(0); box-shadow: 0 8px 18px -12px rgba(15, 27, 45, 0.34); }
.g-btn:focus-visible { outline: 2px solid rgb(var(--c-terracotta) / 0.6); outline-offset: 2px; }
.g-btn:disabled { opacity: 0.6; cursor: default; transform: none; }
.g-mark { width: 20px; height: 20px; color: rgb(var(--c-terracotta)); flex-shrink: 0; }

@media (prefers-reduced-motion: reduce) {
  .g-btn { transition: none; }
  .g-btn:hover, .g-btn:active { transform: none; }
}
</style>
