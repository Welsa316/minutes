<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Mention from '@tiptap/extension-mention';
import Image from '@tiptap/extension-image';
import 'tippy.js/dist/tippy.css';
import { mentionSuggestion, SlashCommand } from '../composables/tiptapSuggestions.js';
import { Callout } from '../composables/calloutNode.js';
import { HeadingFold } from '../composables/collapsibleHeading.js';
import NoteOutline from './NoteOutline.vue';
import { useSpeech } from '../composables/useSpeech.js';
import { api } from '../api/index.js';
import { useToastStore } from '../stores/toast.js';

const router = useRouter();
const speech = useSpeech();
const toast = useToastStore();
const fileInput = ref(null);

// Upload a Blob/File to the server, return its served URL.
async function uploadImage(file) {
  const { data } = await api.post('/uploads', file, { headers: { 'Content-Type': file.type } });
  return data.url;
}

// Browsers hand us all sorts of clipboard image types (macOS often gives
// image/tiff, Windows gives image/bmp). The server only stores web-renderable
// formats, so re-encode anything unusual to PNG via canvas first.
const SAFE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
async function toUploadable(file) {
  if (SAFE_TYPES.has(file.type)) return file;
  try {
    const url = URL.createObjectURL(file);
    // document.createElement, NOT `new Image()` — the Tiptap Image import shadows it.
    const el = document.createElement('img');
    await new Promise((res, rej) => { el.onload = res; el.onerror = rej; el.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = el.naturalWidth || 800;
    canvas.height = el.naturalHeight || 600;
    canvas.getContext('2d').drawImage(el, 0, 0);
    URL.revokeObjectURL(url);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    if (blob) return new File([blob], 'image.png', { type: 'image/png' });
  } catch { /* fall through — server may still accept svg/avif */ }
  return file;
}

async function insertImage(file) {
  if (!file) return;
  const toastId = toast.info('Uploading image…', { ttl: 0 });
  try {
    const uploadable = await toUploadable(file);
    const url = await uploadImage(uploadable);
    editor.value?.chain().focus().setImage({ src: url }).run();
    toast.dismiss(toastId);
  } catch (e) {
    toast.dismiss(toastId);
    toast.error(e?.response?.data?.error || 'Image upload failed');
  }
}

// Pull every image File out of a clipboard/drag DataTransfer, browser-safely.
// (DataTransferItemList is NOT iterable with for...of in Safari — use indexes.)
function imageFilesFrom(dt) {
  if (!dt) return [];
  const out = [];
  if (dt.items && dt.items.length) {
    for (let i = 0; i < dt.items.length; i++) {
      const it = dt.items[i];
      if (it.kind === 'file' && it.type && it.type.indexOf('image/') === 0) {
        const f = it.getAsFile();
        if (f) out.push(f);
      }
    }
  }
  if (!out.length && dt.files && dt.files.length) {
    for (let i = 0; i < dt.files.length; i++) {
      const f = dt.files[i];
      if (f.type && f.type.indexOf('image/') === 0) out.push(f);
    }
  }
  return out;
}

function pickImage() { fileInput.value?.click(); }
function onPickFile(e) {
  const file = e.target.files?.[0];
  if (file) insertImage(file);
  e.target.value = '';
}

let dictateBuffer = '';
function toggleDictate() {
  if (speech.listening.value) { speech.stop(); return; }
  dictateBuffer = '';
  speech.start({ interim: false, continuous: true }, (text, isFinal) => {
    if (isFinal && editor.value) {
      editor.value.chain().focus().insertContent((dictateBuffer ? ' ' : '') + text).run();
      dictateBuffer += text;
    }
  });
}

const props = defineProps({
  modelValue: { type: String, default: '' },
  minHeight: { type: String, default: '160px' },
  // When set, the content area caps at this height and scrolls internally,
  // so a long note doesn't grow the whole page (toolbar/tabs stay pinned).
  maxHeight: { type: String, default: '' },
  // Show an auto-built outline rail (jump to / fold sections). For long notes.
  outline: { type: Boolean, default: false },
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
    HeadingFold,
    Image.configure({
      inline: false,
      allowBase64: false,
      HTMLAttributes: { class: 'tp-img' },
    }),
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
    // Paste an image straight from the clipboard → upload → insert.
    handlePaste: (view, event) => {
      const imgs = imageFilesFrom(event.clipboardData);
      if (!imgs.length) return false;
      event.preventDefault();
      imgs.forEach(insertImage);
      return true;
    },
    // Drag-and-drop image files.
    handleDrop: (view, event) => {
      const imgs = imageFilesFrom(event.dataTransfer);
      if (!imgs.length) return false;
      event.preventDefault();
      imgs.forEach(insertImage);
      return true;
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
  <div :class="outline ? 'flex flex-col lg:flex-row lg:items-start gap-3' : ''">
    <NoteOutline
      v-if="outline && editor"
      :editor="editor"
      class="lg:order-2 lg:w-48 lg:shrink-0 lg:sticky lg:top-4"
    />
    <div class="flex-1 min-w-0 lg:order-1 border border-sand rounded-md bg-warm focus-within:ring-2 focus-within:ring-terracotta/40 focus-within:border-terracotta transition-colors">
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
      <button type="button" class="tp-btn" @click="pickImage" title="Insert image (or just paste)">
        <svg class="h-3.5 w-3.5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></svg>
      </button>
      <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onPickFile" />
      <span class="mx-1 w-px h-4 bg-sand" />
      <button type="button" class="tp-btn" @click="run(c => c.undo())" title="Undo">&#8630;</button>
      <button type="button" class="tp-btn" @click="run(c => c.redo())" title="Redo">&#8631;</button>
      <button
        v-if="speech.supported"
        type="button"
        :class="['tp-btn ml-auto', speech.listening.value && 'bg-terracotta text-warm']"
        @click="toggleDictate"
        :title="speech.listening.value ? 'Stop dictation' : 'Dictate'"
      >
        <svg class="h-3.5 w-3.5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="19" x2="12" y2="22" /></svg>
      </button>
    </div>
    <BubbleMenu v-if="editor" :editor="editor" :tippy-options="{ duration: 120 }" class="flex items-center gap-0.5 bg-surface border border-sand rounded-md shadow-lg px-1 py-1">
      <button type="button" class="tp-btn" :class="isActive('bold') && 'tp-btn-active'" @click="run(c => c.toggleBold())"><span class="font-bold">B</span></button>
      <button type="button" class="tp-btn" :class="isActive('italic') && 'tp-btn-active'" @click="run(c => c.toggleItalic())"><span class="italic">i</span></button>
      <button type="button" class="tp-btn" :class="isActive('strike') && 'tp-btn-active'" @click="run(c => c.toggleStrike())"><span class="line-through">S</span></button>
      <button type="button" class="tp-btn" :class="isActive('code') && 'tp-btn-active'" @click="run(c => c.toggleCode())" title="Code"><span class="font-mono text-xs">{}</span></button>
      <button type="button" class="tp-btn" :class="isActive('link') && 'tp-btn-active'" @click="setLink">link</button>
    </BubbleMenu>
    <EditorContent
      :editor="editor"
      :class="['px-3 py-2.5', maxHeight && 'overflow-y-auto']"
      :style="{ minHeight, maxHeight: maxHeight || undefined }"
    />
    </div>
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

/* Collapsible headings: a fold arrow in the gutter; content hidden when folded. */
.tp-prose .fold-toggle {
  display: inline-flex; align-items: center; justify-content: center;
  width: 0.9em; margin-right: 0.15em; margin-left: -0.05em;
  font-size: 0.6em; line-height: 1; vertical-align: middle;
  color: theme('colors.slate-warm'); opacity: 0; cursor: pointer;
  background: none; border: 0; padding: 0; transition: opacity 120ms ease;
}
.tp-prose .fold-h:hover .fold-toggle,
.tp-prose .fold-h.is-collapsed .fold-toggle { opacity: 0.7; }
.tp-prose .fold-h.is-collapsed .fold-h-content::after {
  content: ' …'; color: theme('colors.slate-warm'); font-weight: 400;
}
.tp-prose .folded-hidden { display: none !important; }
.tp-prose p { line-height: 1.6; margin: 0.25rem 0; }
/* Bold = brand terracotta (still bold weight) — cover <b> from pasted content too */
.tp-prose strong, .tp-prose b { color: theme('colors.terracotta'); font-weight: 700; }
.tp-prose ul, .tp-prose ol { padding-left: 1.5rem; margin: 0.25rem 0; }
/* Bullet lists step through markers by depth, like a real outline. */
.tp-prose ul { list-style: disc; }
.tp-prose ul ul { list-style: circle; }
.tp-prose ul ul ul { list-style: square; }
.tp-prose ul ul ul ul { list-style: disc; }
/* Ordered lists step through number → letter → roman. */
.tp-prose ol { list-style: decimal; }
.tp-prose ol ol { list-style: lower-alpha; }
.tp-prose ol ol ol { list-style: lower-roman; }
.tp-prose ol ol ol ol { list-style: decimal; }
.tp-prose a { color: theme('colors.terracotta'); text-decoration: underline; }
.tp-prose img {
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
  border: 1px solid theme('colors.sand');
  margin: 0.5rem 0;
  display: block;
}
.tp-prose img.ProseMirror-selectednode {
  outline: 2px solid theme('colors.terracotta');
  outline-offset: 2px;
}
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
