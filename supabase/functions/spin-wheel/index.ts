import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PRIZES = ['COMBO', 'XTUDO', 'HOTDOG'];

// Mapeamento das fatias (6 fatias de 60° cada)
// Apenas prêmios válidos (nunca LOSE)
const PRIZE_ANGLES = {
  HOTDOG: 60,  // Fatia 2
  XTUDO: 180,  // Fatia 4
  COMBO: 300   // Fatia 6
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

    // Sortear prêmio com probabilidades variáveis para mais aleatoriedade
    const random = Math.random() * 100;
    let prize: string;
    
    // Adicionar micro-variação nas probabilidades a cada sorteio
    const variation = (Math.random() - 0.5) * 10; // ±5% de variação
    
    if (random < (35 + variation)) {
      prize = 'COMBO';
    } else if (random < (67.5 + variation)) {
      prize = 'XTUDO';
    } else {
      prize = 'HOTDOG';
    }

    // Calcular ângulo com mais aleatoriedade
    const prizeBaseAngle = PRIZE_ANGLES[prize as keyof typeof PRIZE_ANGLES];
    
    // Usar distribuição mais variada dentro da fatia
    // Evitar sempre cair no centro da fatia
    const angleOffset = Math.random() * 60;
    const randomSkew = (Math.random() - 0.5) * 20; // Adicionar mais variação
    const targetAngle = prizeBaseAngle + angleOffset + randomSkew;
    
    // Adicionar rotações extras aleatórias (entre 3 a 6 voltas completas)
    const extraRotations = (3 + Math.random() * 3) * 360;

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
        targetAngle: targetAngle + extraRotations,
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
