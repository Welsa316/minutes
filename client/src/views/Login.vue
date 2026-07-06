<script setup>
import { ref, computed } from 'vue';
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

function toggleMode() {
  mode.value = isSignup.value ? 'signin' : 'signup';
  auth.error = null;
}

async function onSubmit() {
  const ok = isSignup.value
    ? await auth.register(email.value.trim(), password.value, name.value.trim())
    : await auth.login(email.value.trim(), password.value);
  if (ok) {
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    router.replace(redirect);
  }
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
