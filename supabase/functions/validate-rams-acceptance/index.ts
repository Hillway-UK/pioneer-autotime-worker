import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Converts a job document filename to a full Supabase Storage URL
 */
function buildJobDocumentUrl(fileName: string | null | undefined): string | null {
  if (!fileName) return null;
  
  if (fileName.startsWith('http://') || fileName.startsWith('https://')) {
    return fileName;
  }
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  return `${supabaseUrl}/storage/v1/object/public/job-documents/${fileName}`;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
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

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

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
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Fetching RAMS/Site Info for worker ${worker_id}, job ${job_id}`);

    // Fetch job details with RAMS and Site Information URLs
    const { data: job, error: jobError } = await supabaseClient
      .from('jobs')
      .select('id, name, terms_and_conditions_url, waiver_url')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      console.error('Job fetch error:', jobError);
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Job RAMS/Site Info:', {
      job_id: job.id,
      has_rams: !!job.terms_and_conditions_url,
      has_site_info: !!job.waiver_url,
    });

    return new Response(
      JSON.stringify({
        job_id: job.id,
        job_name: job.name,
        terms_and_conditions_url: buildJobDocumentUrl(job.terms_and_conditions_url),
        waiver_url: buildJobDocumentUrl(job.waiver_url),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
