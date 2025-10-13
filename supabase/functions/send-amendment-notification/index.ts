import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  notification_id: string;
  worker_id: string;
  title: string;
  body: string;
  type: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: NotificationPayload = await req.json();
    
    console.log('Processing amendment notification:', payload);

    // Only process amendment notifications
    if (!['amendment_approved', 'amendment_rejected'].includes(payload.type)) {
      return new Response(
        JSON.stringify({ message: 'Not an amendment notification' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch worker's notification preferences
    const { data: prefs, error: prefsError } = await supabase
      .from('notification_preferences')
      .select('push_token')
      .eq('worker_id', payload.worker_id)
      .single();

    if (prefsError) {
      console.log('No notification preferences found for worker:', payload.worker_id);
      return new Response(
        JSON.stringify({ message: 'No preferences found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!prefs?.push_token) {
      console.log('No push token for worker:', payload.worker_id);
      return new Response(
        JSON.stringify({ message: 'No push token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark notification as delivered
    await supabase
      .from('notifications')
      .update({ delivered_at: new Date().toISOString() })
      .eq('id', payload.notification_id);

    console.log('Amendment notification processed successfully');

    return new Response(
      JSON.stringify({ success: true, message: 'Notification processed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing amendment notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
