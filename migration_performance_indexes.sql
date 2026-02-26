-- ==========================================
-- PERFORMANCE OPTIMIZATION INDEXES
-- Critical for 40+ concurrent users
-- ==========================================

-- Index on brigades.game_id (used in all brigade queries)
CREATE INDEX IF NOT EXISTS idx_brigades_game_id ON public.brigades(game_id);

-- Index on players.brigade_id (used to load players per brigade)
CREATE INDEX IF NOT EXISTS idx_players_brigade_id ON public.players(brigade_id);

-- Index on inventory.brigade_id (used in realtime updates)
CREATE INDEX IF NOT EXISTS idx_inventory_brigade_id ON public.inventory(brigade_id);

-- Composite index on inventory for slot queries
CREATE INDEX IF NOT EXISTS idx_inventory_brigade_slot ON public.inventory(brigade_id, slot_index);

-- Index on recipe_notes.brigade_id (used to load recipe notes)
CREATE INDEX IF NOT EXISTS idx_recipe_notes_brigade_id ON public.recipe_notes(brigade_id);

-- Composite index on recipe_notes for step queries
CREATE INDEX IF NOT EXISTS idx_recipe_notes_brigade_step ON public.recipe_notes(brigade_id, step_index);

-- Index on game_logs.game_id (used for event feed)
CREATE INDEX IF NOT EXISTS idx_game_logs_game_id ON public.game_logs(game_id);

-- Index on game_logs.created_at for chronological queries
CREATE INDEX IF NOT EXISTS idx_game_logs_created_at ON public.game_logs(created_at DESC);

-- Composite index on game_logs for filtered queries
CREATE INDEX IF NOT EXISTS idx_game_logs_game_created ON public.game_logs(game_id, created_at DESC);

-- Index on recipe_tests.brigade_id (used for rankings)
CREATE INDEX IF NOT EXISTS idx_recipe_tests_brigade_id ON public.recipe_tests(brigade_id);

-- Composite index on recipe_tests for best score queries
CREATE INDEX IF NOT EXISTS idx_recipe_tests_brigade_score ON public.recipe_tests(brigade_id, global_score DESC);

-- Index on staff.game_id (used to fetch staff code)
CREATE INDEX IF NOT EXISTS idx_staff_game_id ON public.staff(game_id);

-- Index on brigades.code for login lookups
CREATE INDEX IF NOT EXISTS idx_brigades_code ON public.brigades(code);

-- Index on catalog_fragments.fragment_id for decrypt lookups
CREATE INDEX IF NOT EXISTS idx_catalog_fragments_fragment_id ON public.catalog_fragments(fragment_id);

-- Analyze tables to update statistics
ANALYZE public.brigades;
ANALYZE public.players;
ANALYZE public.inventory;
ANALYZE public.recipe_notes;
ANALYZE public.game_logs;
ANALYZE public.recipe_tests;
ANALYZE public.staff;
ANALYZE public.catalog_fragments;
