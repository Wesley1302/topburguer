import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SPREADSHEET_ID = '1rLmoMndmElq_TSQZq0LlV6zU24h-_xD5M4xuENhxZ88';

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

    // Se é novo lead, adicionar ao Google Sheets
    if (isNewLead) {
      try {
        await addToGoogleSheets(name.trim(), cleanWhatsapp);
        console.log('Lead adicionado ao Google Sheets');
      } catch (sheetsError) {
        console.error('Erro ao adicionar ao Google Sheets:', sheetsError);
        // Não falhar a requisição se o Google Sheets falhar
      }
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

async function addToGoogleSheets(name: string, whatsapp: string) {
  const serviceAccountEmail = Deno.env.get('GOOGLE_SHEETS_SA_EMAIL');
  const privateKey = Deno.env.get('GOOGLE_SHEETS_SA_KEY');

  if (!serviceAccountEmail || !privateKey) {
    throw new Error('Google Sheets credentials not configured');
  }

  // Criar JWT para autenticação
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccountEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  
  // Importar chave privada
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = privateKey.substring(pemHeader.length, privateKey.length - pemFooter.length).replace(/\s/g, '');
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const key = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  // Assinar
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    encoder.encode(signatureInput)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${signatureInput}.${encodedSignature}`;

  // Obter access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;

  // Adicionar linha ao Google Sheets
  const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Leads!A:B:append?valueInputOption=RAW`;
  
  await fetch(appendUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: [[name, whatsapp]]
    })
  });
}
