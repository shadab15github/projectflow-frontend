<script setup lang="ts">
import { useRoute } from 'vue-router';

const route = useRoute();
const taskId = route.params.id as string;
</script>

<template>
  <section>
    <h1 class="text-2xl font-semibold">Task {{ taskId }}</h1>
  </section>
</template>
