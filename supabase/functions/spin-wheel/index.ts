import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PRIZES = ['COMBO', 'XTUDO', 'HOTDOG'];
const PRIZE_ANGLES = {
  COMBO: 0,    // Fatia 0
  XTUDO: 120,  // Fatia 2
  HOTDOG: 240  // Fatia 4
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { whatsapp } = await req.json();
    console.log('Spinning wheel for:', whatsapp);

    if (!whatsapp) {
      return new Response(
        JSON.stringify({ error: 'WhatsApp é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verificar limite de giros (3 nas últimas 12 horas)
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const { data: recentSpins, error: spinsError } = await supabase
      .from('spins')
      .select('id')
      .eq('whatsapp', whatsapp)
      .gte('created_at', twelveHoursAgo);

    if (spinsError) throw spinsError;

    if (recentSpins && recentSpins.length >= 3) {
      return new Response(
        JSON.stringify({ 
          error: 'limit_reached',
          message: 'Você já usou suas 3 chances nas últimas 12 horas'
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Contar cupons já reivindicados hoje
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const { data: todayClaims, error: claimsError } = await supabase
      .from('coupon_claims')
      .select('id')
      .eq('whatsapp', whatsapp)
      .gte('created_at', todayStart.toISOString());

    if (claimsError) throw claimsError;

    const claimedToday = todayClaims ? todayClaims.length : 0;

    // Sortear prêmio com probabilidades: COMBO 35%, XTUDO 32.5%, HOTDOG 32.5%
    const random = Math.random() * 100;
    let prize: string;
    
    if (random < 35) {
      prize = 'COMBO';
    } else if (random < 67.5) {
      prize = 'XTUDO';
    } else {
      prize = 'HOTDOG';
    }

    // Calcular ângulo alvo (centro da fatia ±15° para alinhamento perfeito)
    const baseAngle = PRIZE_ANGLES[prize as keyof typeof PRIZE_ANGLES];
    const centerOffset = 30; // Centro da fatia de 60°
    const jitter = (Math.random() - 0.5) * 30; // -15 a +15 graus
    const targetAngle = baseAngle + centerOffset + jitter;

    // Registrar giro
    const { error: insertError } = await supabase
      .from('spins')
      .insert({
        whatsapp,
        prize,
        angle: targetAngle
      });

    if (insertError) throw insertError;

    console.log('Spin registered:', { prize, targetAngle, claimedToday });

    return new Response(
      JSON.stringify({
        prize,
        targetAngle,
        claimedToday
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao girar roleta:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
