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
const googleBtn = ref(null);

function toggleMode() {
  mode.value = isSignup.value ? 'signin' : 'signup';
  auth.error = null;
}

function goAfterAuth() {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
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

async function handleGoogle(response) {
  const ok = await auth.loginWithGoogle(response.credential);
  if (ok) goAfterAuth();
}

onMounted(async () => {
  if (!GOOGLE_CLIENT_ID) return;
  try {
    await loadGoogleScript();
    window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogle });
    window.google.accounts.id.renderButton(googleBtn.value, {
      theme: 'outline', size: 'large', width: 320, text: 'continue_with', shape: 'rectangular',
    });
  } catch { /* offline or blocked — email/password still works */ }
});
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
          <div ref="googleBtn" class="flex justify-center" />
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
