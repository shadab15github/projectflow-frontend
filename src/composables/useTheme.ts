import { computed, readonly, ref } from 'vue';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'projectflow:theme';

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system'
    ? stored
    : 'system';
}

function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

const mode = ref<ThemeMode>(readStoredMode());
const systemDark = ref<boolean>(systemPrefersDark());

const isDark = computed<boolean>(() =>
  mode.value === 'dark' || (mode.value === 'system' && systemDark.value),
);

function applyDomClass(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', isDark.value);
}

if (typeof window !== 'undefined') {
  applyDomClass();

  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', (e) => {
    systemDark.value = e.matches;
    if (mode.value === 'system') applyDomClass();
  });
}

function setTheme(next: ThemeMode): void {
  mode.value = next;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, next);
  }
  applyDomClass();
}

export function useTheme() {
  return {
    mode: readonly(mode),
    isDark: readonly(isDark),
    setTheme,
  };
}
