import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, RefreshCw } from 'lucide-react';

interface Team {
  id: string;
  team_number: number;
  cash_balance: number;
  status: string;
}

interface Stock {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
}

interface Portfolio {
  id: string;
  stock_id: string;
  quantity: number;
  avg_buy_price: number;
  stocks: {
    symbol: string;
    name: string;
  };
}

interface GameSettings {
  current_round: number;
  total_rounds: number;
  is_game_active: boolean;
}

const PlayerDashboard = () => {
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [gameSettings, setGameSettings] = useState<GameSettings | null>(null);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio[]>([]);
  const [selectedStock, setSelectedStock] = useState('');
  const [quantity, setQuantity] = useState('');
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if team is logged in
    const currentTeam = localStorage.getItem('currentTeam');
    if (!currentTeam) {
      navigate('/team-login');
      return;
    }

    const teamData = JSON.parse(currentTeam);
    setTeam(teamData);
    loadGameData(teamData.id);

    // Set up real-time subscription for game settings changes
    const gameSettingsSubscription = supabase
      .channel('game_settings_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_settings'
        },
        (payload) => {
          console.log('Game settings updated via real-time:', payload);
          // Reload game data when settings change
          loadGameData(teamData.id);
          
          // Show notification to user
          toast({
            title: "Game Updated",
            description: `Round changed to ${payload.new.current_round}`,
          });
        }
      )
      .subscribe();

    // Also set up polling as a fallback (every 10 seconds)
    const pollInterval = setInterval(() => {
      loadGameData(teamData.id);
    }, 10000);

    // Clean up subscription and polling on component unmount
    return () => {
      gameSettingsSubscription.unsubscribe();
      clearInterval(pollInterval);
    };
  }, [navigate]);

  const loadGameData = async (teamId: string) => {
    try {
      // Load game settings
      const { data: settings, error: settingsError } = await supabase
        .from('game_settings')
        .select('*')
        .single();
      
      if (settingsError) {
        console.error('Error loading game settings:', settingsError);
        return;
      }
      
      setGameSettings(settings);

      // Load stocks with current round prices
      const { data: stockData, error: stockError } = await supabase
        .from('stocks')
        .select(`
          id,
          symbol,
          name,
          stock_prices!inner(price)
        `)
        .eq('is_active', true)
        .eq('stock_prices.round_number', settings?.current_round || 1);

      if (stockError) {
        console.error('Error loading stocks:', stockError);
      } else {
        const formattedStocks = stockData?.map(stock => ({
          id: stock.id,
          symbol: stock.symbol,
          name: stock.name,
          current_price: stock.stock_prices[0]?.price || 0
        })) || [];
        setStocks(formattedStocks);
      }

      // Load portfolio
      const { data: portfolioData, error: portfolioError } = await supabase
        .from('portfolio')
        .select(`
          *,
          stocks(symbol, name)
        `)
        .eq('team_id', teamId);
      
      if (portfolioError) {
        console.error('Error loading portfolio:', portfolioError);
      } else {
        setPortfolio(portfolioData || []);
      }

      // Update team balance
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('cash_balance')
        .eq('id', teamId)
        .single();
      
      if (teamError) {
        console.error('Error loading team data:', teamError);
      } else if (teamData) {
        setTeam(prev => prev ? { ...prev, cash_balance: teamData.cash_balance } : null);
      }
    } catch (error) {
      console.error('Error loading game data:', error);
    }
  };

  const handleTrade = async () => {
    if (!team || !gameSettings || !selectedStock || !quantity) {
      toast({
        title: "Invalid Trade",
        description: "Please fill all required fields.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const stock = stocks.find(s => s.id === selectedStock);
      if (!stock) throw new Error('Stock not found');

      const tradeQuantity = parseInt(quantity);
      const price = stock.current_price;
      const grossAmount = tradeQuantity * price;
      const brokerage = grossAmount * 0.01; // 1% brokerage
      const totalAmount = grossAmount + brokerage;

      // Check trading rules
      if (tradeType === 'sell' && gameSettings.current_round < 4) {
        throw new Error('Selling is not allowed in rounds 1-3');
      }

      if (tradeType === 'buy' && totalAmount > team.cash_balance) {
        throw new Error('Insufficient cash balance');
      }

      if (tradeType === 'sell') {
        const portfolioItem = portfolio.find(p => p.stock_id === selectedStock);
        if (!portfolioItem || portfolioItem.quantity < tradeQuantity) {
          throw new Error('Insufficient stock quantity');
        }
      }

      // Execute trade
      const { error } = await supabase
        .from('trades')
        .insert([{
          team_id: team.id,
          stock_id: selectedStock,
          trade_type: tradeType,
          quantity: tradeQuantity,
          price: price,
          brokerage: brokerage,
          total_amount: tradeType === 'buy' ? totalAmount : grossAmount - brokerage,
          round_number: gameSettings.current_round
        }]);

      if (error) throw error;

      toast({
        title: "Trade Successful!",
        description: `${tradeType === 'buy' ? 'Bought' : 'Sold'} ${tradeQuantity} shares of ${stock.symbol}`,
      });

      // Reload data
      loadGameData(team.id);
      setSelectedStock('');
      setQuantity('');
    } catch (error: any) {
      toast({
        title: "Trade Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculatePortfolioValue = () => {
    return portfolio.reduce((total, item) => {
      const currentStock = stocks.find(s => s.id === item.stock_id);
      return total + (item.quantity * (currentStock?.current_price || 0));
    }, 0);
  };

  const calculateProfitLoss = (portfolioItem: Portfolio) => {
    const currentStock = stocks.find(s => s.id === portfolioItem.stock_id);
    if (!currentStock) return { amount: 0, percentage: 0 };
    
    const currentValue = portfolioItem.quantity * currentStock.current_price;
    const investedValue = portfolioItem.quantity * portfolioItem.avg_buy_price;
    const profitLoss = currentValue - investedValue;
    const percentage = ((profitLoss / investedValue) * 100);
    
    return { amount: profitLoss, percentage };
  };

  const handleLogout = () => {
    localStorage.removeItem('currentTeam');
    navigate('/');
  };

  if (!team || !gameSettings) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;
  }

  const portfolioValue = calculatePortfolioValue();
  const totalValue = team.cash_balance + portfolioValue;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-primary">Team {team.team_number} Dashboard</h1>
            <p className="text-muted-foreground">Round {gameSettings.current_round} of {gameSettings.total_rounds}</p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => loadGameData(team.id)} 
              variant="outline" 
              size="sm"
              title="Refresh data"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={handleLogout} variant="outline">Logout</Button>
          </div>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cash Balance</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{team.cash_balance.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{portfolioValue.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{totalValue.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Round</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{gameSettings.current_round}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Trading Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Trade Stocks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={tradeType === 'buy' ? 'default' : 'outline'}
                  onClick={() => setTradeType('buy')}
                  className={`flex-1 ${
                    tradeType === 'buy' 
                      ? 'bg-green-600 hover:bg-green-700 text-white' 
                      : 'border-green-600 text-green-600 hover:bg-green-50'
                  }`}
                >
                  Buy
                </Button>
                <Button
                  variant={tradeType === 'sell' ? 'default' : 'outline'}
                  onClick={() => setTradeType('sell')}
                  className={`flex-1 ${
                    tradeType === 'sell' 
                      ? 'bg-red-600 hover:bg-red-700 text-white' 
                      : 'border-red-600 text-red-600 hover:bg-red-50'
                  }`}
                  disabled={gameSettings.current_round < 4}
                >
                  Sell
                </Button>
              </div>

              {gameSettings.current_round < 4 && (
                <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                  Selling is only allowed from Round 4 onwards
                </div>
              )}

              <div className="space-y-2">
                <Label>Select Stock</Label>
                <Select value={selectedStock} onValueChange={setSelectedStock}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a stock" />
                  </SelectTrigger>
                  <SelectContent>
                    {stocks.map(stock => (
                      <SelectItem key={stock.id} value={stock.id}>
                        {stock.symbol} - {stock.name} (₹{stock.current_price})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Enter quantity"
                  min="1"
                />
              </div>

              {selectedStock && quantity && (
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span>Gross Amount:</span>
                    <span>₹{(parseInt(quantity) * (stocks.find(s => s.id === selectedStock)?.current_price || 0)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Brokerage (1%):</span>
                    <span>₹{(parseInt(quantity) * (stocks.find(s => s.id === selectedStock)?.current_price || 0) * 0.01).toLocaleString()}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Total Amount:</span>
                    <span>₹{(parseInt(quantity) * (stocks.find(s => s.id === selectedStock)?.current_price || 0) * 1.01).toLocaleString()}</span>
                  </div>
                </div>
              )}

              <Button 
                onClick={handleTrade} 
                disabled={loading || !selectedStock || !quantity}
                variant={tradeType === 'sell' ? 'destructive' : 'default'}
                className={`w-full ${
                  tradeType === 'buy' 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {loading ? 'Processing...' : `Confirm ${tradeType === 'buy' ? 'Buy' : 'Sell'}`}
              </Button>
            </CardContent>
          </Card>

          {/* Portfolio */}
          <Card>
            <CardHeader>
              <CardTitle>Portfolio</CardTitle>
              <CardDescription>Your current stock holdings</CardDescription>
            </CardHeader>
            <CardContent>
              {portfolio.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No stocks in portfolio</p>
              ) : (
                <div className="space-y-4">
                  {portfolio.map(item => {
                    const currentStock = stocks.find(s => s.id === item.stock_id);
                    const pl = calculateProfitLoss(item);
                    
                    return (
                      <div key={item.id} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-semibold">{item.stocks.symbol}</h4>
                            <p className="text-sm text-muted-foreground">{item.stocks.name}</p>
                          </div>
                          <Badge variant={pl.amount >= 0 ? 'default' : 'destructive'}>
                            {pl.amount >= 0 ? '+' : ''}₹{pl.amount.toFixed(2)}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Quantity</p>
                            <p className="font-medium">{item.quantity}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Avg Buy Price</p>
                            <p className="font-medium">₹{item.avg_buy_price}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Current Price</p>
                            <p className="font-medium">₹{currentStock?.current_price || 0}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">P&L %</p>
                            <p className={`font-medium ${pl.percentage >= 0 ? 'text-success' : 'text-destructive'}`}>
                              {pl.percentage >= 0 ? '+' : ''}{pl.percentage.toFixed(2)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PlayerDashboard;