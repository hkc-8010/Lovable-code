-- Add missing DELETE policies for team deletion functionality

-- Add DELETE policy for teams table (allows admin to delete teams)
CREATE POLICY "Anyone can delete teams" ON public.teams
    FOR DELETE USING (true);

-- Add DELETE policy for players table (cascade when team is deleted)
CREATE POLICY "Anyone can delete players" ON public.players
    FOR DELETE USING (true);

-- Add DELETE policy for trades table (cascade when team is deleted)
CREATE POLICY "Anyone can delete trades" ON public.trades
    FOR DELETE USING (true);

-- Add DELETE policy for portfolio table (cascade when team is deleted)
CREATE POLICY "Anyone can delete portfolio" ON public.portfolio
    FOR DELETE USING (true);
