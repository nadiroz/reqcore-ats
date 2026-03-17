<script setup lang="ts">
import AppBreadcrumb from './AppBreadcrumb.vue'
</script>

<template>
  <Story title="Navigation / AppBreadcrumb" :layout="{ type: 'single', iframe: false }">
    <Variant title="With link + current page">
      <div class="p-6">
        <AppBreadcrumb
          :items="[
            { label: 'Jobs', to: '/dashboard/jobs' },
            { label: 'Social Media Manager' },
          ]"
        />
      </div>
    </Variant>

    <Variant title="Deeper path (3 levels)">
      <div class="p-6">
        <AppBreadcrumb
          :items="[
            { label: 'Applications', to: '/dashboard/applications' },
            { label: 'Social Media Manager', to: '/dashboard/jobs/abc123' },
            { label: 'Joshua Addey' },
          ]"
        />
      </div>
    </Variant>

    <Variant title="Truncated label">
      <div class="p-6">
        <AppBreadcrumb
          :items="[
            { label: 'Candidates', to: '/dashboard/candidates' },
            { label: 'Oluwafavour Abimbola Udohgoodluck Chimamanda' },
          ]"
        />
      </div>
    </Variant>

    <Variant title="Single item (no link)">
      <div class="p-6">
        <AppBreadcrumb :items="[{ label: 'Dashboard' }]" />
      </div>
    </Variant>
  </Story>
</template>
