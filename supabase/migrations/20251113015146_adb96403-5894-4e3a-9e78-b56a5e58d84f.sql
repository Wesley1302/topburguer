-- Create function to increment counter atomically
CREATE OR REPLACE FUNCTION public.increment_counter(counter_key TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_value BIGINT;
BEGIN
  -- Update and return the new value atomically
  UPDATE global_counters
  SET value = value + 1
  WHERE key = counter_key
  RETURNING value INTO new_value;
  
  -- If counter doesn't exist, create it
  IF NOT FOUND THEN
    INSERT INTO global_counters (key, value)
    VALUES (counter_key, 1)
    ON CONFLICT (key) DO UPDATE
    SET value = global_counters.value + 1
    RETURNING value INTO new_value;
  END IF;
  
  RETURN new_value;
END;
$$;