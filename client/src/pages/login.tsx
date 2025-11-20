import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Building } from "lucide-react";

export default function LoginPage() {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { login, register, isLoginPending, isRegisterPending } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    try {
      if (isRegisterMode) {
        await register({ username, password });
        toast({
          title: "Success",
          description: "Account created successfully!",
        });
      } else {
        await login({ username, password });
        toast({
          title: "Success",
          description: "Logged in successfully!",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || (isRegisterMode ? "Registration failed" : "Login failed"),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-20 w-20 bg-primary rounded-full flex items-center justify-center">
            <Building className="text-primary-foreground text-2xl" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">RentyFi</h2>
          <p className="mt-2 text-sm text-gray-600">Manage your properties and personal finances</p>
        </div>
        
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <h3 className="text-xl font-semibold">
              {isRegisterMode ? "Create Account" : "Sign In"}
            </h3>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="mt-1"
                  placeholder="Enter your username"
                />
              </div>
              
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="mt-1"
                  placeholder="Enter your password"
                />
              </div>
              
              <Button
                type="submit"
                className="w-full"
                disabled={isLoginPending || isRegisterPending}
              >
                {(isLoginPending || isRegisterPending) ? "Loading..." : (isRegisterMode ? "Create Account" : "Sign In")}
              </Button>
            </form>
            
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setIsRegisterMode(!isRegisterMode)}
                className="text-sm text-primary hover:text-primary/80"
              >
                {isRegisterMode ? "Already have an account? Sign in" : "Don't have an account? Register"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
