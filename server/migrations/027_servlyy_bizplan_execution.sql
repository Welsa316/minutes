-- The business plan covered strategy + money but not the build/launch order of
-- the actual work: the site's own design + logo, finishing themes, and when to
-- reach out to users. ADD these to the plan without touching the existing phases
-- — a new group appended at the end, plus a few steps added to Position/Grow.
-- (Recommended order is Now → Look the part → Position → Grow → …, but the new
--  group is appended so nothing existing is reordered; drag it earlier in-app.)

-- New group, appended after the current last phase (no reordering of existing ones).
INSERT INTO idea_phases (idea_id, title, note, sort_order)
SELECT i.id, 'Look the part',
  $q$Before you send anyone to the site, it has to look like software worth paying for — sort the brand, the storefront quality, and the pages people land on first. Best done early (right after "Now"); drag it up when you're ready.$q$,
  (SELECT COALESCE(MAX(p.sort_order), -1) + 1 FROM idea_phases p WHERE p.idea_id = i.id)
FROM ideas i JOIN workspaces w ON w.id = i.workspace_id AND w.slug = 'servlyy'
WHERE i.title = 'Servlyy business plan'
  AND NOT EXISTS (SELECT 1 FROM idea_phases p WHERE p.idea_id = i.id AND p.title = 'Look the part');

-- Steps for "Look the part".
INSERT INTO idea_steps (idea_id, phase_id, label, note, sort_order)
SELECT p.idea_id, p.id, st.label, st.note, st.ord
FROM idea_phases p
JOIN ideas i ON i.id = p.idea_id
JOIN workspaces w ON w.id = i.workspace_id AND w.slug = 'servlyy'
CROSS JOIN (VALUES
  ($q$Fix the logo and the Servlyy site's frontend design$q$, $q$First impressions decide whether people even try it. Make it look credible before anything else.$q$, 0),
  ($q$Finish a solid starter set of themes$q$, $q$Enough that any store looks great on day one — you don't need every theme yet, just a strong few.$q$, 1),
  ($q$Make the homepage + pricing page clear and confident$q$, $q$One promise, obvious pricing, a visible "try it" path.$q$, 2),
  ($q$Polish the demo / preview — it's your best sales tool$q$, NULL, 3)
) AS st(label, note, ord)
WHERE i.title = 'Servlyy business plan' AND p.title = 'Look the part'
  AND NOT EXISTS (SELECT 1 FROM idea_steps es WHERE es.phase_id = p.id);

-- Add the "when to reach out" + "expand themes / scale" steps onto the END of the
-- existing Position and Grow phases. Additive — existing steps are left as they are.
INSERT INTO idea_steps (idea_id, phase_id, label, note, sort_order)
SELECT p.idea_id, p.id, st.label, st.note,
       (SELECT COALESCE(MAX(sort_order), -1) FROM idea_steps es WHERE es.phase_id = p.id) + 1 + st.ord
FROM idea_phases p
JOIN ideas i ON i.id = p.idea_id
JOIN workspaces w ON w.id = i.workspace_id AND w.slug = 'servlyy'
CROSS JOIN (VALUES
  ($q$Position — lead with stores$q$, $q$Reach out to your first 10–20 likely users (makers, small shops, friends-of-friends)$q$, $q$Small and personal — you're learning, not scaling yet.$q$, 0),
  ($q$Position — lead with stores$q$, $q$Onboard ~5 as design partners; watch them build and fix what trips them up$q$, $q$Their stumbles are your real roadmap.$q$, 1),
  ($q$Position — lead with stores$q$, $q$Turn 3 of their stores into examples you can show off$q$, NULL, 2),
  ($q$Grow — get discovered$q$, $q$Expand the theme library for the next store type once one is working$q$, $q$Add themes where demand shows up, not all upfront.$q$, 0),
  ($q$Grow — get discovered$q$, $q$Reach out at scale — niche communities, groups, cold outreach$q$, $q$Only once the funnel actually converts.$q$, 1)
) AS st(phase_title, label, note, ord)
WHERE i.title = 'Servlyy business plan' AND st.phase_title = p.title
  AND NOT EXISTS (SELECT 1 FROM idea_steps es WHERE es.phase_id = p.id AND es.label = st.label);
