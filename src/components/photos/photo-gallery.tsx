"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { useWinePhotos, useUploadPhoto, useDeletePhoto, useSetPrimaryPhoto } from "@/lib/hooks/use-wine-photos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { WinePhoto, PhotoType } from "@/types/database";

const PHOTO_TYPE_LABELS: Record<PhotoType, string> = {
  label: "Label",
  bottle: "Bottle",
  cork: "Cork",
  receipt: "Receipt",
  tasting: "Tasting",
  cellar: "Cellar",
  other: "Other",
};

type PhotoGalleryProps = {
  inventoryId: string;
  compact?: boolean;
};

export function PhotoGallery({ inventoryId, compact = false }: PhotoGalleryProps) {
  const { data: photos = [], isLoading } = useWinePhotos(inventoryId);
  const uploadPhoto = useUploadPhoto();
  const deletePhoto = useDeletePhoto();
  const setPrimaryPhoto = useSetPrimaryPhoto();

  const [selectedPhoto, setSelectedPhoto] = useState<WinePhoto | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<string | null>(null);
  const [uploadType, setUploadType] = useState<PhotoType>("label");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // Validate file type
    if (!["image/jpeg", "image/png", "image/webp", "image/heic"].includes(file.type)) {
      toast.error("Invalid file type. Please use JPEG, PNG, WebP, or HEIC.");
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 10MB.");
      return;
    }

    try {
      await uploadPhoto.mutateAsync({
        file,
        inventoryId,
        photoType: uploadType,
        isPrimary: photos.length === 0, // First photo is primary
      });
      toast.success("Photo uploaded!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload photo");
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [inventoryId, photos.length, uploadPhoto, uploadType]);

  const handleDelete = async () => {
    if (!photoToDelete) return;

    try {
      await deletePhoto.mutateAsync(photoToDelete);
      toast.success("Photo deleted");
      setShowDeleteConfirm(false);
      setPhotoToDelete(null);
      setSelectedPhoto(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete photo");
    }
  };

  const handleSetPrimary = async (photoId: string) => {
    try {
      await setPrimaryPhoto.mutateAsync(photoId);
      toast.success("Primary photo updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update photo");
    }
  };

  const confirmDelete = (photoId: string) => {
    setPhotoToDelete(photoId);
    setShowDeleteConfirm(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading photos...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact && photos.length === 0) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base font-medium">Photos</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={uploadType} onValueChange={(v) => setUploadType(v as PhotoType)}>
              <SelectTrigger className="w-24 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PHOTO_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadPhoto.isPending}
            >
              {uploadPhoto.isPending ? "Uploading..." : "Add Photo"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </CardHeader>
        <CardContent>
          {photos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="text-4xl mb-2">📷</div>
              <p>No photos yet</p>
              <p className="text-sm">Add a label, bottle, or tasting photo</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group"
                  onClick={() => setSelectedPhoto(photo)}
                >
                  <Image
                    src={photo.url}
                    alt={photo.caption || "Wine photo"}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                    sizes="(max-width: 768px) 33vw, 150px"
                  />
                  {photo.is_primary && (
                    <Badge className="absolute top-1 left-1 text-xs bg-primary/80">
                      Primary
                    </Badge>
                  )}
                  <Badge
                    variant="secondary"
                    className="absolute bottom-1 right-1 text-xs bg-black/50 text-white"
                  >
                    {PHOTO_TYPE_LABELS[photo.photo_type]}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Photo Viewer Dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-3xl">
          {selectedPhoto && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>{PHOTO_TYPE_LABELS[selectedPhoto.photo_type]} Photo</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        ⋮
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!selectedPhoto.is_primary && (
                        <DropdownMenuItem onClick={() => handleSetPrimary(selectedPhoto.id)}>
                          Set as Primary
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => confirmDelete(selectedPhoto.id)}
                      >
                        Delete Photo
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </DialogTitle>
                {selectedPhoto.caption && (
                  <DialogDescription>{selectedPhoto.caption}</DialogDescription>
                )}
              </DialogHeader>
              <div className="relative aspect-[4/3] w-full">
                <Image
                  src={selectedPhoto.url}
                  alt={selectedPhoto.caption || "Wine photo"}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 800px"
                />
              </div>
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                {selectedPhoto.is_primary && <Badge>Primary Photo</Badge>}
                <span>
                  Added {new Date(selectedPhoto.created_at).toLocaleDateString()}
                </span>
                {selectedPhoto.file_size_bytes && (
                  <span>
                    {(selectedPhoto.file_size_bytes / 1024 / 1024).toFixed(1)}MB
                  </span>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Photo?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The photo will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deletePhoto.isPending}
            >
              {deletePhoto.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Compact thumbnail for wine cards
export function PhotoThumbnail({ url, alt }: { url: string; alt?: string }) {
  return (
    <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
      <Image
        src={url}
        alt={alt || "Wine photo"}
        fill
        className="object-cover"
        sizes="48px"
      />
    </div>
  );
}
