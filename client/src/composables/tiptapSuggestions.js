import { VueRenderer } from '@tiptap/vue-3';
import tippy from 'tippy.js';
import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import MentionList from '../components/MentionList.vue';
import SlashMenu from '../components/SlashMenu.vue';
import { clients as clientsApi, projects as projectsApi } from '../api/endpoints.js';

// ---------------------------------------------------------------------------
// @mention: pull clients + projects and let the user link to them.
// Inserts a Mention node from @tiptap/extension-mention.
// ---------------------------------------------------------------------------

let mentionCache = null;
async function loadMentionables() {
  if (mentionCache) return mentionCache;
  const [c, p] = await Promise.all([clientsApi.list(), projectsApi.list()]);
  mentionCache = [
    ...c.map((x) => ({ kind: 'client', id: x.id, label: x.name })),
    ...p.map((x) => ({ kind: 'project', id: x.id, label: x.name })),
  ];
  return mentionCache;
}

function makePopup() {
  let popup, component;
  return {
    onStart: (props) => {
      component = new VueRenderer(props.componentRef, { props, editor: props.editor });
      if (!props.clientRect) return;
      popup = tippy('body', {
        getReferenceClientRect: props.clientRect,
        appendTo: () => document.body,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: 'manual',
        placement: 'bottom-start',
      })[0];
    },
    onUpdate: (props) => {
      component?.updateProps(props);
      if (props.clientRect) popup?.setProps({ getReferenceClientRect: props.clientRect });
    },
    onKeyDown: (props) => {
      if (props.event.key === 'Escape') { popup?.hide(); return true; }
      return component?.ref?.onKeyDown?.(props) || false;
    },
    onExit: () => { popup?.destroy(); component?.destroy(); },
  };
}

export function mentionSuggestion() {
  const popup = makePopup();
  return {
    char: '@',
    allowSpaces: false,
    items: async ({ query }) => {
      const all = await loadMentionables();
      if (!query) return all.slice(0, 8);
      const q = query.toLowerCase();
      return all.filter((i) => i.label.toLowerCase().includes(q)).slice(0, 8);
    },
    render: () => ({
      onStart: (props) => popup.onStart({ ...props, componentRef: MentionList }),
      onUpdate: popup.onUpdate,
      onKeyDown: popup.onKeyDown,
      onExit: popup.onExit,
    }),
  };
}

// ---------------------------------------------------------------------------
// Slash menu: block-level transforms on `/`.
// ---------------------------------------------------------------------------

const SLASH_ITEMS = [
  { label: 'Heading 1', icon: 'H1', hint: '#',  cmd: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run() },
  { label: 'Heading 2', icon: 'H2', hint: '##', cmd: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run() },
  { label: 'Heading 3', icon: 'H3', hint: '###',cmd: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run() },
  { label: 'Bullet list', icon: '•', cmd: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run() },
  { label: 'Numbered list', icon: '1.', cmd: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run() },
  { label: 'Checklist', icon: '☐', cmd: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList().run() },
  { label: 'Quote', icon: '"',  cmd: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run() },
  { label: 'Code block', icon: '<>', cmd: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run() },
  { label: 'Divider', icon: '—', cmd: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run() },
];

export const SlashCommand = Extension.create({
  name: 'slashCommand',
  addProseMirrorPlugins() {
    const popup = makePopup();
    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        startOfLine: false,
        allowSpaces: false,
        command: ({ editor, range, props }) => props.cmd({ editor, range }),
        items: ({ query }) => {
          const q = query.toLowerCase();
          return SLASH_ITEMS.filter((i) => i.label.toLowerCase().includes(q));
        },
        render: () => ({
          onStart: (props) => popup.onStart({ ...props, componentRef: SlashMenu }),
          onUpdate: popup.onUpdate,
          onKeyDown: popup.onKeyDown,
          onExit: popup.onExit,
        }),
      }),
    ];
  },
});
