<script setup lang="ts">
import { useRoute } from 'vue-router';

const route = useRoute();
const projectId = route.params.id as string;
</script>

<template>
  <section>
    <h1 class="text-2xl font-semibold">Project {{ projectId }}</h1>
  </section>
</template>
