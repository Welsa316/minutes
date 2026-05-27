<script setup>
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const username = ref('');
const password = ref('');

async function onSubmit() {
  const ok = await auth.login(username.value, password.value);
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
        <div>
          <label class="label" for="username">Username</label>
          <input id="username" v-model="username" autocomplete="username" required class="input" />
        </div>
        <div>
          <label class="label" for="password">Password</label>
          <input id="password" v-model="password" type="password" autocomplete="current-password" required class="input" />
        </div>

        <p v-if="auth.error" class="text-sm text-terracotta">{{ auth.error }}</p>

        <button type="submit" :disabled="auth.loading" class="btn-primary w-full">
          {{ auth.loading ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
    </div>
  </div>
</template>
