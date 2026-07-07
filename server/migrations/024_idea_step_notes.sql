-- Steps get their own detail note — the "what exactly / how you'll know it's
-- done" under a one-line label. "Fix the bugs" stops being a mystery.
ALTER TABLE idea_steps ADD COLUMN note TEXT;

-- Seed detail for the Servlyy business plan's steps.
UPDATE idea_steps s SET note = v.note
FROM (VALUES
  ($l$Fix the bugs$l$, $d$The three that bite hardest: the /tenant/me/settings 404 waterfall on dashboard load, the CSP blocking the Cloudflare analytics beacon, and the dead /manage/website route. They're spelled out in the "faster & easier" plan — clear them before anything else.$d$),
  ($l$Turn analytics back on$l$, $d$Once the CSP is fixed, confirm the Cloudflare beacon fires and pageviews + key events land in the dashboard. You can't judge any of the moves below without real numbers.$d$),
  ($l$Make "stores" the headline of the marketing$l$, $d$Rewrite the homepage hero and the ads around one promise: a real online store + website, far cheaper than Shopify. Sell the outcome (a store that sells), not the page builder.$d$),
  ($l$Let people see their finished site before the "pick a plan" step$l$, $d$Generate and show the actual site first; put the paywall after the "wow". Seeing their own store is the moment people decide to pay.$d$),
  ($l$Add the "Made with Servlyy" badge$l$, $d$A small, tasteful footer badge on free/starter store sites that links back. Free distribution — every store becomes an ad. Let paid plans remove it.$d$),
  ($l$Add a simple refer-a-friend$l$, $d$One shareable link per user; both sides get a perk (a free month or a discount). Keep it one click from the dashboard.$d$),
  ($l$Make store sites load fast and rank in Google$l$, $d$This is the whole "faster & easier" plan — fast, crawlable, HTML-first store sites. Fast + indexable = free traffic that actually converts.$d$),
  ($l$Write the SEO pages (cheap Shopify alternative, how to start an online store, …)$l$, $d$Publish comparison + how-to pages targeting real searches: "cheap Shopify alternative", "how to start an online store", per-niche guides. These pull in buyers already looking.$d$),
  ($l$Draft a one-page partner pitch$l$, $d$One page: what Servlyy is, who it's for, what the partner earns, and how to refer. Something a bookkeeper or agency can skim in 30 seconds and say yes to.$d$),
  ($l$List 10 targets — bookkeeper, agency, maker community$l$, $d$Name 10 concrete prospects across the three types — a bookkeeper, an agency, a maker/creator community — with a contact and an angle for each.$d$),
  ($l$Send the first 3 outreach emails$l$, $d$Short, personal, one ask. Reference their audience and the revenue share. Aim for a call, not a signed contract.$d$),
  ($l$Sign the first 2 partners$l$, $d$Get two agreements in writing (referral fee or white-label terms). Two live partners prove the channel before you pour effort into scaling it.$d$),
  ($l$Start taking a small cut of store sales$l$, $d$Introduce a low transaction fee on store sales, waivable on higher plans. Aligns your revenue with the store's success, not just the subscription.$d$),
  ($l$Add the reseller / agency plan$l$, $d$A tier where an agency manages multiple client stores under one account, with white-label + bulk pricing. Turns partners into a sales force.$d$),
  ($l$Build templates for the next store type once one is going well$l$, $d$Once one niche is working, package its layout + copy + SEO as a template and open the next store type. Repeatable growth instead of one-off builds.$d$)
) AS v(label, note)
WHERE s.label = v.label
  AND (s.note IS NULL OR s.note = '')
  AND s.idea_id IN (
    SELECT i.id FROM ideas i JOIN workspaces w ON w.id = i.workspace_id AND w.slug = 'servlyy'
    WHERE i.title = 'Servlyy business plan' AND i.deleted_at IS NULL
  );

-- Seed why/acceptance detail for the performance / UX plan's steps.
UPDATE idea_steps s SET note = v.note
FROM (VALUES
  ($l$Fix the /tenant/me/settings 404 waterfall on dashboard load$l$, $d$Dashboard load fires a request that 404s and blocks render. Fix the endpoint/route so first paint isn't waiting on a dead call.$d$),
  ($l$Fix the CSP blocking the Cloudflare analytics beacon$l$, $d$The Content-Security-Policy blocks the analytics script, so you have zero traffic data right now. Allow the beacon origin and verify events arrive.$d$),
  ($l$Fix the dead /manage/website route + preserve path & query on deep-link logout$l$, $d$The route 404s, and a deep-link logout drops the intended path + query. Restore the route and carry the destination through auth.$d$),
  ($l$Stand up measurement: Lighthouse CI, CrUX field data, bundle analyzer$l$, $d$Wire Lighthouse CI on PRs, CrUX field data, and a bundle analyzer so every change below is judged on real numbers, not vibes.$d$),
  ($l$A1 — move public tenant sites to SSG + ISR (edge-cached HTML)$l$, $d$Pre-render tenant sites to edge-cached HTML with incremental revalidation. HTML on first byte is where SEO + conversion live.$d$),
  ($l$A4 — Cloudflare edge-cache the document + assets (purge on publish)$l$, $d$Cache the document + assets at the edge and purge on publish. Cuts TTFB globally without hammering the origin.$d$),
  ($l$A3 — image pipeline: AVIF/WebP + explicit dimensions + lazy-load$l$, $d$Serve AVIF/WebP, set explicit width/height (no layout shift), and lazy-load below the fold. Images are usually the biggest bytes on the page.$d$),
  ($l$A2 — server-side per-tenant SEO metadata + JSON-LD + sitemaps$l$, $d$Server-render per-tenant title/description/OG + JSON-LD schema + sitemaps. AI crawlers run no JS, so this has to be in the HTML.$d$),
  ($l$A5 — self-host fonts + inline critical CSS$l$, $d$Self-host fonts (no third-party round-trip) and inline critical CSS to remove render-blocking. Faster first paint.$d$),
  ($l$B1 — admin route code-splitting + <200KB JS budget$l$, $d$Split admin routes and hold the JS budget under 200KB. The SPA can stay client-rendered, but it must ship a lot less.$d$),
  ($l$B2 — kill the admin API waterfall (route loaders / parallel fetch)$l$, $d$Replace sequential fetches with route loaders / parallel requests so the admin doesn't load one call at a time.$d$),
  ($l$B3 — cache-first + prefetch-on-intent + optimistic UI$l$, $d$Cache-first data, prefetch on hover/intent, optimistic UI on writes. Make navigation feel instant.$d$),
  ($l$Hybrid cookie auth: token in memory + HttpOnly refresh cookie + silent refresh$l$, $d$Access token in memory + an HttpOnly refresh cookie on .servlyy.com with silent refresh. Fixes deep-link logout and closes the XSS-token-theft hole.$d$),
  ($l$Generate a real site preview before signup$l$, $d$Build the actual site preview before the signup wall so people feel the value first, then sign up.$d$),
  ($l$Drop the forced "choose a plan" step (reverse trial) + shorten the wizard$l$, $d$Let people in without picking a plan (reverse trial) and cut steps from the wizard. Fewer clicks between them and the "wow".$d$)
) AS v(label, note)
WHERE s.label = v.label
  AND (s.note IS NULL OR s.note = '')
  AND s.idea_id IN (
    SELECT i.id FROM ideas i JOIN workspaces w ON w.id = i.workspace_id AND w.slug = 'servlyy'
    WHERE i.title = 'Servlyy — faster & easier' AND i.deleted_at IS NULL
  );
