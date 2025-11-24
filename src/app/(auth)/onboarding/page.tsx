"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Building2, CheckCircle2, ArrowRight } from "lucide-react";
import { createTenantAndCompleteOnboarding, checkSlugAvailability } from "./actions";
import { signIn, signOut } from "next-auth/react";

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
  });
  const [slugError, setSlugError] = useState<string | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);

  // Redirect if already completed onboarding
  useEffect(() => {
    if (user?.onboardingCompleted) {
      router.push('/dashboard');
    }
  }, [user, router]);

  // Auto-generate slug from organization name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setFormData(prev => ({
      ...prev,
      name,
      slug: generateSlug(name)
    }));
  };

  const handleSlugChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setFormData(prev => ({ ...prev, slug }));
    
    if (slug.length >= 3) {
      setSlugChecking(true);
      setSlugError(null);
      
      // Debounce slug checking
      setTimeout(async () => {
        const result = await checkSlugAvailability(slug);
        if (!result.available) {
          setSlugError("This URL is already taken");
        }
        setSlugChecking(false);
      }, 500);
    }
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "User not authenticated. Please sign in again.",
      });
      router.push('/login');
      return;
    }

    if (slugError) {
      toast({
        variant: "destructive",
        title: "Invalid URL",
        description: slugError,
      });
      return;
    }

    setIsLoading(true);

    const data = new FormData();
    data.append('name', formData.name);
    data.append('slug', formData.slug);

    const result = await createTenantAndCompleteOnboarding(user.id, data);

    if (result.success) {
      setStep(3); // Move to success step
      
      // Wait a moment to show success message
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('Onboarding complete - forcing session refresh with re-authentication...');
      
      // The JWT token needs to be regenerated. The most reliable way is to
      // re-authenticate with the OAuth provider, which will trigger a fresh JWT
      // We'll redirect to the OAuth flow which should be seamless for the user
      if (user.email) {
        // Use signIn with the Google provider to trigger re-auth
        // This will be seamless since they're already authenticated with Google
        await signIn('google', { 
          callbackUrl: '/dashboard',
          redirect: true 
        });
      } else {
        // Fallback to hard reload
        window.location.href = '/dashboard';
      }
    } else {
      toast({
        variant: "destructive",
        title: "Setup Failed",
        description: result.error || "Failed to create your organization.",
      });
      setIsLoading(false);
    }
  }, [user, formData, slugError, router, toast]);

  if (!user) {
    return (
      <div className="flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card className="w-full max-w-2xl shadow-xl">
        {step === 1 && (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold">Welcome to NCRelay! 🎉</CardTitle>
              <CardDescription className="text-lg mt-2">
                Let's get you set up in just a few steps
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted/50 rounded-lg p-6 space-y-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h3 className="font-semibold">Create Your Organization</h3>
                    <p className="text-sm text-muted-foreground">Set up your workspace for managing notifications</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h3 className="font-semibold">You'll Be The Admin</h3>
                    <p className="text-sm text-muted-foreground">Full control to invite users and manage settings</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h3 className="font-semibold">Start Routing Notifications</h3>
                    <p className="text-sm text-muted-foreground">Connect your tools and configure integrations</p>
                  </div>
                </div>
              </div>
              <Button onClick={() => setStep(2)} className="w-full" size="lg">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </>
        )}

        {step === 2 && (
          <>
            <CardHeader className="text-center">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-primary" />
              <CardTitle className="text-2xl font-bold">Create Your Organization</CardTitle>
              <CardDescription>
                This will be your workspace for managing notification routing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Organization Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="e.g., Acme Corp, My Company"
                    value={formData.name}
                    onChange={handleNameChange}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">Organization URL</Label>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">ncrelay.com/</span>
                    <Input
                      id="slug"
                      type="text"
                      placeholder="my-org"
                      value={formData.slug}
                      onChange={handleSlugChange}
                      required
                      disabled={isLoading}
                      className={slugError ? "border-destructive" : ""}
                    />
                  </div>
                  {slugChecking && (
                    <p className="text-xs text-muted-foreground">Checking availability...</p>
                  )}
                  {slugError && (
                    <p className="text-xs text-destructive">{slugError}</p>
                  )}
                  {!slugError && formData.slug.length >= 3 && !slugChecking && (
                    <p className="text-xs text-green-600">✓ Available</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    This will be your unique organization identifier
                  </p>
                </div>

                <div className="flex space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading || !!slugError || formData.name.length === 0 || formData.slug.length < 3}
                    className="flex-1"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        Create <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </>
        )}

        {step === 3 && (
          <>
            <CardHeader className="text-center">
              <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-600" />
              <CardTitle className="text-2xl font-bold">All Set! 🎉</CardTitle>
              <CardDescription>
                Your organization has been created successfully
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                Redirecting you to your dashboard...
              </p>
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </CardContent>
          </>
        )}
      </Card>
  );
}
