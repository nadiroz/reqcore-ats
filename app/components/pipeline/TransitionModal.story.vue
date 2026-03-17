<script setup lang="ts">
import TransitionModal from './TransitionModal.vue'
</script>

<template>
  <Story title="Pipeline / TransitionModal" :layout="{ type: 'single', iframe: true }">
    <Variant title="Standard transition">
      <TransitionModal
        :open="true"
        target-status="interview"
        candidate-name="Joshua Addey"
        :is-terminal="false"
        :requires-approval="false"
      />
    </Variant>

    <Variant title="Terminal stage (Hired)">
      <TransitionModal
        :open="true"
        target-status="hired"
        candidate-name="Sarah Chen"
        :is-terminal="true"
        :requires-approval="false"
      />
    </Variant>

    <Variant title="Requires approval">
      <TransitionModal
        :open="true"
        target-status="interview"
        candidate-name="David Okonkwo"
        :is-terminal="false"
        :requires-approval="true"
      />
    </Variant>
  </Story>
</template>
