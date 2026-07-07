import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// Marks the top-level block containing the caret with `.pm-active`. Harmless on
// its own — the dimming only kicks in when an ancestor carries `.is-focus`
// (see TiptapEditor styles), so this can stay installed for every editor.
export const FocusBlock = Extension.create({
  name: 'focusBlock',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('focusBlock'),
        props: {
          decorations(state) {
            const { $head } = state.selection;
            if ($head.depth === 0) return DecorationSet.empty;
            const from = $head.before(1);
            const node = state.doc.nodeAt(from);
            if (!node) return DecorationSet.empty;
            return DecorationSet.create(state.doc, [
              Decoration.node(from, from + node.nodeSize, { class: 'pm-active' }),
            ]);
          },
        },
      }),
    ];
  },
});
