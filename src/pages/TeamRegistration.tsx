import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const TeamRegistration = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    teamNumber: '',
    password: '',
    confirmPassword: '',
    players: [
      { name: '', phone: '' },
      { name: '', phone: '' },
      { name: '', phone: '' },
      { name: '', phone: '' }
    ]
  });

  const handlePlayerChange = (index: number, field: 'name' | 'phone', value: string) => {
    const updatedPlayers = [...formData.players];
    updatedPlayers[index][field] = value;
    setFormData({ ...formData, players: updatedPlayers });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validation
      if (!formData.teamNumber || !formData.password) {
        throw new Error('Team number and password are required');
      }

      if (formData.password !== formData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      if (formData.players.some(player => !player.name || !player.phone)) {
        throw new Error('All player names and phone numbers are required');
      }

      // Check if team number already exists
      const { data: existingTeam } = await supabase
        .from('teams')
        .select('team_number')
        .eq('team_number', parseInt(formData.teamNumber))
        .single();

      if (existingTeam) {
        throw new Error('Team number already exists');
      }

      // Create team
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert([{
          team_number: parseInt(formData.teamNumber),
          password_hash: formData.password, // In real app, hash this
          status: 'pending'
        }])
        .select()
        .single();

      if (teamError) throw teamError;

      // Create players
      const playersToInsert = formData.players.map(player => ({
        team_id: team.id,
        name: player.name,
        phone_number: player.phone
      }));

      const { error: playersError } = await supabase
        .from('players')
        .insert(playersToInsert);

      if (playersError) throw playersError;

      toast({
        title: "Registration Successful!",
        description: "Your team has been registered and is pending admin approval.",
      });

      navigate('/team-login');
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary">Team Registration</CardTitle>
          <CardDescription>Register your team for the Stock Market Trading Game</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="Confirm password"
                required
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Team Players (4 required)</h3>
              {formData.players.map((player, index) => (
                <div key={index} className="grid grid-cols-2 gap-4 p-4 border rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor={`player-${index}-name`}>Player {index + 1} Name</Label>
                    <Input
                      id={`player-${index}-name`}
                      value={player.name}
                      onChange={(e) => handlePlayerChange(index, 'name', e.target.value)}
                      placeholder={`Player ${index + 1} name`}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`player-${index}-phone`}>Phone Number</Label>
                    <Input
                      id={`player-${index}-phone`}
                      value={player.phone}
                      onChange={(e) => handlePlayerChange(index, 'phone', e.target.value)}
                      placeholder="Phone number"
                      required
                    />
                  </div>
                </div>
              ))}
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
                {loading ? 'Registering...' : 'Register Team'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamRegistration;