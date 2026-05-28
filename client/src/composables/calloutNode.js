import { Node, mergeAttributes, wrappingInputRule } from '@tiptap/core';

// Simple callout block: > !  starts a callout. Tone: info | warn | next.
// Renders as a colored, bordered <aside> with the tone determining colors.
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      tone: {
        default: 'info',
        parseHTML: (el) => el.getAttribute('data-tone') || 'info',
        renderHTML: (attrs) => ({ 'data-tone': attrs.tone }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'aside.callout' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['aside', mergeAttributes({ class: 'callout' }, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setCallout: (attrs) => ({ commands }) => commands.wrapIn(this.name, attrs || {}),
      toggleCallout: (attrs) => ({ commands }) => commands.toggleWrap(this.name, attrs || {}),
      unsetCallout: () => ({ commands }) => commands.lift(this.name),
    };
  },

  addInputRules() {
    return [
      // Markdown-ish: >! enters an info callout
      wrappingInputRule({ find: /^>!\s$/, type: this.type, getAttributes: () => ({ tone: 'info' }) }),
      wrappingInputRule({ find: /^>\?\s$/, type: this.type, getAttributes: () => ({ tone: 'warn' }) }),
      wrappingInputRule({ find: /^>>\s$/, type: this.type, getAttributes: () => ({ tone: 'next' }) }),
    ];
  },
});
