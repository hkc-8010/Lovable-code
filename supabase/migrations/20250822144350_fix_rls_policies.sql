-- Fix RLS policies for admin operations

-- Add missing policies for stocks table
CREATE POLICY "Anyone can insert stocks" ON public.stocks
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update stocks" ON public.stocks
    FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete stocks" ON public.stocks
    FOR DELETE USING (true);

-- Add missing policies for stock_prices table
CREATE POLICY "Anyone can insert stock prices" ON public.stock_prices
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update stock prices" ON public.stock_prices
    FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete stock prices" ON public.stock_prices
    FOR DELETE USING (true);

-- Add missing policies for game_settings table
CREATE POLICY "Anyone can update game settings" ON public.game_settings
    FOR UPDATE USING (true);

-- Add missing policies for admin_users table
CREATE POLICY "Anyone can insert admin users" ON public.admin_users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update admin users" ON public.admin_users
    FOR UPDATE USING (true);
