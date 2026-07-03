import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// Makes existing headings foldable. A heading gains a `collapsed` attribute
// (persisted as data-collapsed in the note HTML, so fold state survives reloads
// and is non-destructive — exports still contain everything). A decoration
// hides the nodes under a collapsed heading, and a tiny node view draws the
// fold arrow. Works on any TiptapEditor without changing how headings serialize.

// Everything after a collapsed heading, up to the next heading of equal-or-higher
// level, gets display:none. Purely visual — the document is untouched.
function foldDecorations(doc) {
  const decos = [];
  const kids = [];
  doc.forEach((node, offset) => kids.push({ node, offset }));
  for (let i = 0; i < kids.length; i++) {
    const { node } = kids[i];
    if (node.type.name !== 'heading' || !node.attrs.collapsed) continue;
    const level = node.attrs.level;
    for (let j = i + 1; j < kids.length; j++) {
      const c = kids[j];
      if (c.node.type.name === 'heading' && c.node.attrs.level <= level) break;
      decos.push(Decoration.node(c.offset, c.offset + c.node.nodeSize, { class: 'folded-hidden' }));
    }
  }
  return DecorationSet.create(doc, decos);
}

function headingNodeView(node, view, getPos) {
  let current = node;
  const dom = document.createElement('h' + node.attrs.level);
  dom.className = 'fold-h' + (node.attrs.collapsed ? ' is-collapsed' : '');

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'fold-toggle';
  btn.contentEditable = 'false';
  btn.tabIndex = -1;
  btn.textContent = node.attrs.collapsed ? '▸' : '▾';
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof getPos !== 'function') return;
    const pos = getPos();
    const n = view.state.doc.nodeAt(pos);
    if (!n) return;
    view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...n.attrs, collapsed: !n.attrs.collapsed }));
  });

  const content = document.createElement('span');
  content.className = 'fold-h-content';

  dom.appendChild(btn);
  dom.appendChild(content);

  return {
    dom,
    contentDOM: content,
    update(updated) {
      if (updated.type.name !== 'heading') return false;
      if (updated.attrs.level !== current.attrs.level) return false; // tag differs — let PM rebuild
      current = updated;
      dom.className = 'fold-h' + (updated.attrs.collapsed ? ' is-collapsed' : '');
      btn.textContent = updated.attrs.collapsed ? '▸' : '▾';
      return true;
    },
    ignoreMutation(mutation) {
      // Let ProseMirror own the content span; ignore chrome (the arrow button).
      return !content.contains(mutation.target) && mutation.target !== content;
    },
  };
}

export const HeadingFold = Extension.create({
  name: 'headingFold',
  // Run our Enter handler before StarterKit's split, so we can expand first.
  priority: 1000,

  addKeyboardShortcuts() {
    // Enter on a COLLAPSED heading starts a new sibling section right after this
    // one — it does NOT open the folded section. (To add content inside, expand
    // it with the arrow first.) The new heading is inserted after the folded
    // section's content, at the same level, with the cursor in it.
    const handleEnter = () => {
      const { state } = this.editor;
      const { $from } = state.selection;
      const node = $from.parent;
      if (node.type.name !== 'heading' || !node.attrs.collapsed) return false;

      const level = node.attrs.level;
      const headingPos = $from.before();
      // Insert point = the next heading of equal-or-higher level (the end of this
      // section), or the end of the document.
      let insertAt = state.doc.content.size;
      let done = false;
      state.doc.forEach((n, offset) => {
        if (done || offset <= headingPos) return;
        if (n.type.name === 'heading' && n.attrs.level <= level) { insertAt = offset; done = true; }
      });

      const headingType = state.schema.nodes.heading;
      return this.editor.commands.command(({ tr, dispatch }) => {
        if (dispatch) {
          const newHeading = headingType.createAndFill({ level });
          tr.insert(insertAt, newHeading);
          tr.setSelection(TextSelection.near(tr.doc.resolve(insertAt + 1)));
          tr.scrollIntoView();
          dispatch(tr);
        }
        return true;
      });
    };
    return { Enter: handleEnter };
  },

  addGlobalAttributes() {
    return [{
      types: ['heading'],
      attributes: {
        collapsed: {
          default: false,
          parseHTML: (el) => el.getAttribute('data-collapsed') === 'true',
          renderHTML: (attrs) => (attrs.collapsed ? { 'data-collapsed': 'true' } : {}),
          keepOnSplit: false,
        },
      },
    }];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('headingFold'),
        props: {
          decorations: (state) => foldDecorations(state.doc),
          nodeViews: { heading: headingNodeView },
        },
      }),
    ];
  },
});
