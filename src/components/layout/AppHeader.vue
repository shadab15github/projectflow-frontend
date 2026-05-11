<script setup lang="ts">
import { computed } from "vue";
import { useAuthStore } from "@/store/auth";
import { useProjectStore } from "@/store/project";
import { Button } from "@/components/ui/button";
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
import AppLogo from "@/components/layout/AppLogo.vue";
import { useTheme } from "@/composables/useTheme";

const auth = useAuthStore();
const projectStore = useProjectStore();
const { mode: themeMode, isDark, setTheme } = useTheme();

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

function logout(): void {
  auth.logout();
  projectStore.clear();
  window.location.href = "/login";
}
</script>

<template>
  <header
    class="h-16 shrink-0 border-b bg-background flex items-center justify-between px-4 gap-4"
  >
    <!-- Logo -->
    <RouterLink to="/app" class="flex items-center gap-2 shrink-0">
      <AppLogo />
      <span class="font-semibold text-base tracking-tight"> ProjectFlow </span>
    </RouterLink>

    <!-- Right actions -->
    <div class="flex items-center gap-1">
      <Button size="sm" class="gap-1.5 mr-2">
        <VsxIcon iconName="Add" class="size-4" />
        Create
      </Button>

      <Button variant="ghost" size="icon-sm" aria-label="Notifications">
        <VsxIcon iconName="Notification" class="size-4" />
      </Button>

      <Button variant="ghost" size="icon-sm" aria-label="Help">
        <VsxIcon iconName="MessageQuestion" class="size-4" />
      </Button>

      <Button variant="ghost" size="icon-sm" aria-label="Settings">
        <VsxIcon iconName="Setting2" class="size-4" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger
          class="inline-flex items-center justify-center size-8 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-label="Toggle theme"
        >
          <VsxIcon
            :iconName="isDark ? 'Moon' : 'Sun1'"
            class="size-4"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" :side-offset="6" class="min-w-36">
          <DropdownMenuItem
            class="gap-2"
            :data-active="themeMode === 'light' ? '' : undefined"
            @select="setTheme('light')"
          >
            <VsxIcon iconName="Sun1" class="size-4" />
            <span class="flex-1">Light</span>
            <VsxIcon
              v-if="themeMode === 'light'"
              iconName="TickCircle"
              class="size-4 text-primary"
            />
          </DropdownMenuItem>
          <DropdownMenuItem
            class="gap-2"
            @select="setTheme('dark')"
          >
            <VsxIcon iconName="Moon" class="size-4" />
            <span class="flex-1">Dark</span>
            <VsxIcon
              v-if="themeMode === 'dark'"
              iconName="TickCircle"
              class="size-4 text-primary"
            />
          </DropdownMenuItem>
          <DropdownMenuItem
            class="gap-2"
            @select="setTheme('system')"
          >
            <VsxIcon iconName="Monitor" class="size-4" />
            <span class="flex-1">System</span>
            <VsxIcon
              v-if="themeMode === 'system'"
              iconName="TickCircle"
              class="size-4 text-primary"
            />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger
          class="ml-1 flex items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Profile menu"
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
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" :side-offset="6" class="min-w-56">
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
  </header>
</template>
