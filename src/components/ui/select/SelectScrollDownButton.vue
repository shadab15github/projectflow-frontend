<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import {
  SelectScrollDownButton,
  type SelectScrollDownButtonProps,
  useForwardProps,
} from 'reka-ui'
import { VsxIcon } from 'vue-iconsax'
import { cn } from '@/lib/utils'

const props = defineProps<SelectScrollDownButtonProps & { class?: HTMLAttributes['class'] }>()
const forwarded = useForwardProps(props)
</script>

<template>
  <SelectScrollDownButton
    v-bind="forwarded"
    data-slot="select-scroll-down-button"
    :class="cn('flex cursor-default items-center justify-center py-1', props.class)"
  >
    <VsxIcon iconName="ArrowDown2" class="size-4" />
  </SelectScrollDownButton>
</template>
