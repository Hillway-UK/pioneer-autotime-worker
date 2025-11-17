import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.0';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { worker_id, job_id } = await req.json();

    if (!worker_id || !job_id) {
      return new Response(
        JSON.stringify({ error: 'worker_id and job_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Checking RAMS acceptance for worker ${worker_id} on job ${job_id}`);

    // Get start of today in UTC
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if already accepted today
    const { data, error } = await supabaseClient
      .from('rams_acceptances')
      .select('id, accepted_at')
      .eq('worker_id', worker_id)
      .eq('job_id', job_id)
      .gte('accepted_at', today.toISOString())
      .order('accepted_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Query error:', error);
      return new Response(
        JSON.stringify({ error: 'Database query failed', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const alreadyAcceptedToday = data && data.length > 0;
    
    console.log(`RAMS already accepted today: ${alreadyAcceptedToday}`);
    if (alreadyAcceptedToday) {
      console.log(`Last acceptance at: ${data[0].accepted_at}`);
    }

    return new Response(
      JSON.stringify({
        already_accepted: alreadyAcceptedToday,
        last_acceptance: alreadyAcceptedToday ? data[0] : null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
