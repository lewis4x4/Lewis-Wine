import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { WinePhoto, PhotoType } from "@/types/database";

// Fetch photos for an inventory item
export function useWinePhotos(inventoryId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["wine-photos", inventoryId],
    queryFn: async () => {
      if (!inventoryId) return [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("wine_photos")
        .select("*")
        .eq("inventory_id", inventoryId)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as WinePhoto[];
    },
    enabled: !!inventoryId,
    retry: 1,
  });
}

// Fetch photos for a rating
export function useRatingPhotos(ratingId: string | undefined) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["rating-photos", ratingId],
    queryFn: async () => {
      if (!ratingId) return [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("wine_photos")
        .select("*")
        .eq("rating_id", ratingId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as WinePhoto[];
    },
    enabled: !!ratingId,
    retry: 1,
  });
}

// Upload photo mutation
export function useUploadPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      inventoryId,
      ratingId,
      visitId,
      photoType = "other",
      caption,
      isPrimary = false,
    }: {
      file: File;
      inventoryId?: string;
      ratingId?: string;
      visitId?: string;
      photoType?: PhotoType;
      caption?: string;
      isPrimary?: boolean;
    }) => {
      const formData = new FormData();
      formData.append("file", file);
      if (inventoryId) formData.append("inventory_id", inventoryId);
      if (ratingId) formData.append("rating_id", ratingId);
      if (visitId) formData.append("visit_id", visitId);
      formData.append("photo_type", photoType);
      if (caption) formData.append("caption", caption);
      formData.append("is_primary", isPrimary.toString());

      const response = await fetch("/api/photos/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to upload photo");
      }

      return result.photo as WinePhoto;
    },
    onSuccess: (photo) => {
      // Invalidate relevant queries
      if (photo.inventory_id) {
        queryClient.invalidateQueries({ queryKey: ["wine-photos", photo.inventory_id] });
        queryClient.invalidateQueries({ queryKey: ["wine-detail", photo.inventory_id] });
      }
      if (photo.rating_id) {
        queryClient.invalidateQueries({ queryKey: ["rating-photos", photo.rating_id] });
      }
    },
  });
}

// Delete photo mutation
export function useDeletePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (photoId: string) => {
      const response = await fetch(`/api/photos/${photoId}`, {
        method: "DELETE",
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to delete photo");
      }

      return photoId;
    },
    onSuccess: () => {
      // Invalidate all photo queries
      queryClient.invalidateQueries({ queryKey: ["wine-photos"] });
      queryClient.invalidateQueries({ queryKey: ["rating-photos"] });
      queryClient.invalidateQueries({ queryKey: ["wine-detail"] });
    },
  });
}

// Update photo mutation (caption, type, primary)
export function useUpdatePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      photoId,
      updates,
    }: {
      photoId: string;
      updates: {
        photo_type?: PhotoType;
        caption?: string | null;
        is_primary?: boolean;
      };
    }) => {
      const response = await fetch(`/api/photos/${photoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to update photo");
      }

      return result.photo as WinePhoto;
    },
    onSuccess: (photo) => {
      if (photo.inventory_id) {
        queryClient.invalidateQueries({ queryKey: ["wine-photos", photo.inventory_id] });
        queryClient.invalidateQueries({ queryKey: ["wine-detail", photo.inventory_id] });
      }
      if (photo.rating_id) {
        queryClient.invalidateQueries({ queryKey: ["rating-photos", photo.rating_id] });
      }
    },
  });
}

// Set photo as primary
export function useSetPrimaryPhoto() {
  const updatePhoto = useUpdatePhoto();

  return useMutation({
    mutationFn: async (photoId: string) => {
      return updatePhoto.mutateAsync({
        photoId,
        updates: { is_primary: true },
      });
    },
  });
}
