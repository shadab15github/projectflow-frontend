<script setup lang="ts"></script>

<template>
  <div class="min-h-screen flex">
    <aside class="w-60 border-r bg-background p-4">
      <div class="font-semibold mb-6">ProjectFlow</div>
      <nav class="flex flex-col gap-1 text-sm">
        <RouterLink to="/app" class="px-2 py-1.5 rounded hover:bg-accent">Dashboard</RouterLink>
      </nav>
    </aside>
    <div class="flex-1 flex flex-col">
      <header class="h-14 border-b flex items-center px-4"></header>
      <main class="flex-1 p-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>
