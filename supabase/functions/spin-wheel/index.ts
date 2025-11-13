import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PRIZES = ['COMBO', 'XTUDO', 'HOTDOG'];

// Mapeamento preciso das fatias (mesmo do frontend)
// Cada fatia tem 90 graus
const PRIZE_ANGLE_RANGES = {
  XTUDO: { min: 0, max: 90 },
  HOTDOG: { min: 90, max: 180 },
  COMBO: { min: 180, max: 270 }
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

    // Calcular ângulo aleatório dentro da fatia do prêmio
    const prizeAngles = PRIZE_ANGLE_RANGES[prize as keyof typeof PRIZE_ANGLE_RANGES];
    const targetAngle = prizeAngles.min + Math.random() * (prizeAngles.max - prizeAngles.min);

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
