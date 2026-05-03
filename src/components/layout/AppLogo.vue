<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { cn } from '@/lib/utils';

const props = defineProps<{
  class?: HTMLAttributes['class'];
}>();
</script>

<template>
  <div
    :class="
      cn(
        'size-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground',
        props.class,
      )
    "
  >
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      class="size-[60%]"
      aria-hidden="true"
    >
      <rect x="0" y="3" width="16" height="2.4" rx="1.2" />
      <rect x="0" y="6.8" width="12" height="2.4" rx="1.2" fill-opacity="0.85" />
      <rect x="0" y="10.6" width="8" height="2.4" rx="1.2" fill-opacity="0.6" />
    </svg>
  </div>
</template>
