-- Create leads table
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  whatsapp TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create spins table
CREATE TABLE IF NOT EXISTS public.spins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp TEXT NOT NULL,
  prize TEXT NOT NULL,
  angle NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create coupon_claims table
CREATE TABLE IF NOT EXISTS public.coupon_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp TEXT NOT NULL,
  prize TEXT NOT NULL,
  coupon_number BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create global_counters table
CREATE TABLE IF NOT EXISTS public.global_counters (
  key TEXT PRIMARY KEY,
  value BIGINT NOT NULL DEFAULT 0
);

-- Initialize coupon counter
INSERT INTO public.global_counters (key, value) VALUES ('coupon', 0)
ON CONFLICT (key) DO NOTHING;

-- Create index for faster whatsapp lookups
CREATE INDEX IF NOT EXISTS idx_spins_whatsapp_created ON public.spins(whatsapp, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coupon_claims_whatsapp_date ON public.coupon_claims(whatsapp, created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_counters ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is a promotional app)
CREATE POLICY "Allow all operations on leads" ON public.leads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on spins" ON public.spins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on coupon_claims" ON public.coupon_claims FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow read on global_counters" ON public.global_counters FOR SELECT USING (true);
CREATE POLICY "Allow update on global_counters" ON public.global_counters FOR UPDATE USING (true) WITH CHECK (true);