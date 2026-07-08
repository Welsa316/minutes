<script setup>
// A draw-on checkbox: the rounded square outline "unwraps" into a checkmark when
// checked. Ported from a Framer-Motion (motion/react) component — but the effect
// is just a stroke-dash transition, so it runs on pure CSS here (no motion lib).
//
// Presentational only: wrap it in the interactive element (a <button> with the
// right aria) so it inherits click/keyboard/focus from the parent. Colour is
// driven by `currentColor` by default, so the parent can theme + transition it.
defineProps({
  checked: { type: Boolean, default: false },
  size: { type: [Number, String], default: 22 },
  color: { type: String, default: 'currentColor' },
  strokeWidth: { type: [Number, String], default: 3 },
  duration: { type: [Number, String], default: 0.45 }, // seconds
});
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 40 40"
    fill="none"
    class="acheck"
    aria-hidden="true"
    :style="{ '--acheck-dur': duration + 's' }"
  >
    <path
      class="acheck-path"
      :class="{ 'is-checked': checked }"
      d="M 2.45 24.95 V 33.95 C 2.45 35.9382 4.0618 37.55 6.05 37.55 H 33.95 C 35.9382 37.55 37.55 35.9382 37.55 33.95 V 6.05 C 37.55 4.0618 35.9382 2.45 33.95 2.45 H 6.05 C 4.0618 2.45 2.45 4.0618 2.45 6.05 V 22.0617 C 2.45 23.0443 2.8516 23.9841 3.5616 24.6633 L 10.0451 30.8649 C 11.5404 32.2952 13.9308 32.1735 15.2731 30.5988 L 36.2 6.05"
      :stroke="color"
      stroke-linecap="round"
      :stroke-width="strokeWidth"
    />
  </svg>
</template>

<style scoped>
.acheck { display: block; overflow: visible; }
.acheck-path {
  stroke-dasharray: 132;
  stroke-dashoffset: 0;
  transition:
    stroke-dasharray var(--acheck-dur, 0.45s) ease-in-out,
    stroke-dashoffset var(--acheck-dur, 0.45s) ease-in-out;
}
.acheck-path.is-checked {
  stroke-dasharray: 150;
  stroke-dashoffset: -134;
}
@media (prefers-reduced-motion: reduce) {
  .acheck-path { transition: none; }
}
</style>
