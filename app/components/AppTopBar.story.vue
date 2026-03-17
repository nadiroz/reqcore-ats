<script setup lang="ts">
/**
 * Story: AppTopBar
 *
 * AppTopBar is deeply integrated with Nuxt context (auth session, useFetch, route).
 * These variants document the visual states via static mockups rather than mounting
 * the live component. Use `npm run dev` to see the real component in context.
 */
</script>

<template>
  <Story title="Navigation / AppTopBar" :layout="{ type: 'single', iframe: false }">
    <!-- Primary nav bar — default state -->
    <Variant title="Primary nav (default)">
      <div class="border border-surface-200 dark:border-surface-800 rounded-xl overflow-hidden">
        <div class="flex h-14 items-center justify-between px-6 bg-white/80 dark:bg-surface-900/80 border-b border-surface-200/80 dark:border-surface-800/80">
          <!-- Left: logo + nav -->
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2.5">
              <div class="size-7 rounded-lg bg-brand-100 dark:bg-brand-900/40" />
              <span class="text-[15px] font-bold text-surface-900 dark:text-surface-100 tracking-tight">Reqcore</span>
            </div>
            <nav class="flex items-center gap-0.5">
              <span
                v-for="label in ['Dashboard', 'Jobs', 'Candidates', 'Applications', 'Interviews']"
                :key="label"
                class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all"
                :class="label === 'Jobs'
                  ? 'text-brand-700 dark:text-brand-300 bg-brand-50/80 dark:bg-brand-950/40'
                  : 'text-surface-600 dark:text-surface-400'"
              >
                {{ label }}
              </span>
            </nav>
          </div>
          <!-- Right: search + bell + divider + avatar -->
          <div class="flex items-center gap-1.5">
            <div class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border border-surface-200 dark:border-surface-700 text-xs text-surface-400">
              <span>⌘K</span>
            </div>
            <!-- Bell — no badge -->
            <div class="relative flex items-center justify-center size-8 rounded-lg text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800">
              <svg class="size-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15 17H9m3 4a2 2 0 01-2-2h4a2 2 0 01-2 2zm7-4H5a7 7 0 1114 0z" /></svg>
            </div>
            <div class="w-px h-6 bg-surface-200 dark:bg-surface-700 mx-1" />
            <div class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-100/80 dark:hover:bg-surface-800/60 cursor-pointer">
              <div class="size-7 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-[11px] font-bold">NA</div>
              <svg class="size-3 text-surface-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </div>
      </div>
    </Variant>

    <!-- Bell with notification badge -->
    <Variant title="Notification badge (unread count)">
      <div class="flex items-center gap-6 p-6">
        <!-- 1 unread -->
        <div class="flex flex-col items-center gap-2">
          <div class="relative flex items-center justify-center size-8 rounded-lg text-surface-500 bg-surface-100">
            <svg class="size-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15 17H9m3 4a2 2 0 01-2-2h4a2 2 0 01-2 2zm7-4H5a7 7 0 1114 0z" /></svg>
            <span class="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-danger-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-surface-900">1</span>
          </div>
          <span class="text-xs text-surface-400">1 unread</span>
        </div>
        <!-- 5 unread -->
        <div class="flex flex-col items-center gap-2">
          <div class="relative flex items-center justify-center size-8 rounded-lg text-surface-500 bg-surface-100">
            <svg class="size-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15 17H9m3 4a2 2 0 01-2-2h4a2 2 0 01-2 2zm7-4H5a7 7 0 1114 0z" /></svg>
            <span class="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-danger-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-surface-900">5</span>
          </div>
          <span class="text-xs text-surface-400">5 unread</span>
        </div>
        <!-- 9+ unread -->
        <div class="flex flex-col items-center gap-2">
          <div class="relative flex items-center justify-center size-8 rounded-lg text-surface-500 bg-surface-100">
            <svg class="size-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15 17H9m3 4a2 2 0 01-2-2h4a2 2 0 01-2 2zm7-4H5a7 7 0 1114 0z" /></svg>
            <span class="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-danger-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-surface-900">9+</span>
          </div>
          <span class="text-xs text-surface-400">9+ unread</span>
        </div>
      </div>
    </Variant>

    <!-- Job sub-nav -->
    <Variant title="Job sub-nav bar">
      <div class="border border-surface-200 dark:border-surface-800 rounded-xl overflow-hidden">
        <div class="flex items-center h-10 px-6 gap-2 bg-surface-50/90 dark:bg-surface-950/90 border-b border-surface-200/60 dark:border-surface-800/60">
          <!-- Sidebar toggle -->
          <div class="size-4 text-brand-600 dark:text-brand-400">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /></svg>
          </div>
          <div class="w-px h-4 bg-surface-200 dark:bg-surface-700" />
          <svg class="size-3.5 text-brand-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          <span class="text-sm font-semibold text-surface-900 dark:text-surface-100 truncate max-w-[200px]">Social Media Manager</span>
          <span class="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold capitalize ring-1 ring-inset bg-success-50 text-success-700 ring-success-200 dark:bg-success-950/60 dark:text-success-400 dark:ring-success-800">open</span>
          <div class="w-px h-4 bg-surface-200 dark:bg-surface-700" />
          <nav class="flex items-center gap-0.5">
            <span class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 shadow-sm">Board</span>
            <span class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-surface-500 dark:text-surface-400">Table</span>
            <span class="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-surface-500 dark:text-surface-400">
              <svg class="size-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" /></svg>
              <svg class="size-2.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" /></svg>
            </span>
          </nav>
          <div class="ml-auto flex items-center gap-2">
            <span class="text-xs text-surface-400">← page actions teleported here</span>
          </div>
        </div>
      </div>
    </Variant>
  </Story>
</template>
