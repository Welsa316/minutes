import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '../api/index.js';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);
  const checked = ref(false);
  const loading = ref(false);
  const error = ref(null);

  const isAuthenticated = computed(() => !!user.value);

  async function fetchMe() {
    try {
      const { data } = await api.get('/auth/me');
      user.value = data;
    } catch {
      user.value = null;
    } finally {
      checked.value = true;
    }
  }

  async function login(email, password) {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await api.post('/auth/login', { email, password });
      user.value = data;
      return true;
    } catch (e) {
      error.value = e?.response?.data?.error || 'Login failed';
      user.value = null;
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function register(email, password, name) {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await api.post('/auth/register', { email, password, name });
      user.value = data;
      return true;
    } catch (e) {
      error.value = e?.response?.data?.error || 'Could not create account';
      user.value = null;
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function loginWithGoogle(credential) {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await api.post('/auth/google', { credential });
      user.value = data;
      return true;
    } catch (e) {
      error.value = e?.response?.data?.error || 'Google sign-in failed';
      user.value = null;
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    try { await api.post('/auth/logout'); } catch { /* ignore — cookie cleared either way */ }
    user.value = null;
    // Wipe per-user client state so nothing leaks to the next account signing
    // in on this browser (recent items, remembered active workspace).
    try {
      localStorage.removeItem('minutes:recent');
      localStorage.removeItem('minutes:workspace');
    } catch { /* private mode / storage disabled */ }
  }

  return { user, checked, loading, error, isAuthenticated, fetchMe, login, register, loginWithGoogle, logout };
});
