<script setup lang="ts">
import CommandPalette from './CommandPalette.vue'
</script>

<template>
  <Story title="CommandPalette" :layout="{ type: 'single', iframe: true }">
    <Variant title="Open (empty query)">
      <CommandPalette :open="true" />
    </Variant>
  </Story>
</template>
