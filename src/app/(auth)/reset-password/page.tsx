
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, Suspense } from "react";
import { Logo } from "@/components/icons/Logo";
import { Loader2, ArrowLeft } from "lucide-react";
import { resetPasswordAction } from "../actions";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const resetPasswordSchema = z.object({
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

function ResetPasswordFormComponent() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (urlToken) {
      setToken(urlToken);
    } else {
      setError("Password reset token not found or invalid. Please request a new one.");
      toast({ variant: "destructive", title: "Error", description: "Invalid reset link." });
    }
  }, [searchParams, toast]);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(data: ResetPasswordFormValues) {
    if (!token) {
      setError("Token is missing.");
      toast({ variant: "destructive", title: "Error", description: "Token is missing." });
      return;
    }
    setIsLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append('token', token);
    formData.append('password', data.password);

    const result = await resetPasswordAction(formData);
    setIsLoading(false);

    if (result.success) {
      setSuccess(true);
      toast({
        title: "Password Reset Successful",
        description: "You can now log in with your new password.",
      });
      // Optional: redirect after a delay or on button click
      // setTimeout(() => router.push('/login'), 3000);
    } else {
      setError(result.error || "Failed to reset password. The link may be invalid or expired.");
      toast({
        variant: "destructive",
        title: "Password Reset Failed",
        description: result.error || "Please try again or request a new link.",
      });
    }
  }
  
  if (!token && !error) {
    return (
      <Card className="w-full shadow-xl">
        <CardHeader className="items-center"><Logo className="mb-4 h-auto w-32" /></CardHeader>
        <CardContent><Loader2 className="mx-auto h-8 w-8 animate-spin" /></CardContent>
      </Card>
    );
  }

  if (error && !success) {
     return (
      <Card className="w-full shadow-xl">
        <CardHeader className="items-center"><Logo className="mb-4 h-auto w-32" /></CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" asChild>
            <Link href="/forgot-password">
              Request New Reset Link
            </Link>
          </Button>
          <Button variant="secondary" asChild className="ml-2">
            <Link href="/login">
             Back to Login
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }


  return (
    <Card className="w-full shadow-xl">
      <CardHeader className="items-center">
        <Logo className="mb-4 h-auto w-32" />
        <CardTitle className="text-2xl">Reset Your Password</CardTitle>
        <CardDescription>
          Enter your new password below.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {success ? (
          <div className="text-center space-y-4">
            <p className="text-green-600">Your password has been reset successfully!</p>
            <Button asChild className="bg-primary hover:bg-primary/90">
              <Link href="/login">
                Proceed to Login
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {error && <p className="text-sm font-medium text-destructive">{error}</p>}
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Reset Password
                </Button>
              </form>
            </Form>
            <div className="mt-4 text-center text-sm">
                <Link href="/login" legacyBehavior>
                <a className="underline text-muted-foreground hover:text-primary">
                    <ArrowLeft className="inline mr-1 h-3 w-3" /> Back to Login
                </a>
                </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Card className="w-full shadow-xl"><CardHeader className="items-center"><Logo className="mb-4 h-auto w-32" /></CardHeader><CardContent><Loader2 className="mx-auto h-8 w-8 animate-spin" /></CardContent></Card>}>
      <ResetPasswordFormComponent />
    </Suspense>
  )
}

