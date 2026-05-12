import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { User } from '@/types';
import * as userService from '@/services/user.service';

export const useUserStore = defineStore('user', () => {
  const users = ref<User[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const loaded = ref(false);

  const byId = computed<Map<string, User>>(() => {
    const map = new Map<string, User>();
    for (const u of users.value) map.set(u._id, u);
    return map;
  });

  function findById(id: string | null | undefined): User | undefined {
    if (!id) return undefined;
    return byId.value.get(id);
  }

  function displayName(id: string | null | undefined): string {
    const u = findById(id);
    return u?.name ?? 'Unknown';
  }

  function initials(id: string | null | undefined): string {
    const u = findById(id);
    if (!u?.name) return '?';
    const parts = u.name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase() || '?';
  }

  async function fetchUsers(force = false): Promise<void> {
    if (loaded.value && !force) return;
    loading.value = true;
    error.value = null;
    try {
      users.value = await userService.listUsers();
      loaded.value = true;
    } catch (err) {
      error.value = 'Failed to load users';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  function clear(): void {
    users.value = [];
    loaded.value = false;
    error.value = null;
  }

  return {
    users,
    loading,
    error,
    loaded,
    byId,
    findById,
    displayName,
    initials,
    fetchUsers,
    clear,
  };
});
