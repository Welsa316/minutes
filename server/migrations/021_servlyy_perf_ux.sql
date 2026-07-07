-- Second Servlyy roadmap idea: the performance + UX ("faster & easier") plan.
INSERT INTO ideas (workspace_id, title, note, lane, progress, sort_order)
SELECT w.id,
  'Servlyy — faster & easier',
  $plan$Two products under one roof pull opposite ways: public tenant sites (slug.servlyy.com) must be HTML on first byte — that's where SEO + conversion live — while the admin SPA can stay client-rendered but must FEEL instant. Hold everything to Core Web Vitals 2025: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1, TTFB ≤ 200ms, admin JS < 200KB.

Phase 0 (this week): fix the /tenant/me/settings 404 waterfall on dashboard load; fix the CSP blocking the Cloudflare analytics beacon (you have no traffic data right now); fix the dead /manage/website route and deep-link logout; stand up measurement (Lighthouse CI, CrUX, bundle analyzer).

Phase 1 (public sites — biggest lever): move to SSG + ISR edge-cached HTML; server-side per-tenant SEO metadata + JSON-LD schema; Cloudflare edge-cache; image pipeline (AVIF/WebP + explicit dimensions); fonts + critical CSS. AI crawlers run no JS, so tenants are invisible to AI search until this lands.

Phase 2 (admin): route code-splitting + <200KB budget; kill the API waterfall with route loaders; cache-first + prefetch-on-intent + optimistic UI.
Phase 3 (auth): access token in memory + HttpOnly refresh cookie on .servlyy.com with silent refresh — fixes deep-link logout and closes the XSS-takeover hole.
Phase 4 (onboarding): generate a real site preview BEFORE signup; drop the forced "choose a plan" step (reverse trial); shorten the wizard; dashboard polish.

Do first: A1 SSG+ISR → A4 edge-cache → A3 images → kill the admin waterfall/404 → hybrid cookie auth. Interleave generate-before-signup + reverse trial.$plan$,
  'building', 0, -99
FROM workspaces w
WHERE w.slug = 'servlyy'
  AND NOT EXISTS (
    SELECT 1 FROM ideas i
    WHERE i.workspace_id = w.id AND i.title = 'Servlyy — faster & easier' AND i.deleted_at IS NULL
  );
