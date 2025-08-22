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

-- Insert initial game settings
INSERT INTO public.game_settings (current_round, total_rounds, is_game_active) 
VALUES (1, 8, true);

-- Insert default admin user (password: admin123)
INSERT INTO public.admin_users (username, password_hash) 
VALUES ('admin', '$2b$10$rOvHgJkYYHfBZY6PQjQQNOmRrPHfX5k2LhKZnw1YYmHY8fOYxn8Y.');

-- Enable Row Level Security
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public access (teams can read their own data)
CREATE POLICY "Teams can view their own data" ON public.teams
    FOR SELECT USING (true);

CREATE POLICY "Teams can insert their own data" ON public.teams
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Teams can update their own data" ON public.teams
    FOR UPDATE USING (true);

CREATE POLICY "Anyone can view players" ON public.players
    FOR SELECT USING (true);

CREATE POLICY "Anyone can insert players" ON public.players
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view stocks" ON public.stocks
    FOR SELECT USING (true);

CREATE POLICY "Anyone can view stock prices" ON public.stock_prices
    FOR SELECT USING (true);

CREATE POLICY "Anyone can view trades" ON public.trades
    FOR SELECT USING (true);

CREATE POLICY "Anyone can insert trades" ON public.trades
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view portfolio" ON public.portfolio
    FOR SELECT USING (true);

CREATE POLICY "Anyone can insert/update portfolio" ON public.portfolio
    FOR ALL USING (true);

CREATE POLICY "Anyone can view game settings" ON public.game_settings
    FOR SELECT USING (true);

CREATE POLICY "Anyone can view admin users" ON public.admin_users
    FOR SELECT USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- Create function to update portfolio after trade
CREATE OR REPLACE FUNCTION public.update_portfolio_after_trade()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger for portfolio updates
CREATE TRIGGER update_portfolio_trigger
    AFTER INSERT ON public.trades
    FOR EACH ROW
    EXECUTE FUNCTION public.update_portfolio_after_trade();