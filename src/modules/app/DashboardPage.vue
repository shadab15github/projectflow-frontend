<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/store/auth";
import { useProjects } from "@/store/project";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import CreateProjectDialog from "./CreateProjectDialog.vue";

const auth = useAuthStore();
const router = useRouter();

const { data, isPending, isError } = useProjects();
const projects = computed(() => data.value ?? []);
const loading = isPending;
const error = computed(() =>
  isError.value ? "Failed to load projects" : null,
);
const dialogOpen = ref(false);

const canCreate = computed<boolean>(() => {
  const role = auth.user?.role;
  return role === "manager" || role === "admin" || role === "super_admin";
});

function openProject(slug: string): void {
  router.push({ name: "project-detail", params: { slug } });
}

function onCreated(slug: string): void {
  openProject(slug);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}
</script>

<template>
  <section class="flex flex-col gap-6 p-6">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Dashboard</h1>
        <p class="text-sm text-muted-foreground">
          Projects you're a member of.
        </p>
      </div>
      <Button v-if="canCreate" @click="dialogOpen = true">
        Create project
      </Button>
    </header>

    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

    <div
      v-if="loading && projects.length === 0"
      class="text-sm text-muted-foreground"
    >
      Loading projects…
    </div>

    <div
      v-else-if="projects.length === 0"
      class="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center"
    >
      <h2 class="text-lg font-medium">No projects yet</h2>
      <p class="max-w-sm text-sm text-muted-foreground">
        {{
          canCreate
            ? "Create your first project to start organizing tasks with your team."
            : "Ask a manager or admin to add you to a project."
        }}
      </p>
      <Button v-if="canCreate" @click="dialogOpen = true">
        Create project
      </Button>
    </div>

    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card
        v-for="project in projects"
        :key="project._id"
        class="cursor-pointer transition-colors hover:bg-accent/40"
        role="button"
        tabindex="0"
        @click="openProject(project.slug)"
        @keydown.enter="openProject(project.slug)"
      >
        <CardHeader>
          <div class="flex items-center gap-2">
            <span
              class="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-primary"
            >
              {{ project.key }}
            </span>
            <CardTitle class="truncate">{{ project.name }}</CardTitle>
          </div>
          <CardDescription>
            {{
              project.description ? project.description : "No description yet."
            }}
          </CardDescription>
        </CardHeader>
        <CardContent
          class="flex items-center justify-between text-xs text-muted-foreground"
        >
          <span
            >{{ project.members.length }} member{{
              project.members.length === 1 ? "" : "s"
            }}</span
          >
          <span>Updated {{ formatDate(project.updatedAt) }}</span>
        </CardContent>
      </Card>
    </div>

    <CreateProjectDialog v-model:open="dialogOpen" @created="onCreated" />
  </section>
</template>
