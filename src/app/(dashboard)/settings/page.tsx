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

export default function SettingsPage() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-playfair text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

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
