import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { hashPassword, generateSecurePassword } from '@/lib/auth';
import { Check, X, Plus, Edit, Trash2, ToggleLeft, ToggleRight, RefreshCw, Key } from 'lucide-react';

interface Team {
  id: string;
  team_number: number;
  cash_balance: number;
  status: string;
  players: Array<{
    name: string;
    phone_number: string;
  }>;
}

interface Stock {
  id: string;
  symbol: string;
  name: string;
  is_active: boolean;
}

interface GameSettings {
  id?: string;
  current_round: number;
  total_rounds: number;
  is_game_active: boolean;
  initial_team_balance?: number;
  max_stocks?: number;
  brokerage_percentage?: number;
  trading_allowed?: boolean;
  closing_bell_round?: number;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [gameSettings, setGameSettings] = useState<GameSettings | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Stock management
  const [newStock, setNewStock] = useState({ symbol: '', name: '' });
  const [selectedRound, setSelectedRound] = useState('1');
  const [stockPrices, setStockPrices] = useState<{ [key: string]: string }>({});
  
  // Game configuration
  const [configSettings, setConfigSettings] = useState({
    initial_team_balance: 5000000,
    max_stocks: 25,
    brokerage_percentage: 1.0
  });

  useEffect(() => {
    // Check if admin is logged in
    const currentAdmin = localStorage.getItem('currentAdmin');
    if (!currentAdmin) {
      navigate('/admin-login');
      return;
    }

    loadAdminData();

    // Set up real-time subscriptions for auto-refresh
    const gameSettingsSubscription = supabase
      .channel('admin_game_settings')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'game_settings' },
        (payload) => {
          console.log('Admin: Game settings updated:', payload);
          setGameSettings(payload.new as GameSettings);
          toast({
            title: "Game Settings Updated",
            description: "Dashboard refreshed with latest changes",
          });
        }
      )
      .subscribe();

    const teamsSubscription = supabase
      .channel('admin_teams')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'teams' },
        (payload) => {
          console.log('Admin: Teams updated:', payload);
          loadAdminData(); // Reload all data for team changes
          toast({
            title: "Teams Updated",
            description: "Team data refreshed",
          });
        }
      )
      .subscribe();

    const stocksSubscription = supabase
      .channel('admin_stocks')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'stocks' },
        (payload) => {
          console.log('Admin: Stocks updated:', payload);
          loadAdminData(); // Reload all data for stock changes
          toast({
            title: "Stocks Updated",
            description: "Stock data refreshed",
          });
        }
      )
      .subscribe();

    // Fallback polling every 90 seconds
    const pollInterval = setInterval(() => {
      loadAdminData();
    }, 90000);

    // Cleanup subscriptions
    return () => {
      gameSettingsSubscription.unsubscribe();
      teamsSubscription.unsubscribe();
      stocksSubscription.unsubscribe();
      clearInterval(pollInterval);
    };
  }, [navigate]);

  const loadAdminData = async () => {
    try {
      // Load teams with players
      const { data: teamsData } = await supabase
        .from('teams')
        .select(`
          *,
          players(name, phone_number)
        `)
        .order('team_number');
      setTeams(teamsData || []);

      // Load stocks (both active and inactive for admin view)
      const { data: stocksData } = await supabase
        .from('stocks')
        .select('*')
        .order('is_active', { ascending: false })
        .order('symbol');
      setStocks(stocksData || []);

      // Load game settings
      const { data: settings, error: settingsError } = await supabase
        .from('game_settings')
        .select('*')
        .single();
      
      if (settingsError) {
        console.error('Error loading game settings:', settingsError);
      } else {
        console.log('Loaded game settings:', settings); // Debug log
        setGameSettings(settings);
        
        // Update config settings state
        if (settings) {
          setConfigSettings({
            initial_team_balance: settings.initial_team_balance || 5000000,
            max_stocks: settings.max_stocks || 25,
            brokerage_percentage: (settings.brokerage_percentage || 0.01) * 100 // Convert to percentage for UI
          });
        }
      }

      // Load leaderboard
      const { data: portfolioData } = await supabase
        .from('portfolio')
        .select(`
          team_id,
          quantity,
          avg_buy_price,
          stocks(id, symbol),
          teams(team_number, cash_balance)
        `);

      // Calculate portfolio values and create leaderboard
      const teamValues: { [key: string]: any } = {};
      
      for (const item of portfolioData || []) {
        if (!teamValues[item.team_id]) {
          teamValues[item.team_id] = {
            team_number: item.teams.team_number,
            cash_balance: item.teams.cash_balance,
            portfolio_value: 0
          };
        }
        
        // Get current stock price
        const { data: priceData } = await supabase
          .from('stock_prices')
          .select('price')
          .eq('stock_id', item.stocks.id)
          .eq('round_number', settings?.current_round || 1)
          .single();
          
        if (priceData) {
          teamValues[item.team_id].portfolio_value += item.quantity * priceData.price;
        }
      }
      
      const leaderboardData = Object.values(teamValues)
        .map((team: any) => ({
          ...team,
          total_value: team.cash_balance + team.portfolio_value
        }))
        .sort((a, b) => b.total_value - a.total_value);
        
      setLeaderboard(leaderboardData);

      // Load stock prices for current round
      if (settings) {
        const { data: pricesData } = await supabase
          .from('stock_prices')
          .select('stock_id, price')
          .eq('round_number', settings.current_round);
        
        const pricesMap: { [key: string]: string } = {};
        pricesData?.forEach(price => {
          pricesMap[price.stock_id] = price.price.toString();
        });
        setStockPrices(pricesMap);
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
    }
  };

  const handleTeamStatusChange = async (teamId: string, status: 'approved' | 'rejected') => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('teams')
        .update({ status })
        .eq('id', teamId);

      if (error) throw error;

      toast({
        title: "Team Status Updated",
        description: `Team has been ${status}`,
      });

      loadAdminData();
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddStock = async () => {
    if (!newStock.symbol || !newStock.name) {
      toast({
        title: "Invalid Input",
        description: "Please provide both symbol and name",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('stocks')
        .insert([{
          symbol: newStock.symbol.toUpperCase(),
          name: newStock.name,
          is_active: true
        }]);

      if (error) throw error;

      toast({
        title: "Stock Added",
        description: `${newStock.symbol} has been added successfully`,
      });

      setNewStock({ symbol: '', name: '' });
      loadAdminData();
    } catch (error: any) {
      toast({
        title: "Add Stock Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStockStatus = async (stockId: string, symbol: string, currentStatus: boolean) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('stocks')
        .update({ is_active: !currentStatus })
        .eq('id', stockId);

      if (error) throw error;

      toast({
        title: "Stock Status Updated",
        description: `${symbol} has been ${!currentStatus ? 'activated' : 'deactivated'}`,
      });

      loadAdminData();
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStock = async (stockId: string, symbol: string) => {
    // Confirm deletion
    if (!confirm(`Are you sure you want to delete ${symbol}? This will also remove all associated price data and trades.`)) {
      return;
    }

    setLoading(true);
    try {
      // Check if stock has any trades
      const { data: trades } = await supabase
        .from('trades')
        .select('id')
        .eq('stock_id', stockId)
        .limit(1);

      if (trades && trades.length > 0) {
        throw new Error(`Cannot delete ${symbol} as it has existing trades. Consider deactivating instead.`);
      }

      // Delete stock prices first (due to foreign key constraint)
      const { error: pricesError } = await supabase
        .from('stock_prices')
        .delete()
        .eq('stock_id', stockId);

      if (pricesError) throw pricesError;

      // Delete the stock
      const { error: stockError } = await supabase
        .from('stocks')
        .delete()
        .eq('id', stockId);

      if (stockError) throw stockError;

      toast({
        title: "Stock Deleted",
        description: `${symbol} has been removed successfully`,
      });

      loadAdminData();
    } catch (error: any) {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStockPrices = async () => {
    setLoading(true);
    try {
      const pricesToUpdate = Object.entries(stockPrices)
        .filter(([_, price]) => price && parseFloat(price) > 0)
        .map(([stockId, price]) => ({
          stock_id: stockId,
          round_number: parseInt(selectedRound),
          price: parseFloat(price)
        }));

      if (pricesToUpdate.length === 0) {
        throw new Error('Please enter valid prices for at least one stock');
      }

      // Delete existing prices for this round and stocks
      const stockIds = pricesToUpdate.map(p => p.stock_id);
      await supabase
        .from('stock_prices')
        .delete()
        .eq('round_number', parseInt(selectedRound))
        .in('stock_id', stockIds);

      // Insert new prices
      const { error } = await supabase
        .from('stock_prices')
        .insert(pricesToUpdate);

      if (error) throw error;

      toast({
        title: "Prices Updated",
        description: `Stock prices updated for Round ${selectedRound}`,
      });
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoundChange = async (newRound: number) => {
    setLoading(true);
    try {
      console.log('Updating round from', gameSettings?.current_round, 'to', newRound);
      console.log('Game settings ID:', gameSettings?.id);
      
      // Determine if trading should be allowed in the new round
      const isClosingBell = newRound === (gameSettings?.closing_bell_round || 9);
      const tradingAllowed = !isClosingBell;
      
      // Update the game settings with round and trading status
      const { data, error } = await supabase
        .from('game_settings')
        .update({ 
          current_round: newRound,
          trading_allowed: tradingAllowed
        })
        .eq('id', gameSettings?.id)
        .select();

      console.log('Update result:', { data, error });

      if (error) throw error;

      const roundDescription = isClosingBell 
        ? `🔔 Closing Bell - Round ${newRound} (Trading Disabled)`
        : `Game is now in Round ${newRound}`;

      toast({
        title: "Round Updated",
        description: roundDescription,
      });

      // Reload admin data to reflect changes
      await loadAdminData();
    } catch (error: any) {
      console.error('Round update error:', error);
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await loadAdminData();
      toast({
        title: "Dashboard Refreshed",
        description: "All data has been updated",
      });
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh dashboard data",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handlePasswordReset = async (teamId: string, teamNumber: number) => {
    // Generate a secure password as suggestion
    const suggestedPassword = generateSecurePassword(8);
    
    const choice = confirm(
      `Reset password for Team #${teamNumber}?\n\n` +
      `Click OK to use auto-generated password: "${suggestedPassword}"\n` +
      `Click Cancel to enter a custom password`
    );
    
    let newPassword: string | null;
    
    if (choice) {
      // Use auto-generated password
      newPassword = suggestedPassword;
    } else {
      // Ask for custom password
      newPassword = prompt(`Enter custom password for Team #${teamNumber}:`);
      
      if (!newPassword) {
        return; // User cancelled
      }

      if (newPassword.length < 4) {
        toast({
          title: "Invalid Password",
          description: "Password must be at least 4 characters long",
          variant: "destructive",
        });
        return;
      }
    }

    setLoading(true);
    try {
      console.log(`Resetting password for team ${teamNumber} with ID: ${teamId}`);
      
      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);
      
      // Update the team's password
      const { error } = await supabase
        .from('teams')
        .update({ password_hash: hashedPassword })
        .eq('id', teamId);

      if (error) {
        console.error('Password reset error:', error);
        throw error;
      }

      console.log(`Password reset successful for team ${teamNumber}`);

      toast({
        title: "Password Reset Successful",
        description: `New password set for Team #${teamNumber}. Share this password: "${newPassword}"`,
      });

      // Also show an alert with the password for easy copying
      alert(
        `Password Reset Successful!\n\n` +
        `Team #${teamNumber} new password: ${newPassword}\n\n` +
        `Please share this password with the team members.`
      );

    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast({
        title: "Password Reset Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTeamDelete = async (teamId: string, teamNumber: number) => {
    if (!confirm(`Are you sure you want to delete Team #${teamNumber}? This action cannot be undone and will also delete all associated trades and portfolio data.`)) {
      return;
    }

    setLoading(true);
    try {
      console.log(`Attempting to delete team ${teamNumber} with ID: ${teamId}`);
      
      // Delete the team - CASCADE DELETE will handle related records
      const { error: teamError } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);

      if (teamError) {
        console.error('Team deletion error:', teamError);
        throw teamError;
      }

      console.log(`Team ${teamNumber} deleted successfully`);

      toast({
        title: "Team Deleted",
        description: `Team #${teamNumber} has been successfully deleted. The team will be automatically logged out.`,
      });

      // Refresh data
      await loadAdminData();
    } catch (error: any) {
      console.error('Error deleting team:', error);
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfigUpdate = async () => {
    if (!gameSettings?.id) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('game_settings')
        .update({
          initial_team_balance: configSettings.initial_team_balance,
          max_stocks: configSettings.max_stocks,
          brokerage_percentage: configSettings.brokerage_percentage / 100 // Convert back to decimal
        })
        .eq('id', gameSettings.id);

      if (error) throw error;

      toast({
        title: "Configuration Updated",
        description: "Game settings have been successfully updated",
      });

      loadAdminData();
    } catch (error: any) {
      console.error('Error updating configuration:', error);
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStock = async (stockId: string, currentStatus: boolean) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('stocks')
        .update({ is_active: !currentStatus })
        .eq('id', stockId);

      if (error) throw error;

      toast({
        title: "Stock Updated",
        description: `Stock has been ${!currentStatus ? 'activated' : 'deactivated'}`,
      });

      loadAdminData();
    } catch (error: any) {
      console.error('Error updating stock:', error);
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('currentAdmin');
    navigate('/');
  };

  if (!gameSettings) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-primary">Admin Dashboard</h1>
            <p className="text-muted-foreground">Stock Market Trading Game Control Panel</p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleManualRefresh} 
              variant="outline"
              disabled={refreshing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button onClick={handleLogout} variant="outline">Logout</Button>
          </div>
        </div>

        {/* Game Control */}
        <Card>
          <CardHeader>
            <CardTitle>Game Control</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label>Current Round:</Label>
              <Select 
                value={gameSettings.current_round.toString()}
                onValueChange={(value) => handleRoundChange(parseInt(value))}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: gameSettings.total_rounds }, (_, i) => i + 1).map(round => {
                    const isClosingBell = round === (gameSettings.closing_bell_round || 9);
                    return (
                      <SelectItem key={round} value={round.toString()}>
                        {isClosingBell ? `🔔 Round ${round} (Closing Bell)` : `Round ${round}`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <Badge variant={gameSettings.is_game_active ? 'default' : 'secondary'}>
              {gameSettings.is_game_active ? 'Active' : 'Inactive'}
            </Badge>
            {gameSettings.current_round === (gameSettings.closing_bell_round || 9) && (
              <Badge variant="destructive" className="bg-red-600">
                🔔 Closing Bell - Trading Disabled
              </Badge>
            )}
            {gameSettings.trading_allowed === false && gameSettings.current_round !== (gameSettings.closing_bell_round || 9) && (
              <Badge variant="outline" className="border-orange-500 text-orange-600">
                Trading Disabled
              </Badge>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="teams" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="teams">Team Management</TabsTrigger>
            <TabsTrigger value="stocks">Stock Management</TabsTrigger>
            <TabsTrigger value="prices">Price Management</TabsTrigger>
            <TabsTrigger value="config">Game Config</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          </TabsList>

          {/* Team Management */}
          <TabsContent value="teams">
            <Card>
              <CardHeader>
                <CardTitle>Team Management</CardTitle>
                <CardDescription>Approve or reject team registrations</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team #</TableHead>
                      <TableHead>Players</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Cash Balance</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teams.map(team => (
                      <TableRow key={team.id}>
                        <TableCell className="font-medium">{team.team_number}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {team.players.map((player, index) => (
                              <div key={index} className="text-sm">
                                {player.name} - {player.phone_number}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            team.status === 'approved' ? 'default' :
                            team.status === 'rejected' ? 'destructive' : 'secondary'
                          }>
                            {team.status}
                          </Badge>
                        </TableCell>
                        <TableCell>₹{team.cash_balance.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {team.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleTeamStatusChange(team.id, 'approved')}
                                  disabled={loading}
                                  className="bg-success hover:bg-success/90"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleTeamStatusChange(team.id, 'rejected')}
                                  disabled={loading}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePasswordReset(team.id, team.team_number)}
                              disabled={loading}
                              className="border-blue-600 text-blue-600 hover:bg-blue-50"
                              title="Reset Password"
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleTeamDelete(team.id, team.team_number)}
                              disabled={loading}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stock Management */}
          <TabsContent value="stocks">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Add New Stock</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Label>Symbol</Label>
                      <Input
                        value={newStock.symbol}
                        onChange={(e) => setNewStock({...newStock, symbol: e.target.value})}
                        placeholder="e.g., AAPL"
                      />
                    </div>
                    <div className="flex-1">
                      <Label>Company Name</Label>
                      <Input
                        value={newStock.name}
                        onChange={(e) => setNewStock({...newStock, name: e.target.value})}
                        placeholder="e.g., Apple Inc."
                      />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={handleAddStock} disabled={loading}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Stock
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Current Stocks ({stocks.length}/20)</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Symbol</TableHead>
                        <TableHead>Company Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stocks.map(stock => (
                        <TableRow key={stock.id}>
                          <TableCell className="font-medium">{stock.symbol}</TableCell>
                          <TableCell>{stock.name}</TableCell>
                          <TableCell>
                            <Badge variant={stock.is_active ? 'default' : 'secondary'}>
                              {stock.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleToggleStockStatus(stock.id, stock.symbol, stock.is_active)}
                                disabled={loading}
                                title={`${stock.is_active ? 'Deactivate' : 'Activate'} ${stock.symbol}`}
                              >
                                {stock.is_active ? (
                                  <ToggleRight className="h-4 w-4 text-green-600" />
                                ) : (
                                  <ToggleLeft className="h-4 w-4 text-gray-400" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteStock(stock.id, stock.symbol)}
                                disabled={loading}
                                title={`Delete ${stock.symbol}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Game Configuration */}
          <TabsContent value="config">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Game Configuration</CardTitle>
                  <CardDescription>Configure game settings and parameters</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="initial_balance">Initial Team Balance (₹)</Label>
                      <Input
                        id="initial_balance"
                        type="number"
                        value={configSettings.initial_team_balance}
                        onChange={(e) => setConfigSettings({
                          ...configSettings,
                          initial_team_balance: parseInt(e.target.value) || 0
                        })}
                        placeholder="5000000"
                      />
                      <p className="text-sm text-muted-foreground">
                        Current: ₹{configSettings.initial_team_balance.toLocaleString()}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="max_stocks">Maximum Stocks</Label>
                      <Input
                        id="max_stocks"
                        type="number"
                        value={configSettings.max_stocks}
                        onChange={(e) => setConfigSettings({
                          ...configSettings,
                          max_stocks: parseInt(e.target.value) || 0
                        })}
                        placeholder="25"
                      />
                      <p className="text-sm text-muted-foreground">
                        Current active stocks: {stocks.filter(s => s.is_active).length}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="brokerage">Brokerage Percentage (%)</Label>
                      <Input
                        id="brokerage"
                        type="number"
                        step="0.1"
                        value={configSettings.brokerage_percentage}
                        onChange={(e) => setConfigSettings({
                          ...configSettings,
                          brokerage_percentage: parseFloat(e.target.value) || 0
                        })}
                        placeholder="1.0"
                      />
                      <p className="text-sm text-muted-foreground">
                        Current: {configSettings.brokerage_percentage}%
                      </p>
                    </div>
                  </div>

                  <Button onClick={handleConfigUpdate} disabled={loading}>
                    <Edit className="h-4 w-4 mr-2" />
                    Update Configuration
                  </Button>
                  
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> To add, remove, or manage individual stocks, please use the 
                      <strong> "Stock Management"</strong> tab. The "Maximum Stocks" setting here only controls 
                      the upper limit for the total number of stocks in the game.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Price Management */}
          <TabsContent value="prices">
            <Card>
              <CardHeader>
                <CardTitle>Stock Price Management</CardTitle>
                <CardDescription>Set stock prices for each round</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Label>Round:</Label>
                  <Select value={selectedRound} onValueChange={setSelectedRound}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: gameSettings.total_rounds }, (_, i) => i + 1).map(round => {
                        const isClosingBell = round === (gameSettings.closing_bell_round || 9);
                        return (
                          <SelectItem key={round} value={round.toString()}>
                            {isClosingBell ? `🔔 Round ${round} (Closing Bell)` : `Round ${round}`}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stocks.map(stock => (
                    <div key={stock.id} className="space-y-2">
                      <Label>{stock.symbol} - {stock.name}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={stockPrices[stock.id] || ''}
                        onChange={(e) => setStockPrices({
                          ...stockPrices,
                          [stock.id]: e.target.value
                        })}
                        placeholder="Enter price"
                      />
                    </div>
                  ))}
                </div>

                <Button onClick={handleUpdateStockPrices} disabled={loading}>
                  <Edit className="h-4 w-4 mr-2" />
                  Update Prices for Round {selectedRound}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Leaderboard */}
          <TabsContent value="leaderboard">
            <Card>
              <CardHeader>
                <CardTitle>Team Leaderboard</CardTitle>
                <CardDescription>Teams ranked by total value (Portfolio + Cash)</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Team #</TableHead>
                      <TableHead>Cash Balance</TableHead>
                      <TableHead>Portfolio Value</TableHead>
                      <TableHead>Total Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaderboard.map((team, index) => (
                      <TableRow key={team.team_number}>
                        <TableCell className="font-bold">#{index + 1}</TableCell>
                        <TableCell className="font-medium">{team.team_number}</TableCell>
                        <TableCell>₹{team.cash_balance.toLocaleString()}</TableCell>
                        <TableCell>₹{team.portfolio_value.toLocaleString()}</TableCell>
                        <TableCell className="font-bold">₹{team.total_value.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
