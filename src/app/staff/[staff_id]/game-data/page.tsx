"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Database, Trophy, Shield, Puzzle, ChevronLeft, Info } from "lucide-react";

export default function GameDataPage() {
    const params = useParams();
    const router = useRouter();
    const staffId = params.staff_id as string;
    const [activeTab, setActiveTab] = useState("contests");
    const [catalogFragments, setCatalogFragments] = useState<any[]>([]);
    const [selectedFragment, setSelectedFragment] = useState<any>(null);
    const [isFragmentDialogOpen, setIsFragmentDialogOpen] = useState(false);

    useEffect(() => {
        const fetchFragments = async () => {
            const { data } = await supabase.from('catalog_fragments').select('*');
            if (data) setCatalogFragments(data);
        };
        fetchFragments();
    }, []);

    const handleFragmentClick = (fragmentId: string) => {
        const fragment = catalogFragments.find(f => f.fragment_id === fragmentId);
        if (fragment) {
            setSelectedFragment(fragment);
            setIsFragmentDialogOpen(true);
        }
    };

    const contests = [
        {
            id: "1.1",
            title: "LA CHAÎNE DU FROID",
            type: "Mémoire",
            effectif: "Min 1",
            rules: "Parcours aller-retour (faire un parcours long avec des obstacles et mouvements imposés). Au bout, une feuille retournée visible pendant 20 secondes. Elle contient une recette complexe. Le coureur mémorise autant qu'il peut puis revient dicter à un coéquipier qui note sur papier. Chaque mot faux ou mal placé ajoute 15 secondes de pénalité. Classement au temps total.",
            roles: ["Bras Droit : ajoute un 4e coureur, les séquences se répartissent sur plus de passages.", "Filet : un passage raté se refait sans la pénalité de 15 secondes.", "Éclaireur : +10 secondes de mémorisation sur l'un des passages (10s devient 20s).", "Contrôleur : avant la validation finale, demande à l'arbitre si la feuille contient des erreurs (oui/non)."],
            fragments: ["1er : K7M2 (étape 1) + U8K3 (étape 3)", "2e : L9F4 (étape 2)", "3e : Q9U5 (étape 10)"],
            materiel: "feuilles imprimées avec les séquences, papier, stylos."
        },
        {
            id: "1.2",
            title: "BATAILLE BALLON",
            type: "Physique",
            effectif: "Min 1",
            rules: "Tournoi de ballon (par défaut volley mais à voir en fonction de la balle). Il y a des tables qui font un filet au milieu. Même règles qu'au volley sauf que l'on ne peut pas frapper trop fort ni trop bas (toujours dépendant de la balle). Les matchs sont choisis au hasard équipe contre équipe.",
            roles: ["Bras Droit : ajoute un joueur.", "Filet : un joueur éliminé revient en jeu avec un nouveau ballon (une seule fois).", "Agent Double : rejoint une autre brigade pendant ce contest. Si cette brigade gagne, sa brigade d'origine gagne aussi les fragments (1x/partie)."],
            fragments: ["1er : X9D4 (étape 4) + C5E8 (étape 5)", "2e : L6K5 (étape 6)"],
            materiel: "ballons légers, zone avec obstacles."
        },
        {
            id: "1.3",
            title: "TIMES UP",
            type: "Social",
            effectif: "Min 2",
            rules: "Paquet de 30 mots mêlant d'un times up classique. 3 manches avec le même paquet. Manche 1 : décrire librement sans dire le mot. Manche 2 : un seul mot autorisé. Manche 3 : mime uniquement, aucun son. Chaque brigade a 30 secondes par tour pour faire deviner un maximum de mots. Classement au total de mots devinés sur les 3 manches.",
            roles: ["Chef : +15 secondes dans un tour par manche (45s au lieu de 30s).", "Bras Droit : ajoute un tour de description supplémentaire par manche.", "Éclaireur : +10 secondes dans un tour par manche (donc dans les 3 manches)."],
            fragments: ["Gagnant : E7W2 (étape 3) + X4T5 (étape 8) + S3O2 (étape 10)"],
            materiel: "30 cartes mots imprimées, chronomètre."
        },
        {
            id: "2.1",
            title: "LE DESSIN À L'AVEUGLE",
            type: "Coordination",
            effectif: "Min 2",
            rules: "Un membre (le guide) voit un dessin complexe pendant 20 secondes. Il doit ensuite guider verbalement ses coéquipiers pour le reproduire sur une feuille. Le guide ne voit PAS ce que les dessinateurs font. Les dessinateurs ne peuvent PAS parler. 5 dessins successifs, 2 minutes par dessin. Scoring : nombre total d'éléments correctement placés sur les 5 dessins. S'il y a plus de 2 membres d'une même équipe, tous les membres (or guide) peuvent dessiner en même temps et le meilleur dessin comptera.",
            roles: ["Chef : En tant que dessinateur, il peut parler au guide.", "Éclaireur : +10 secondes de visionnage sur un dessin de son choix (20s devient 30s).", "Filet : si un dessin est raté, la brigade peut le refaire (le guide revoit l'image 10 secondes).", "Contrôleur : avant la validation d'un dessin, demande à l'arbitre si un élément spécifique est bien placé."],
            fragments: ["1er : S4U6 (étape 5) + M2X7 (étape 6)", "2e : P7V3 (étape 7)", "3e : N7P4 (étape 9)"],
            materiel: "dessins imprimés, feuilles blanches, stylos."
        },
        {
            id: "2.2",
            title: "MR WHITE",
            type: "Dilemme",
            effectif: "Max 2",
            rules: "Le règle du Mr White classique a adapté en fonction du nombre de joueurs. Faire plusieurs manches rapidement pour avoir de la disparité dans les scores cumulés de chacun.",
            roles: ["Négociateur : force la coopération mutuelle (avant le début de la manche)."],
            fragments: ["En jeu : D3Q8 (étape 2) + A5Q1 (étape 7)"],
            materiel: "papiers, stylos."
        },
        {
            id: "2.3",
            title: "LA CARTE MÉMOIRE",
            type: "Mémoire",
            effectif: "3",
            rules: "5 manches. À chaque manche, le joueur annonce combien de cartes il va mémoriser. Il voit les cartes pendant 30 secondes. Puis un mini-jeu d'1 minute (calcul mental, questions flash, petit défi physique). Après le mini-jeu, il doit restituer ses cartes dans l'ordre. Score = nombre de cartes restituées correctement multiplié par 1,x (x dépend de la position dans le classement : 1er = 5, 2e = 4 ect… - A adapter en fonction des circonstances). Les 3 membres se relaient. Classement au score total.",
            roles: ["Éclaireur : +10 secondes de mémorisation sur une manche (30s devient 40s).", "Contrôleur : après restitution, demande à l'arbitre si UNE carte précise est au bon endroit ou combien de cartes le son.", "Filet : restitution incorrecte refaite une fois sans relancer le mini-jeu.", "Décodeur : pendant le mini-jeu de calcul/logique, reçoit un indice bonus de l'arbitre."],
            fragments: ["1er : Z6L3 (étape 8) + R4D8 (étape 7)", "2e : K5R9 (étape 9)", "3e : W1J6 (étape 1)"],
            materiel: "jeux de cartes ou cartes imprimées, papier, stylos."
        },
        {
            id: "3.1",
            title: "LA GRILLE FANTÔME",
            type: "Logique",
            effectif: "Min 1",
            rules: "Grille de mots croisés 6x6. Les définitions mélangent gastronomie et entrepreneuriat. Les cases numérotées forment un mot secret quand on les lit dans l'ordre. Première brigade à soumettre le mot correct gagne.",
            roles: ["Décodeur : reçoit une grille avec 2 réponses pré-remplies.", "Contrôleur : demande à l'arbitre si UN mot de la grille est correct avant de soumettre.", "Filet : première soumission incorrecte sans pénalité de 20 pts.", "Bras Droit : ajoute un membre pour résoudre en équipe."],
            fragments: ["1er : P4X9 (étape 1) + Z4P6 (étape 3)", "2e : F7Y2 (étape 5)"],
            materiel: "grilles imprimées, stylos."
        },
        {
            id: "3.2",
            title: "LE GRAND DÉBAT",
            type: "Social",
            effectif: "Min 1",
            rules: "L'arbitre impose 2 sujets de débat loufoques. 1 minutes de préparation. Chaque brigade a 1 minute pour défendre sa position et 2min pour débattre. Les autres brigades du pool votent pour le discours le plus convaincant et divertissant. Classement par nombre de votes.",
            roles: ["Chef : +15 secondes de plaidoyer (1min30 devient 1min45).", "Éclaireur : +10 secondes de préparation ou de plaidoyer (au choix).", "Bras Droit : ajoute un orateur. Deux voix dans un débat = plus d'impact.", "Agent Double : rejoint une autre brigade pendant ce débat. Si cette brigade gagne le vote, sa brigade d'origine gagne aussi les fragments (1x/partie)."],
            fragments: ["Tour 1 : H2V7 (étape 2)", "Tour 2 : W3G9 (étape 6)", "Tour 3 : B1W8 (étape 8)"],
            materiel: "sujets de débat imprimés."
        },
        {
            id: "3.3",
            title: "LE CONTEST DE DANSE",
            type: "Coordination",
            effectif: "Min 3",
            rules: "L'arbitre impose un thème musical et stylistique. 4 minutes de préparation. Chaque brigade performe pendant 1 minute. Les autres brigades et l'arbitre jugent sur créativité, coordination, énergie et respect du thème. Classement par notes.",
            roles: ["Bras Droit : ajoute un danseur. Plus de corps = chorégraphie plus spectaculaire.", "Éclaireur : +10 secondes de performance (1min devient 1min10).", "Contrôleur : demande à l'arbitre un feedback sur un aspect de la chorégraphie avant la performance finale (\"Est-ce que notre formation est lisible ?\")."],
            fragments: ["1er : J2H7 (étape 4) + D8M1 (étape 9)", "2e : V6R5 (étape 4)", "3e : F1I8 (étape 10)"],
            materiel: "enceinte bluetooth, playlist musicale."
        },
        {
            id: "4.1",
            title: "PASSE À 10",
            type: "Physique",
            effectif: "Min 2",
            rules: "Match en 1 contre 1 équipe avec une balle de tennis. Compléter le plus de passes consécutives. Interception = l'adversaire prend la main. 3 rounds de 1 minute 30. Classement au score total. Plus on envoie de joueurs, plus les passes sont faciles.",
            roles: ["Bras Droit : ajoute un joueur. Plus de cibles = avantage majeur.", "Filet : si la balle est interceptée, le compteur ne repart pas à 0 (une fois par round).", "Chef : +15 secondes sur un round de son choix (1min30 devient 1min45).", "Éclaireur : +10 secondes sur un round de son choix."],
            fragments: ["En jeu : R8B3 (étape 1) + Y6C5 (étape 2) + Y9F4 (étape 7). Distribution selon classement."],
            materiel: "balle de tennis, zone de jeu délimitée."
        },
        {
            id: "4.2",
            title: "L'ANAGRAMME EN CHAÎNE",
            type: "Logique",
            effectif: "Min 1",
            rules: "Feuille avec 5 anagrammes culinaires/entrepreneuriales. Chaque solution donne une lettre soulignée. Les 5 lettres forment un mot final. Première brigade à soumettre le mot correct gagne. Soumission incorrecte = retour en bout de file (30 secondes perdues). Plus de membres = on se répartit les anagrammes.",
            roles: ["Décodeur : l'arbitre lui donne la réponse de l'anagramme la plus difficile.", "Contrôleur : vérifie si UNE anagramme est correctement résolue avant de soumettre.", "Filet : soumission incorrecte sans retour en file, re-soumission immédiate.", "Bras Droit : ajoute un membre pour se répartir le travail."],
            fragments: ["1er : N5L8 (étape 3) + E9H2 (étape 8)", "2e : G2Y7 (étape 9)"],
            materiel: "feuilles imprimées, brouillon, stylos."
        },
        {
            id: "4.3",
            title: "LE BLACK JACK",
            type: "Stratégie",
            effectif: "Max 2",
            rules: "Blackjack entre brigades. 3 rounds. Max 2 joueurs sur la table par équipe. Les autres joueurs peuvent aider ou échanger de place.",
            roles: ["Contrôleur : demande à l'arbitre si son total actuel est supérieur ou inférieur à celui de la banque.", "Filet : si dépassement de 21, annule le round et recommence avec de nouvelles cartes (une seule fois).", "Agent Double : rejoint une autre brigade pendant ce contest. Si cette brigade gagne, sa brigade d'origine gagne aussi les fragments (1x/partie)."],
            fragments: ["Gagnant : I3Z1 (étape 5) + Q1M9 (étape 4) + H8J2 (étape 6) + I4Z6 (étape 10)"],
            materiel: "jeu de 52 cartes."
        }
    ];

    const roles = [
        { name: "Chef", description: "Bonus de temps ou capacités de communication spéciales" },
        { name: "Bras Droit", description: "Ajoute un membre/joueur/tour supplémentaire" },
        { name: "Éclaireur", description: "Bonus de temps de mémorisation/visionnage/performance" },
        { name: "Contrôleur", description: "Peut demander des validations/feedbacks à l'arbitre" },
        { name: "Filet", description: "Permet de refaire une action ratée sans pénalité" },
        { name: "Décodeur", description: "Reçoit des indices ou réponses de l'arbitre" },
        { name: "Négociateur", description: "Force la coopération mutuelle" },
        { name: "Agent Double", description: "Peut rejoindre une autre brigade et partager les gains" }
    ];

    const fragmentsDistribution = {
        "Cycle 1": [
            { contest: "1.1", fragments: ["K7M2", "U8K3", "L9F4", "Q9U5"] },
            { contest: "1.2", fragments: ["X9D4", "C5E8", "L6K5"] },
            { contest: "1.3", fragments: ["E7W2", "X4T5", "S3O2"] }
        ],
        "Cycle 2": [
            { contest: "2.1", fragments: ["S4U6", "M2X7", "P7V3", "N7P4"] },
            { contest: "2.2", fragments: ["D3Q8", "A5Q1"] },
            { contest: "2.3", fragments: ["Z6L3", "R4D8", "K5R9", "W1J6"] }
        ],
        "Cycle 3": [
            { contest: "3.1", fragments: ["P4X9", "Z4P6", "F7Y2"] },
            { contest: "3.2", fragments: ["H2V7", "W3G9", "B1W8"] },
            { contest: "3.3", fragments: ["J2H7", "D8M1", "V6R5", "F1I8"] }
        ],
        "Cycle 4": [
            { contest: "4.1", fragments: ["R8B3", "Y6C5", "Y9F4"] },
            { contest: "4.2", fragments: ["N5L8", "E9H2", "G2Y7"] },
            { contest: "4.3", fragments: ["I3Z1", "Q1M9", "H8J2", "I4Z6"] }
        ],
        "Cachés": [
            { contest: "Serre", fragments: ["T5N1", "A1G9", "B3T1", "G8A3", "O9B4", "T1N6", "U2S7", "J3C6", "V6A3", "O8B1"] }
        ]
    };

    const typeColors: Record<string, string> = {
        'Mémoire': 'text-blue-400 border-blue-400/30 bg-blue-400/10',
        'Physique': 'text-orange-400 border-orange-400/30 bg-orange-400/10',
        'Social': 'text-pink-400 border-pink-400/30 bg-pink-400/10',
        'Coordination': 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
        'Dilemme': 'text-red-400 border-red-400/30 bg-red-400/10',
        'Logique': 'text-purple-400 border-purple-400/30 bg-purple-400/10',
        'Stratégie': 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
    };

    return (
        <div className="min-h-screen flex flex-col p-4 md:p-8 bg-background relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1/4 h-1/4 bg-blue-500/5 rounded-full blur-3xl -z-10" />
            <div className="absolute bottom-0 left-0 w-1/4 h-1/4 bg-purple-500/5 rounded-full blur-3xl -z-10" />

            <header className="flex flex-col md:flex-row items-start md:items-center justify-between pb-4 md:pb-6 border-b border-white/10 mb-4 md:mb-6">
                <div className="mb-3 md:mb-0">
                    <h1 className="text-xl md:text-2xl lg:text-3xl font-black tracking-widest font-mono text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 flex items-center gap-2 md:gap-3">
                        <Database className="w-6 h-6 md:w-8 md:h-8 text-blue-500" />
                        GAME_DATA // RÉFÉRENCE
                    </h1>
                    <p className="text-muted-foreground font-mono text-xs md:text-sm mt-1">Contests, Rôles et Fragments</p>
                </div>
                <Button variant="outline" className="font-mono text-xs border-white/20 hover:bg-white/5" onClick={() => router.push(`/staff/${staffId}`)}>
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    RETOUR
                </Button>
            </header>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col w-full max-w-7xl mx-auto">
                <TabsList className="grid w-full grid-cols-3 bg-white/5 border border-white/10">
                    <TabsTrigger value="contests" className="data-[state=active]:bg-primary/20 font-mono text-xs md:text-sm">
                        <Trophy className="w-4 h-4 mr-2" />
                        CONTESTS
                    </TabsTrigger>
                    <TabsTrigger value="roles" className="data-[state=active]:bg-primary/20 font-mono text-xs md:text-sm">
                        <Shield className="w-4 h-4 mr-2" />
                        RÔLES
                    </TabsTrigger>
                    <TabsTrigger value="fragments" className="data-[state=active]:bg-primary/20 font-mono text-xs md:text-sm">
                        <Puzzle className="w-4 h-4 mr-2" />
                        FRAGMENTS
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="contests" className="space-y-6 flex-1 mt-6">
                    <div className="grid grid-cols-1 gap-6">
                        {[1, 2, 3, 4].map(cycle => {
                            const cycleContests = contests.filter(c => c.id.startsWith(`${cycle}.`));
                            return (
                                <Card key={cycle} className="glass-panel border-white/10 bg-background/50">
                                    <CardHeader className="border-b border-white/5">
                                        <CardTitle className="font-mono text-xl flex items-center gap-2">
                                            <Trophy className="w-5 h-5 text-purple-400" />
                                            CYCLE {cycle}
                                        </CardTitle>
                                        <CardDescription className="font-mono text-xs">
                                            {cycleContests.length} contests disponibles
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-6 space-y-6">
                                        {cycleContests.map(contest => (
                                            <div key={contest.id} className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/8 transition-colors">
                                                <div className="flex items-start gap-4 mb-4">
                                                    <div className="shrink-0 w-16 h-16 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
                                                        <span className="font-mono text-lg font-black text-purple-300">{contest.id}</span>
                                                    </div>
                                                    <div className="flex-1">
                                                        <h3 className="font-mono text-lg font-bold text-white mb-2">{contest.title}</h3>
                                                        <div className="flex flex-wrap gap-2 mb-3">
                                                            <Badge className={`font-mono text-xs border ${typeColors[contest.type]}`}>
                                                                {contest.type}
                                                            </Badge>
                                                            <Badge variant="outline" className="font-mono text-xs border-white/20 text-white/70">
                                                                {contest.effectif}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-4">
                                                    <div>
                                                        <h4 className="font-mono text-sm font-bold text-blue-400 mb-2">RÈGLES</h4>
                                                        <p className="text-sm text-white/80 leading-relaxed">{contest.rules}</p>
                                                    </div>

                                                    <div>
                                                        <h4 className="font-mono text-sm font-bold text-green-400 mb-2">RÔLES UTILES</h4>
                                                        <ul className="space-y-1">
                                                            {contest.roles.map((role, idx) => (
                                                                <li key={idx} className="text-sm text-white/70 pl-4 border-l-2 border-green-400/30">
                                                                    {role}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>

                                                    <div>
                                                        <h4 className="font-mono text-sm font-bold text-purple-400 mb-2">FRAGMENTS</h4>
                                                        <ul className="space-y-1">
                                                            {contest.fragments.map((frag, idx) => (
                                                                <li key={idx} className="text-sm text-white/70 font-mono pl-4 border-l-2 border-purple-400/30">
                                                                    {frag}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>

                                                    <div>
                                                        <h4 className="font-mono text-sm font-bold text-orange-400 mb-2">MATÉRIEL</h4>
                                                        <p className="text-sm text-white/70">{contest.materiel}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </TabsContent>

                <TabsContent value="roles" className="space-y-6 flex-1 mt-6">
                    <Card className="glass-panel border-white/10 bg-background/50">
                        <CardHeader className="border-b border-white/5">
                            <CardTitle className="font-mono text-xl flex items-center gap-2">
                                <Shield className="w-5 h-5 text-blue-400" />
                                CATALOGUE DES RÔLES
                            </CardTitle>
                            <CardDescription className="font-mono text-xs">
                                {roles.length} rôles disponibles dans le jeu
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {roles.map((role, idx) => (
                                    <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/8 transition-colors">
                                        <h3 className="font-mono text-lg font-bold text-white mb-2 flex items-center gap-2">
                                            <Shield className="w-5 h-5 text-blue-400" />
                                            {role.name}
                                        </h3>
                                        <p className="text-sm text-white/70 leading-relaxed">{role.description}</p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="glass-panel border-white/10 bg-background/50">
                        <CardHeader className="border-b border-white/5">
                            <CardTitle className="font-mono text-lg flex items-center gap-2">
                                <Trophy className="w-5 h-5 text-purple-400" />
                                UTILISATION PAR CONTEST
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <Table>
                                <TableHeader className="bg-white/5">
                                    <TableRow className="border-white/10 hover:bg-transparent">
                                        <TableHead className="font-mono text-primary">RÔLE</TableHead>
                                        <TableHead className="font-mono text-primary">CONTESTS</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {roles.map((role, idx) => {
                                        const usedIn = contests.filter(c => 
                                            c.roles.some(r => r.toLowerCase().includes(role.name.toLowerCase()))
                                        );
                                        return (
                                            <TableRow key={idx} className="border-white/10 hover:bg-white/5">
                                                <TableCell className="font-mono font-bold text-white">{role.name}</TableCell>
                                                <TableCell className="font-mono text-sm text-white/70">
                                                    {usedIn.map(c => c.id).join(', ') || 'Aucun'}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="fragments" className="space-y-6 flex-1 mt-6">
                    <Card className="glass-panel border-white/10 bg-background/50">
                        <CardHeader className="border-b border-white/5">
                            <CardTitle className="font-mono text-xl flex items-center gap-2">
                                <Puzzle className="w-5 h-5 text-purple-400" />
                                DISTRIBUTION DES FRAGMENTS
                            </CardTitle>
                            <CardDescription className="font-mono text-xs">
                                40 fragments distribués via contests + 10 cachés dans la Serre
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            {Object.entries(fragmentsDistribution).map(([cycleName, data]) => (
                                <div key={cycleName} className="bg-white/5 border border-white/10 rounded-xl p-6">
                                    <h3 className="font-mono text-lg font-bold text-white mb-4 flex items-center gap-2">
                                        {cycleName === "Cachés" ? <Puzzle className="w-5 h-5 text-yellow-400" /> : <Trophy className="w-5 h-5 text-purple-400" />}
                                        {cycleName}
                                    </h3>
                                    <div className="space-y-3">
                                        {data.map((item, idx) => (
                                            <div key={idx} className="bg-white/5 border border-white/8 rounded-lg p-4 hover:bg-white/8 transition-colors">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-mono text-sm font-bold text-purple-300">
                                                        Contest {item.contest}
                                                    </span>
                                                    <Badge variant="outline" className="font-mono text-xs border-purple-400/30 text-purple-300">
                                                        {item.fragments.length} fragments
                                                    </Badge>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {item.fragments.map((frag, fragIdx) => (
                                                        <button
                                                            key={fragIdx}
                                                            onClick={() => handleFragmentClick(frag)}
                                                            className="font-mono text-xs bg-purple-500/20 text-purple-200 px-3 py-1 rounded-full border border-purple-400/30 hover:bg-purple-500/30 hover:border-purple-400/50 transition-all cursor-pointer flex items-center gap-1"
                                                        >
                                                            {frag}
                                                            <Info className="w-3 h-3 opacity-60" />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card className="glass-panel border-white/10 bg-background/50">
                        <CardHeader className="border-b border-white/5">
                            <CardTitle className="font-mono text-lg flex items-center gap-2">
                                <Puzzle className="w-5 h-5 text-blue-400" />
                                RÉCAPITULATIF
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
                                    <div className="font-mono text-3xl font-black text-blue-400 mb-1">10</div>
                                    <div className="font-mono text-xs text-white/60">Cycle 1</div>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
                                    <div className="font-mono text-3xl font-black text-purple-400 mb-1">10</div>
                                    <div className="font-mono text-xs text-white/60">Cycle 2</div>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
                                    <div className="font-mono text-3xl font-black text-pink-400 mb-1">10</div>
                                    <div className="font-mono text-xs text-white/60">Cycle 3</div>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
                                    <div className="font-mono text-3xl font-black text-orange-400 mb-1">10</div>
                                    <div className="font-mono text-xs text-white/60">Cycle 4</div>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
                                    <div className="font-mono text-3xl font-black text-yellow-400 mb-1">10</div>
                                    <div className="font-mono text-xs text-white/60">Cachés</div>
                                </div>
                            </div>
                            <div className="mt-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-white/10 rounded-lg p-4 text-center">
                                <div className="font-mono text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 mb-1">50</div>
                                <div className="font-mono text-sm text-white/70">TOTAL FRAGMENTS</div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={isFragmentDialogOpen} onOpenChange={setIsFragmentDialogOpen}>
                <DialogContent className="max-w-2xl bg-background border-white/10">
                    <DialogHeader>
                        <DialogTitle className="font-mono text-2xl flex items-center gap-2">
                            <Puzzle className="w-6 h-6 text-purple-400" />
                            Fragment {selectedFragment?.fragment_id}
                        </DialogTitle>
                        <DialogDescription className="font-mono text-xs">
                            {selectedFragment?.type} • Niveau {selectedFragment?.level}
                        </DialogDescription>
                    </DialogHeader>
                    {selectedFragment && (
                        <div className="space-y-4 mt-4">
                            <div className="flex gap-2">
                                <Badge className="font-mono text-xs border border-purple-400/30 bg-purple-400/10 text-purple-300">
                                    Contest {selectedFragment.contest}
                                </Badge>
                                <Badge className="font-mono text-xs border border-blue-400/30 bg-blue-400/10 text-blue-300">
                                    Position: {selectedFragment.position}
                                </Badge>
                                <Badge className="font-mono text-xs border border-green-400/30 bg-green-400/10 text-green-300">
                                    Étape {selectedFragment.step}
                                </Badge>
                                {selectedFragment.is_coded && (
                                    <Badge className="font-mono text-xs border border-red-400/30 bg-red-400/10 text-red-300">
                                        Codé
                                    </Badge>
                                )}
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                                <h4 className="font-mono text-sm font-bold text-blue-400 mb-2">CONTENU</h4>
                                <p className="text-sm text-white/80 leading-relaxed">{selectedFragment.content}</p>
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                                <h4 className="font-mono text-sm font-bold text-green-400 mb-2">DÉCODAGE</h4>
                                <p className="text-sm text-white/80 leading-relaxed font-mono">{selectedFragment.decoding}</p>
                            </div>

                            {selectedFragment.notes && (
                                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                                    <h4 className="font-mono text-sm font-bold text-yellow-400 mb-2">NOTES</h4>
                                    <p className="text-sm text-white/70 leading-relaxed italic">{selectedFragment.notes}</p>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
