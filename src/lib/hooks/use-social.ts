"use client";

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import type {
  UserProfile,
  UserProfileInsert,
  UserProfileUpdate,
  Friendship,
  FriendshipInsert,
  FriendshipStatus,
  SharedTasting,
  SharedTastingInsert,
  TastingVisibility,
  TastingLikeInsert,
  TastingCommentInsert,
  SharedTastingWithDetails,
} from "@/types/database";

// User Profile Hooks
export function useUserProfile(userId?: string) {
  const supabase = createClient();
  const { user } = useAuth();
  const targetId = userId || user?.id;

  return useQuery({
    queryKey: ["user-profile", targetId],
    queryFn: async () => {
      if (!targetId) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("user_profiles")
        .select("*")
        .eq("id", targetId)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data as UserProfile | null;
    },
    enabled: !!targetId,
    retry: 1,
  });
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (updates: UserProfileUpdate) => {
      if (!user) throw new Error("Not authenticated");

      // Try to update first
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase as any)
        .from("user_profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      if (existing) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from("user_profiles")
          .update(updates)
          .eq("id", user.id)
          .select()
          .single();
        if (error) throw error;
        return data as UserProfile;
      } else {
        // Insert if doesn't exist
        const insert: UserProfileInsert = {
          id: user.id,
          ...updates,
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from("user_profiles")
          .insert(insert)
          .select()
          .single();
        if (error) throw error;
        return data as UserProfile;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["user-profile", data.id] });
    },
  });
}

// Friendship Hooks
export function useFriendships(status?: FriendshipStatus) {
  const supabase = createClient();
  const { user } = useAuth();

  return useQuery({
    queryKey: ["friendships", status],
    queryFn: async () => {
      if (!user) return [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from("friendships")
        .select("*")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data as Friendship[];
    },
    enabled: !!user,
    retry: 1,
  });
}

export function useFriendRequests() {
  const supabase = createClient();
  const { user } = useAuth();

  return useQuery({
    queryKey: ["friend-requests"],
    queryFn: async () => {
      if (!user) return [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("friendships")
        .select("*")
        .eq("addressee_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Friendship[];
    },
    enabled: !!user,
  });
}

export function useFriendsWithProfiles() {
  const supabase = createClient();
  const { user } = useAuth();

  return useQuery({
    queryKey: ["friends-with-profiles"],
    queryFn: async () => {
      if (!user) return [];

      // Get accepted friendships
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: friendships, error: fError } = await (supabase as any)
        .from("friendships")
        .select("*")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq("status", "accepted");

      if (fError) throw fError;

      // Get friend IDs
      const friendIds = (friendships as Friendship[]).map((f) =>
        f.requester_id === user.id ? f.addressee_id : f.requester_id
      );

      if (friendIds.length === 0) return [];

      // Get profiles for friends
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profiles, error: pError } = await (supabase as any)
        .from("user_profiles")
        .select("*")
        .in("id", friendIds);

      if (pError) throw pError;

      return profiles as UserProfile[];
    },
    enabled: !!user,
  });
}

export function useSendFriendRequest() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (addresseeId: string) => {
      if (!user) throw new Error("Not authenticated");

      const insert: FriendshipInsert = {
        requester_id: user.id,
        addressee_id: addresseeId,
        status: "pending",
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("friendships")
        .insert(insert)
        .select()
        .single();

      if (error) throw error;
      return data as Friendship;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friendships"] });
    },
  });
}

export function useRespondToFriendRequest() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      friendshipId,
      status,
    }: {
      friendshipId: string;
      status: "accepted" | "declined";
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("friendships")
        .update({ status })
        .eq("id", friendshipId)
        .select()
        .single();

      if (error) throw error;
      return data as Friendship;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friendships"] });
      queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
      queryClient.invalidateQueries({ queryKey: ["friends-with-profiles"] });
    },
  });
}

export function useRemoveFriend() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (friendshipId: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("friendships")
        .delete()
        .eq("id", friendshipId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friendships"] });
      queryClient.invalidateQueries({ queryKey: ["friends-with-profiles"] });
    },
  });
}

// Shared Tastings / Feed Hooks
export function useSocialFeed(visibility?: TastingVisibility) {
  const supabase = createClient();
  const { user } = useAuth();

  return useInfiniteQuery({
    queryKey: ["social-feed", visibility],
    queryFn: async ({ pageParam = 0 }) => {
      const limit = 20;
      const offset = pageParam * limit;

      // Get friend IDs first
      let friendIds: string[] = [];
      if (user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: friendships } = await (supabase as any)
          .from("friendships")
          .select("requester_id, addressee_id")
          .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
          .eq("status", "accepted");

        if (friendships) {
          type FriendshipRow = { requester_id: string; addressee_id: string };
          friendIds = (friendships as FriendshipRow[]).map((f) =>
            f.requester_id === user.id ? f.addressee_id : f.requester_id
          );
        }
      }

      // Build query for shared tastings
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from("shared_tastings")
        .select(`
          *,
          user_profiles:user_id (*)
        `)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (visibility) {
        query = query.eq("visibility", visibility);
      } else {
        // Show public + friends' posts
        if (user && friendIds.length > 0) {
          query = query.or(
            `visibility.eq.public,and(visibility.eq.friends,user_id.in.(${friendIds.join(",")}))`
          );
        } else {
          query = query.eq("visibility", "public");
        }
      }

      const { data: tastings, error } = await query;
      if (error) throw error;

      // Now fetch ratings, likes, comments for each tasting
      type TastingRow = {
        id: string;
        rating_id: string;
        user_id: string;
        visibility: TastingVisibility;
        caption: string | null;
        created_at: string;
        updated_at: string;
        user_profiles: UserProfile;
      };
      const tastingData = tastings as TastingRow[];
      const ratingIds = tastingData.map((t) => t.rating_id);
      const tastingIds = tastingData.map((t) => t.id);

      // Fetch ratings with wine info
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: ratings } = await (supabase as any)
        .from("ratings")
        .select(`
          *,
          cellar_inventory:inventory_id (
            *,
            wine_reference (*)
          ),
          wine_reference (*)
        `)
        .in("id", ratingIds);

      // Fetch likes counts
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: likesData } = await (supabase as any)
        .from("tasting_likes")
        .select("shared_tasting_id")
        .in("shared_tasting_id", tastingIds);

      // Check if current user has liked
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: userLikes } = user
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? await (supabase as any)
            .from("tasting_likes")
            .select("shared_tasting_id")
            .eq("user_id", user.id)
            .in("shared_tasting_id", tastingIds)
        : { data: [] };

      // Fetch comments counts
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: commentsData } = await (supabase as any)
        .from("tasting_comments")
        .select("shared_tasting_id")
        .in("shared_tasting_id", tastingIds);

      // Build the response
      type LikeRow = { shared_tasting_id: string };
      type CommentRow = { shared_tasting_id: string };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type RatingRow = any;

      const likesMap = new Map<string, number>();
      (likesData as LikeRow[] || []).forEach((l) => {
        likesMap.set(l.shared_tasting_id, (likesMap.get(l.shared_tasting_id) || 0) + 1);
      });

      const userLikesSet = new Set((userLikes as LikeRow[] || []).map((l) => l.shared_tasting_id));

      const commentsMap = new Map<string, number>();
      (commentsData as CommentRow[] || []).forEach((c) => {
        commentsMap.set(c.shared_tasting_id, (commentsMap.get(c.shared_tasting_id) || 0) + 1);
      });

      const ratingsMap = new Map<string, RatingRow>();
      (ratings as RatingRow[] || []).forEach((r: RatingRow) => {
        ratingsMap.set(r.id, r);
      });

      const result: SharedTastingWithDetails[] = tastingData.map((t) => ({
        ...t,
        user_profile: t.user_profiles || null,
        rating: ratingsMap.get(t.rating_id) || null,
        likes_count: likesMap.get(t.id) || 0,
        comments_count: commentsMap.get(t.id) || 0,
        has_liked: userLikesSet.has(t.id),
      }));

      return {
        items: result,
        nextPage: result.length === limit ? pageParam + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    retry: 1,
  });
}

export function useShareTasting() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      ratingId,
      visibility,
      caption,
    }: {
      ratingId: string;
      visibility: TastingVisibility;
      caption?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const insert: SharedTastingInsert = {
        user_id: user.id,
        rating_id: ratingId,
        visibility,
        caption,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("shared_tastings")
        .insert(insert)
        .select()
        .single();

      if (error) throw error;
      return data as SharedTasting;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-feed"] });
      queryClient.invalidateQueries({ queryKey: ["my-shared-tastings"] });
    },
  });
}

export function useDeleteSharedTasting() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("shared_tastings")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-feed"] });
      queryClient.invalidateQueries({ queryKey: ["my-shared-tastings"] });
    },
  });
}

export function useMySharedTastings() {
  const supabase = createClient();
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-shared-tastings"],
    queryFn: async () => {
      if (!user) return [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("shared_tastings")
        .select("rating_id")
        .eq("user_id", user.id);

      if (error) throw error;
      return (data as { rating_id: string }[]).map((d) => d.rating_id);
    },
    enabled: !!user,
  });
}

// Likes Hooks
export function useLikeTasting() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (sharedTastingId: string) => {
      if (!user) throw new Error("Not authenticated");

      const insert: TastingLikeInsert = {
        shared_tasting_id: sharedTastingId,
        user_id: user.id,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("tasting_likes")
        .insert(insert)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-feed"] });
    },
  });
}

export function useUnlikeTasting() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (sharedTastingId: string) => {
      if (!user) throw new Error("Not authenticated");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("tasting_likes")
        .delete()
        .eq("shared_tasting_id", sharedTastingId)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-feed"] });
    },
  });
}

// Comments Hooks
export function useTastingComments(sharedTastingId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["tasting-comments", sharedTastingId],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("tasting_comments")
        .select(`
          *,
          user_profiles:user_id (*)
        `)
        .eq("shared_tasting_id", sharedTastingId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!sharedTastingId,
  });
}

export function useAddComment() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      sharedTastingId,
      content,
    }: {
      sharedTastingId: string;
      content: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const insert: TastingCommentInsert = {
        shared_tasting_id: sharedTastingId,
        user_id: user.id,
        content,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("tasting_comments")
        .insert(insert)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasting-comments", variables.sharedTastingId] });
      queryClient.invalidateQueries({ queryKey: ["social-feed"] });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({ commentId, sharedTastingId }: { commentId: string; sharedTastingId: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("tasting_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;
      return { sharedTastingId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["tasting-comments", result.sharedTastingId] });
      queryClient.invalidateQueries({ queryKey: ["social-feed"] });
    },
  });
}

// Search users hook
export function useSearchUsers(query: string) {
  const supabase = createClient();
  const { user } = useAuth();

  return useQuery({
    queryKey: ["search-users", query],
    queryFn: async () => {
      if (!query || query.length < 2) return [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("user_profiles")
        .select("*")
        .or(`display_name.ilike.%${query}%`)
        .eq("is_public", true)
        .neq("id", user?.id || "")
        .limit(20);

      if (error) throw error;
      return data as UserProfile[];
    },
    enabled: query.length >= 2,
  });
}

// Social stats hook
export function useSocialStats() {
  const supabase = createClient();
  const { user } = useAuth();

  return useQuery({
    queryKey: ["social-stats"],
    queryFn: async () => {
      if (!user) return null;

      // Get friend count
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: friendships } = await (supabase as any)
        .from("friendships")
        .select("id")
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq("status", "accepted");

      // Get pending requests count
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pendingRequests } = await (supabase as any)
        .from("friendships")
        .select("id")
        .eq("addressee_id", user.id)
        .eq("status", "pending");

      // Get shared tastings count
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sharedTastings } = await (supabase as any)
        .from("shared_tastings")
        .select("id")
        .eq("user_id", user.id);

      // Get total likes received
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: myTastings } = await (supabase as any)
        .from("shared_tastings")
        .select("id")
        .eq("user_id", user.id);

      type IdRow = { id: string };
      let totalLikes = 0;
      if (myTastings && (myTastings as IdRow[]).length > 0) {
        const tastingIds = (myTastings as IdRow[]).map((t) => t.id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: likes } = await (supabase as any)
          .from("tasting_likes")
          .select("id")
          .in("shared_tasting_id", tastingIds);
        totalLikes = (likes as IdRow[] || []).length;
      }

      return {
        friendsCount: (friendships as IdRow[] || []).length,
        pendingRequestsCount: (pendingRequests as IdRow[] || []).length,
        sharedTastingsCount: (sharedTastings as IdRow[] || []).length,
        totalLikesReceived: totalLikes,
      };
    },
    enabled: !!user,
    retry: 1,
  });
}
