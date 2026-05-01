<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import {
  SelectScrollUpButton,
  type SelectScrollUpButtonProps,
  useForwardProps,
} from 'reka-ui'
import { ChevronUp } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const props = defineProps<SelectScrollUpButtonProps & { class?: HTMLAttributes['class'] }>()
const forwarded = useForwardProps(props)
</script>

<template>
  <SelectScrollUpButton
    v-bind="forwarded"
    data-slot="select-scroll-up-button"
    :class="cn('flex cursor-default items-center justify-center py-1', props.class)"
  >
    <ChevronUp class="size-4" />
  </SelectScrollUpButton>
</template>
