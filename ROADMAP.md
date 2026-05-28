# Minutes — Roadmap

What's shipped, what's planned, and rough implementation notes for the next two tiers. Tier 1 + Tier 2 are live in `main`. Tier 3 + Tier 4 are deferred.

---

## Shipped (Tier 1)

| # | Feature | Where it lives |
|---|---|---|
| 1 | Command palette (Cmd+K) | `client/src/components/CommandPalette.vue` |
| 2 | Quick-add overlay (Cmd+N) | `client/src/components/QuickAdd.vue` |
| 3 | Slash menu + @mentions in editor | `client/src/composables/tiptapSuggestions.js` |
| 4 | Optimistic UI (action items) | `client/src/components/ActionItemList.vue` |
| 5 | Deterministic client colors | `client/src/utils/colors.js`, `ClientChip.vue` |

## Shipped (Tier 2)

| # | Feature | Where it lives |
|---|---|---|
| 6 | Universal tags | migration `002`, `routes/tags.js`, `TagPicker.vue`, `TagChip.vue` |
| 7 | Kanban for projects | `views/Projects.vue` (view toggle) |
| 8 | Calendar for meetings | `views/Meetings.vue` (view toggle) |
| 9 | Inline status editing | `StatusBadge.vue` (editable prop) |
| 10 | Smart date parsing | `utils/dates.js` (chrono-node), `SmartDateInput.vue` |
| 11 | Saved views | `routes/savedViews.js`, `SavedViewsBar.vue` |
| 12 | Recent + Pinned in sidebar | `composables/useRecent.js`, `routes/pinned.js`, `Sidebar.vue` |

---

## Tier 3 — feel, not function (planned)

### 13. Page-level animations
- Wrap `<RouterView>` in `<Transition name="page">` with slide-fade.
- Use `<TransitionGroup>` in every list (already done for action items, extend to all).
- Add `@vueuse/motion` for spring physics on modal open/close.
- Drop animation on Kanban: `vue-draggable-plus` already gives ghost cards; tune duration to 220ms.

### 14. Confetti on completion
- `npm i canvas-confetti`
- Hook into ActionItemList: when toggling the last open item to done, fire confetti.
- Palette: `['#C65D3E', '#0F1B2D', '#E8DDD0']`.

### 15. Hover previews
- `npm i @floating-ui/vue`
- New `<EntityHover>` wrapper around ClientChip / project links / meeting links.
- On hover for >400ms, show floating card with summary (status, dates, last-meeting title).

### 16. Empty states with personality
- Replace plain "No meetings" text with `EmptyState.vue` taking `icon`, `title`, `hint`.
- Custom SVGs in `assets/empty/` using ink + terracotta palette. Avoid stock illustrations.
- Always include the relevant keyboard shortcut as a hint ("Press Cmd+N to add one").

### 17. Keyboard shortcuts everywhere
- `@vueuse/core` already installed; use `useMagicKeys`.
- Add: `j`/`k` to navigate row in current list, `c` to focus inline-create, `e` on detail to focus title, `/` to focus search.
- `?` opens a shortcut cheat-sheet modal.

### 18. Optional sound effects (off by default)
- Three Web Audio buffers: `pop` (action item check), `whoosh` (modal open), `tick` (cmd-k).
- Settings page toggle stored in `localStorage`.

### 19. URL state for filters and tabs
- Already partially done (Meetings view + filter, Projects view in query).
- Extend to MeetingDetail tab (`?tab=after`), client/project tabs.

### 20. Warm dark mode
- New CSS variables in `assets/main.css` under `[data-theme="dark"]`:
  - `--bg`: `#0A1320`
  - `--surface`: `#1A2030`
  - `--ink`: `#E8DDD0`
  - `--slate-warm`: `#9CA3AF`
  - Terracotta stays.
- Sidebar toggle. Persist in `localStorage` and honor `prefers-color-scheme` on first visit.

---

## Tier 4 — defer until daily-use (planned)

### 21. AI summary of meeting notes
- Server endpoint: `POST /api/meetings/:id/summarize` → calls Anthropic (`claude-sonnet-4`).
- Input: raw `live_notes` HTML stripped to text.
- Output: cleaned `summary` HTML + structured `action_items` array.
- Background job triggered after first "Save" on the After tab.
- Env: `ANTHROPIC_API_KEY`.

### 22. Voice capture
- Browser `webkitSpeechRecognition`.
- New mic button on MeetingDetail.
- Transcribes into `live_notes` editor at cursor.
- Free. No server-side cost.

### 23. Email-to-meeting
- Set up Resend inbound at `meeting@minutes.<your-domain>`.
- Resend POSTs to `/api/inbound/email`.
- Server creates a meeting with subject as title, body as `live_notes`, `from` as a tag.

### 24. Backlinks
- New view of all mentions referencing a given client/project.
- Server: `GET /api/clients/:id/mentions` walks `meetings`, `notes` HTML, finds `<span class="mention" data-id="X" data-kind="client">`.
- Render under "Mentioned in" section on each detail page.

### 25. Templates per meeting type
- New `meeting_templates` table: `{ id, name, structure }` with `structure` being Tiptap JSON.
- On MeetingNew, optional "Start from template" dropdown.
- Seed examples: Discovery call, Scope review, Kickoff.

---

## Conventions

- All new components live in `client/src/components/`.
- All new view-level pages in `client/src/views/`.
- All Tiptap extensions in `client/src/composables/tiptapSuggestions.js` (or sibling).
- DB changes: number-prefixed `.sql` file in `server/migrations/`, idempotent re-runs.
- Skip framework slop — terse copy, no welcome messages, no "your X will appear here" filler.
