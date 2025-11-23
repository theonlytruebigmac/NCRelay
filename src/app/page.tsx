"use client";

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoginDialog } from '@/components/auth/LoginDialog';
import { 
  ArrowRight, 
  Zap, 
  Shield, 
  Clock, 
  CheckCircle2, 
  BarChart3,
  Webhook,
  Filter,
  Users,
  Lock,
  Bell,
  Activity
} from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      // Only redirect if user is logged in
      setShouldRedirect(true);
      router.replace('/dashboard');
    }
  }, [user, isLoading, router]);

  // Don't show landing page if redirecting
  if (shouldRedirect) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <LoginDialog open={loginDialogOpen} onOpenChange={setLoginDialogOpen} />
      
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-md border-b border-border z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Webhook className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">NCRelay</span>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => setLoginDialogOpen(true)}>Login</Button>
            <Button onClick={() => setLoginDialogOpen(true)}>
              Sign Up <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-6">
            <Badge variant="secondary" className="mb-4">
              <Zap className="h-3 w-3 mr-1" />
              Run on Autopilot
            </Badge>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
              One Hub for
              <br />
              <span className="text-primary">All Your Notifications</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Stop juggling multiple notification systems. Route alerts from all your IT tools to Slack, Teams, Discord, and more—from a single platform.
            </p>
            <div className="flex items-center justify-center space-x-4 pt-4">
              <Button 
                size="lg" 
                className="text-lg h-12 px-8"
                onClick={() => setLoginDialogOpen(true)}
              >
                Sign Up Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="text-lg h-12 px-8">
                View Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Unify Your IT Tool Stack
            </h2>
            <p className="text-muted-foreground text-lg">
              Connect monitoring tools, ticketing systems, and more—then route alerts wherever your team works
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Webhook,
                title: "Universal Integration",
                description: "Connect RMM, PSA, monitoring, and any tool with webhooks—all in one place"
              },
              {
                icon: Filter,
                title: "Smart Filtering",
                description: "Transform and format alerts to match your team's needs before delivery"
              },
              {
                icon: Bell,
                title: "Route Anywhere",
                description: "Send to Slack, Teams, Discord, email, or any platform your team uses"
              },
              {
                icon: Activity,
                title: "Live Monitoring",
                description: "See all notifications flowing through in real-time with detailed logs"
              },
              {
                icon: Shield,
                title: "Enterprise Security",
                description: "IP whitelisting, role-based access, and audit logs keep your data safe"
              },
              {
                icon: BarChart3,
                title: "Analytics & Insights",
                description: "Track notification patterns and delivery success across all your tools"
              }
            ].map((feature, i) => (
              <Card key={i} className="p-6 hover:shadow-lg transition-shadow">
                <feature.icon className="h-10 w-10 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section with Blue Background */}
      <section className="py-20 px-6 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="space-y-6">
            <Bell className="h-16 w-16 mx-auto opacity-90" />
            <h2 className="text-3xl md:text-5xl font-bold">
              Stop Context Switching.
              <br />
              Get All Your Alerts in One Place.
            </h2>
            <p className="text-lg opacity-90 max-w-2xl mx-auto">
              N-able, ConnectWise, Datto, Auvik, SolarWinds—consolidate notifications from your entire tool stack
            </p>
            <Button 
              size="lg" 
              variant="secondary" 
              className="mt-4"
              onClick={() => setLoginDialogOpen(true)}
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-muted-foreground text-lg">
              Choose the plan that fits your needs
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                name: "Free",
                price: "$0",
                period: "forever",
                description: "Perfect for testing and small deployments",
                features: [
                  "2,000 notifications/month",
                  "1 endpoint",
                  "Unlimited integrations",
                  "Field filters (1 per integration)",
                  "7-day log retention"
                ]
              },
              {
                name: "Professional",
                price: "$49",
                period: "per month",
                description: "For MSPs and growing businesses",
                features: [
                  "10,000 notifications/month",
                  "15 endpoints",
                  "Unlimited integrations",
                  "Unlimited field filters",
                  "30-day log retention",
                  "Custom roles & permissions",
                  "IP whitelisting"
                ],
                popular: true
              },
              {
                name: "Enterprise",
                price: "$149",
                period: "per month",
                description: "For large MSPs and enterprises",
                features: [
                  "50,000 notifications/month",
                  "Unlimited endpoints",
                  "Unlimited integrations",
                  "Unlimited field filters",
                  "90-day log retention",
                  "Custom roles & permissions",
                  "IP whitelisting",
                  "Custom domain (CNAME or A)",
                  "Advanced analytics"
                ]
              }
            ].map((plan, i) => (
              <Card key={i} className={`p-8 ${plan.popular ? 'border-primary border-2 shadow-lg' : ''}`}>
                {plan.popular && (
                  <Badge className="mb-4">Most Popular</Badge>
                )}
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">/{plan.period}</span>
                </div>
                <p className="text-muted-foreground mb-6">{plan.description}</p>
                <Button 
                  className="w-full mb-6" 
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => setLoginDialogOpen(true)}
                >
                  Sign Up
                </Button>
                <ul className="space-y-3">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-start">
                      <CheckCircle2 className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-6 border-t">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Begin?
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            Start automating your notifications today
          </p>
          <Button 
            size="lg" 
            className="text-lg h-12 px-8"
            onClick={() => setLoginDialogOpen(true)}
          >
            Sign Up Now
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Webhook className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold">NCRelay</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Securely relay notifications to your favorite platforms.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/login" className="hover:text-foreground">Features</Link></li>
                <li><Link href="/login" className="hover:text-foreground">Pricing</Link></li>
                <li><Link href="/login" className="hover:text-foreground">Documentation</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/login" className="hover:text-foreground">About</Link></li>
                <li><Link href="/login" className="hover:text-foreground">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/login" className="hover:text-foreground">Privacy</Link></li>
                <li><Link href="/login" className="hover:text-foreground">Terms</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} NCRelay. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
