-- Add Closing Bell (Round 9) support
-- Update total rounds from 8 to 9 and add trading restrictions for Round 9

-- Update game settings to include Round 9 (Closing Bell)
UPDATE public.game_settings
SET total_rounds = 9;

-- Add a column to track if trading is allowed in current round
ALTER TABLE public.game_settings
ADD COLUMN trading_allowed BOOLEAN NOT NULL DEFAULT true;

-- Add a column to identify the closing bell round
ALTER TABLE public.game_settings  
ADD COLUMN closing_bell_round INTEGER NOT NULL DEFAULT 9;

-- Update the existing game settings to reflect that Round 9 is the closing bell
UPDATE public.game_settings
SET 
  trading_allowed = CASE WHEN current_round = 9 THEN false ELSE true END,
  closing_bell_round = 9;
