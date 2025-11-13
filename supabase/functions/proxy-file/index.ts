import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    console.log('Proxying file:', fileUrl);

    const fileResponse = await fetch(fileUrl);
    
    if (!fileResponse.ok) {
      console.error('Failed to fetch file:', fileResponse.status);
      return new Response("Failed to fetch file", { 
        status: fileResponse.status,
        headers: corsHeaders 
      });
    }

    const bytes = await fileResponse.arrayBuffer();
    const contentType = fileResponse.headers.get("Content-Type") ?? "application/pdf";

    console.log('File proxied successfully, content-type:', contentType);

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
