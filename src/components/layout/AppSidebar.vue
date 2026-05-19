<script setup lang="ts">
import { computed, ref } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import { useAuthStore } from "@/store/auth";
import { useCurrentTenant } from "@/store/tenant";
import { useProjects } from "@/store/project";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VsxIcon } from "vue-iconsax";
import ChevronsUpDownIcon from "@/components/icons/ChevronsUpDownIcon.vue";

const auth = useAuthStore();
const queryClient = useQueryClient();

const tenantQuery = useCurrentTenant();
const tenant = computed(() => tenantQuery.data.value ?? null);
const tenantLoading = computed(() => tenantQuery.isPending.value);

const projectsQuery = useProjects();
const projects = computed(() => projectsQuery.data.value ?? []);

const PROJECTS_EXPANDED_KEY = "projectflow:projects-expanded";

const projectsExpanded = ref<boolean>(true);
const storedExpanded =
  typeof window !== "undefined"
    ? window.localStorage.getItem(PROJECTS_EXPANDED_KEY)
    : null;
if (storedExpanded !== null) projectsExpanded.value = storedExpanded === "1";

function toggleProjects(): void {
  projectsExpanded.value = !projectsExpanded.value;
  window.localStorage.setItem(
    PROJECTS_EXPANDED_KEY,
    projectsExpanded.value ? "1" : "0",
  );
}

function initials(value: string | undefined | null, fallback: string): string {
  const name = (value ?? "").trim();
  if (!name) return fallback;
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const userInitials = computed<string>(() => initials(auth.user?.name, "U"));
const tenantInitials = computed<string>(() =>
  initials(tenant.value?.name, "W"),
);

function logout(): void {
  auth.logout();
  queryClient.clear();
  window.location.href = "/login";
}
</script>

<template>
  <aside class="h-full flex flex-col border-r">
    <!-- Workspace switcher -->
    <div class="px-3 h-16 flex items-center border-b">
      <DropdownMenu>
        <DropdownMenuTrigger
          class="w-full flex items-center gap-2 rounded-md p-2 hover:bg-accent text-left"
        >
          <Avatar class="size-8 rounded-md">
            <AvatarFallback
              class="rounded-md bg-primary text-primary-foreground text-xs font-semibold"
            >
              {{ tenantInitials }}
            </AvatarFallback>
          </Avatar>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate">
              {{
                tenant ? tenant.name : tenantLoading ? "Loading…" : "Workspace"
              }}
            </div>
            <div class="text-xs text-muted-foreground truncate capitalize">
              {{ tenant?.plan ?? "free" }} plan
            </div>
          </div>
          <ChevronsUpDownIcon class="size-4 text-muted-foreground shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="w-(--reka-dropdown-menu-trigger-width) min-w-56"
          align="start"
          :side-offset="6"
        >
          <DropdownMenuLabel class="text-muted-foreground text-xs">
            Workspaces
          </DropdownMenuLabel>
          <DropdownMenuItem v-if="tenant" class="gap-2">
            <Avatar class="size-6 rounded-sm">
              <AvatarFallback
                class="rounded-sm text-[10px] bg-primary text-primary-foreground"
              >
                {{ tenantInitials }}
              </AvatarFallback>
            </Avatar>
            <span class="truncate">{{ tenant.name }}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled class="gap-2">
            <VsxIcon iconName="Add" class="size-4" />
            <span>Create workspace</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto p-3 flex flex-col gap-0.5 text-sm">
      <RouterLink
        to="/app"
        class="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent"
        exact-active-class="bg-accent font-medium"
      >
        <VsxIcon iconName="Element3" class="size-4" />
        <span>Dashboard</span>
      </RouterLink>

      <RouterLink
        to="/app/for-you"
        class="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent"
        active-class="bg-accent font-medium"
      >
        <VsxIcon iconName="MagicStar" class="size-4" />
        <span>For You</span>
      </RouterLink>

      <button
        type="button"
        class="mt-1 flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent text-left"
        :aria-expanded="projectsExpanded"
        @click="toggleProjects"
      >
        <VsxIcon
          :iconName="projectsExpanded ? 'ArrowDown2' : 'ArrowRight2'"
          class="size-4 text-muted-foreground"
        />
        <VsxIcon iconName="Folder" class="size-4" />
        <span class="flex-1">Projects</span>
        <span class="text-xs text-muted-foreground">
          {{ projects.length }}
        </span>
      </button>

      <div
        v-if="projectsExpanded"
        class="ml-4 flex flex-col gap-0.5 pl-3 border-l"
      >
        <RouterLink
          v-for="project in projects"
          :key="project._id"
          :to="{ name: 'project-detail', params: { slug: project.slug } }"
          class="px-2 py-1 rounded text-sm hover:bg-accent truncate"
          active-class="bg-accent font-medium"
        >
          {{ project.name }}
        </RouterLink>
        <p
          v-if="projects.length === 0"
          class="px-2 py-1 text-xs text-muted-foreground"
        >
          No projects yet
        </p>
      </div>
    </nav>

    <!-- Profile selector -->
    <div class="px-3 py-1.5 border-t">
      <DropdownMenu>
        <DropdownMenuTrigger
          class="w-full flex items-center gap-2 rounded-md p-2 hover:bg-accent text-left"
        >
          <Avatar class="size-8">
            <AvatarImage
              v-if="auth.user?.avatar"
              :src="auth.user.avatar"
              :alt="auth.user.name"
            />
            <AvatarFallback class="text-xs">
              {{ userInitials }}
            </AvatarFallback>
          </Avatar>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate">
              {{ auth.user?.name ?? "User" }}
            </div>
            <div class="text-xs text-muted-foreground truncate">
              {{ auth.user?.email ?? "" }}
            </div>
          </div>
          <ChevronsUpDownIcon class="size-4 text-muted-foreground shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="w-(--reka-dropdown-menu-trigger-width) min-w-56"
          align="end"
          side="top"
          :side-offset="6"
        >
          <DropdownMenuLabel class="font-normal">
            <div class="flex items-center gap-2">
              <Avatar class="size-8">
                <AvatarImage
                  v-if="auth.user?.avatar"
                  :src="auth.user.avatar"
                  :alt="auth.user.name"
                />
                <AvatarFallback class="text-xs">
                  {{ userInitials }}
                </AvatarFallback>
              </Avatar>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium truncate">
                  {{ auth.user?.name ?? "User" }}
                </div>
                <div class="text-xs text-muted-foreground truncate">
                  {{ auth.user?.email ?? "" }}
                </div>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem class="gap-2">
            <VsxIcon iconName="User" class="size-4" />
            <span>Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem class="gap-2">
            <VsxIcon iconName="Setting2" class="size-4" />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            class="gap-2"
            @select="logout"
          >
            <VsxIcon iconName="Logout" class="size-4" />
            <span>Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </aside>
</template>
