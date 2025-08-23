import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { verifyPassword } from '@/lib/auth';

const TeamLogin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    teamNumber: '',
    password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: team, error } = await supabase
        .from('teams')
        .select('*')
        .eq('team_number', parseInt(formData.teamNumber))
        .single();

      if (error || !team) {
        throw new Error('Invalid team number or password');
      }

      // Verify password using bcrypt
      const isPasswordValid = await verifyPassword(formData.password, team.password_hash);
      
      if (!isPasswordValid) {
        throw new Error('Invalid team number or password');
      }

      if (team.status !== 'approved') {
        throw new Error(`Team status: ${team.status}. Please wait for admin approval.`);
      }

      // Store team info in localStorage for session management
      localStorage.setItem('currentTeam', JSON.stringify(team));
      
      toast({
        title: "Login Successful!",
        description: `Welcome Team ${team.team_number}!`,
      });

      navigate('/player-dashboard');
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary">Team Login</CardTitle>
          <CardDescription>Login to access your team dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="teamNumber">Team Number</Label>
              <Input
                id="teamNumber"
                type="number"
                value={formData.teamNumber}
                onChange={(e) => setFormData({ ...formData, teamNumber: e.target.value })}
                placeholder="Enter team number"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter password"
                required
              />
            </div>

            <div className="flex gap-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate('/')}
                className="flex-1"
              >
                Back to Home
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'Logging in...' : 'Login'}
              </Button>
            </div>

            <div className="text-center">
              <Button 
                type="button" 
                variant="link" 
                onClick={() => navigate('/team-registration')}
                className="text-primary"
              >
                Don't have a team? Register here
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamLogin;