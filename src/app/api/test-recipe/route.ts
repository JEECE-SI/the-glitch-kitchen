import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const maxDuration = 60;

// In-memory cache to prevent duplicate concurrent requests
const processingRequests = new Map<string, Promise<NextResponse>>();

const OPENROUTER_MODEL = "anthropic/claude-3.5-haiku";

// Lazy Supabase client initialization to avoid build-time errors
function getSupabaseClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    
    if (!supabaseUrl || !supabaseKey) {
        throw new Error("Supabase configuration missing");
    }
    
    return createClient(supabaseUrl, supabaseKey);
}

// -------------------------------------------------------------------
// Semantic level → bonus points (server-side, deterministic)
// -------------------------------------------------------------------
const SEMANTIC_BONUS: Record<string, number> = {
    EXACT: 40, // perfect synonym / same meaning in culinary context
    PROCHE: 28, // very close, near-equivalent
    PARTIEL: 16, // same broad culinary category
    INDIRECT: 6, // loosely related, same universe
    AUCUN: 0, // no relation, or empty (handled by VIDE)
};

const validLevel = (l: string): string => {
    const up = (l || "").toUpperCase().trim();
    return SEMANTIC_BONUS.hasOwnProperty(up) ? up : "AUCUN";
};

export async function POST(req: NextRequest) {
    try {
        // Rate limiting: max 3 requests per minute per IP (prevents API quota exhaustion)
        const rateLimitResult = await rateLimit(req, { interval: 60000, uniqueTokenPerInterval: 3 });
        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: `Trop de requêtes. Réessayez dans ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)}s.` },
                { 
                    status: 429,
                    headers: {
                        'X-RateLimit-Limit': '3',
                        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
                        'X-RateLimit-Reset': rateLimitResult.reset.toString(),
                    }
                }
            );
        }

        const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
        if (!OPENROUTER_API_KEY) {
            return NextResponse.json(
                { error: "OPENROUTER_API_KEY is not configured on the server." },
                { status: 500 }
            );
        }

        const body = await req.json();
        const { brigadeDbId, recipeSteps } = body;

        if (!brigadeDbId || !recipeSteps || !Array.isArray(recipeSteps)) {
            return NextResponse.json(
                { error: "Missing brigadeDbId or recipeSteps." },
                { status: 400 }
            );
        }

        // Request deduplication: prevent concurrent duplicate requests from same brigade
        const requestKey = `test-${brigadeDbId}`;
        if (processingRequests.has(requestKey)) {
            console.log(`[test-recipe] Duplicate request detected for brigade ${brigadeDbId}, returning cached promise`);
            return processingRequests.get(requestKey)!;
        }

        // Create promise for this request
        const requestPromise = (async () => {
            try {
                return await processRecipeTest(brigadeDbId, recipeSteps, OPENROUTER_API_KEY);
            } finally {
                // Clean up after 2 seconds
                setTimeout(() => processingRequests.delete(requestKey), 2000);
            }
        })();

        processingRequests.set(requestKey, requestPromise);
        return requestPromise;

    } catch (error: any) {
        console.error("Recipe test error:", error);
        return NextResponse.json(
            { error: "Erreur interne : " + (error.message || "Unknown") },
            { status: 500 }
        );
    }
}

async function processRecipeTest(brigadeDbId: string, recipeSteps: any[], openrouterApiKey: string): Promise<NextResponse> {
    try {
        const supabase = getSupabaseClient();

        // --- Max attempts check ---
        const { data: existingTests, error: testsFetchError } = await supabase
            .from("recipe_tests")
            .select("attempt_number")
            .eq("brigade_id", brigadeDbId)
            .order("attempt_number", { ascending: false })
            .limit(1);

        if (testsFetchError) console.error("Error fetching existing tests:", testsFetchError);

        const attemptCount = existingTests && existingTests.length > 0 ? existingTests[0].attempt_number : 0;
        if (attemptCount >= 3) {
            return NextResponse.json({ error: "Nombre maximum d'essais atteint (3/3)." }, { status: 403 });
        }

        // --- Fetch reference recipe ---
        const { data: realRecipe, error: recipeError } = await supabase
            .from("catalog_recipe")
            .select("*")
            .order("step_index", { ascending: true });

        if (recipeError || !realRecipe || realRecipe.length === 0) {
            return NextResponse.json({ error: "Could not fetch the reference recipe." }, { status: 500 });
        }

        const realRecipeFormatted = realRecipe.map((step: any) => ({
            step: step.step_index,
            ingredient: step.ingredient || "",
            technique: step.technique || "",
            tool: step.tool || "",
        }));

        const brigadeRecipeFormatted = recipeSteps.map(
            (step: any, index: number) => ({
                step: index + 1,
                ingredient: step.ingredient || "",
                technique: step.technique || "",
                tool: step.tool || "",
            })
        );

        // -------------------------------------------------------------------
        // SERVER-SIDE lexical base score [0.00 .. 60.00] — fully deterministic
        // Combines Levenshtein char-similarity (40%) + token overlap (60%)
        // -------------------------------------------------------------------
        const normalise = (s: string): string =>
            s.toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9\s]/g, " ")
                .replace(/\s+/g, " ").trim();

        const levenshtein = (a: string, b: string): number => {
            const m = a.length, n = b.length;
            const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
                Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
            );
            for (let i = 1; i <= m; i++)
                for (let j = 1; j <= n; j++)
                    dp[i][j] = a[i - 1] === b[j - 1]
                        ? dp[i - 1][j - 1]
                        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            return dp[m][n];
        };

        const lexicalBase = (ref: string, brigade: string): number => {
            if (!brigade.trim()) return 0;
            const r = normalise(ref);
            const b = normalise(brigade);
            const dist = levenshtein(r, b);
            const maxLen = Math.max(r.length, b.length);
            const charSim = maxLen === 0 ? 1 : Math.max(0, 1 - dist / maxLen);
            const refWords = r.split(/\s+/).filter(w => w.length > 1);
            const brigWords = b.split(/\s+/).filter(w => w.length > 1);
            let overlapRatio = 0;
            if (refWords.length > 0) {
                const matched = refWords.filter(w =>
                    brigWords.some(bw => bw === w || levenshtein(bw, w) <= Math.ceil(w.length * 0.2))
                ).length;
                overlapRatio = matched / refWords.length;
            }
            const combined = charSim * 0.40 + overlapRatio * 0.60;
            return Math.min(60, Math.round(combined * 60 * 100) / 100);
        };

        // Pre-compute lexical bases for all fields
        const preScores = brigadeRecipeFormatted.map((bs: any) => {
            const rs = realRecipeFormatted.find((r: any) => r.step === bs.step);
            if (!rs) return { step: bs.step, lex_i: 0, lex_t: 0, lex_o: 0 };
            return {
                step: bs.step,
                lex_i: !bs.ingredient.trim() ? 0 : lexicalBase(rs.ingredient, bs.ingredient),
                lex_t: !bs.technique.trim() ? 0 : lexicalBase(rs.technique, bs.technique),
                lex_o: !bs.tool.trim() ? 0 : lexicalBase(rs.tool, bs.tool),
            };
        });

        // -------------------------------------------------------------------
        // PROMPT OPTIMISÉ — Claude 3.5 Sonnet pour analyse ultra-précise
        // AI choisit des LABELS sémantiques (pas de nombres) → élimine la dérive numérique
        // Résultats cohérents et reproductibles avec température 0
        // -------------------------------------------------------------------
        const prompt = `Vous êtes un assistant expert en évaluation culinaire. Votre mission est d'analyser chaque étape de recette avec une précision maximale.

Pour chaque étape et chaque champ (ingrédient, technique, outil), choisissez UN SEUL label sémantique parmi cette liste EXACTE:
EXACT, PROCHE, PARTIEL, INDIRECT, AUCUN

DÉFINITIONS DES LABELS (soyez rigoureux et cohérent):

• EXACT: Synonyme parfait ou signification identique dans le contexte culinaire
  Exemples: "fouetter" = "battre", "sauteuse" = "poêle", "crème liquide" = "crème fraîche liquide"
  
• PROCHE: Signification très proche, quasi-équivalent, même famille de technique
  Exemples: "rissoler" ≈ "revenir", "marmite" ≈ "cocotte", "hacher" ≈ "émincer finement"
  
• PARTIEL: Même grande catégorie culinaire mais pas équivalent
  Exemples: "beurre" ~ "huile", "cuire" ~ "pocher", "couteau" ~ "hachoir"
  
• INDIRECT: Lien lointain, même univers culinaire mais différent
  Exemples: "sel" ~ "épices", "four" ~ "plaque", "bouillir" ~ "mijoter"
  
• AUCUN: Aucun lien sémantique OU le champ de la brigade est VIDE
  Exemples: "tomate" vs "chocolat", "" (vide), "mixer" vs "assiette"

RÈGLES CRITIQUES:
1. Si le champ de la brigade est vide ("") → TOUJOURS utiliser AUCUN, sans exception
2. Chaque choix de label doit refléter la comparaison de SENS, pas l'orthographe
3. L'orthographe/similarité lexicale est déjà calculée séparément par le système
4. Concentrez-vous UNIQUEMENT sur la sémantique culinaire
5. Soyez CONSTANT: même comparaison = même label, toujours

RECETTE DE RÉFÉRENCE (10 étapes):
${realRecipeFormatted
                .map((s: any) =>
                    `Étape ${s.step}: ingrédient="${s.ingredient}" | technique="${s.technique}" | outil="${s.tool}"`
                )
                .join("\n")}

RECETTE DE LA BRIGADE (à évaluer):
${brigadeRecipeFormatted
                .map((bs: any) => {
                    const rs = realRecipeFormatted.find((r: any) => r.step === bs.step) as any;
                    return `Étape ${bs.step}: ingrédient="${bs.ingredient}" (réf: "${rs?.ingredient ?? ""}") | technique="${bs.technique}" (réf: "${rs?.technique ?? ""}") | outil="${bs.tool}" (réf: "${rs?.tool ?? ""}")`;
                })
                .join("\n")}

FORMAT DE SORTIE: Répondez UNIQUEMENT avec un objet JSON valide, aucun autre texte:
{
  "steps": [
    {
      "step": 1,
      "ingredient_level": "AUCUN",
      "technique_level": "AUCUN",
      "tool_level": "AUCUN",
      "feedback": "une phrase factuelle en français, max 80 caractères"
    },
    { "step": 2, "ingredient_level": "AUCUN", "technique_level": "AUCUN", "tool_level": "AUCUN", "feedback": "" },
    { "step": 3, "ingredient_level": "AUCUN", "technique_level": "AUCUN", "tool_level": "AUCUN", "feedback": "" },
    { "step": 4, "ingredient_level": "AUCUN", "technique_level": "AUCUN", "tool_level": "AUCUN", "feedback": "" },
    { "step": 5, "ingredient_level": "AUCUN", "technique_level": "AUCUN", "tool_level": "AUCUN", "feedback": "" },
    { "step": 6, "ingredient_level": "AUCUN", "technique_level": "AUCUN", "tool_level": "AUCUN", "feedback": "" },
    { "step": 7, "ingredient_level": "AUCUN", "technique_level": "AUCUN", "tool_level": "AUCUN", "feedback": "" },
    { "step": 8, "ingredient_level": "AUCUN", "technique_level": "AUCUN", "tool_level": "AUCUN", "feedback": "" },
    { "step": 9, "ingredient_level": "AUCUN", "technique_level": "AUCUN", "tool_level": "AUCUN", "feedback": "" },
    { "step": 10, "ingredient_level": "AUCUN", "technique_level": "AUCUN", "tool_level": "AUCUN", "feedback": "" }
  ],
  "global_feedback": "résumé factuel global en français, max 200 caractères"
}`;

        const openai = new OpenAI({
            apiKey: openrouterApiKey,
            baseURL: "https://openrouter.ai/api/v1",
            timeout: 55_000,
        });

        const response = await openai.chat.completions.create({
            model: OPENROUTER_MODEL,
            max_tokens: 2048,
            temperature: 0,  // Déterministe à 100% pour cohérence maximale
            messages: [{
                role: "user",
                content: prompt
            }]
        });

        const text = response.choices[0]?.message?.content || "";

        // --- Parse AI response ---
        const extractJson = (raw: string): any => {
            let s = raw.trim();
            const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (fence) s = fence[1].trim();
            const obj = s.match(/\{[\s\S]*\}/);
            if (obj) s = obj[0];
            try { return JSON.parse(s); } catch { /* continue */ }
            const repaired = s.replace(/,\s*([}\]])/g, '$1').replace(/[\r\n]/g, ' ').replace(/[\x00-\x1F\x7F]/g, '');
            try { return JSON.parse(repaired); } catch { /* fall through */ }
            return null;
        };

        const aiResult = extractJson(text);

        if (!aiResult || !Array.isArray(aiResult.steps)) {
            console.error("[test-recipe] Failed to parse AI response:", text);
            return NextResponse.json(
                { error: "Le système d'évaluation a retourné une réponse invalide. Réessayez." },
                { status: 500 }
            );
        }

        // -------------------------------------------------------------------
        // SERVER-SIDE score computation — AI labels + lexical base → final scores
        // field_score = lexical_base + SEMANTIC_BONUS[label]  (capped at 100)
        // Natural decimals come from the continuous lexical_base (e.g. 58.39 + 40 = 98.39)
        // -------------------------------------------------------------------
        const round2 = (n: number) => Math.round(n * 100) / 100;

        const steps = brigadeRecipeFormatted.map((bs: any) => {
            const aiStep = aiResult.steps.find((s: any) => s.step === bs.step);
            const ps = preScores.find((p: any) => p.step === bs.step) ?? { lex_i: 0, lex_t: 0, lex_o: 0 };
            const isEmpty = (v: string) => !v || !v.trim();

            // Pick AI labels (fallback to AUCUN if missing/invalid)
            const lvl_i = isEmpty(bs.ingredient) ? "AUCUN" : validLevel(aiStep?.ingredient_level);
            const lvl_t = isEmpty(bs.technique) ? "AUCUN" : validLevel(aiStep?.technique_level);
            const lvl_o = isEmpty(bs.tool) ? "AUCUN" : validLevel(aiStep?.tool_level);

            // Compute field scores
            const ingredient_score = isEmpty(bs.ingredient) ? 0 : round2(Math.min(100, ps.lex_i + SEMANTIC_BONUS[lvl_i]));
            const technique_score = isEmpty(bs.technique) ? 0 : round2(Math.min(100, ps.lex_t + SEMANTIC_BONUS[lvl_t]));
            const tool_score = isEmpty(bs.tool) ? 0 : round2(Math.min(100, ps.lex_o + SEMANTIC_BONUS[lvl_o]));

            const step_score = round2((ingredient_score + technique_score + tool_score) / 3);

            return {
                step: bs.step,
                ingredient_score,
                technique_score,
                tool_score,
                step_score,
                feedback: aiStep?.feedback || "",
            };
        });

        const global_score = round2(
            steps.reduce((acc: number, s: any) => acc + s.step_score, 0) / 10
        );

        const result = {
            steps,
            global_score,
            global_feedback: aiResult.global_feedback || "",
        };

        // --- Save to Supabase ---
        const attemptNumber = attemptCount + 1;
        const { error: insertError } = await supabase
            .from("recipe_tests")
            .insert({
                brigade_id: brigadeDbId,
                attempt_number: attemptNumber,
                global_score: result.global_score,
                details: result,
            });

        if (insertError) {
            console.error("Error saving test attempt:", insertError);
            return NextResponse.json(
                { error: "Le score a été calculé mais n'a pas pu être sauvegardé. Erreur: " + (insertError?.message || JSON.stringify(insertError)) },
                { status: 500 }
            );
        }

        return NextResponse.json({
            ...result,
            attempt_number: attemptNumber,
            attempts_remaining: 3 - attemptNumber,
        });

    } catch (error: any) {
        console.error("[processRecipeTest] Error:", error);
        return NextResponse.json(
            { error: "Erreur interne : " + (error.message || "Unknown") },
            { status: 500 }
        );
    }
}
