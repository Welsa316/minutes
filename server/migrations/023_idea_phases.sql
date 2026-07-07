-- A roadmap idea is now organised into ordered PHASES. Each phase carries a
-- short brief (the why/how) and its own ordered steps. This is what turns a flat
-- checklist into an actual plan: "line up partners" stops being one vague line
-- and becomes a phase with a brief + concrete steps.
CREATE TABLE idea_phases (
  id          SERIAL PRIMARY KEY,
  idea_id     INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT '',
  note        TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_idea_phases_idea ON idea_phases(idea_id);

-- Steps now belong to a phase (idea_id kept so the list's step counts still work).
ALTER TABLE idea_steps ADD COLUMN phase_id INTEGER REFERENCES idea_phases(id) ON DELETE CASCADE;
CREATE INDEX idx_idea_steps_phase ON idea_steps(phase_id);

-- Replace the two Servlyy projects' flat seed steps with curated, phased plans.
DELETE FROM idea_steps es
USING ideas i
JOIN workspaces w ON w.id = i.workspace_id AND w.slug = 'servlyy'
WHERE es.idea_id = i.id AND es.phase_id IS NULL
  AND i.title IN ('Servlyy business plan', 'Servlyy — faster & easier');

-- Business plan → 5 phases.
INSERT INTO idea_phases (idea_id, title, note, sort_order)
SELECT i.id, ph.title, ph.note, ph.ord
FROM ideas i
JOIN workspaces w ON w.id = i.workspace_id AND w.slug = 'servlyy'
CROSS JOIN (VALUES
  ($s$Now — stop flying blind$s$, $s$You can't improve what you can't measure. Fix what's broken and turn the data back on before anything else.$s$, 0),
  ($s$Position — lead with stores$s$, $s$One sharp promise beats a feature list — a real online store and website, far cheaper than Shopify. Say that everywhere.$s$, 1),
  ($s$Grow — get discovered$s$, $s$Turn happy users into a growth loop, and let Google send buyers who are already searching.$s$, 2),
  ($s$Partner — line up a few partners$s$, $s$Who + why — a bookkeeper (referral fees), an agency (white-label reseller), and a maker community (distribution). Target: 2 signed by end of Q3.$s$, 3),
  ($s$Earn — take a small cut$s$, $s$Once stores are succeeding on Servlyy, grow with the platform, not just subscriptions.$s$, 4)
) AS ph(title, note, ord)
WHERE i.title = 'Servlyy business plan'
  AND NOT EXISTS (SELECT 1 FROM idea_phases p WHERE p.idea_id = i.id);

INSERT INTO idea_steps (idea_id, phase_id, label, sort_order)
SELECT p.idea_id, p.id, st.label, st.ord
FROM idea_phases p
JOIN ideas i ON i.id = p.idea_id
JOIN workspaces w ON w.id = i.workspace_id AND w.slug = 'servlyy'
CROSS JOIN (VALUES
  ($s$Now — stop flying blind$s$, $s$Fix the bugs$s$, 0),
  ($s$Now — stop flying blind$s$, $s$Turn analytics back on$s$, 1),
  ($s$Position — lead with stores$s$, $s$Make "stores" the headline of the marketing$s$, 0),
  ($s$Position — lead with stores$s$, $s$Let people see their finished site before the "pick a plan" step$s$, 1),
  ($s$Grow — get discovered$s$, $s$Add the "Made with Servlyy" badge$s$, 0),
  ($s$Grow — get discovered$s$, $s$Add a simple refer-a-friend$s$, 1),
  ($s$Grow — get discovered$s$, $s$Make store sites load fast and rank in Google$s$, 2),
  ($s$Grow — get discovered$s$, $s$Write the SEO pages (cheap Shopify alternative, how to start an online store, …)$s$, 3),
  ($s$Partner — line up a few partners$s$, $s$Draft a one-page partner pitch$s$, 0),
  ($s$Partner — line up a few partners$s$, $s$List 10 targets — bookkeeper, agency, maker community$s$, 1),
  ($s$Partner — line up a few partners$s$, $s$Send the first 3 outreach emails$s$, 2),
  ($s$Partner — line up a few partners$s$, $s$Sign the first 2 partners$s$, 3),
  ($s$Earn — take a small cut$s$, $s$Start taking a small cut of store sales$s$, 0),
  ($s$Earn — take a small cut$s$, $s$Add the reseller / agency plan$s$, 1),
  ($s$Earn — take a small cut$s$, $s$Build templates for the next store type once one is going well$s$, 2)
) AS st(phase_title, label, ord)
WHERE i.title = 'Servlyy business plan' AND st.phase_title = p.title
  AND NOT EXISTS (SELECT 1 FROM idea_steps es WHERE es.phase_id = p.id);

-- Performance / UX plan → 5 phases (mirrors the note's Phase 0–4).
INSERT INTO idea_phases (idea_id, title, note, sort_order)
SELECT i.id, ph.title, ph.note, ph.ord
FROM ideas i
JOIN workspaces w ON w.id = i.workspace_id AND w.slug = 'servlyy'
CROSS JOIN (VALUES
  ($s$Phase 0 — fix + measure$s$, $s$Stop the bleeding and get instruments on the dashboard before optimizing — right now there's no traffic data at all.$s$, 0),
  ($s$Phase 1 — public sites fast$s$, $s$The biggest lever. Tenant sites must be HTML on first byte — that's where SEO and conversion live. AI crawlers run no JS, so tenants are invisible until this lands.$s$, 1),
  ($s$Phase 2 — admin feels instant$s$, $s$The admin SPA can stay client-rendered but must feel immediate. Hold admin JS under 200KB.$s$, 2),
  ($s$Phase 3 — secure the session$s$, $s$Fixes deep-link logout and closes the XSS-takeover hole in one move.$s$, 3),
  ($s$Phase 4 — onboarding that converts$s$, $s$Let people feel the value before they commit — preview first, decide later.$s$, 4)
) AS ph(title, note, ord)
WHERE i.title = 'Servlyy — faster & easier'
  AND NOT EXISTS (SELECT 1 FROM idea_phases p WHERE p.idea_id = i.id);

INSERT INTO idea_steps (idea_id, phase_id, label, sort_order)
SELECT p.idea_id, p.id, st.label, st.ord
FROM idea_phases p
JOIN ideas i ON i.id = p.idea_id
JOIN workspaces w ON w.id = i.workspace_id AND w.slug = 'servlyy'
CROSS JOIN (VALUES
  ($s$Phase 0 — fix + measure$s$, $s$Fix the /tenant/me/settings 404 waterfall on dashboard load$s$, 0),
  ($s$Phase 0 — fix + measure$s$, $s$Fix the CSP blocking the Cloudflare analytics beacon$s$, 1),
  ($s$Phase 0 — fix + measure$s$, $s$Fix the dead /manage/website route + preserve path & query on deep-link logout$s$, 2),
  ($s$Phase 0 — fix + measure$s$, $s$Stand up measurement: Lighthouse CI, CrUX field data, bundle analyzer$s$, 3),
  ($s$Phase 1 — public sites fast$s$, $s$A1 — move public tenant sites to SSG + ISR (edge-cached HTML)$s$, 0),
  ($s$Phase 1 — public sites fast$s$, $s$A4 — Cloudflare edge-cache the document + assets (purge on publish)$s$, 1),
  ($s$Phase 1 — public sites fast$s$, $s$A3 — image pipeline: AVIF/WebP + explicit dimensions + lazy-load$s$, 2),
  ($s$Phase 1 — public sites fast$s$, $s$A2 — server-side per-tenant SEO metadata + JSON-LD + sitemaps$s$, 3),
  ($s$Phase 1 — public sites fast$s$, $s$A5 — self-host fonts + inline critical CSS$s$, 4),
  ($s$Phase 2 — admin feels instant$s$, $s$B1 — admin route code-splitting + <200KB JS budget$s$, 0),
  ($s$Phase 2 — admin feels instant$s$, $s$B2 — kill the admin API waterfall (route loaders / parallel fetch)$s$, 1),
  ($s$Phase 2 — admin feels instant$s$, $s$B3 — cache-first + prefetch-on-intent + optimistic UI$s$, 2),
  ($s$Phase 3 — secure the session$s$, $s$Hybrid cookie auth: token in memory + HttpOnly refresh cookie + silent refresh$s$, 0),
  ($s$Phase 4 — onboarding that converts$s$, $s$Generate a real site preview before signup$s$, 0),
  ($s$Phase 4 — onboarding that converts$s$, $s$Drop the forced "choose a plan" step (reverse trial) + shorten the wizard$s$, 1)
) AS st(phase_title, label, ord)
WHERE i.title = 'Servlyy — faster & easier' AND st.phase_title = p.title
  AND NOT EXISTS (SELECT 1 FROM idea_steps es WHERE es.phase_id = p.id);

-- Safety net: any other idea with leftover phase-less steps gets a single "Plan"
-- phase so nothing is orphaned in the new phased UI.
INSERT INTO idea_phases (idea_id, title, sort_order)
SELECT DISTINCT s.idea_id, 'Plan', 0
FROM idea_steps s
WHERE s.phase_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM idea_phases p WHERE p.idea_id = s.idea_id);

UPDATE idea_steps s
SET phase_id = p.id
FROM idea_phases p
WHERE s.phase_id IS NULL AND p.idea_id = s.idea_id AND p.title = 'Plan';
