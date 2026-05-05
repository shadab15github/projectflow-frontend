<script setup lang="ts">
import { VsxIcon } from 'vue-iconsax';
import { Button } from '@/components/ui/button';

interface Props {
  icon: string;
  title: string;
  description: string;
  ctaLabel?: string;
}

defineProps<Props>();
</script>

<template>
  <div
    class="rounded-lg border border-dashed bg-card flex flex-col items-center text-center gap-3 px-6 py-16"
  >
    <div
      class="size-14 rounded-full bg-muted flex items-center justify-center"
    >
      <VsxIcon :iconName="icon" class="size-7 text-muted-foreground" />
    </div>
    <h3 class="text-lg font-semibold">{{ title }}</h3>
    <p class="text-sm text-muted-foreground max-w-md">{{ description }}</p>
    <Button v-if="ctaLabel" variant="outline" size="sm" disabled>
      {{ ctaLabel }}
    </Button>
    <p class="text-xs text-muted-foreground">Coming soon</p>
  </div>
</template>
