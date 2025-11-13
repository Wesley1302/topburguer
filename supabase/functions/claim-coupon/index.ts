import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { whatsapp, prize } = await req.json();
    console.log('Claiming coupon for:', { whatsapp, prize });

    if (!whatsapp || !prize) {
      return new Response(
        JSON.stringify({ error: 'WhatsApp e prêmio são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verificar limite de cupons (3 por dia)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: todayClaims, error: claimsError } = await supabase
      .from('coupon_claims')
      .select('id')
      .eq('whatsapp', whatsapp)
      .gte('created_at', todayStart.toISOString());

    if (claimsError) throw claimsError;

    if (todayClaims && todayClaims.length >= 3) {
      return new Response(
        JSON.stringify({ 
          error: 'daily_limit_reached',
          message: 'Você já resgatou 3 cupons hoje'
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Incrementar contador global atomicamente
    const { data: counterData, error: counterError } = await supabase
      .rpc('increment_counter', { counter_key: 'coupon_number' });

    if (counterError) throw counterError;

    const couponNumber = counterData;
    console.log('Counter incremented to:', couponNumber);

    // Registrar cupom
    const { error: insertError } = await supabase
      .from('coupon_claims')
      .insert({
        whatsapp,
        prize,
        coupon_number: couponNumber
      });

    if (insertError) {
      console.error('Failed to insert coupon claim:', insertError);
      throw insertError;
    }

    console.log('Coupon claimed successfully:', { couponNumber, prize, whatsapp });

    return new Response(
      JSON.stringify({ couponNumber }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao resgatar cupom:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
