-- Complete Production Database Setup for SM Game V2
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/zbpstkusjxghoegtqvgh/sql

-- ============================================================================
-- STEP 1: Create all tables and basic structure
-- ============================================================================

-- Create teams table
CREATE TABLE public.teams (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    team_number INTEGER NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    cash_balance DECIMAL(12,2) NOT NULL DEFAULT 2000000.00,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create players table
CREATE TABLE public.players (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create stocks table
CREATE TABLE public.stocks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    symbol TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create stock prices table
CREATE TABLE public.stock_prices (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    stock_id UUID NOT NULL REFERENCES public.stocks(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(stock_id, round_number)
);

-- Create trades table
CREATE TABLE public.trades (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    stock_id UUID NOT NULL REFERENCES public.stocks(id) ON DELETE CASCADE,
    trade_type TEXT NOT NULL CHECK (trade_type IN ('buy', 'sell')),
    quantity INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    brokerage DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    round_number INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create portfolio view helper table
CREATE TABLE public.portfolio (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    stock_id UUID NOT NULL REFERENCES public.stocks(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    avg_buy_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(team_id, stock_id)
);

-- Create game settings table
CREATE TABLE public.game_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    current_round INTEGER NOT NULL DEFAULT 1,
    total_rounds INTEGER NOT NULL DEFAULT 8,
    is_game_active BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create admin users table
CREATE TABLE public.admin_users (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================================================
-- STEP 2: Enable Row Level Security and Create Policies
-- ============================================================================

-- Enable Row Level Security
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public access
CREATE POLICY "Teams can view their own data" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Teams can insert their own data" ON public.teams FOR INSERT WITH CHECK (true);
CREATE POLICY "Teams can update their own data" ON public.teams FOR UPDATE USING (true);

CREATE POLICY "Anyone can view players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Anyone can insert players" ON public.players FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view stocks" ON public.stocks FOR SELECT USING (true);
CREATE POLICY "Anyone can insert stocks" ON public.stocks FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update stocks" ON public.stocks FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete stocks" ON public.stocks FOR DELETE USING (true);

CREATE POLICY "Anyone can view stock prices" ON public.stock_prices FOR SELECT USING (true);
CREATE POLICY "Anyone can insert stock prices" ON public.stock_prices FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update stock prices" ON public.stock_prices FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete stock prices" ON public.stock_prices FOR DELETE USING (true);

CREATE POLICY "Anyone can view trades" ON public.trades FOR SELECT USING (true);
CREATE POLICY "Anyone can insert trades" ON public.trades FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view portfolio" ON public.portfolio FOR SELECT USING (true);
CREATE POLICY "Anyone can insert/update portfolio" ON public.portfolio FOR ALL USING (true);

CREATE POLICY "Anyone can view game settings" ON public.game_settings FOR SELECT USING (true);
CREATE POLICY "Anyone can update game settings" ON public.game_settings FOR UPDATE USING (true);

CREATE POLICY "Anyone can view admin users" ON public.admin_users FOR SELECT USING (true);
CREATE POLICY "Anyone can insert admin users" ON public.admin_users FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update admin users" ON public.admin_users FOR UPDATE USING (true);

-- ============================================================================
-- STEP 3: Create Functions and Triggers
-- ============================================================================

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Create function to update portfolio after trade
CREATE OR REPLACE FUNCTION public.update_portfolio_after_trade()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_quantity INTEGER;
    current_avg_price DECIMAL(10,2);
    new_avg_price DECIMAL(10,2);
BEGIN
    -- Get current portfolio data
    SELECT quantity, avg_buy_price INTO current_quantity, current_avg_price
    FROM public.portfolio 
    WHERE team_id = NEW.team_id AND stock_id = NEW.stock_id;
    
    IF NEW.trade_type = 'buy' THEN
        IF current_quantity IS NULL THEN
            -- First time buying this stock
            INSERT INTO public.portfolio (team_id, stock_id, quantity, avg_buy_price)
            VALUES (NEW.team_id, NEW.stock_id, NEW.quantity, NEW.price);
        ELSE
            -- Calculate new average price
            new_avg_price := ((current_quantity * current_avg_price) + (NEW.quantity * NEW.price)) / (current_quantity + NEW.quantity);
            
            UPDATE public.portfolio 
            SET quantity = current_quantity + NEW.quantity,
                avg_buy_price = new_avg_price,
                updated_at = now()
            WHERE team_id = NEW.team_id AND stock_id = NEW.stock_id;
        END IF;
        
        -- Update team cash balance (subtract)
        UPDATE public.teams 
        SET cash_balance = cash_balance - NEW.total_amount,
            updated_at = now()
        WHERE id = NEW.team_id;
        
    ELSIF NEW.trade_type = 'sell' THEN
        -- Update portfolio quantity
        UPDATE public.portfolio 
        SET quantity = current_quantity - NEW.quantity,
            updated_at = now()
        WHERE team_id = NEW.team_id AND stock_id = NEW.stock_id;
        
        -- Remove from portfolio if quantity becomes 0
        DELETE FROM public.portfolio 
        WHERE team_id = NEW.team_id AND stock_id = NEW.stock_id AND quantity <= 0;
        
        -- Update team cash balance (add)
        UPDATE public.teams 
        SET cash_balance = cash_balance + NEW.total_amount,
            updated_at = now()
        WHERE id = NEW.team_id;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_teams_updated_at
    BEFORE UPDATE ON public.teams
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_portfolio_updated_at
    BEFORE UPDATE ON public.portfolio
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_game_settings_updated_at
    BEFORE UPDATE ON public.game_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for portfolio updates
CREATE TRIGGER update_portfolio_trigger
    AFTER INSERT ON public.trades
    FOR EACH ROW
    EXECUTE FUNCTION public.update_portfolio_after_trade();

-- ============================================================================
-- STEP 4: Insert Initial Data
-- ============================================================================

-- Insert initial game settings
INSERT INTO public.game_settings (current_round, total_rounds, is_game_active) 
VALUES (1, 8, true);

-- Insert sample admin user (username: admin, password: admin123)
INSERT INTO public.admin_users (username, password_hash) 
VALUES ('admin', '$2b$12$gWfXo9JMGP3IHeEIEO37ceKrZkpBtvW3vMNKGM7ogNBFHFmceMwsG');

-- Insert sample stocks (20 stocks)
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
('ORCL', 'Oracle Corporation', true);

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
FROM stock_ids;

-- Insert sample stock prices for Round 2
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
FROM stock_ids;

-- Create a sample team for testing (team: 1001, password: team123)
INSERT INTO public.teams (team_number, password_hash, status, cash_balance) 
VALUES (1001, '$2b$12$drQR9KTvlMTncq.cccKG2.PrZShcGmUqOTqYKfwoVakjCIoRQHSBC', 'approved', 2000000.00);

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
WHERE t.team_number = 1001;
