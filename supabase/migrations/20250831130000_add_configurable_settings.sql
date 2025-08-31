-- Add configurable game settings
ALTER TABLE public.game_settings 
ADD COLUMN initial_team_balance DECIMAL(12,2) NOT NULL DEFAULT 5000000.00,
ADD COLUMN max_stocks INTEGER NOT NULL DEFAULT 25,
ADD COLUMN brokerage_percentage DECIMAL(5,4) NOT NULL DEFAULT 0.01;

-- Update existing game settings with new values
UPDATE public.game_settings 
SET initial_team_balance = 5000000.00,
    max_stocks = 25,
    brokerage_percentage = 0.01
WHERE id IS NOT NULL;

-- Update teams table default balance
ALTER TABLE public.teams 
ALTER COLUMN cash_balance SET DEFAULT 5000000.00;

-- Update existing teams to new balance (optional - uncomment if you want to update existing teams)
-- UPDATE public.teams SET cash_balance = 5000000.00 WHERE cash_balance = 2000000.00;

-- Add 5 more stocks to reach 25 total
INSERT INTO public.stocks (symbol, name, is_active) VALUES
('ADBE', 'Adobe Inc.', true),
('PYPL', 'PayPal Holdings Inc.', true),
('SPOT', 'Spotify Technology S.A.', true),
('TWTR', 'Twitter Inc.', true),
('SNAP', 'Snap Inc.', true)
ON CONFLICT (symbol) DO NOTHING;

-- Add stock prices for the new stocks for Round 1
WITH stock_ids AS (
  SELECT id, symbol FROM public.stocks WHERE symbol IN ('ADBE', 'PYPL', 'SPOT', 'TWTR', 'SNAP')
)
INSERT INTO public.stock_prices (stock_id, round_number, price) 
SELECT 
  id,
  1 as round_number,
  CASE symbol
    WHEN 'ADBE' THEN 420.00
    WHEN 'PYPL' THEN 85.00
    WHEN 'SPOT' THEN 145.00
    WHEN 'TWTR' THEN 42.00
    WHEN 'SNAP' THEN 12.50
    ELSE 100.00
  END as price
FROM stock_ids
ON CONFLICT (stock_id, round_number) DO NOTHING;

-- Add stock prices for the new stocks for Round 2
WITH stock_ids AS (
  SELECT id, symbol FROM public.stocks WHERE symbol IN ('ADBE', 'PYPL', 'SPOT', 'TWTR', 'SNAP')
)
INSERT INTO public.stock_prices (stock_id, round_number, price) 
SELECT 
  id,
  2 as round_number,
  CASE symbol
    WHEN 'ADBE' THEN 425.00
    WHEN 'PYPL' THEN 87.50
    WHEN 'SPOT' THEN 142.00
    WHEN 'TWTR' THEN 44.00
    WHEN 'SNAP' THEN 13.00
    ELSE 105.00
  END as price
FROM stock_ids
ON CONFLICT (stock_id, round_number) DO NOTHING;
