require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase.from('catalog_fragments').select('id').limit(1);
    if (error) {
        console.error("DB Error:", error.message);
    } else {
        console.log("Table exists, rows found=" + data.length);
    }
}
check();
