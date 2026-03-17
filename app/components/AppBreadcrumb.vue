<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next'

defineProps<{
  items: Array<{ label: string; to?: string }>
}>()
</script>

<template>
  <nav class="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
    <template v-for="(item, idx) in items" :key="idx">
      <ChevronRight v-if="idx > 0" class="size-3 shrink-0 text-surface-300 dark:text-surface-600" />
      <NuxtLink
        v-if="item.to"
        :to="item.to"
        class="text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200 transition-colors"
      >
        {{ item.label }}
      </NuxtLink>
      <span
        v-else
        class="max-w-[220px] truncate font-medium text-surface-800 dark:text-surface-200"
        :title="item.label"
      >
        {{ item.label }}
      </span>
    </template>
  </nav>
</template>
