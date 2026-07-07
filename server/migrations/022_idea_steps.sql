-- A roadmap idea (project) gets an ordered list of steps — the actual plan of
-- what to do, in order. Progress on the pipeline node is derived from how many
-- steps are done.
CREATE TABLE idea_steps (
  id          SERIAL PRIMARY KEY,
  idea_id     INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  label       TEXT NOT NULL DEFAULT '',
  done        BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_idea_steps_idea ON idea_steps(idea_id);

-- Seed the Servlyy business plan's steps (the "what to do from here" sequence).
INSERT INTO idea_steps (idea_id, label, sort_order)
SELECT i.id, s.label, s.ord
FROM ideas i
JOIN workspaces w ON w.id = i.workspace_id AND w.slug = 'servlyy'
CROSS JOIN (VALUES
  ($$Fix the bugs and turn analytics back on — stop flying blind$$, 0),
  ($$Lead the marketing with stores: "a real online store + website, way cheaper than Shopify"$$, 1),
  ($$Let people see their finished site before the "pick a plan" step$$, 2),
  ($$Add the "Made with Servlyy" badge + a simple refer-a-friend$$, 3),
  ($$Make store sites load fast and rank in Google$$, 4),
  ($$Write the SEO pages ("cheap Shopify alternative", "how to start an online store", …)$$, 5),
  ($$Line up a couple of partners (a bookkeeper, an agency, a maker community)$$, 6),
  ($$Start taking a small cut of store sales$$, 7),
  ($$Add the reseller / agency plan$$, 8),
  ($$Build templates + pages for the next store type once one is going well$$, 9)
) AS s(label, ord)
WHERE i.title = 'Servlyy business plan'
  AND NOT EXISTS (SELECT 1 FROM idea_steps es WHERE es.idea_id = i.id);

-- Seed the "faster & easier" performance/UX plan's steps (sequenced by impact).
INSERT INTO idea_steps (idea_id, label, sort_order)
SELECT i.id, s.label, s.ord
FROM ideas i
JOIN workspaces w ON w.id = i.workspace_id AND w.slug = 'servlyy'
CROSS JOIN (VALUES
  ($$Fix the /tenant/me/settings 404 waterfall on dashboard load$$, 0),
  ($$Fix the CSP blocking the Cloudflare analytics beacon — restore traffic data$$, 1),
  ($$Fix the dead /manage/website route + preserve path & query on deep-link logout$$, 2),
  ($$Stand up measurement: Lighthouse CI, CrUX field data, bundle analyzer$$, 3),
  ($$A1 — Move public tenant sites to SSG + ISR (edge-cached HTML)$$, 4),
  ($$A4 — Cloudflare edge-cache the document + assets (purge on publish)$$, 5),
  ($$A3 — Image pipeline: AVIF/WebP + explicit dimensions + lazy-load below the fold$$, 6),
  ($$A2 — Server-side per-tenant SEO metadata + JSON-LD schema + sitemaps$$, 7),
  ($$A5 — Self-host fonts + inline critical CSS$$, 8),
  ($$B1 — Admin route code-splitting + <200KB JS budget$$, 9),
  ($$B2 — Kill the admin API waterfall (route loaders / parallel fetch)$$, 10),
  ($$B3 — Cache-first + prefetch-on-intent + optimistic UI$$, 11),
  ($$Hybrid cookie auth: token in memory + HttpOnly refresh cookie + silent refresh$$, 12),
  ($$Generate a real site preview before signup$$, 13),
  ($$Drop the forced "choose a plan" step (reverse trial) + shorten the wizard$$, 14)
) AS s(label, ord)
WHERE i.title = 'Servlyy — faster & easier'
  AND NOT EXISTS (SELECT 1 FROM idea_steps es WHERE es.idea_id = i.id);
