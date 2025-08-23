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
import { Check, X, Plus, Edit, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

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
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [gameSettings, setGameSettings] = useState<GameSettings | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Stock management
  const [newStock, setNewStock] = useState({ symbol: '', name: '' });
  const [selectedRound, setSelectedRound] = useState('1');
  const [stockPrices, setStockPrices] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    // Check if admin is logged in
    const currentAdmin = localStorage.getItem('currentAdmin');
    if (!currentAdmin) {
      navigate('/admin-login');
      return;
    }

    loadAdminData();
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
      
      // Update the game settings - use a more reliable approach
      const { data, error } = await supabase
        .from('game_settings')
        .update({ current_round: newRound })
        .eq('id', gameSettings?.id)
        .select();

      console.log('Update result:', { data, error });

      if (error) throw error;

      toast({
        title: "Round Updated",
        description: `Game is now in Round ${newRound}`,
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
          <Button onClick={handleLogout} variant="outline">Logout</Button>
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
                  {Array.from({ length: gameSettings.total_rounds }, (_, i) => i + 1).map(round => (
                    <SelectItem key={round} value={round.toString()}>
                      {round}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Badge variant={gameSettings.is_game_active ? 'default' : 'secondary'}>
              {gameSettings.is_game_active ? 'Active' : 'Inactive'}
            </Badge>
          </CardContent>
        </Card>

        <Tabs defaultValue="teams" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="teams">Team Management</TabsTrigger>
            <TabsTrigger value="stocks">Stock Management</TabsTrigger>
            <TabsTrigger value="prices">Price Management</TabsTrigger>
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
                          {team.status === 'pending' && (
                            <div className="flex gap-2">
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
                            </div>
                          )}
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
                      {Array.from({ length: gameSettings.total_rounds }, (_, i) => i + 1).map(round => (
                        <SelectItem key={round} value={round.toString()}>
                          {round}
                        </SelectItem>
                      ))}
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