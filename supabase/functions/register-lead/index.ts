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
    const { name, whatsapp } = await req.json();
    console.log('Registering lead:', { name, whatsapp });

    // Validação
    if (!name || name.trim().length < 2 || name.trim().length > 60) {
      return new Response(
        JSON.stringify({ error: 'Nome deve ter entre 2 e 60 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalizar WhatsApp: remover tudo exceto números
    const cleanWhatsapp = whatsapp.replace(/\D/g, '');
    
    // Validar formato brasileiro: 55 + DDD (2 dígitos) + Número (8 ou 9 dígitos)
    if (!cleanWhatsapp.match(/^55\d{10,11}$/)) {
      return new Response(
        JSON.stringify({ error: 'WhatsApp inválido. Use o formato: (DDD) 9XXXX-XXXX' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Inicializar Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verificar se já existe
    const { data: existing } = await supabase
      .from('leads')
      .select('whatsapp')
      .eq('whatsapp', cleanWhatsapp)
      .maybeSingle();

    let isNewLead = !existing;

    // Upsert no Supabase
    const { error: upsertError } = await supabase
      .from('leads')
      .upsert(
        { name: name.trim(), whatsapp: cleanWhatsapp },
        { onConflict: 'whatsapp' }
      );

    if (upsertError) {
      console.error('Erro ao salvar no Supabase:', upsertError);
      throw upsertError;
    }

    return new Response(
      JSON.stringify({ success: true, isNewLead }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao registrar lead:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
