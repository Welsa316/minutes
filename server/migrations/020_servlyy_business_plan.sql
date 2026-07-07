-- Seed the Servlyy business plan as the first roadmap idea in the Servlyy
-- workspace (dollar-quoted so apostrophes need no escaping; NOT EXISTS so a
-- re-run can't duplicate it). sort_order -100 keeps it first in its stage.
INSERT INTO ideas (workspace_id, title, note, lane, progress, sort_order)
SELECT w.id,
  'Servlyy business plan',
  $plan$Sell Servlyy as the cheap all-in-one that does a real online store AND a real website — under Shopify, with no add-on tax. Stay industry-agnostic: simple sites (law firm, portfolio) are easy money on the side; the online store is the pitch. Shout about the store depth already built — inventory, shipping, taxes, wholesale/B2B, multi-currency — most people don't know it's in there.

Grow for free: a "Made with Servlyy" badge on free sites, SEO/Google pages ("cheap Shopify alternative", "how to start an online store"), and partners (bookkeepers, agencies, maker communities) — not paid ads. Make the real money over time by taking a small cut of the sales flowing through the stores.

First few weeks: fix the bugs and turn analytics back on; lead the marketing with stores; let people see their finished site before the "pick a plan" step; add the badge + a refer-a-friend. Next couple months: make store sites load fast and rank in Google; start the SEO pages; line up a few partners. Later: take a cut of store sales, add a reseller/agency plan, then a templates store.$plan$,
  'building', 0, -100
FROM workspaces w
WHERE w.slug = 'servlyy'
  AND NOT EXISTS (
    SELECT 1 FROM ideas i
    WHERE i.workspace_id = w.id AND i.title = 'Servlyy business plan' AND i.deleted_at IS NULL
  );
