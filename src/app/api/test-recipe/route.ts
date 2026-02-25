import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const maxDuration = 60;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const GROQ_MODEL = "llama-3.3-70b-versatile";

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
        if (!GROQ_API_KEY) {
            return NextResponse.json(
                { error: "GROQ_API_KEY is not configured on the server." },
                { status: 500 }
            );
        }

        const body = await req.json();
        const { brigadeId, brigadeDbId, recipeSteps } = body;

        if (!brigadeDbId || !recipeSteps || !Array.isArray(recipeSteps)) {
            return NextResponse.json(
                { error: "Missing brigadeDbId or recipeSteps." },
                { status: 400 }
            );
        }

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
        // PROMPT — plain ASCII only, no unicode box chars (avoids JSON 400 error)
        // AI only picks semantic LABELS (not numbers) → eliminates numeric drift
        // -------------------------------------------------------------------
        const prompt = `You are a culinary evaluation assistant. For each step and each field, pick ONE semantic label from this exact list: EXACT, PROCHE, PARTIEL, INDIRECT, AUCUN.

LABEL DEFINITIONS:
- EXACT    : perfect synonym or identical meaning in culinary context (ex: "fouetter" = "battre", "sauteuse" = "poele")
- PROCHE   : very close meaning, near-equivalent, same technique family (ex: "rissoler" ~ "revenir", "marmite" ~ "cocotte")
- PARTIEL  : same broad culinary category but not equivalent (ex: "beurre" ~ "huile", "cuire" ~ "pocher")
- INDIRECT : loosely related, same culinary universe but different (ex: "sel" ~ "epices", "couteau" ~ "moulin")
- AUCUN    : no semantic link, or the brigade field is EMPTY

IMPORTANT RULES:
- If the brigade field is empty ("") -> use AUCUN, no exceptions.
- Each label choice must reflect the MEANING comparison, not the spelling. Spelling similarity is already computed separately.
- Focus purely on culinary semantics.

REFERENCE RECIPE (10 steps):
${realRecipeFormatted
                .map((s: any) =>
                    `Step ${s.step}: ingredient="${s.ingredient}" | technique="${s.technique}" | tool="${s.tool}"`
                )
                .join("\n")}

BRIGADE RECIPE (to evaluate):
${brigadeRecipeFormatted
                .map((bs: any) => {
                    const rs = realRecipeFormatted.find((r: any) => r.step === bs.step) as any;
                    return `Step ${bs.step}: ingredient="${bs.ingredient}" (ref: "${rs?.ingredient ?? ""}") | technique="${bs.technique}" (ref: "${rs?.technique ?? ""}") | tool="${bs.tool}" (ref: "${rs?.tool ?? ""}")`;
                })
                .join("\n")}

OUTPUT FORMAT: respond ONLY with a valid JSON object, no other text:
{
  "steps": [
    {
      "step": 1,
      "ingredient_level": "AUCUN",
      "technique_level": "AUCUN",
      "tool_level": "AUCUN",
      "feedback": "one factual sentence in French, max 80 chars"
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
  "global_feedback": "global factual summary in French, max 200 chars"
}`;

        const openai = new OpenAI({
            apiKey: GROQ_API_KEY,
            baseURL: GROQ_BASE_URL,
            timeout: 55_000,
        });

        const response = await openai.chat.completions.create({
            model: GROQ_MODEL,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 1200,              // labels are short, 1200 is more than enough
            temperature: 0,               // fully deterministic
            seed: 42,
            response_format: { type: "json_object" },
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
        console.error("Recipe test error:", error);
        return NextResponse.json(
            { error: "Erreur interne : " + (error.message || "Unknown") },
            { status: 500 }
        );
    }
}
