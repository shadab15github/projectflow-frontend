import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { LoginPayload, SignupPayload, User } from "@/types";
import * as authService from "@/services/auth.service";
import { useTenantStore } from "@/store/tenant";

const STORAGE_KEYS = {
  TOKEN: "auth_token",
  USER: "auth_user",
} as const;

function loadFromStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function saveToStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Silently fail (e.g. private browsing storage quota)
  }
}

function removeFromStorage(key: string): void {
  localStorage.removeItem(key);
}

export const useAuthStore = defineStore("auth", () => {
  const user = ref<User | null>(loadFromStorage<User>(STORAGE_KEYS.USER));
  const token = ref<string | null>(loadFromStorage<string>(STORAGE_KEYS.TOKEN));

  const isAuthenticated = computed<boolean>(
    () => token.value !== null && user.value !== null,
  );

  function setSession(nextUser: User, nextToken: string): void {
    user.value = nextUser;
    token.value = nextToken;
    saveToStorage(STORAGE_KEYS.USER, nextUser);
    saveToStorage(STORAGE_KEYS.TOKEN, nextToken);
  }

  function clearSession(): void {
    user.value = null;
    token.value = null;
    removeFromStorage(STORAGE_KEYS.USER);
    removeFromStorage(STORAGE_KEYS.TOKEN);
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
