import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { PhotoType } from "@/types/database";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const inventoryId = formData.get("inventory_id") as string | null;
    const ratingId = formData.get("rating_id") as string | null;
    const visitId = formData.get("visit_id") as string | null;
    const photoType = (formData.get("photo_type") as PhotoType) || "other";
    const caption = formData.get("caption") as string | null;
    const isPrimary = formData.get("is_primary") === "true";

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate at least one reference
    if (!inventoryId && !ratingId && !visitId) {
      return NextResponse.json(
        { success: false, error: "Must provide inventory_id, rating_id, or visit_id" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: "Invalid file type. Allowed: JPEG, PNG, WebP, HEIC" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: "File too large. Maximum size is 10MB" },
        { status: 400 }
      );
    }

    // Generate unique file path
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const referenceId = inventoryId || ratingId || visitId;
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const storagePath = `${user.id}/${referenceId}/${fileName}`;

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("wine-photos")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { success: false, error: "Failed to upload file" },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("wine-photos")
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    // Insert photo record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: photo, error: insertError } = await (supabase as any)
      .from("wine_photos")
      .insert({
        user_id: user.id,
        inventory_id: inventoryId,
        rating_id: ratingId,
        visit_id: visitId,
        storage_path: storagePath,
        url: publicUrl,
        photo_type: photoType,
        caption: caption,
        is_primary: isPrimary,
        file_size_bytes: file.size,
        mime_type: file.type,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Database insert error:", insertError);
      // Try to clean up uploaded file
      await supabase.storage.from("wine-photos").remove([storagePath]);
      return NextResponse.json(
        { success: false, error: "Failed to save photo record" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      photo,
    });
  } catch (error) {
    console.error("Photo upload error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to upload photo",
      },
      { status: 500 }
    );
  }
}
