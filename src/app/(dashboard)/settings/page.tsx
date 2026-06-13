"use client";

import { useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { useCellar } from "@/lib/hooks/use-cellar";
import { useUpdateLocationMode } from "@/lib/hooks/use-cellar-locations";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { LocationMode } from "@/types/database";
import { DataTools } from "@/components/settings/data-tools";

export default function SettingsPage() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const supabase = createClient();

  const { data: cellar } = useCellar();
  const updateLocationMode = useUpdateLocationMode();
  const currentLocationMode: LocationMode = (cellar?.location_mode as LocationMode) || "simple";

  const handleLocationModeChange = async (mode: LocationMode) => {
    if (!cellar) return;
    try {
      await updateLocationMode.mutateAsync({ cellarId: cellar.id, mode });
      toast.success("Location mode updated!");
    } catch {
      toast.error("Failed to update location mode");
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("profiles")
        .update({ display_name: displayName })
        .eq("id", user?.id);

      if (error) throw error;
      toast.success("Profile updated!");
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("New passwords don't match");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsChangingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success("Password updated successfully!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-playfair text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Tune the system around how your cellar actually works.
        </p>
      </div>

      <Card className="border-primary/25 bg-gradient-to-br from-primary/10 via-background to-background">
        <CardHeader>
          <CardTitle className="font-playfair text-2xl">System preference view</CardTitle>
          <CardDescription>Settings should support the operating model, not get in its way.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border bg-background/80 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What matters now</div>
            <p className="mt-2 text-sm text-foreground">This is where account identity, cellar tracking behavior, and data tools stay aligned with the way you actually use Pourfolio.</p>
          </div>
          <div className="rounded-xl border bg-background/80 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Best next move</div>
            <p className="mt-2 text-sm text-foreground">Keep settings minimal, legible, and tied to real outcomes like cleaner location tracking and safer data operations.</p>
          </div>
          <div className="rounded-xl border bg-background/80 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Risk if ignored</div>
            <p className="mt-2 text-sm text-foreground">If settings feel like a dump of controls, trust falls and the product starts feeling more technical than premium.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email || ""} disabled />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your account password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Password must be at least 6 characters long
            </p>
            <Button type="submit" disabled={isChangingPassword || !newPassword || !confirmPassword}>
              {isChangingPassword ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cellar Settings</CardTitle>
          <CardDescription>Configure how you track wine locations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="locationMode">Location Tracking Mode</Label>
            <Select
              value={currentLocationMode}
              onValueChange={(value) => handleLocationModeChange(value as LocationMode)}
              disabled={updateLocationMode.isPending}
            >
              <SelectTrigger id="locationMode">
                <SelectValue placeholder="Select a mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simple">
                  <div className="flex flex-col">
                    <span>Simple</span>
                  </div>
                </SelectItem>
                <SelectItem value="structured">
                  <div className="flex flex-col">
                    <span>Structured</span>
                  </div>
                </SelectItem>
                <SelectItem value="grid">
                  <div className="flex flex-col">
                    <span>Grid</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {currentLocationMode === "simple" && "Free-text location (e.g., 'Kitchen wine rack, top shelf')"}
              {currentLocationMode === "structured" && "Hierarchical: Zone → Rack → Shelf → Position"}
              {currentLocationMode === "grid" && "Visual grid selection for your cellar layout"}
            </p>
          </div>

          {(currentLocationMode === "structured" || currentLocationMode === "grid") && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                To set up {currentLocationMode === "structured" ? "zones, racks, and shelves" : "your cellar grid"},
                you&apos;ll need to run the database migration and then configure your locations.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <DataTools />

      <Card>
        <CardHeader>
          <CardTitle>App Information</CardTitle>
          <CardDescription>About Pourfolio</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Version</span>
            <span className="text-sm font-medium">0.1.0 (MVP)</span>
          </div>
          <Separator />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-2">Pourfolio</p>
            <p>Your Wine Portfolio - Track, rate, and manage your wine collection.</p>
            <p className="mt-2">
              Built with Next.js, Supabase, and lots of love for wine.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Deleting your account will permanently remove all your data including
            your cellar, ratings, and purchase history.
          </p>
          <Button variant="destructive" disabled>
            Delete Account (Coming Soon)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
