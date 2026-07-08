-- "Servlyy — faster & easier" was seeded as an engineering/performance plan
-- (SSG, caching, auth, bundle budgets). It was meant to be about the STORE
-- OWNER'S experience — the design and flow that make THEIR onboarding faster and
-- easier. Replace the technical content with a user-facing UX/onboarding plan.

-- Remove the old (technical) phases + their steps for this idea.
-- Idempotent: skipped once the new user-facing plan is in place.
DELETE FROM idea_phases p
USING ideas i, workspaces w
WHERE p.idea_id = i.id
  AND i.workspace_id = w.id AND w.slug = 'servlyy'
  AND i.title = 'Servlyy — faster & easier'
  AND NOT EXISTS (
    SELECT 1 FROM idea_phases p2 JOIN ideas i2 ON i2.id = p2.idea_id
    JOIN workspaces w2 ON w2.id = i2.workspace_id AND w2.slug = 'servlyy'
    WHERE i2.title = 'Servlyy — faster & easier' AND p2.title = 'See it before you sign up'
  );

-- New, user-facing pitch.
UPDATE ideas i SET note = $note$Make it effortless for a store owner to go from "I have something to sell" to a live, good-looking store. Fewer steps, smart defaults, a design that looks great with no skill, and guidance that teaches as they go — the value should be felt before they ever pick a plan.$note$
FROM workspaces w
WHERE i.workspace_id = w.id AND w.slug = 'servlyy' AND i.title = 'Servlyy — faster & easier';

-- User-facing phases.
INSERT INTO idea_phases (idea_id, title, note, sort_order)
SELECT i.id, ph.title, ph.note, ph.ord
FROM ideas i
JOIN workspaces w ON w.id = i.workspace_id AND w.slug = 'servlyy'
CROSS JOIN (VALUES
  ($q$See it before you sign up$q$, $q$Deliver the "wow" before the paywall — let people watch their own store appear from almost nothing.$q$, 0),
  ($q$A shorter path to live$q$, $q$Trim setup to the few things that actually matter to go live; defer the rest. No forced plan-picker up front.$q$, 1),
  ($q$Adding products, painlessly$q$, $q$Adding products is the core chore — make it a few taps, not a form marathon.$q$, 2),
  ($q$Looks great with zero design skill$q$, $q$Themes that are beautiful out of the box, personalised in one tap from their brand.$q$, 3),
  ($q$Go live with confidence, then keep going$q$, $q$Make "Publish" a clear, reassuring moment — and keep guiding after launch.$q$, 4)
) AS ph(title, note, ord)
WHERE i.title = 'Servlyy — faster & easier'
  AND NOT EXISTS (SELECT 1 FROM idea_phases p WHERE p.idea_id = i.id);

-- Steps (with a short detail note where it helps).
INSERT INTO idea_steps (idea_id, phase_id, label, note, sort_order)
SELECT p.idea_id, p.id, st.label, st.note, st.ord
FROM idea_phases p
JOIN ideas i ON i.id = p.idea_id
JOIN workspaces w ON w.id = i.workspace_id AND w.slug = 'servlyy'
CROSS JOIN (VALUES
  ($q$See it before you sign up$q$, $q$Ask two things first: store name + what you sell$q$, NULL, 0),
  ($q$See it before you sign up$q$, $q$Generate a real, styled starter store instantly$q$, $q$Theme + sample products, using their name. Seeing their own store is the moment they commit.$q$, 1),
  ($q$See it before you sign up$q$, $q$Show that preview before asking to sign up or pick a plan$q$, NULL, 2),
  ($q$See it before you sign up$q$, $q$Start from a store type (fashion, food, digital…), never a blank page$q$, NULL, 3),
  ($q$A shorter path to live$q$, $q$Replace the long wizard with a "3 steps to go live" checklist$q$, $q$Do them in any order; show what's left, not a rigid sequence.$q$, 0),
  ($q$A shorter path to live$q$, $q$Pre-fill payments, shipping, and policies with sensible defaults$q$, $q$Editable later — don't make setup a prerequisite to seeing progress.$q$, 1),
  ($q$A shorter path to live$q$, $q$Drop the forced "choose a plan" step — build first, decide later (reverse trial)$q$, NULL, 2),
  ($q$A shorter path to live$q$, $q$Auto-save everything so progress is never lost$q$, NULL, 3),
  ($q$Adding products, painlessly$q$, $q$Quick-add: name, price, photo → done$q$, NULL, 0),
  ($q$Adding products, painlessly$q$, $q$Drag-and-drop photos with auto-crop and cleanup$q$, NULL, 1),
  ($q$Adding products, painlessly$q$, $q$One-tap "duplicate" to spin up variants$q$, NULL, 2),
  ($q$Adding products, painlessly$q$, $q$Suggest a product description from the title/photo (optional)$q$, NULL, 3),
  ($q$Adding products, painlessly$q$, $q$Bulk import from a spreadsheet for people switching over$q$, $q$The #1 unblock for anyone leaving Shopify/Etsy.$q$, 4),
  ($q$Looks great with zero design skill$q$, $q$Curated themes that look finished on day one$q$, NULL, 0),
  ($q$Looks great with zero design skill$q$, $q$One-tap style: pull colours + fonts from their logo$q$, NULL, 1),
  ($q$Looks great with zero design skill$q$, $q$Live editing — see every change instantly, with a mobile preview$q$, NULL, 2),
  ($q$Looks great with zero design skill$q$, $q$Pre-arranged sections (hero, featured, about, contact) they can tweak$q$, NULL, 3),
  ($q$Go live with confidence, then keep going$q$, $q$A "you're ready to launch" checklist + a test order$q$, NULL, 0),
  ($q$Go live with confidence, then keep going$q$, $q$Guided domain connect (or a free subdomain to start)$q$, NULL, 1),
  ($q$Go live with confidence, then keep going$q$, $q$One clear Publish moment with share links (social, WhatsApp, QR)$q$, NULL, 2),
  ($q$Go live with confidence, then keep going$q$, $q$After launch, a "next best step" nudge (first sale, more products, email signup)$q$, NULL, 3),
  ($q$Go live with confidence, then keep going$q$, $q$Teach-as-you-go tips and friendly empty states instead of a docs wall$q$, NULL, 4)
) AS st(phase_title, label, note, ord)
WHERE i.title = 'Servlyy — faster & easier' AND st.phase_title = p.title
  AND NOT EXISTS (SELECT 1 FROM idea_steps es WHERE es.phase_id = p.id);
