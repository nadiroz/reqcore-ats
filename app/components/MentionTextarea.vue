<script setup lang="ts">
import { AtSign } from 'lucide-vue-next'
import type { MentionMember } from '~/composables/useMentions'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  rows?: number
  disabled?: boolean
}>(), {
  placeholder: 'Write a comment…',
  rows: 2,
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'submit': []
}>()

const { members, loadMembers, searchMembers } = useMentions()

const textareaRef = ref<HTMLTextAreaElement>()
const showDropdown = ref(false)
const mentionQuery = ref('')
const mentionStartPos = ref(0)
const selectedIndex = ref(0)

const suggestions = computed(() => searchMembers(mentionQuery.value))

function handleInput(e: Event) {
  const target = e.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
  checkForMention(target)
}

function checkForMention(textarea: HTMLTextAreaElement) {
  const cursorPos = textarea.selectionStart
  const textBefore = textarea.value.slice(0, cursorPos)

  // Find the last @ that isn't inside a completed mention
  const atIndex = textBefore.lastIndexOf('@')
  if (atIndex === -1) {
    showDropdown.value = false
    return
  }

  // Check if @ is at the start or preceded by a space/newline
  if (atIndex > 0 && !/[\s\n]/.test(textBefore[atIndex - 1])) {
    showDropdown.value = false
    return
  }

  const query = textBefore.slice(atIndex + 1)
  // If query contains a space after a bracket, it's a completed mention
  if (query.includes('](')) {
    showDropdown.value = false
    return
  }

  mentionQuery.value = query
  mentionStartPos.value = atIndex
  selectedIndex.value = 0
  showDropdown.value = true
  loadMembers()
}

function insertMention(member: MentionMember) {
  const value = props.modelValue
  const before = value.slice(0, mentionStartPos.value)
  const after = value.slice(mentionStartPos.value + mentionQuery.value.length + 1) // +1 for @
  const mention = `@[${member.name}](${member.userId}) `
  emit('update:modelValue', before + mention + after)
  showDropdown.value = false

  nextTick(() => {
    const pos = before.length + mention.length
    textareaRef.value?.setSelectionRange(pos, pos)
    textareaRef.value?.focus()
  })
}

function handleKeydown(e: KeyboardEvent) {
  if (!showDropdown.value) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      emit('submit')
    }
    return
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, suggestions.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    if (suggestions.value.length > 0) {
      e.preventDefault()
      insertMention(suggestions.value[selectedIndex.value])
    }
  } else if (e.key === 'Escape') {
    showDropdown.value = false
  }
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}
</script>

<template>
  <div class="relative">
    <textarea
      ref="textareaRef"
      :value="modelValue"
      :placeholder="placeholder"
      :rows="rows"
      :disabled="disabled"
      class="w-full rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors resize-none"
      @input="handleInput"
      @keydown="handleKeydown"
      @blur="setTimeout(() => showDropdown = false, 200)"
    />

    <!-- Mention autocomplete dropdown -->
    <Transition
      enter-active-class="transition-all duration-150"
      leave-active-class="transition-all duration-100"
      enter-from-class="opacity-0 translate-y-1"
      leave-to-class="opacity-0 translate-y-1"
    >
      <div
        v-if="showDropdown && suggestions.length > 0"
        class="absolute left-0 bottom-full mb-1 w-full max-h-48 overflow-y-auto rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 shadow-lg z-50"
      >
        <button
          v-for="(member, idx) in suggestions"
          :key="member.userId"
          class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors"
          :class="idx === selectedIndex ? 'bg-brand-50 dark:bg-brand-950/40' : 'hover:bg-surface-50 dark:hover:bg-surface-800'"
          @mousedown.prevent="insertMention(member)"
          @mouseenter="selectedIndex = idx"
        >
          <div
            v-if="member.image"
            class="size-6 rounded-full overflow-hidden shrink-0"
          >
            <img :src="member.image" :alt="member.name" class="size-full object-cover" />
          </div>
          <div
            v-else
            class="size-6 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-[9px] font-bold text-brand-700 dark:text-brand-300 shrink-0"
          >
            {{ getInitials(member.name) }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">{{ member.name }}</div>
            <div class="text-xs text-surface-400 truncate">{{ member.email }}</div>
          </div>
          <AtSign class="size-3 text-surface-300 shrink-0" />
        </button>
      </div>
    </Transition>
  </div>
</template>
