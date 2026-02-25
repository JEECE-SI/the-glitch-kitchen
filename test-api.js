const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://togzuwoxeeynhggpwxfw.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvZ3p1d294ZWV5bmhnZ3B3eGZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NjA1NzEsImV4cCI6MjA4NzQzNjU3MX0.K3VC7-6koiWDHbREu9MctFlkLTJwo5FnPexaBVfqMcQ');

async function test() {
    const { data: b } = await supabase.from('brigades').select('id, code').limit(1);
    if (!b || !b[0]) return console.log('no brigade');

    const { data: currentTests } = await supabase.from('recipe_tests').select('*').eq('brigade_id', b[0].id);
    console.log('Current tests for', b[0].code, currentTests);

    const res = await fetch('http://localhost:3000/api/test-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            brigadeId: b[0].code,
            brigadeDbId: b[0].id,
            recipeSteps: [{ ingredient: "apple", technique: "cut", tool: "knife" }]
        })
    });
    console.log('API response:', await res.json());
}
test();
