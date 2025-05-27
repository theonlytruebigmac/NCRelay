
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
import { useState } from "react";
import { Logo } from "@/components/icons/Logo";
import { Loader2, ArrowLeft } from "lucide-react";
import { sendPasswordResetLinkAction } from "../actions";
import Link from "next/link";

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(data: ForgotPasswordFormValues) {
    setIsLoading(true);
    setMessage(null);
    const formData = new FormData();
    formData.append('email', data.email);

    const result = await sendPasswordResetLinkAction(formData);
    setIsLoading(false);

    if (result.success || result.message) {
      setMessage(result.message || "If your email is registered, you will receive a password reset link shortly.");
      toast({
        title: "Request Submitted",
        description: result.message || "Password reset link sent if email exists.",
      });
      form.reset();
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: result.error || "Could not process your request. Please try again.",
      });
    }
  }

  return (
    <Card className="w-full shadow-xl">
      <CardHeader className="items-center">
        <Logo className="mb-4 h-auto w-32" />
        <CardTitle className="text-2xl">Forgot Your Password?</CardTitle>
        <CardDescription>
          Enter your email address and we&apos;ll send you a link to reset your password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {message ? (
          <div className="text-center space-y-4">
            <p className="text-green-600">{message}</p>
            <Button variant="outline" asChild>
              <Link href="/login">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
              </Link>
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Reset Link
              </Button>
            </form>
          </Form>
        )}
        {!message && (
           <div className="mt-4 text-center text-sm">
            <Link href="/login" legacyBehavior>
              <a className="underline text-muted-foreground hover:text-primary">
                 Back to Login
              </a>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
