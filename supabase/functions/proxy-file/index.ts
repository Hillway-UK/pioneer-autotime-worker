import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const fileUrl = url.searchParams.get("url");

    if (!fileUrl) {
      return new Response("Missing ?url= parameter", { 
        status: 400,
        headers: corsHeaders 
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // If the URL points to our Storage, try downloading via Admin client (works for private buckets too)
    if (supabaseUrl && fileUrl.startsWith(supabaseUrl) && serviceRoleKey) {
      try {
        const relative = fileUrl.replace(supabaseUrl, '');
        // Expect paths like: /storage/v1/object/public/<bucket>/<object>
        // or /storage/v1/object/authenticated/<bucket>/<object>
        const parts = relative.split('/').filter(Boolean);
        // parts: ['storage','v1','object',('public'|'authenticated'|bucket), bucket, ...object]
        if (parts.length >= 6 && parts[0] === 'storage' && parts[2] === 'object') {
          let idx = 3;
          if (['public', 'authenticated'].includes(parts[3])) {
            idx = 4; // bucket starts after access segment
          }
          const bucket = parts[idx];
          const objectPath = parts.slice(idx + 1).join('/');

          if (bucket && objectPath) {
            const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
            const { data, error } = await supabaseAdmin.storage.from(bucket).download(objectPath);
            if (!error && data) {
              const contentType = (data as Blob).type || 'application/octet-stream';
              const bytes = await data.arrayBuffer();
              return new Response(bytes, {
                headers: {
                  ...corsHeaders,
                  'Content-Type': contentType,
                  'Cache-Control': 'public, max-age=3600',
                }
              });
            } else if (error) {
              console.error('Storage download error:', error.message || error);
            }
          }
        }
      } catch (e) {
        console.error('Error parsing storage URL or downloading:', e);
      }
    }

    // Fallback: direct fetch (works for public assets)
    console.log('Proxying file via fetch:', fileUrl);
    const fileResponse = await fetch(fileUrl);
    
    if (!fileResponse.ok) {
      const body = await fileResponse.text();
      console.error('Failed to fetch file:', fileResponse.status, body);
      return new Response(body || "Failed to fetch file", { 
        status: fileResponse.status,
        headers: corsHeaders 
      });
    }

    const bytes = await fileResponse.arrayBuffer();
    const contentType = fileResponse.headers.get("Content-Type") ?? "application/octet-stream";

    return new Response(bytes, {
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error('Error in proxy-file function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
