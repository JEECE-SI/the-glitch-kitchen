-- ==========================================
-- THE GLITCH KITCHEN - SUPABASE GLOBAL SCHEMA
-- ==========================================

-- 1. Table des parties (Games)
CREATE TABLE IF NOT EXISTS public.games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'setup', -- setup, active, finished
    active_contest VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Table des Brigades
CREATE TABLE IF NOT EXISTS public.brigades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
    code VARCHAR(10) UNIQUE NOT NULL, -- Le code de connexion à 4 ou 6 caractères
    name VARCHAR(255), -- Optionnel le nom de la brigade
    prestige_points INTEGER DEFAULT 100,
    role_capability VARCHAR(255), -- Le rôle / pouvoir affecté
    role_used BOOLEAN DEFAULT FALSE, -- Si le pouvoir a été utilisé
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Table des Notes de Recette (10 étapes par brigade)
CREATE TABLE IF NOT EXISTS public.recipe_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brigade_id UUID REFERENCES public.brigades(id) ON DELETE CASCADE,
    step_index INTEGER NOT NULL CHECK (step_index >= 1 AND step_index <= 10),
    fragments VARCHAR(255) DEFAULT '',
    notes TEXT DEFAULT '',
    UNIQUE(brigade_id, step_index)
);

-- 4. Table de l'Inventaire des fragments (15 slots par brigade)
CREATE TABLE IF NOT EXISTS public.inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brigade_id UUID REFERENCES public.brigades(id) ON DELETE CASCADE,
    slot_index INTEGER NOT NULL CHECK (slot_index >= 1 AND slot_index <= 15),
    fragment_data VARCHAR(255), -- Le fragment ou null si vide
    UNIQUE(brigade_id, slot_index)
);

-- ==========================================
-- POLITIQUES DE SÉCURITÉ (RLS)
-- ==========================================
-- Activation du Row Level Security
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brigades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- Pour l'instant on ouvre tout (à durcir si vous implémentez l'auth Supabase plus tard, 
-- mais pour une partie locale/entre amis les accès ouverts suffisent souvent)
CREATE POLICY "Allow public read/write access" ON public.games FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write access" ON public.brigades FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write access" ON public.recipe_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write access" ON public.inventory FOR ALL USING (true) WITH CHECK (true);


-- ==========================================
-- FONCTIONS ET TRIGGERS
-- ==========================================

-- Cette fonction génère automatiquement les 10 lignes de recette et 15 slots 
-- d'inventaire lorsqu'une nouvelle brigade est créée (lorsque insérée dans la base).
CREATE OR REPLACE FUNCTION public.handle_new_brigade()
RETURNS TRIGGER AS $$
BEGIN
  -- Création des 10 étapes de recette vides
  FOR i IN 1..10 LOOP
    INSERT INTO public.recipe_notes (brigade_id, step_index, fragments, notes)
    VALUES (NEW.id, i, '', '');
  END LOOP;

  -- Création des 15 slots d'inventaire vides
  FOR i IN 1..15 LOOP
    INSERT INTO public.inventory (brigade_id, slot_index, fragment_data)
    VALUES (NEW.id, i, NULL);
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Déclencheur sur la table brigades
DROP TRIGGER IF EXISTS on_brigade_created ON public.brigades;
CREATE TRIGGER on_brigade_created
  AFTER INSERT ON public.brigades
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_brigade();


-- ==========================================
-- REALTIME SUBSCRIPTIONS
-- Autorise Next.js à s'abonner aux changements des tables
-- ==========================================
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN 
    CREATE PUBLICATION supabase_realtime; 
  END IF; 
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.brigades;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recipe_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory;
