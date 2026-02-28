import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabaseClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    
    if (!supabaseUrl || !supabaseKey) {
        throw new Error("Supabase configuration missing");
    }
    
    return createClient(supabaseUrl, supabaseKey);
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { brigadeId } = body;

        if (!brigadeId) {
            return NextResponse.json(
                { error: "Missing brigadeId." },
                { status: 400 }
            );
        }

        const supabase = getSupabaseClient();

        // Fetch current max_attempts
        const { data: brigade, error: fetchError } = await supabase
            .from('brigades')
            .select('max_attempts')
            .eq('id', brigadeId)
            .single();

        if (fetchError || !brigade) {
            return NextResponse.json(
                { error: "Brigade not found." },
                { status: 404 }
            );
        }

        const currentMax = brigade.max_attempts || 3;
        const newMax = currentMax + 1;

        // Update max_attempts
        const { error: updateError } = await supabase
            .from('brigades')
            .update({ max_attempts: newMax })
            .eq('id', brigadeId);

        if (updateError) {
            console.error("Error updating max_attempts:", updateError);
            return NextResponse.json(
                { error: "Failed to update max attempts." },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            max_attempts: newMax,
            message: `Tentatives augmentées à ${newMax}`
        });

    } catch (error: any) {
        console.error("Add attempt error:", error);
        return NextResponse.json(
            { error: "Internal error: " + (error.message || "Unknown") },
            { status: 500 }
        );
    }
}
