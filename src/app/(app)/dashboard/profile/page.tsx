"use client";

import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { changePasswordAction } from "@/app/(auth)/actions";
import { getInitials } from "@/lib/utils";

const profileSchema = z.object({
  name: z.string().min(1, "Name cannot be empty.").max(100, "Name is too long."),
  email: z.string().email("Invalid email address.").max(255, "Email is too long."),
});
type ProfileFormValues = z.infer<typeof profileSchema>;

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z.string().min(8, "New password must be at least 8 characters long."),
  confirmNewPassword: z.string(),
}).refine(data => data.newPassword === data.confirmNewPassword, {
  message: "New passwords do not match.",
  path: ["confirmNewPassword"],
}).refine(data => data.currentPassword !== data.newPassword, {
    message: "New password must be different from the current password.",
    path: ["newPassword"],
});
type PasswordFormValues = z.infer<typeof passwordSchema>;


export default function ProfilePage() {
  const { user, updateUserName, updateUserEmail, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
    },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmNewPassword: "" },
  });

  useEffect(() => {
    if (user) {
      profileForm.reset({
        name: user.name || "",
        email: user.email || "",
      });
    }
  }, [user, profileForm]);

  const watchedName = profileForm.watch("name");
  const watchedEmail = profileForm.watch("email");

  const handleProfileSubmit = async (data: ProfileFormValues) => {
    if (!user) return;

    const nameChanged = data.name.trim() !== (user.name || "").trim();
    const emailChanged = data.email.trim() !== (user.email || "").trim();

    if (!nameChanged && !emailChanged) {
      toast({ title: "No Changes", description: "Your profile information is already up to date." });
      return;
    }

    setIsSubmittingProfile(true);
    profileForm.clearErrors();
    let overallSuccess = true;
    const messages: { title: string; description: string; variant?: "destructive" }[] = [];

    if (nameChanged) {
      const nameFormData = new FormData();
      nameFormData.append('name', data.name.trim());
      const nameResult = await updateUserName(nameFormData);
      if (!nameResult.success) {
        overallSuccess = false;
        profileForm.setError("name", { type: "server", message: nameResult.error });
        messages.push({ variant: "destructive", title: "Name Update Failed", description: nameResult.error || "Could not update your name." });
      } else {
        messages.push({ title: "Name Updated", description: "Your name has been successfully updated." });
      }
    }

    if (emailChanged) {
      const emailFormData = new FormData();
      emailFormData.append('email', data.email.trim());
      const emailResult = await updateUserEmail(emailFormData);
      if (!emailResult.success) {
        overallSuccess = false;
        profileForm.setError("email", { type: "server", message: emailResult.error });
        messages.push({ variant: "destructive", title: "Email Update Failed", description: emailResult.error || "Could not update your email." });
      } else {
        messages.push({ title: "Email Updated", description: "Your email has been successfully updated." });
      }
    }
    setIsSubmittingProfile(false);

    if (messages.length === 1) {
      toast(messages[0]);
    } else if (messages.length > 1) {
      if (overallSuccess) {
        toast({ title: "Profile Updated", description: "Your profile information has been successfully updated." });
      } else {
         toast({ variant: "destructive", title: "Profile Update Issues", description: "Some profile updates failed. Please check the form." });
      }
    }
  };
  
  const handlePasswordSubmit = async (data: PasswordFormValues) => {
    if (!user) return;
    setIsSubmittingPassword(true);
    passwordForm.clearErrors(); // Clear previous server errors

    const formData = new FormData();
    formData.append('currentPassword', data.currentPassword);
    formData.append('newPassword', data.newPassword);

    const result = await changePasswordAction(user.id, formData);
    setIsSubmittingPassword(false);

    if (result.success) {
      toast({ title: "Password Changed", description: "Your password has been successfully updated." });
      passwordForm.reset();
    } else {
      if (result.error?.toLowerCase().includes("current password")) {
        passwordForm.setError("currentPassword", { type: "server", message: result.error });
        passwordForm.setFocus("currentPassword");
      } else if (result.error?.toLowerCase().includes("new password must be different")) {
        passwordForm.setError("newPassword", { type: "server", message: result.error});
        passwordForm.setFocus("newPassword");
      } else if (result.error) { // Fallback for other errors, e.g. validation from schema refine
         passwordForm.setError("newPassword", { type: "server", message: result.error });
         passwordForm.setFocus("newPassword");
      }
      toast({ variant: "destructive", title: "Change Password Failed", description: result.error || "Could not change your password." });
    }
  };

  const profileInfoChanged = profileForm.formState.isDirty && (
    profileForm.getValues("name").trim() !== (user?.name || "").trim() ||
    profileForm.getValues("email").trim() !== (user?.email || "").trim()
  );

  return (
    <PageShell
      title="User Profile"
      description="View and manage your profile information."
    >
      <div className="grid gap-8 md:grid-cols-1 max-w-2xl mx-auto">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Your Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4 mb-6">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={`https://placehold.co/100x100.png?text=${getInitials(watchedName)}`} alt={watchedName || "User"} data-ai-hint="user avatar"/>
                  <AvatarFallback>{getInitials(watchedName)}</AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-xl font-semibold">{watchedName || "User Name"}</h2>
                  <p className="text-sm text-muted-foreground">{watchedEmail}</p>
                </div>
              </div>
            
            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-6">
                <FormField
                  control={profileForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="name">Full Name</FormLabel>
                      <FormControl>
                        <Input 
                          id="name" 
                          placeholder="Your full name" 
                          {...field}
                          disabled={authLoading || isSubmittingProfile}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={profileForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="email">Email Address</FormLabel>
                      <FormControl>
                        <Input 
                          id="email" 
                          type="email"
                          placeholder="your@email.com" 
                          {...field}
                          disabled={authLoading || isSubmittingProfile}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={authLoading || isSubmittingProfile || !profileInfoChanged}>
                    {isSubmittingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Profile Changes
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your account password.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-6">
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} disabled={isSubmittingPassword || authLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} disabled={isSubmittingPassword || authLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="confirmNewPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} disabled={isSubmittingPassword || authLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmittingPassword || authLoading}>
                    {isSubmittingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Change Password
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

