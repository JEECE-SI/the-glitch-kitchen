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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2.5 Table Staff (Game Masters)
CREATE TABLE IF NOT EXISTS public.staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
    code VARCHAR(10) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2.6 Table Recipe Tests (for scoring)
CREATE TABLE IF NOT EXISTS public.recipe_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brigade_id UUID REFERENCES public.brigades(id) ON DELETE CASCADE,
    global_score INTEGER DEFAULT 0,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2.7 Table des Joueurs (Players)
CREATE TABLE IF NOT EXISTS public.players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brigade_id UUID REFERENCES public.brigades(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(255), -- Le rôle attribué (ex: 'Chef de Brigade', 'L'Économe'...)
    role_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Table des Notes de Recette (10 étapes par brigade)
CREATE TABLE IF NOT EXISTS public.recipe_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brigade_id UUID REFERENCES public.brigades(id) ON DELETE CASCADE,
    step_index INTEGER NOT NULL CHECK (step_index >= 1 AND step_index <= 10),
    fragments VARCHAR(255) DEFAULT '',
    ingredient VARCHAR(255) DEFAULT '',
    technique VARCHAR(255) DEFAULT '',
    tool VARCHAR(255) DEFAULT '',
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

-- 5. Catalog of Roles
CREATE TABLE IF NOT EXISTS public.catalog_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    power_name VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 6. Catalog of Missions
CREATE TABLE IF NOT EXISTS public.catalog_missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 7. Catalog of Contests
CREATE TABLE IF NOT EXISTS public.catalog_contests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ==========================================
-- POLITIQUES DE SÉCURITÉ (RLS)
-- ==========================================
-- Activation du Row Level Security
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brigades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_contests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_tests ENABLE ROW LEVEL SECURITY;

-- Pour l'instant on ouvre tout (à durcir si vous implémentez l'auth Supabase plus tard, 
-- mais pour une partie locale/entre amis les accès ouverts suffisent souvent)
CREATE POLICY "Allow public read/write access" ON public.games FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write access" ON public.brigades FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write access" ON public.players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write access" ON public.recipe_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write access" ON public.inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write access" ON public.catalog_roles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write access" ON public.catalog_missions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write access" ON public.catalog_contests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write access" ON public.staff FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write access" ON public.recipe_tests FOR ALL USING (true) WITH CHECK (true);

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
    INSERT INTO public.recipe_notes (brigade_id, step_index, fragments, ingredient, technique, tool, notes)
    VALUES (NEW.id, i, '', '', '', '', '');
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
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recipe_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory;
ALTER PUBLICATION supabase_realtime ADD TABLE public.catalog_roles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.catalog_missions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.catalog_contests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recipe_tests;

-- ===============================
-- CATALOG TABLES
-- ===============================

CREATE TABLE IF NOT EXISTS public.catalog_recipe (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    step_index INTEGER NOT NULL,
    ingredient VARCHAR(255),
    technique VARCHAR(255),
    tool VARCHAR(255)
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.catalog_recipe) THEN
        INSERT INTO public.catalog_recipe (step_index, ingredient, technique, tool) VALUES
        (1, 'Farine + beurre', 'Sabler à froid', 'Corne de pâtissier'),
        (2, 'Eau + sel', 'Fraiser vigoureusement', 'Plan en marbre'),
        (3, 'Échine de porc', 'Hacher grossièrement', 'Feuille de boucher'),
        (4, 'Veau', 'Tailler en dés', 'Couteau d''office'),
        (5, 'Foie gras', 'Incorporer à la farce', 'Maryse en bois'),
        (6, 'Cognac', 'Flamber hors du feu', 'Louche en laiton'),
        (7, 'Épices', 'Assaisonner au dernier moment', 'Moulin à épices'),
        (8, 'Gelée de viande', 'Couler à chaud', 'Entonnoir à piston'),
        (9, 'Farce + pâte', 'Chemiser et monter', 'Cercle à pâté'),
        (10, 'Moule', 'Cuire longuement au four', 'Sonde thermique');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.catalog_fragments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fragment_id VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(100),
    content TEXT,
    decoding TEXT,
    level VARCHAR(50),
    contest VARCHAR(50),
    position VARCHAR(50),
    step VARCHAR(50),
    is_coded BOOLEAN,
    notes TEXT
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.catalog_fragments) THEN
        INSERT INTO public.catalog_fragments (fragment_id, type, content, decoding, level, contest, position, step, is_coded, notes) VALUES
        ('K7M2', 'Ingr+Tech', 'C''est par là que tout commence : farine et beurre, émiettés du bout des doigts jusqu''à obtenir du sable. Tout doit rester froid.', 'Farine + beurre / Sabler à froid / Position 1', '1', '1.1', '1er', '1', false, 'Direct avec position'),
        ('P4X9', 'Tech+Outil', 'Le tout premier geste de la recette se fait avec une corne de pâtissier, dans un mouvement qui rappelle la fabrication du sable.', 'Sabler / Corne de pâtissier / Position 1', '2', '3.1', '1er', '1', false, 'Position implicite'),
        ('W1J6', 'Ingr+Outil', 'Farine et beurre se travaillent à la corne de pâtissier.', 'Farine + beurre / Corne', '1', '2.3', '3e', '1', false, 'Pas de position'),
        ('R8B3', 'Complet codé', 'F_R_N_ + B__RR_ / S_BL_R À FR__D / C_RN_ D_ P_T_SS__R', 'Farine + beurre / Sabler à froid / Corne de pâtissier', '2', '4.1', '1er', '1', false, 'Complet codé, pas de position'),
        ('T5N1', 'Croisé', 'L''étape de la corne de pâtissier ouvre la recette. Elle précède immédiatement celle du plan en marbre.', 'Position 1 avant position 2', '3', 'Caché', '-', '1-2', false, 'Lie les outils des étapes 1 et 2'),
        ('D3Q8', 'Ingr+Tech', 'Juste après le sablage, on ajoute H₂O + NaCl puis on écrase la pâte d''un geste ferme de la paume. Deuxième étape.', 'Eau + sel / Fraiser / Position 2', '2', '2.2', '1er', '2', false, 'Position explicite'),
        ('L9F4', 'Tech+Outil', 'Deuxième étape : le fraisage vigoureux se fait en écrasant la pâte sur un plan en marbre.', 'Fraiser / Plan en marbre / Position 2', '1', '1.1', '2e', '2', false, 'Direct avec position'),
        ('H2V7', 'Ingr+Outil', 'Eau et sel rejoignent la pâte, travaillée sur un plan en marbre.', 'Eau + sel / Plan en marbre', '1', '3.4', '1er', '2', false, 'Pas de position'),
        ('Y6C5', 'Complet codé', 'ERBRAM NE NALP / TNEMESUERUOGIV RESIARF / LES + UAE', 'Eau + sel / Fraiser vigoureusement / Plan en marbre', '2', '4.2', '1er', '2', false, 'Complet codé'),
        ('A1G9', 'Croisé', 'La deuxième étape utilise un liquide salé et un plan de pierre. Elle suit le sablage et précède la première découpe de viande.', 'Position 2, entre 1 et 3', '3', 'Caché', '-', '1-2-2003', false, 'Lie trois étapes'),
        ('U8K3', 'Ingr+Tech', 'Troisième étape : le morceau persillé du haut du dos du porc est haché en morceaux grossiers.', 'Échine / Hacher grossièrement / Position 3', '1', '1.2', '1er', '3', false, 'Direct avec position'),
        ('Z4P6', 'Tech+Outil', 'Hacher grossièrement avec une feuille de boucher. C''est la première des deux découpes de viande.', 'Hacher / Feuille de boucher', '2', '3.2', '1er', '3', false, 'Position implicite'),
        ('E7W2', 'Ingr+Outil', 'L''échine de porc se travaille à la feuille de boucher.', 'Échine / Feuille de boucher', '1', '1.4', '1er', '3', false, 'Pas de position'),
        ('N5L8', 'Complet codé', 'CH_N D_ P_RC / H_CH_R GR_SS_ R_M_NT / F_ LL D_ B_ CH_R', 'Échine / Hacher grossièrement / Feuille de boucher', '2', '4.3', '1er', '3', false, 'Complet codé'),
        ('B3T1', 'Croisé', 'Les deux découpes de viande — porc puis veau — se suivent en positions 3 et 4.', 'Positions 3-4 confirmées', '3', 'Caché', '-', '3-4', false, 'Donne les deux positions'),
        ('X9D4', 'Ingr+Tech', 'En quatrième position, une viande de jeune bovin est taillée en dés réguliers.', 'Veau / Tailler en dés / Position 4', '1', '1.3', '1er', '4', false, 'Direct avec position'),
        ('J2H7', 'Tech+Outil', 'ECIFFO''D UAETUOC / SÉD NE RELLIAT', 'Tailler en dés / Couteau d''office', '2', '3.3', '1er', '4', false, 'Pas de position'),
        ('V6R5', 'Ingr+Outil', 'Le veau se découpe au couteau d''office, juste après le porc.', 'Veau / Couteau d''office / Position 4', '2', '3.4', '2e', '4', false, 'Position relative'),
        ('Q1M9', 'Complet', 'Quatrième étape : veau taillé en dés au couteau d''office.', 'Veau / Dés / Couteau / Position 4', '1', '4.1', '2e', '4', false, 'Complet direct, rare'),
        ('G8A3', 'Croisé', 'L''étape du couteau d''office suit celle de la feuille de boucher. Les deux sont dans la première moitié de la recette.', 'Positions 3-4', '3', 'Caché', '-', '3-4', false, 'Lie par les outils'),
        ('S4U6', 'Ingr+Tech', 'Un produit noble, celui des fêtes de fin d''année, est incorporé délicatement à la farce. Cinquième étape.', 'Foie gras / Incorporer / Position 5', '2', '2.1', '1er', '5', false, 'Position explicite'),
        ('F7Y2', 'Tech+Outil', 'Incorporer délicatement à la farce avec une maryse en bois, juste après les deux découpes.', 'Incorporer / Maryse / Position 5', '2', '3.1', '2e', '5', false, 'Position relative'),
        ('C5E8', 'Ingr+Outil', 'Le foie gras est travaillé à la maryse en bois.', 'Foie gras / Maryse', '1', '1.3', '1er', '5', false, 'Pas de position'),
        ('I3Z1', 'Complet codé', 'SIOB NE ESYRAM / ECRAF AL À REROPROCNI / SARG EIOF', 'Foie gras / Incorporer à la farce / Maryse en bois', '2', '4.4', '1er', '5', false, 'Complet codé'),
        ('O9B4', 'Croisé', 'Le produit noble et sa maryse interviennent en position 5, entre les découpes de viande et le flambage à l''alcool.', 'Position 5, entre 4 et 6', '3', 'Caché', '-', '4-5-2006', false, 'Lie trois étapes'),
        ('M2X7', 'Ingr+Tech', 'L''eau-de-vie ambrée des Charentes est enflammée hors du feu. Sixième étape, pile au milieu.', 'Cognac / Flamber / Position 6', '2', '2.3', '1er', '6', false, 'Position explicite'),
        ('L6K5', 'Tech+Outil', 'Flamber hors du feu à l''aide d''une louche en laiton.', 'Flamber / Louche en laiton', '1', '1.2', '2e', '6', false, 'Pas de position'),
        ('W3G9', 'Ingr+Outil', 'L C_GN_C S_ V_RS_ V_C N L CH N L T_N', 'Le cognac se verse avec une louche en laiton', '2', '3.4', '1er', '6', false, 'Pas de position'),
        ('H8J2', 'Complet', 'Sixième étape : cognac flambé hors du feu avec une louche en laiton, au centre de la recette.', 'Cognac / Flamber / Louche / Position 6', '1', '4.2', '2e', '6', false, 'Complet direct, rare'),
        ('T1N6', 'Croisé', 'La seule étape avec du feu vif est en position 6. Elle suit le foie gras et précède l''assaisonnement.', 'Position 6, entre 5 et 7', '3', 'Caché', '-', '5-6-2007', false, 'Lie trois étapes'),
        ('R4D8', 'Ingr+Tech', 'Des poudres aromatiques ajoutées au dernier moment, juste après le flambage. Septième étape.', 'Épices / Assaisonner / Position 7', '2', '3.2', '2e', '7', false, 'Position explicite'),
        ('P7V3', 'Tech+Outil', 'Assaisonner au dernier moment en utilisant un moulin à épices.', 'Assaisonner / Moulin', '1', '2.1', '2e', '7', false, 'Pas de position'),
        ('A5Q1', 'Ingr+Outil', 'Les épices passent par le moulin à épices, en septième position.', 'Épices / Moulin / Position 7', '2', '2.2', '2e', '7', false, 'Position explicite'),
        ('Y9F4', 'Complet codé', 'SECIPÉ À NILUOM / TNEMOM REINRED UA RENNOSSIASSA / SECIPÉ', 'Épices / Assaisonner au dernier moment / Moulin à épices', '2', '4.1', '3e', '7', false, 'Complet codé'),
        ('U2S7', 'Croisé', 'L''assaisonnement au moulin vient juste après les flammes de la louche en laiton et juste avant l''étape liquide. Position 7.', 'Position 7, entre 6 et 8', '3', 'Caché', '-', '6-7-2008', false, 'Lie trois étapes par les outils'),
        ('Z6L3', 'Ingr+Tech', 'Une gelée translucide d''os et de viande, coulée encore chaude. Huitième étape.', 'Gelée / Couler à chaud / Position 8', '2', '2.4', '1er', '8', false, 'Position explicite'),
        ('B1W8', 'Tech+Outil', 'Couler à chaud à l''aide d''un entonnoir à piston pour un versement précis.', 'Couler / Entonnoir', '1', '3.3', '2e', '8', false, 'Pas de position'),
        ('X4T5', 'Ingr+Outil', 'La gelée de viande est versée via un entonnoir à piston.', 'Gelée / Entonnoir', '1', '1.3', '2e', '8', false, 'Pas de position'),
        ('E9H2', 'Complet codé', 'G_L _ D_ V_ ND / C_ L_R À CH D / NT_NN R À P_ST_N', 'Gelée / Couler à chaud / Entonnoir à piston', '2', '4.3', '1er', '8', false, 'Complet codé'),
        ('J3C6', 'Croisé', 'La gelée et son entonnoir se situent en position 8, entre le moulin à épices et le cercle à pâté.', 'Position 8, entre 7 et 9', '3', 'Caché', '-', '7-8-2009', false, 'Lie trois étapes par les outils'),
        ('K5R9', 'Ingr+Tech', 'Farce et pâte se rencontrent enfin : on chemise et on monte le tout. Avant-dernière étape.', 'Farce + pâte / Chemiser et monter / Position 9', '2', '2.3', '2e', '9', false, 'Position implicite'),
        ('D8M1', 'Tech+Outil', 'Chemiser et monter dans un cercle à pâté, juste avant la cuisson finale.', 'Chemiser / Cercle à pâté / Position 9', '2', '3.2', '3e', '9', false, 'Position relative'),
        ('N7P4', 'Ingr+Outil', 'La farce et la pâte sont assemblées dans un cercle à pâté.', 'Farce + pâte / Cercle', '1', '2.1', '3e', '9', false, 'Pas de position'),
        ('G2Y7', 'Complet codé', 'ÉTÂP À ELCREC / RETNOM TE RESIMEHC / ETÂP + ECRAF', 'Farce + pâte / Chemiser et monter / Cercle à pâté', '2', '4.3', '2e', '9', false, 'Complet codé'),
        ('V6A3', 'Croisé', 'L''avant-dernière étape assemble tout dans un cercle à pâté, juste après la gelée à l''entonnoir et juste avant le four. Position 9.', 'Position 9, entre 8 et 10', '3', 'Caché', '-', '8-9-10', false, 'Lie trois étapes'),
        ('Q9U5', 'Ingr+Tech', 'Le moule entre au four pour une cuisson lente et prolongée. C''est la dernière étape de la recette.', 'Moule / Cuire longuement / Position 10', '1', '1.1', '3e', '10', false, 'Direct avec position'),
        ('F1I8', 'Tech+Outil', 'Cuire longuement au four en surveillant avec une sonde thermique. C''est la fin de la recette.', 'Cuire / Sonde / Position 10', '2', '2.4', '1er', '10', false, 'Position explicite'),
        ('S3O2', 'Ingr+Outil', 'Le moule est surveillé par une sonde thermique au four.', 'Moule / Sonde', '1', '1.4', '2e', '10', false, 'Pas de position'),
        ('I4Z6', 'Complet codé', 'M L / C R L_NG_ M_NT _ _ F R / S_ND TH_RM_Q_ _', 'Moule / Cuire longuement au four / Sonde thermique', '2', '4.4', '2e', '10', false, 'Complet codé'),
        ('O8B1', 'Croisé', 'La toute dernière étape utilise un four et le seul instrument de mesure de la recette. Elle suit le montage au cercle à pâté.', 'Position 10, après 9', '3', 'Caché', '-', '9-10', false, 'Confirme position finale'),
        ('F10E', 'Croisé', 'La toute dernière étape utilise un four et le seul instrument de mesure de la recette. Elle suit le montage au cercle à pâté.', 'Position 10, après 9', '3', 'Caché', '-', '9-10', false, 'Confirme position finale');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.game_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
    brigade_id UUID REFERENCES public.brigades(id) ON DELETE CASCADE,
    event_type VARCHAR(100),
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.catalog_recipe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_fragments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read/write access" ON public.catalog_recipe;
CREATE POLICY "Allow public read/write access" ON public.catalog_recipe FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write access" ON public.catalog_fragments;
CREATE POLICY "Allow public read/write access" ON public.catalog_fragments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write access" ON public.game_logs;
CREATE POLICY "Allow public read/write access" ON public.game_logs FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.catalog_recipe;
    EXCEPTION WHEN undefined_object OR duplicate_object THEN
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.catalog_fragments;
    EXCEPTION WHEN undefined_object OR duplicate_object THEN
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.game_logs;
    EXCEPTION WHEN undefined_object OR duplicate_object THEN
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.staff;
    EXCEPTION WHEN undefined_object OR duplicate_object THEN
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.recipe_tests;
    EXCEPTION WHEN undefined_object OR duplicate_object THEN
    END;
END $$;

-- ==========================================
-- PERFORMANCE OPTIMIZATION INDEXES
-- Critical for 40+ concurrent users
-- ==========================================

-- Index on brigades.game_id (used in all brigade queries)
CREATE INDEX IF NOT EXISTS idx_brigades_game_id ON public.brigades(game_id);

-- Index on brigades.code for login lookups
CREATE INDEX IF NOT EXISTS idx_brigades_code ON public.brigades(code);

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

-- Index on catalog_fragments.fragment_id for decrypt lookups
CREATE INDEX IF NOT EXISTS idx_catalog_fragments_fragment_id ON public.catalog_fragments(fragment_id);

-- Analyze tables to update statistics for query optimization
ANALYZE public.brigades;
ANALYZE public.players;
ANALYZE public.inventory;
ANALYZE public.recipe_notes;
ANALYZE public.game_logs;
ANALYZE public.recipe_tests;
ANALYZE public.staff;
ANALYZE public.catalog_fragments;
