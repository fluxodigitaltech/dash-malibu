-- Create a table to store the results of the 6-hour sync.
-- This allows the dashboard to load instantly for all users.
CREATE TABLE IF NOT EXISTS public.dashboard_sync (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  data JSONB NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.dashboard_sync ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read the sync data (only one row exists)
CREATE POLICY "Public read access for dashboard sync"
  ON public.dashboard_sync FOR SELECT
  USING (true);

-- Allow service role (server-side function) to update it
-- (Already handled by bypass RLS if using service key, but good to have)
CREATE POLICY "Authenticated users can update dashboard sync"
  ON public.dashboard_sync FOR ALL
  USING (true)
  WITH CHECK (true);
