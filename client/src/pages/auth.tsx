import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { insertUserSchema } from "@shared/routes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

// Auth schemas
const loginSchema = z.object({
  username: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = insertUserSchema.extend({
  email: z.string().email("Please enter a valid email (@olemiss.edu or @k-state.edu)"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Helper to get saved email from localStorage
function getSavedEmail(): string {
  if (typeof window === 'undefined') return '';
  const savedEmail = localStorage.getItem('rebelchefs_remembered_email');
  const wasRemembered = localStorage.getItem('rebelchefs_remember_me') === 'true';
  return (savedEmail && wasRemembered) ? savedEmail : '';
}

function getRememberMeState(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('rebelchefs_remember_me') === 'true';
}

export default function AuthPage() {
  const { user, login, register, isLoggingIn, isRegistering } = useAuth();
  const [activeTab, setActiveTab] = useState("login");
  const [rememberMe, setRememberMe] = useState(getRememberMeState);

  // Forms - initialize with saved email if remembered
  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: getSavedEmail(),
      password: '',
    }
  });

  if (user) {
    if (user.role === 'admin') return <Redirect to="/admin" />;
    if (user.role === 'chef') return <Redirect to="/chef" />;
    return <Redirect to="/" />;
  }

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: "user",
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    }
  });

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left: Branding */}
      <div className="hidden lg:flex flex-col justify-center items-center p-12 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1541544744870-0840428e938e?q=80&w=2053&auto=format&fit=crop')] opacity-10 bg-cover bg-center mix-blend-overlay" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-blue-900/90" />
        
        <div className="relative z-10 text-center text-primary-foreground max-w-lg">
          <h1 className="text-6xl font-display font-bold mb-6 tracking-tight">REBEL CHEFS</h1>
          <p className="text-xl text-primary-foreground/80 font-light leading-relaxed">
            Premium dining management for fraternities. View weekly menus, track macros, and manage meal requests with ease.
          </p>
        </div>
      </div>

      {/* Right: Auth Forms */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-3xl font-display font-bold text-primary tracking-tight">REBEL CHEFS</h1>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8 h-12">
              <TabsTrigger value="login" className="text-base font-medium">Sign In</TabsTrigger>
              <TabsTrigger value="register" className="text-base font-medium">Create Account</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card className="border-none shadow-none">
                <CardHeader className="px-0 pt-0">
                  <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
                  <CardDescription>Enter your email to access your dashboard</CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  <form onSubmit={loginForm.handleSubmit((data) => {
                    // Save or clear remembered email based on checkbox
                    if (rememberMe) {
                      localStorage.setItem('rebelchefs_remembered_email', data.username);
                      localStorage.setItem('rebelchefs_remember_me', 'true');
                    } else {
                      localStorage.removeItem('rebelchefs_remembered_email');
                      localStorage.removeItem('rebelchefs_remember_me');
                    }
                    login(data);
                  })} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        placeholder="name@school.edu" 
                        className="h-11"
                        data-testid="input-login-email"
                        {...loginForm.register("username")} 
                      />
                      {loginForm.formState.errors.username && (
                        <p className="text-sm text-destructive">{loginForm.formState.errors.username.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input 
                        id="password" 
                        type="password"
                        className="h-11"
                        data-testid="input-login-password"
                        {...loginForm.register("password")} 
                      />
                      {loginForm.formState.errors.password && (
                        <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="remember-me" 
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(checked === true)}
                        data-testid="checkbox-remember-me"
                      />
                      <Label htmlFor="remember-me" className="text-sm font-normal cursor-pointer">
                        Remember my email
                      </Label>
                    </div>
                    <Button type="submit" className="w-full h-11 text-base" disabled={isLoggingIn} data-testid="button-login">
                      {isLoggingIn ? "Signing in..." : "Sign In"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="register">
              <Card className="border-none shadow-none">
                <CardHeader className="px-0 pt-0">
                  <CardTitle className="text-2xl font-bold">Get started</CardTitle>
                  <CardDescription>Create an account to view your fraternity's menu</CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  <form onSubmit={registerForm.handleSubmit((data) => {
                    const { confirmPassword, ...rest } = data;
                    register(rest);
                  })} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Full Name</Label>
                      <Input placeholder="John Doe" className="h-11" {...registerForm.register("name")} />
                      {registerForm.formState.errors.name && <p className="text-sm text-destructive">{registerForm.formState.errors.name.message}</p>}
                    </div>
                    
                    <div className="space-y-2">
                      <Label>School Email</Label>
                      <Input placeholder="name@olemiss.edu" className="h-11" {...registerForm.register("email")} />
                      <p className="text-xs text-muted-foreground">Must use .edu email to verify fraternity affiliation</p>
                      {registerForm.formState.errors.email && <p className="text-sm text-destructive">{registerForm.formState.errors.email.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Password</Label>
                        <Input type="password" className="h-11" {...registerForm.register("password")} />
                        {registerForm.formState.errors.password && <p className="text-sm text-destructive">{registerForm.formState.errors.password.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label>Confirm</Label>
                        <Input type="password" className="h-11" {...registerForm.register("confirmPassword")} />
                        {registerForm.formState.errors.confirmPassword && <p className="text-sm text-destructive">{registerForm.formState.errors.confirmPassword.message}</p>}
                      </div>
                    </div>

                    <Button type="submit" className="w-full h-11 text-base" disabled={isRegistering}>
                      {isRegistering ? "Creating account..." : "Create Account"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
