import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { generateSecurePassword, hashPassword } from '@/lib/auth';
import { Copy, RefreshCw } from 'lucide-react';

interface AdminPasswordGeneratorProps {
  onPasswordGenerated?: (password: string, hash: string) => void;
}

const AdminPasswordGenerator = ({ onPasswordGenerated }: AdminPasswordGeneratorProps) => {
  const [password, setPassword] = useState('');
  const [passwordHash, setPasswordHash] = useState('');
  const [loading, setLoading] = useState(false);

  const generatePassword = () => {
    const newPassword = generateSecurePassword(12);
    setPassword(newPassword);
    setPasswordHash('');
  };

  const hashGeneratedPassword = async () => {
    if (!password) {
      toast({
        title: "No Password",
        description: "Please generate a password first.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const hash = await hashPassword(password);
      setPasswordHash(hash);
      onPasswordGenerated?.(password, hash);
      
      toast({
        title: "Password Hashed",
        description: "Password has been securely hashed.",
      });
    } catch (error) {
      toast({
        title: "Hashing Failed",
        description: "Failed to hash the password.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${type} copied to clipboard.`,
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-center">Password Generator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Generated Password</Label>
          <div className="flex gap-2">
            <Input
              value={password}
              readOnly
              placeholder="Click generate to create a password"
              className="font-mono"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={generatePassword}
              title="Generate new password"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            {password && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(password, 'Password')}
                title="Copy password"
              >
                <Copy className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <Button
          onClick={hashGeneratedPassword}
          disabled={!password || loading}
          className="w-full"
        >
          {loading ? 'Hashing...' : 'Generate Hash'}
        </Button>

        {passwordHash && (
          <div className="space-y-2">
            <Label>Bcrypt Hash</Label>
            <div className="flex gap-2">
              <Input
                value={passwordHash}
                readOnly
                className="font-mono text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(passwordHash, 'Hash')}
                title="Copy hash"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Passwords are 12 characters with mixed case, numbers, and symbols</p>
          <p>• Hashes use bcrypt with 12 salt rounds for security</p>
          <p>• Use the hash in your database, share only the password</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminPasswordGenerator;
