<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Mention from '@tiptap/extension-mention';
import 'tippy.js/dist/tippy.css';
import { mentionSuggestion, SlashCommand } from '../composables/tiptapSuggestions.js';
import { Callout } from '../composables/calloutNode.js';

const router = useRouter();

const props = defineProps({
  modelValue: { type: String, default: '' },
  minHeight: { type: String, default: '160px' },
});
const emit = defineEmits(['update:modelValue']);

const editor = useEditor({
  content: props.modelValue || '',
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      HTMLAttributes: { rel: 'noopener noreferrer' },
    }),
    Mention.configure({
      HTMLAttributes: { class: 'mention' },
      renderLabel({ options, node }) {
        const kind = node.attrs.kind || 'item';
        return `${options.suggestion.char}${node.attrs.label}`;
      },
      suggestion: mentionSuggestion(),
    }).extend({
      addAttributes() {
        return {
          id: { default: null, parseHTML: (el) => el.getAttribute('data-id'), renderHTML: (a) => ({ 'data-id': a.id }) },
          label: { default: null, parseHTML: (el) => el.getAttribute('data-label'), renderHTML: (a) => ({ 'data-label': a.label }) },
          kind: { default: null, parseHTML: (el) => el.getAttribute('data-kind'), renderHTML: (a) => ({ 'data-kind': a.kind }) },
        };
      },
    }),
    SlashCommand,
    Callout,
  ],
  editorProps: {
    attributes: { class: 'tp-prose focus:outline-none' },
    handleClick: (view, pos, event) => {
      // Make @mentions clickable: navigate to the linked entity
      const target = event.target;
      if (target?.classList?.contains('mention')) {
        const kind = target.getAttribute('data-kind');
        const id = target.getAttribute('data-id');
        if (kind && id) {
          router.push(kind === 'client' ? `/clients/${id}` : `/projects/${id}`);
          return true;
        }
      }
      return false;
    },
  },
  onUpdate: ({ editor }) => emit('update:modelValue', editor.getHTML()),
});

watch(() => props.modelValue, (v) => {
  const ed = editor.value;
  if (!ed) return;
  if ((v || '') !== ed.getHTML()) ed.commands.setContent(v || '', false);
});

onBeforeUnmount(() => editor.value?.destroy());

function run(cmd) {
  const ed = editor.value;
  if (!ed) return;
  cmd(ed.chain().focus()).run();
}

function setLink() {
  const ed = editor.value;
  if (!ed) return;
  const prev = ed.getAttributes('link').href;
  const url = window.prompt('URL', prev || 'https://');
  if (url === null) return;
  if (url === '') {
    ed.chain().focus().extendMarkRange('link').unsetLink().run();
  } else {
    ed.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }
}

const isActive = (n, opts) => editor.value?.isActive(n, opts) || false;
</script>

<template>
  <div class="border border-sand rounded-md bg-warm focus-within:ring-2 focus-within:ring-terracotta/40 focus-within:border-terracotta transition-colors">
    <div v-if="editor" class="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-sand">
      <button type="button" class="tp-btn" :class="isActive('bold') && 'tp-btn-active'" @click="run(c => c.toggleBold())" title="Bold"><span class="font-bold">B</span></button>
      <button type="button" class="tp-btn" :class="isActive('italic') && 'tp-btn-active'" @click="run(c => c.toggleItalic())" title="Italic"><span class="italic">i</span></button>
      <button type="button" class="tp-btn" :class="isActive('strike') && 'tp-btn-active'" @click="run(c => c.toggleStrike())" title="Strikethrough"><span class="line-through">S</span></button>
      <span class="mx-1 w-px h-4 bg-sand" />
      <button type="button" class="tp-btn" :class="isActive('heading', { level: 1 }) && 'tp-btn-active'" @click="run(c => c.toggleHeading({ level: 1 }))">H1</button>
      <button type="button" class="tp-btn" :class="isActive('heading', { level: 2 }) && 'tp-btn-active'" @click="run(c => c.toggleHeading({ level: 2 }))">H2</button>
      <button type="button" class="tp-btn" :class="isActive('heading', { level: 3 }) && 'tp-btn-active'" @click="run(c => c.toggleHeading({ level: 3 }))">H3</button>
      <span class="mx-1 w-px h-4 bg-sand" />
      <button type="button" class="tp-btn" :class="isActive('bulletList') && 'tp-btn-active'" @click="run(c => c.toggleBulletList())" title="Bullet list">&bull;</button>
      <button type="button" class="tp-btn" :class="isActive('orderedList') && 'tp-btn-active'" @click="run(c => c.toggleOrderedList())" title="Numbered list">1.</button>
      <button type="button" class="tp-btn" :class="isActive('taskList') && 'tp-btn-active'" @click="run(c => c.toggleTaskList())" title="Checklist">&#9744;</button>
      <span class="mx-1 w-px h-4 bg-sand" />
      <button type="button" class="tp-btn" :class="isActive('link') && 'tp-btn-active'" @click="setLink" title="Link">link</button>
      <button type="button" class="tp-btn" :class="isActive('blockquote') && 'tp-btn-active'" @click="run(c => c.toggleBlockquote())" title="Quote">&ldquo;</button>
      <button type="button" class="tp-btn" :class="isActive('callout', { tone: 'info' }) && 'tp-btn-active'" @click="run(c => c.toggleCallout({ tone: 'info' }))" title="Callout / key decision">!</button>
      <button type="button" class="tp-btn" :class="isActive('callout', { tone: 'next' }) && 'tp-btn-active'" @click="run(c => c.toggleCallout({ tone: 'next' }))" title="Callout / follow-up">→</button>
      <span class="mx-1 w-px h-4 bg-sand" />
      <button type="button" class="tp-btn" @click="run(c => c.undo())" title="Undo">&#8630;</button>
      <button type="button" class="tp-btn" @click="run(c => c.redo())" title="Redo">&#8631;</button>
    </div>
    <BubbleMenu v-if="editor" :editor="editor" :tippy-options="{ duration: 120 }" class="flex items-center gap-0.5 bg-surface border border-sand rounded-md shadow-lg px-1 py-1">
      <button type="button" class="tp-btn" :class="isActive('bold') && 'tp-btn-active'" @click="run(c => c.toggleBold())"><span class="font-bold">B</span></button>
      <button type="button" class="tp-btn" :class="isActive('italic') && 'tp-btn-active'" @click="run(c => c.toggleItalic())"><span class="italic">i</span></button>
      <button type="button" class="tp-btn" :class="isActive('strike') && 'tp-btn-active'" @click="run(c => c.toggleStrike())"><span class="line-through">S</span></button>
      <button type="button" class="tp-btn" :class="isActive('code') && 'tp-btn-active'" @click="run(c => c.toggleCode())" title="Code"><span class="font-mono text-xs">{}</span></button>
      <button type="button" class="tp-btn" :class="isActive('link') && 'tp-btn-active'" @click="setLink">link</button>
    </BubbleMenu>
    <EditorContent :editor="editor" class="px-3 py-2.5" :style="{ minHeight }" />
  </div>
</template>

<style>
.tp-btn {
  @apply px-1.5 py-0.5 rounded text-slate-warm hover:bg-sand/60 hover:text-ink transition-colors min-w-[1.75rem] text-center text-sm leading-tight;
}
.tp-btn-active {
  @apply bg-sand text-ink;
}
.tp-prose { color: theme('colors.ink'); }
.tp-prose h1 { font-family: theme('fontFamily.serif'); font-size: 1.5rem; margin: 0.75rem 0 0.25rem; }
.tp-prose h2 { font-family: theme('fontFamily.serif'); font-size: 1.25rem; margin: 0.625rem 0 0.25rem; }
.tp-prose h3 { font-family: theme('fontFamily.serif'); font-size: 1.125rem; margin: 0.5rem 0 0.25rem; }
.tp-prose p { line-height: 1.6; margin: 0.25rem 0; }
.tp-prose ul, .tp-prose ol { padding-left: 1.5rem; margin: 0.25rem 0; }
.tp-prose ul { list-style: disc; }
.tp-prose ol { list-style: decimal; }
.tp-prose a { color: theme('colors.terracotta'); text-decoration: underline; }
.tp-prose ul[data-type="taskList"] { list-style: none; padding-left: 0; }
.tp-prose ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5rem; }
.tp-prose ul[data-type="taskList"] li > label { margin-top: 0.25rem; }
.tp-prose ul[data-type="taskList"] li > label input[type="checkbox"] { accent-color: theme('colors.terracotta'); }
.tp-prose ul[data-type="taskList"] li > div { flex: 1; }
.tp-prose ul[data-type="taskList"] li[data-checked="true"] > div { color: theme('colors.slate-warm'); text-decoration: line-through; }
.tp-prose blockquote { border-left: 3px solid theme('colors.sand'); padding-left: 0.75rem; color: theme('colors.slate-warm'); margin: 0.5rem 0; }
.tp-prose code { background: theme('colors.sand'); padding: 0.125rem 0.25rem; border-radius: 0.25rem; font-size: 0.875em; }
.tp-prose pre { background: theme('colors.ink'); color: theme('colors.warm'); padding: 0.75rem; border-radius: 0.375rem; overflow-x: auto; }
.tp-prose pre code { background: transparent; padding: 0; color: inherit; }

/* Callout boxes */
.tp-prose .callout {
  border-left: 3px solid;
  border-radius: 0.5rem;
  padding: 0.6rem 0.9rem;
  margin: 0.5rem 0;
  background: rgb(var(--c-sand) / 0.4);
}
.tp-prose .callout[data-tone="info"]  { border-color: theme('colors.terracotta'); background: rgb(var(--c-terracotta) / 0.08); }
.tp-prose .callout[data-tone="warn"]  { border-color: #C29A3A; background: rgba(194, 154, 58, 0.08); }
.tp-prose .callout[data-tone="next"]  { border-color: #3F6B4C; background: rgba(63, 107, 76, 0.08); }
.tp-prose .callout[data-tone="info"]::before  { content: '! '; color: theme('colors.terracotta'); font-weight: 600; }
.tp-prose .callout[data-tone="warn"]::before  { content: '? '; color: #C29A3A; font-weight: 600; }
.tp-prose .callout[data-tone="next"]::before  { content: '→ '; color: #3F6B4C; font-weight: 600; }
.tp-prose .callout > :first-child { display: inline; }
.tp-prose .callout > * { margin: 0; }
.tp-prose .mention {
  background: theme('colors.sand');
  color: theme('colors.ink');
  padding: 0.05rem 0.4rem;
  border-radius: 0.25rem;
  font-weight: 500;
  cursor: pointer;
  font-size: 0.95em;
}
.tp-prose .mention:hover { background: theme('colors.terracotta'); color: theme('colors.warm'); }
.tippy-box { background: transparent !important; }
.tippy-arrow { display: none !important; }
.tippy-content { padding: 0 !important; }
</style>
