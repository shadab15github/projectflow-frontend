import { computed, reactive } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import type { User } from '@/types';
import * as userService from '@/services/user.service';

export const userKeys = {
  all: ['users'] as const,
  list: () => [...userKeys.all, 'list'] as const,
};

export function useUsers() {
  return useQuery<User[]>({
    queryKey: userKeys.list(),
    queryFn: userService.listUsers,
  });
}

export function useUserLookup() {
  const query = useUsers();
  const users = computed<User[]>(() => query.data.value ?? []);

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
    return findById(id)?.name ?? 'Unknown';
  }

  function initials(id: string | null | undefined): string {
    const u = findById(id);
    if (!u?.name) return '?';
    const parts = u.name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase() || '?';
  }

  return reactive({
    users,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    byId,
    findById,
    displayName,
    initials,
  });
}
