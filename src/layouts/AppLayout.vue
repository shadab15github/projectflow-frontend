<script setup lang="ts">
import { ref } from "vue";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import AppSidebar from "@/components/layout/AppSidebar.vue";
import AppHeader from "@/components/layout/AppHeader.vue";

const SIDEBAR_SIZE_KEY = "projectflow:sidebar-size";
const DEFAULT_SIDEBAR_SIZE = 18;

const initialSidebarSize = ref<number>(DEFAULT_SIDEBAR_SIZE);
const stored =
  typeof window !== "undefined"
    ? window.localStorage.getItem(SIDEBAR_SIZE_KEY)
    : null;
if (stored) {
  const parsed = Number(stored);
  if (!Number.isNaN(parsed) && parsed >= 14 && parsed <= 30) {
    initialSidebarSize.value = parsed;
  }
}

function persistSidebarSize(sizes: number[]): void {
  const [sidebar] = sizes;
  if (typeof sidebar === "number") {
    window.localStorage.setItem(SIDEBAR_SIZE_KEY, String(sidebar));
  }
}
</script>

<template>
  <ResizablePanelGroup
    direction="horizontal"
    class="fixed inset-0 h-screen overflow-hidden"
    @layout="persistSidebarSize"
  >
    <ResizablePanel
      :default-size="initialSidebarSize"
      :min-size="14"
      :max-size="30"
      class="bg-background"
    >
      <AppSidebar />
    </ResizablePanel>

    <ResizableHandle with-handle />

    <ResizablePanel :default-size="100 - initialSidebarSize">
      <div class="h-full flex flex-col">
        <AppHeader />
        <main class="flex-1 min-h-0 overflow-y-auto">
          <RouterView />
        </main>
      </div>
    </ResizablePanel>
  </ResizablePanelGroup>
</template>
