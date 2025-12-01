"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  useSocialFeed,
  useLikeTasting,
  useUnlikeTasting,
  useAddComment,
  useTastingComments,
  useSocialStats,
} from "@/lib/hooks/use-social";
import type { SharedTastingWithDetails } from "@/types/database";

function TastingCard({ tasting }: { tasting: SharedTastingWithDetails }) {
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const likeMutation = useLikeTasting();
  const unlikeMutation = useUnlikeTasting();
  const addCommentMutation = useAddComment();
  const { data: comments } = useTastingComments(showComments ? tasting.id : "");

  const handleLike = () => {
    if (tasting.has_liked) {
      unlikeMutation.mutate(tasting.id);
    } else {
      likeMutation.mutate(tasting.id);
    }
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    addCommentMutation.mutate(
      { sharedTastingId: tasting.id, content: newComment },
      { onSuccess: () => setNewComment("") }
    );
  };

  const wine = tasting.rating?.inventory?.wine_reference || tasting.rating?.wine_reference;
  const wineName =
    wine?.name ||
    tasting.rating?.inventory?.custom_name ||
    "Unknown Wine";
  const producer =
    wine?.producer ||
    tasting.rating?.inventory?.custom_producer ||
    "";
  const vintage =
    tasting.rating?.inventory?.vintage ||
    tasting.rating?.inventory?.custom_vintage;
  const region = wine?.region || "";

  const displayName =
    tasting.user_profile?.display_name ||
    "Wine Lover";
  const initials = displayName.substring(0, 2).toUpperCase();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback className="bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{displayName}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(tasting.created_at), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </div>
          <Badge variant={tasting.visibility === "public" ? "default" : "secondary"}>
            {tasting.visibility === "public" ? "Public" : "Friends"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Wine Info */}
        <div className="rounded-lg bg-muted/50 p-4">
          <div className="flex items-start gap-3">
            <span className="text-3xl">
              {wine?.wine_type === "white"
                ? "🥂"
                : wine?.wine_type === "rose"
                ? "🌸"
                : wine?.wine_type === "sparkling"
                ? "🍾"
                : "🍷"}
            </span>
            <div className="flex-1">
              <h3 className="font-semibold">
                {wineName}
                {vintage && ` ${vintage}`}
              </h3>
              {producer && (
                <p className="text-sm text-muted-foreground">{producer}</p>
              )}
              {region && (
                <p className="text-xs text-muted-foreground">{region}</p>
              )}
            </div>
            {tasting.rating?.score && (
              <div className="text-right">
                <div className="text-2xl font-bold text-primary">
                  {tasting.rating.score}
                </div>
                <div className="text-xs text-muted-foreground">/100</div>
              </div>
            )}
          </div>
        </div>

        {/* Caption */}
        {tasting.caption && (
          <p className="text-sm">{tasting.caption}</p>
        )}

        {/* Tasting Notes */}
        {tasting.rating?.tasting_notes && (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Notes: </span>
            {tasting.rating.tasting_notes}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-4 pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLike}
            disabled={likeMutation.isPending || unlikeMutation.isPending}
            className={tasting.has_liked ? "text-red-500" : ""}
          >
            {tasting.has_liked ? "❤️" : "🤍"} {tasting.likes_count}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowComments(!showComments)}
          >
            💬 {tasting.comments_count}
          </Button>
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="space-y-3 pt-2 border-t">
            {comments && comments.length > 0 ? (
              <div className="space-y-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {comments.map((comment: any) => (
                  <div key={comment.id} className="flex gap-2 text-sm">
                    <span className="font-medium">
                      {comment.user_profiles?.display_name || "User"}:
                    </span>
                    <span className="text-muted-foreground">{comment.content}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No comments yet</p>
            )}
            <div className="flex gap-2">
              <Textarea
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[60px]"
              />
              <Button
                size="sm"
                onClick={handleAddComment}
                disabled={!newComment.trim() || addCommentMutation.isPending}
              >
                Post
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SocialPage() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useSocialFeed();
  const { data: stats } = useSocialStats();

  const allTastings = data?.pages.flatMap((page) => page.items) || [];

  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-playfair">Social Feed</h1>
          <p className="text-muted-foreground">
            See what your friends are drinking
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/social/friends">
              Friends
              {stats?.pendingRequestsCount ? (
                <Badge variant="destructive" className="ml-2">
                  {stats.pendingRequestsCount}
                </Badge>
              ) : null}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/social/share">Share Tasting</Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.friendsCount}</div>
              <p className="text-xs text-muted-foreground">Friends</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.sharedTastingsCount}</div>
              <p className="text-xs text-muted-foreground">Tastings Shared</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.totalLikesReceived}</div>
              <p className="text-xs text-muted-foreground">Likes Received</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">
                {stats.pendingRequestsCount}
              </div>
              <p className="text-xs text-muted-foreground">Pending Requests</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Feed */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading feed...</p>
        </div>
      ) : allTastings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-4xl mb-4">🍷</p>
            <h3 className="font-semibold text-lg mb-2">Your feed is empty</h3>
            <p className="text-muted-foreground mb-4">
              Add friends or share your own tastings to see activity here
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" asChild>
                <Link href="/social/friends">Find Friends</Link>
              </Button>
              <Button asChild>
                <Link href="/social/share">Share a Tasting</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {allTastings.map((tasting) => (
            <TastingCard key={tasting.id} tasting={tasting} />
          ))}
          {hasNextPage && (
            <div className="text-center py-4">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? "Loading..." : "Load More"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
