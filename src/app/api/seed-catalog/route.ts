import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role to bypass RLS for seeding
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ROLES = [
    {
        title: "Le Chef",
        power_name: "Voix d'Or",
        description: "Seul autorisé à parler si silence imposé. +15s sur les épreuves orales.",
        poste_ref: "Président"
    },
    {
        title: "Le Bras Droit",
        power_name: "Renfort",
        description: "Peut rejoindre n'importe quel contest en membre supplémentaire (ex: Min 2 devient Min 3).",
        poste_ref: "Chef de Projet"
    },
    {
        title: "Le Filet",
        power_name: "Seconde Chance",
        description: "Droit à un nouvel essai sans pénalité après une erreur (1x par contest).",
        poste_ref: "Secrétaire Général"
    },
    {
        title: "L'Éclaireur",
        power_name: "Vision",
        description: "Peut ajouter un bonus de 10 secondes 1 fois par contest.",
        poste_ref: "Resp. Commercial"
    },
    {
        title: "Le Contrôleur",
        power_name: "Vérification",
        description: "Demande à l'arbitre de confirmer UN élément avant validation finale (1x par contest).",
        poste_ref: "Resp. Qualité"
    },
    {
        title: "Le Décodeur",
        power_name: "Décryptage",
        description: "Reçoit un indice bonus ou un avantage de départ dans les épreuves de logique/code.",
        poste_ref: "DSI"
    },
    {
        title: "Le Négociateur",
        power_name: "Influence",
        description: "Force la coopération en Dilemme (1x/partie).",
        poste_ref: "Dév. Commercial"
    },
    {
        title: "L'Agent Double",
        power_name: "Perturbation",
        description: "Peut intégrer une autre équipe pendant un contest. Si cette équipe gagne, l'équipe de l'agent double gagne aussi (1x/partie).",
        poste_ref: "Resp. Communication"
    },
];

const CONTESTS = [
    {
        title: "1.1 — La Chaîne du Froid",
        description: "Mémoire | Min 1 | Relais (15m). Mémoriser une recette complexe (6, 8, 10 mots). Retour et dictée. Erreur = +15s. Classement au temps. Rôles utiles: Bras Droit, Filet, Contrôleur.",
        type: "Mémoire",
        effectif: "Min 1",
        roles_utiles: "Bras Droit, Filet, Contrôleur"
    },
    {
        title: "1.2 — Bataille Ballon",
        description: "Physique | Min 1 | Tournoi de ballon de baudruche dans une salle en bordel. Objectif: ne pas faire tomber la balle au sol. Rôles utiles: Chef, Bras Droit, Filet.",
        type: "Physique",
        effectif: "Min 1",
        roles_utiles: "Chef, Bras Droit, Filet"
    },
    {
        title: "1.3 — Times Up",
        description: "Social | Min 2 | 30 mots (3 manches : description libre, 1 mot, mime). 30s par tour. Classement au total de mots trouvés. Rôles utiles: Chef, Bras Droit, Agent Double.",
        type: "Social",
        effectif: "Min 2",
        roles_utiles: "Chef, Bras Droit, Agent Double"
    },
    {
        title: "2.1 — Dessin à l'Aveugle",
        description: "Coordination | Min 2 | Guide voit un schéma (20s) et guide ses coéquipiers sans voir leur travail. Dessinateurs muets. 5 dessins, 2min chacun. Rôles utiles: Chef, Éclaireur, Filet.",
        type: "Coordination",
        effectif: "Min 2",
        roles_utiles: "Chef, Éclaireur, Filet"
    },
    {
        title: "2.2 — Mr White",
        description: "Dilemme | Max 2 | Choix secret : COOPÉRER ou TRAHIR. Coop/Coop (1 frag ch.), Coop/Trahir (2 pour traître), Trahir/Trahir (0). Rôles utiles: Négociateur, Agent Double, Éclaireur.",
        type: "Dilemme",
        effectif: "Max 2",
        roles_utiles: "Négociateur, Agent Double, Éclaireur"
    },
    {
        title: "2.3 — La Carte Mémoire",
        description: "Mémoire | 3 joueurs | 5 manches. Mémoriser 3 à 10 cartes (30s) + mini-jeu (1min) + restitution. Score = cartes x perf mini-jeu. Rôles utiles: Décodeur, Contrôleur, Filet.",
        type: "Mémoire",
        effectif: "3 joueurs",
        roles_utiles: "Décodeur, Contrôleur, Filet"
    },
    {
        title: "3.1 — La Grille Fantôme",
        description: "Logique | Min 1 | Mots croisés 6x6. Trouver le mot secret via cases numérotées. Rôles utiles: Décodeur, Contrôleur, Filet.",
        type: "Logique",
        effectif: "Min 1",
        roles_utiles: "Décodeur, Contrôleur, Filet"
    },
    {
        title: "3.2 — Le Grand Débat",
        description: "Social | Min 1 | Débat sur sujets loufoques. 2min prépa / 1min30 de plaidoyer. Vote des autres brigades sur l'éloquence/humour. Rôles utiles: Chef, Négociateur, Agent Double.",
        type: "Social",
        effectif: "Min 1",
        roles_utiles: "Chef, Négociateur, Agent Double"
    },
    {
        title: "3.3 — Contest de Danse",
        description: "Coordination | Min 3 | Chorégraphie sur thème imposé. 4min prépa / 1min de perf. Jugé sur créativité, énergie et thème. Rôles utiles: Chef, Bras Droit, Éclaireur.",
        type: "Coordination",
        effectif: "Min 3",
        roles_utiles: "Chef, Bras Droit, Éclaireur"
    },
    {
        title: "4.1 — Passe à 10",
        description: "Physique | Min 2 | Match 1v1. Faire 10 passes consécutives pour marquer 1pt. 3 rounds de 1min30. Balle de tennis. Rôles utiles: Bras Droit, Filet, Chef.",
        type: "Physique",
        effectif: "Min 2",
        roles_utiles: "Bras Droit, Filet, Chef"
    },
    {
        title: "4.2 — Anagramme en Chaîne",
        description: "Logique | Min 1 | 5 anagrammes. Les lettres soulignées forment un mot final. Erreur = retour en bout de file (30s perdues). Rôles utiles: Décodeur, Contrôleur, Filet.",
        type: "Logique",
        effectif: "Min 1",
        roles_utiles: "Décodeur, Contrôleur, Filet"
    },
    {
        title: "4.3 — Le Black Jack",
        description: "Stratégie | Max 2 | Blackjack contre les autres brigades. 3 rounds. Se rapprocher de 21 sans dépasser. Cartes cachées. Rôles utiles: Éclaireur, Agent Double, Négociateur.",
        type: "Stratégie",
        effectif: "Max 2",
        roles_utiles: "Éclaireur, Agent Double, Négociateur"
    },
];

export async function POST() {
    try {
        // Clear existing roles and contests
        await supabase.from('catalog_roles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('catalog_contests').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        // Insert new roles
        const { error: rolesError } = await supabase.from('catalog_roles').insert(
            ROLES.map(r => ({
                title: r.title,
                power_name: r.power_name,
                description: r.description,
            }))
        );
        if (rolesError) throw rolesError;

        // Insert new contests
        const { error: contestsError } = await supabase.from('catalog_contests').insert(
            CONTESTS.map(c => ({
                title: c.title,
                description: c.description,
            }))
        );
        if (contestsError) throw contestsError;

        return NextResponse.json({
            success: true,
            message: `Seeded ${ROLES.length} roles and ${CONTESTS.length} contests successfully.`,
            roles: ROLES.map(r => r.title),
            contests: CONTESTS.map(c => c.title),
        });
    } catch (error: any) {
        console.error('[seed-catalog] Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({
        message: 'Send a POST request to seed the catalog with the 8 roles and 12 contests.',
        roles: ROLES.map(r => ({ title: r.title, power: r.power_name })),
        contests: CONTESTS.map(c => ({ title: c.title, type: c.type })),
    });
}
