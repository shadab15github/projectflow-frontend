import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { LoginPayload, SignupPayload, User } from '@/types';
import * as authService from '@/services/auth.service';
import { useTenantStore } from '@/store/tenant';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const token = ref<string | null>(null);

  const isAuthenticated = computed<boolean>(() => token.value !== null && user.value !== null);

  function setSession(nextUser: User, nextToken: string): void {
    user.value = nextUser;
    token.value = nextToken;
  }

  function clearSession(): void {
    user.value = null;
    token.value = null;
    useTenantStore().clearTenant();
  }

  async function login(payload: LoginPayload): Promise<void> {
    const result = await authService.login(payload);
    setSession(result.user, result.token);
  }

  async function signup(payload: SignupPayload): Promise<void> {
    const result = await authService.register(payload);
    setSession(result.user, result.token);
  }

  function logout(): void {
    clearSession();
  }

  return {
    user,
    token,
    isAuthenticated,
    login,
    signup,
    logout,
    setSession,
    clearSession,
  };
});
