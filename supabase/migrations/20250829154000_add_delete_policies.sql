-- Add missing DELETE policies for admin operations

-- Add DELETE policy for teams table
CREATE POLICY "Anyone can delete teams" ON public.teams
    FOR DELETE USING (true);

-- Add DELETE policy for players table  
CREATE POLICY "Anyone can delete players" ON public.players
    FOR DELETE USING (true);

-- Add DELETE policy for trades table
CREATE POLICY "Anyone can delete trades" ON public.trades
    FOR DELETE USING (true);

-- Add DELETE policy for portfolio table
CREATE POLICY "Anyone can delete portfolio" ON public.portfolio
    FOR DELETE USING (true);
