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
import logoImg from "@assets/rebelcehfs_1770767284846.png";

// Auth schemas
const loginSchema = z.object({
  username: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = insertUserSchema.extend({
  name: z.string().trim().min(2, "Please enter your full name"),
  email: z.string()
    .trim()
    .email("Please enter a valid school email")
    .refine((value) => value.endsWith("@olemiss.edu") || value.endsWith("@k-state.edu"), {
      message: "Use your @olemiss.edu or @k-state.edu email",
    }),
  password: z.string().min(8, "Password must be at least 8 characters"),
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
      <div className="hidden lg:flex flex-col justify-center items-center p-12 bg-neutral-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(247,181,77,0.08),transparent_70%)]" />
        <div className="relative z-10 text-center max-w-lg flex flex-col items-center gap-8">
          <img src={logoImg} alt="Rebel Chefs" className="w-80 h-auto" data-testid="img-logo-desktop" />
          <div className="h-px w-16 bg-amber-500/60" />
          <p className="text-lg text-neutral-400 font-light leading-relaxed tracking-wide">
            Premium dining management for fraternities. View weekly menus, track macros, and manage meal requests with ease.
          </p>
          <p className="text-xs uppercase tracking-[0.3em] text-amber-500/70 font-semibold">
            Join the Resistance
          </p>
        </div>
      </div>

      {/* Right: Auth Forms */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex flex-col items-center mb-8">
            <img src={logoImg} alt="Rebel Chefs" className="w-48 h-auto" data-testid="img-logo-mobile" />
            <div className="h-px w-12 bg-amber-500/40 mt-4" />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8 h-12 bg-neutral-100 border border-border">
              <TabsTrigger value="login" className="text-base font-semibold data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm">Sign In</TabsTrigger>
              <TabsTrigger value="register" className="text-base font-semibold data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm">Create Account</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card className="border-none shadow-none">
                <CardHeader className="px-0 pt-0">
                  <CardTitle className="text-2xl font-black tracking-tight">Welcome back</CardTitle>
                  <CardDescription className="text-muted-foreground">Enter your email to access your dashboard</CardDescription>
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
                    <Button type="submit" className="w-full h-12 text-base font-semibold bg-amber-500 hover:bg-amber-600 text-black shadow-sm" disabled={isLoggingIn} data-testid="button-login">
                      {isLoggingIn ? "Signing in..." : "Sign In"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="register">
              <Card className="border-none shadow-none">
                <CardHeader className="px-0 pt-0">
                  <CardTitle className="text-2xl font-black tracking-tight">Get started</CardTitle>
                  <CardDescription className="text-muted-foreground">Create an account with your supported school email to access your house menu</CardDescription>
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
                      <p className="text-xs text-muted-foreground">Supported domains: @olemiss.edu and @k-state.edu</p>
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

                    <Button type="submit" className="w-full h-12 text-base font-semibold bg-amber-500 hover:bg-amber-600 text-black shadow-sm" disabled={isRegistering}>
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
