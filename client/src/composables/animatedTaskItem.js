import TaskItem from '@tiptap/extension-task-item';

// The same draw-on checkmark used on the Roadmap (AnimatedCheck.vue): a rounded
// square outline whose stroke "unwraps" into a tick. We keep Tiptap's own task
// checkbox node view intact — click/keyboard/readonly toggling and a11y all come
// from the parent — and only decorate it: drop the SVG into the styler <span>
// the default node view already renders, and flip its `is-checked` class when the
// item's checked attr changes. The native <input> stays in the DOM (hidden via
// CSS) so it keeps handling the actual toggle.
const ACHECK_PATH =
  'M 2.45 24.95 V 33.95 C 2.45 35.9382 4.0618 37.55 6.05 37.55 H 33.95 C 35.9382 37.55 37.55 35.9382 37.55 33.95 V 6.05 C 37.55 4.0618 35.9382 2.45 33.95 2.45 H 6.05 C 4.0618 2.45 2.45 4.0618 2.45 6.05 V 22.0617 C 2.45 23.0443 2.8516 23.9841 3.5616 24.6633 L 10.0451 30.8649 C 11.5404 32.2952 13.9308 32.1735 15.2731 30.5988 L 36.2 6.05';
const SVG_NS = 'http://www.w3.org/2000/svg';

export const AnimatedTaskItem = TaskItem.extend({
  addNodeView() {
    const renderParent = this.parent?.();
    return (props) => {
      const nodeView = renderParent ? renderParent(props) : null;
      if (!nodeView || !nodeView.dom) return nodeView;

      const styler = nodeView.dom.querySelector('label > span');
      let path = null;
      if (styler) {
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 40 40');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('aria-hidden', 'true');
        svg.classList.add('acheck');
        path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', ACHECK_PATH);
        path.setAttribute('stroke', 'currentColor');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-width', '3');
        path.classList.add('acheck-path');
        path.classList.toggle('is-checked', !!props.node?.attrs?.checked);
        svg.appendChild(path);
        styler.appendChild(svg);
      }

      const parentUpdate = nodeView.update;
      return {
        ...nodeView,
        update: (updatedNode, ...rest) => {
          const ok = parentUpdate ? parentUpdate(updatedNode, ...rest) : true;
          if (ok !== false && path) path.classList.toggle('is-checked', !!updatedNode.attrs?.checked);
          return ok;
        },
      };
    };
  },
});
