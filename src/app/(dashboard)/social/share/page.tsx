"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { useShareTasting, useMySharedTastings } from "@/lib/hooks/use-social";
import { toast } from "sonner";
import type { TastingVisibility, Rating, CellarInventory, WineReference } from "@/types/database";

type RatingWithWine = Rating & {
  cellar_inventory?: (CellarInventory & { wine_reference: WineReference | null }) | null;
  wine_reference?: WineReference | null;
};

function useUserRatings() {
  const supabase = createClient();
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-ratings-for-sharing"],
    queryFn: async () => {
      if (!user) return [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("ratings")
        .select(`
          *,
          cellar_inventory:inventory_id (
            *,
            wine_reference (*)
          ),
          wine_reference (*)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as RatingWithWine[];
    },
    enabled: !!user,
  });
}

export default function ShareTastingPage() {
  const router = useRouter();
  const [selectedRatingId, setSelectedRatingId] = useState<string>("");
  const [visibility, setVisibility] = useState<TastingVisibility>("friends");
  const [caption, setCaption] = useState("");

  const { data: ratings, isLoading } = useUserRatings();
  const { data: alreadyShared } = useMySharedTastings();
  const shareMutation = useShareTasting();

  const alreadySharedSet = new Set(alreadyShared || []);
  const availableRatings = ratings?.filter((r) => !alreadySharedSet.has(r.id)) || [];
  const selectedRating = ratings?.find((r) => r.id === selectedRatingId);

  const handleShare = () => {
    if (!selectedRatingId) {
      toast.error("Please select a rating to share");
      return;
    }

    shareMutation.mutate(
      {
        ratingId: selectedRatingId,
        visibility,
        caption: caption.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Tasting shared successfully!");
          router.push("/social");
        },
        onError: (error) => {
          toast.error("Failed to share tasting");
          console.error(error);
        },
      }
    );
  };

  const getWineName = (rating: RatingWithWine) => {
    const wine = rating.cellar_inventory?.wine_reference || rating.wine_reference;
    const name = wine?.name || rating.cellar_inventory?.custom_name || "Unknown Wine";
    const vintage = rating.cellar_inventory?.vintage || rating.cellar_inventory?.custom_vintage;
    return vintage ? `${name} ${vintage}` : name;
  };

  const getProducer = (rating: RatingWithWine) => {
    const wine = rating.cellar_inventory?.wine_reference || rating.wine_reference;
    return wine?.producer || rating.cellar_inventory?.custom_producer || "";
  };

  return (
    <div className="container py-6 space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/social">← Back</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold font-playfair">Share a Tasting</h1>
          <p className="text-sm text-muted-foreground">
            Share your wine experience with friends
          </p>
        </div>
      </div>

      {/* Select Rating */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select a Rating</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading your ratings...</p>
          ) : availableRatings.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">
                {ratings?.length === 0
                  ? "You haven't rated any wines yet"
                  : "All your ratings have been shared"}
              </p>
              <Button variant="outline" asChild>
                <Link href="/ratings">Go to Ratings</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {availableRatings.map((rating) => (
                <button
                  key={rating.id}
                  onClick={() => setSelectedRatingId(rating.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedRatingId === rating.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{getWineName(rating)}</p>
                      {getProducer(rating) && (
                        <p className="text-sm text-muted-foreground">
                          {getProducer(rating)}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(rating.tasting_date || rating.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="text-lg">
                        {rating.score}
                      </Badge>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Rating Preview */}
      {selectedRating && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="flex items-start gap-3">
                <span className="text-3xl">🍷</span>
                <div className="flex-1">
                  <h3 className="font-semibold">{getWineName(selectedRating)}</h3>
                  {getProducer(selectedRating) && (
                    <p className="text-sm text-muted-foreground">
                      {getProducer(selectedRating)}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">
                    {selectedRating.score}
                  </div>
                  <div className="text-xs text-muted-foreground">/100</div>
                </div>
              </div>
            </div>
            {selectedRating.tasting_notes && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Notes: </span>
                {selectedRating.tasting_notes}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Caption & Visibility */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Add a caption (optional)</Label>
            <Textarea
              placeholder="What made this wine special?"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Who can see this?</Label>
            <Select
              value={visibility}
              onValueChange={(v) => setVisibility(v as TastingVisibility)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="friends">Friends Only</SelectItem>
                <SelectItem value="public">Public</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {visibility === "friends"
                ? "Only your friends will see this tasting"
                : "Anyone can see this tasting"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" asChild>
          <Link href="/social">Cancel</Link>
        </Button>
        <Button
          onClick={handleShare}
          disabled={!selectedRatingId || shareMutation.isPending}
        >
          {shareMutation.isPending ? "Sharing..." : "Share Tasting"}
        </Button>
      </div>
    </div>
  );
}
