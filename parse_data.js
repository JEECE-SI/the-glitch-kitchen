const fs = require('fs');

const recipeText = `1	Farine + beurre	Sabler à froid	Corne de pâtissier
2	Eau + sel	Fraiser vigoureusement	Plan en marbre
3	Échine de porc	Hacher grossièrement	Feuille de boucher
4	Veau	Tailler en dés	Couteau d'office
5	Foie gras	Incorporer à la farce	Maryse en bois
6	Cognac	Flamber hors du feu	Louche en laiton
7	Épices	Assaisonner au dernier moment	Moulin à épices
8	Gelée de viande	Couler à chaud	Entonnoir à piston
9	Farce + pâte	Chemiser et monter	Cercle à pâté
10	Moule	Cuire longuement au four	Sonde thermique`;

const fragmentsText = `1	K7M2	Ingr+Tech	C'est par là que tout commence : farine et beurre, émiettés du bout des doigts jusqu'à obtenir du sable. Tout doit rester froid.	Farine + beurre / Sabler à froid / Position 1	1	1.1	1er	1	Non	Direct avec position
2	P4X9	Tech+Outil	Le tout premier geste de la recette se fait avec une corne de pâtissier, dans un mouvement qui rappelle la fabrication du sable.	Sabler / Corne de pâtissier / Position 1	2	3.1	1er	1	Non	Position implicite
3	W1J6	Ingr+Outil	Farine et beurre se travaillent à la corne de pâtissier.	Farine + beurre / Corne	1	2.3	3e	1	Non	Pas de position
4	R8B3	Complet codé	F_R_N_ + B__RR_ / S_BL_R À FR__D / C_RN_ D_ P_T_SS__R	Farine + beurre / Sabler à froid / Corne de pâtissier	2	4.1	1er	1	Oui (voyelles retirées)	Complet codé, pas de position
5	T5N1	Croisé	L'étape de la corne de pâtissier ouvre la recette. Elle précède immédiatement celle du plan en marbre.	Position 1 avant position 2	3	Caché	-	1-2	Non	Lie les outils des étapes 1 et 2
6	D3Q8	Ingr+Tech	Juste après le sablage, on ajoute H₂O + NaCl puis on écrase la pâte d'un geste ferme de la paume. Deuxième étape.	Eau + sel / Fraiser / Position 2	2	2.2	1er	2	Partiellement (formule chimique)	Position explicite
7	L9F4	Tech+Outil	Deuxième étape : le fraisage vigoureux se fait en écrasant la pâte sur un plan en marbre.	Fraiser / Plan en marbre / Position 2	1	1.1	2e	2	Non	Direct avec position
8	H2V7	Ingr+Outil	Eau et sel rejoignent la pâte, travaillée sur un plan en marbre.	Eau + sel / Plan en marbre	1	3.4	1er	2	Non	Pas de position
9	Y6C5	Complet codé	ERBRAM NE NALP / TNEMESUERUOGIV RESIARF / LES + UAE	Eau + sel / Fraiser vigoureusement / Plan en marbre	2	4.2	1er	2	Oui (texte inversé)	Complet codé
10	A1G9	Croisé	La deuxième étape utilise un liquide salé et un plan de pierre. Elle suit le sablage et précède la première découpe de viande.	Position 2, entre 1 et 3	3	Caché	-	1-2-2003	Non	Lie trois étapes
11	U8K3	Ingr+Tech	Troisième étape : le morceau persillé du haut du dos du porc est haché en morceaux grossiers.	Échine / Hacher grossièrement / Position 3	1	1.2	1er	3	Non	Direct avec position
12	Z4P6	Tech+Outil	Hacher grossièrement avec une feuille de boucher. C'est la première des deux découpes de viande.	Hacher / Feuille de boucher	2	3.2	1er	3	Non	Position implicite
13	E7W2	Ingr+Outil	L'échine de porc se travaille à la feuille de boucher.	Échine / Feuille de boucher	1	1.4	1er	3	Non	Pas de position
14	N5L8	Complet codé	CH_N D_ P_RC / H_CH_R GR_SS_ R_M_NT / F_ LL D_ B_ CH_R	Échine / Hacher grossièrement / Feuille de boucher	2	4.3	1er	3	Oui (voyelles retirées)	Complet codé
15	B3T1	Croisé	Les deux découpes de viande — porc puis veau — se suivent en positions 3 et 4.	Positions 3-4 confirmées	3	Caché	-	3-4	Non	Donne les deux positions
16	X9D4	Ingr+Tech	En quatrième position, une viande de jeune bovin est taillée en dés réguliers.	Veau / Tailler en dés / Position 4	1	1.3	1er	4	Non	Direct avec position
17	J2H7	Tech+Outil	ECIFFO'D UAETUOC / SÉD NE RELLIAT	Tailler en dés / Couteau d'office	2	3.3	1er	4	Oui (texte inversé)	Pas de position
18	V6R5	Ingr+Outil	Le veau se découpe au couteau d'office, juste après le porc.	Veau / Couteau d'office / Position 4	2	3.4	2e	4	Non	Position relative
19	Q1M9	Complet	Quatrième étape : veau taillé en dés au couteau d'office.	Veau / Dés / Couteau / Position 4	1	4.1	2e	4	Non	Complet direct, rare
20	G8A3	Croisé	L'étape du couteau d'office suit celle de la feuille de boucher. Les deux sont dans la première moitié de la recette.	Positions 3-4	3	Caché	-	3-4	Non	Lie par les outils
21	S4U6	Ingr+Tech	Un produit noble, celui des fêtes de fin d'année, est incorporé délicatement à la farce. Cinquième étape.	Foie gras / Incorporer / Position 5	2	2.1	1er	5	Non	Position explicite
22	F7Y2	Tech+Outil	Incorporer délicatement à la farce avec une maryse en bois, juste après les deux découpes.	Incorporer / Maryse / Position 5	2	3.1	2e	5	Non	Position relative
23	C5E8	Ingr+Outil	Le foie gras est travaillé à la maryse en bois.	Foie gras / Maryse	1	1.3	1er	5	Non	Pas de position
24	I3Z1	Complet codé	SIOB NE ESYRAM / ECRAF AL À REROPROCNI / SARG EIOF	Foie gras / Incorporer à la farce / Maryse en bois	2	4.4	1er	5	Oui (texte inversé)	Complet codé
25	O9B4	Croisé	Le produit noble et sa maryse interviennent en position 5, entre les découpes de viande et le flambage à l'alcool.	Position 5, entre 4 et 6	3	Caché	-	4-5-2006	Non	Lie trois étapes
26	M2X7	Ingr+Tech	L'eau-de-vie ambrée des Charentes est enflammée hors du feu. Sixième étape, pile au milieu.	Cognac / Flamber / Position 6	2	2.3	1er	6	Non	Position explicite
27	L6K5	Tech+Outil	Flamber hors du feu à l'aide d'une louche en laiton.	Flamber / Louche en laiton	1	1.2	2e	6	Non	Pas de position
28	W3G9	Ingr+Outil	L C_GN_C S_ V_RS_ V_C N L CH N L T_N	Le cognac se verse avec une louche en laiton	2	3.4	1er	6	Oui (voyelles retirées)	Pas de position
29	H8J2	Complet	Sixième étape : cognac flambé hors du feu avec une louche en laiton, au centre de la recette.	Cognac / Flamber / Louche / Position 6	1	4.2	2e	6	Non	Complet direct, rare
30	T1N6	Croisé	La seule étape avec du feu vif est en position 6. Elle suit le foie gras et précède l'assaisonnement.	Position 6, entre 5 et 7	3	Caché	-	5-6-2007	Non	Lie trois étapes
31	R4D8	Ingr+Tech	Des poudres aromatiques ajoutées au dernier moment, juste après le flambage. Septième étape.	Épices / Assaisonner / Position 7	2	3.2	2e	7	Non	Position explicite
32	P7V3	Tech+Outil	Assaisonner au dernier moment en utilisant un moulin à épices.	Assaisonner / Moulin	1	2.1	2e	7	Non	Pas de position
33	A5Q1	Ingr+Outil	Les épices passent par le moulin à épices, en septième position.	Épices / Moulin / Position 7	2	2.2	2e	7	Non	Position explicite
34	Y9F4	Complet codé	SECIPÉ À NILUOM / TNEMOM REINRED UA RENNOSSIASSA / SECIPÉ	Épices / Assaisonner au dernier moment / Moulin à épices	2	4.1	3e	7	Oui (texte inversé)	Complet codé
35	U2S7	Croisé	L'assaisonnement au moulin vient juste après les flammes de la louche en laiton et juste avant l'étape liquide. Position 7.	Position 7, entre 6 et 8	3	Caché	-	6-7-2008	Non	Lie trois étapes par les outils
36	Z6L3	Ingr+Tech	Une gelée translucide d'os et de viande, coulée encore chaude. Huitième étape.	Gelée / Couler à chaud / Position 8	2	2.4	1er	8	Non	Position explicite
37	B1W8	Tech+Outil	Couler à chaud à l'aide d'un entonnoir à piston pour un versement précis.	Couler / Entonnoir	1	3.3	2e	8	Non	Pas de position
38	X4T5	Ingr+Outil	La gelée de viande est versée via un entonnoir à piston.	Gelée / Entonnoir	1	1.3	2e	8	Non	Pas de position
39	E9H2	Complet codé	G_L _ D_ V_ ND / C_ L_R À CH D / NT_NN R À P_ST_N	Gelée / Couler à chaud / Entonnoir à piston	2	4.3	1er	8	Oui (voyelles retirées)	Complet codé
40	J3C6	Croisé	La gelée et son entonnoir se situent en position 8, entre le moulin à épices et le cercle à pâté.	Position 8, entre 7 et 9	3	Caché	-	7-8-2009	Non	Lie trois étapes par les outils
41	K5R9	Ingr+Tech	Farce et pâte se rencontrent enfin : on chemise et on monte le tout. Avant-dernière étape.	Farce + pâte / Chemiser et monter / Position 9	2	2.3	2e	9	Non	Position implicite
42	D8M1	Tech+Outil	Chemiser et monter dans un cercle à pâté, juste avant la cuisson finale.	Chemiser / Cercle à pâté / Position 9	2	3.2	3e	9	Non	Position relative
43	N7P4	Ingr+Outil	La farce et la pâte sont assemblées dans un cercle à pâté.	Farce + pâte / Cercle	1	2.1	3e	9	Non	Pas de position
44	G2Y7	Complet codé	ÉTÂP À ELCREC / RETNOM TE RESIMEHC / ETÂP + ECRAF	Farce + pâte / Chemiser et monter / Cercle à pâté	2	4.3	2e	9	Oui (texte inversé)	Complet codé
45	V6A3	Croisé	L'avant-dernière étape assemble tout dans un cercle à pâté, juste après la gelée à l'entonnoir et juste avant le four. Position 9.	Position 9, entre 8 et 10	3	Caché	-	8-9-10	Non	Lie trois étapes
46	Q9U5	Ingr+Tech	Le moule entre au four pour une cuisson lente et prolongée. C'est la dernière étape de la recette.	Moule / Cuire longuement / Position 10	1	1.1	3e	10	Non	Direct avec position
47	F1I8	Tech+Outil	Cuire longuement au four en surveillant avec une sonde thermique. C'est la fin de la recette.	Cuire / Sonde / Position 10	2	2.4	1er	10	Non	Position explicite
48	S3O2	Ingr+Outil	Le moule est surveillé par une sonde thermique au four.	Moule / Sonde	1	1.4	2e	10	Non	Pas de position
49	I4Z6	Complet codé	M L / C R L_NG_ M_NT _ _ F R / S_ND TH_RM_Q_ _	Moule / Cuire longuement au four / Sonde thermique	2	4.4	2e	10	Oui (voyelles retirées)	Complet codé
50	O8B1	Croisé	La toute dernière étape utilise un four et le seul instrument de mesure de la recette. Elle suit le montage au cercle à pâté.	Position 10, après 9	3	Caché	-	9-10	Non	Confirme position finale
51	F10E	Croisé	La toute dernière étape utilise un four et le seul instrument de mesure de la recette. Elle suit le montage au cercle à pâté.	Position 10, après 9	3	Caché	-	9-10	Non	Confirme position finale`;

function escapeSql(str) {
    if (!str) return "''";
    return "'" + str.replace(/'/g, "''") + "'";
}

let sql = "-- ===============================\n-- CATALOG TABLES\n-- ===============================\n";

// Recipe
sql += "\nCREATE TABLE IF NOT EXISTS public.catalog_recipe (\n    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n    step_index INTEGER NOT NULL,\n    ingredient VARCHAR(255),\n    technique VARCHAR(255),\n    tool VARCHAR(255)\n);\n\n";
sql += "DO $$\nBEGIN\n    IF NOT EXISTS (SELECT 1 FROM public.catalog_recipe) THEN\n        INSERT INTO public.catalog_recipe (step_index, ingredient, technique, tool) VALUES\n";

const rLines = recipeText.trim().split('\n');
const rVals = rLines.map(line => {
    let [st, ing, tech, tool] = line.split('\t');
    return `        (${st}, ${escapeSql(ing)}, ${escapeSql(tech)}, ${escapeSql(tool)})`;
});
sql += rVals.join(",\n") + ";\n    END IF;\nEND $$;\n";

// Fragments
sql += "\nCREATE TABLE IF NOT EXISTS public.catalog_fragments (\n    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n    fragment_id VARCHAR(50) UNIQUE NOT NULL,\n    type VARCHAR(100),\n    content TEXT,\n    decoding TEXT,\n    level VARCHAR(50),\n    contest VARCHAR(50),\n    position VARCHAR(50),\n    step VARCHAR(50),\n    is_coded BOOLEAN,\n    notes TEXT\n);\n\n";

sql += "DO $$\nBEGIN\n    IF NOT EXISTS (SELECT 1 FROM public.catalog_fragments) THEN\n        INSERT INTO public.catalog_fragments (fragment_id, type, content, decoding, level, contest, position, step, is_coded, notes) VALUES\n";

const fLines = fragmentsText.trim().split('\n');
const fVals = fLines.map(line => {
    let parts = line.split('\t');
    let f_id = parts[1];
    let type = parts[2];
    let content = parts[3];
    let decoding = parts[4];
    let level = parts[5];
    let contest = parts[6];
    let pos = parts[7];
    let step = parts[8];
    let isCoded = parts[9] === 'Oui';
    let notes = parts[10];

    return `        (${escapeSql(f_id)}, ${escapeSql(type)}, ${escapeSql(content)}, ${escapeSql(decoding)}, ${escapeSql(level)}, ${escapeSql(contest)}, ${escapeSql(pos)}, ${escapeSql(step)}, ${isCoded}, ${escapeSql(notes)})`;
});
sql += fVals.join(",\n") + ";\n    END IF;\nEND $$;\n";

// Logs table
sql += "\nCREATE TABLE IF NOT EXISTS public.game_logs (\n    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n    game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,\n    brigade_id UUID REFERENCES public.brigades(id) ON DELETE CASCADE,\n    event_type VARCHAR(100),\n    message TEXT,\n    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())\n);\n";

sql += "\nALTER TABLE public.catalog_recipe ENABLE ROW LEVEL SECURITY;\n";
sql += "ALTER TABLE public.catalog_fragments ENABLE ROW LEVEL SECURITY;\n";
sql += "ALTER TABLE public.game_logs ENABLE ROW LEVEL SECURITY;\n";

sql += "CREATE POLICY \"Allow public read/write access\" ON public.catalog_recipe FOR ALL USING (true) WITH CHECK (true);\n";
sql += "CREATE POLICY \"Allow public read/write access\" ON public.catalog_fragments FOR ALL USING (true) WITH CHECK (true);\n";
sql += "CREATE POLICY \"Allow public read/write access\" ON public.game_logs FOR ALL USING (true) WITH CHECK (true);\n";
sql += "ALTER PUBLICATION supabase_realtime ADD TABLE public.catalog_recipe;\n";
sql += "ALTER PUBLICATION supabase_realtime ADD TABLE public.catalog_fragments;\n";
sql += "ALTER PUBLICATION supabase_realtime ADD TABLE public.game_logs;\n";

fs.writeFileSync('migration.sql', sql);
console.log('Migration generated.');
