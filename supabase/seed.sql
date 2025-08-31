-- Sample data for Stock Market Trading Game

-- Insert sample stocks (20 stocks as mentioned in the game rules)
INSERT INTO public.stocks (symbol, name, is_active) VALUES
('AAPL', 'Apple Inc.', true),
('MSFT', 'Microsoft Corporation', true),
('GOOGL', 'Alphabet Inc.', true),
('AMZN', 'Amazon.com Inc.', true),
('TSLA', 'Tesla Inc.', true),
('META', 'Meta Platforms Inc.', true),
('NVDA', 'NVIDIA Corporation', true),
('NFLX', 'Netflix Inc.', true),
('UBER', 'Uber Technologies Inc.', true),
('ZOOM', 'Zoom Video Communications', true),
('SHOP', 'Shopify Inc.', true),
('SQ', 'Block Inc.', true),
('COIN', 'Coinbase Global Inc.', true),
('RBLX', 'Roblox Corporation', true),
('PLTR', 'Palantir Technologies', true),
('SNOW', 'Snowflake Inc.', true),
('CRM', 'Salesforce Inc.', true),
('AMD', 'Advanced Micro Devices', true),
('INTC', 'Intel Corporation', true),
('ORCL', 'Oracle Corporation', true)
ON CONFLICT (symbol) DO NOTHING;

-- Insert sample stock prices for Round 1
WITH stock_ids AS (
  SELECT id, symbol FROM public.stocks
)
INSERT INTO public.stock_prices (stock_id, round_number, price) 
SELECT 
  id,
  1 as round_number,
  CASE symbol
    WHEN 'AAPL' THEN 150.00
    WHEN 'MSFT' THEN 280.00
    WHEN 'GOOGL' THEN 2500.00
    WHEN 'AMZN' THEN 3200.00
    WHEN 'TSLA' THEN 800.00
    WHEN 'META' THEN 320.00
    WHEN 'NVDA' THEN 450.00
    WHEN 'NFLX' THEN 380.00
    WHEN 'UBER' THEN 45.00
    WHEN 'ZOOM' THEN 85.00
    WHEN 'SHOP' THEN 120.00
    WHEN 'SQ' THEN 75.00
    WHEN 'COIN' THEN 180.00
    WHEN 'RBLX' THEN 35.00
    WHEN 'PLTR' THEN 18.00
    WHEN 'SNOW' THEN 220.00
    WHEN 'CRM' THEN 210.00
    WHEN 'AMD' THEN 95.00
    WHEN 'INTC' THEN 50.00
    WHEN 'ORCL' THEN 85.00
    ELSE 100.00
  END as price
FROM stock_ids
ON CONFLICT (stock_id, round_number) DO NOTHING;

-- Insert sample stock prices for Round 2 (with some changes)
WITH stock_ids AS (
  SELECT id, symbol FROM public.stocks
)
INSERT INTO public.stock_prices (stock_id, round_number, price) 
SELECT 
  id,
  2 as round_number,
  CASE symbol
    WHEN 'AAPL' THEN 155.50
    WHEN 'MSFT' THEN 275.80
    WHEN 'GOOGL' THEN 2520.00
    WHEN 'AMZN' THEN 3180.00
    WHEN 'TSLA' THEN 820.00
    WHEN 'META' THEN 315.00
    WHEN 'NVDA' THEN 465.00
    WHEN 'NFLX' THEN 390.00
    WHEN 'UBER' THEN 47.50
    WHEN 'ZOOM' THEN 82.00
    WHEN 'SHOP' THEN 125.00
    WHEN 'SQ' THEN 78.00
    WHEN 'COIN' THEN 175.00
    WHEN 'RBLX' THEN 38.00
    WHEN 'PLTR' THEN 19.50
    WHEN 'SNOW' THEN 215.00
    WHEN 'CRM' THEN 205.00
    WHEN 'AMD' THEN 98.00
    WHEN 'INTC' THEN 52.00
    WHEN 'ORCL' THEN 87.50
    ELSE 105.00
  END as price
FROM stock_ids
ON CONFLICT (stock_id, round_number) DO NOTHING;

-- Create a sample admin user with bcrypt hashed password
INSERT INTO public.admin_users (username, password_hash) 
VALUES ('admin', '$2b$12$gWfXo9JMGP3IHeEIEO37ceKrZkpBtvW3vMNKGM7ogNBFHFmceMwsG')
ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash;

-- Create a sample team for testing with bcrypt hashed password
INSERT INTO public.teams (team_number, password_hash, status, cash_balance) 
VALUES (1001, '$2b$12$drQR9KTvlMTncq.cccKG2.PrZShcGmUqOTqYKfwoVakjCIoRQHSBC', 'approved', 5000000.00)
ON CONFLICT (team_number) DO UPDATE SET 
  password_hash = EXCLUDED.password_hash,
  status = EXCLUDED.status,
  cash_balance = EXCLUDED.cash_balance;

-- Add sample players for the test team
INSERT INTO public.players (team_id, name, phone_number) 
SELECT 
  t.id,
  player_data.name,
  player_data.phone
FROM public.teams t,
(VALUES 
  ('John Doe', '+1234567890'),
  ('Jane Smith', '+1234567891'),
  ('Mike Johnson', '+1234567892'),
  ('Sarah Wilson', '+1234567893')
) AS player_data(name, phone)
WHERE t.team_number = 1001
ON CONFLICT DO NOTHING;
