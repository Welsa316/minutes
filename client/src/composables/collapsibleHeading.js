import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
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
