-- Fix security issues by setting proper search_path for functions
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