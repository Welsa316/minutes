-- The first workspaces were seeded (004) with bare single-letter icons — "F" for
-- Freelance, "S" for Servlyy. The app now renders a set of minimalist line-icons
-- keyed by name, so those legacy letters fall through to raw text in the switcher
-- and portal. Migrate the known seeds to sensible icon keys, and default anything
-- else still on a bare letter (or with no icon) to the generic mark.
UPDATE workspaces SET icon = 'briefcase' WHERE slug = 'freelance' AND (icon IS NULL OR char_length(icon) <= 2);
UPDATE workspaces SET icon = 'rocket'    WHERE slug = 'servlyy'   AND (icon IS NULL OR char_length(icon) <= 2);
UPDATE workspaces SET icon = 'sparkles'  WHERE icon IS NULL OR char_length(icon) <= 2;
