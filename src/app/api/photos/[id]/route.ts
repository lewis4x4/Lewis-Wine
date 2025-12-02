import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { WinePhotoUpdate } from "@/types/database";

// DELETE /api/photos/[id] - Delete a photo
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

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

    // Get the photo to find the storage path
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: photo, error: fetchError } = await (supabase as any)
      .from("wine_photos")
      .select("storage_path, user_id")
      .eq("id", id)
      .single();

    if (fetchError || !photo) {
      return NextResponse.json(
        { success: false, error: "Photo not found" },
        { status: 404 }
      );
    }

    const photoData = photo as { storage_path: string; user_id: string };

    // Verify ownership
    if (photoData.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from("wine-photos")
      .remove([photoData.storage_path]);

    if (storageError) {
      console.error("Storage delete error:", storageError);
    }

    // Delete from database
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase as any)
      .from("wine_photos")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json(
        { success: false, error: "Failed to delete photo" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Photo delete error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete photo",
      },
      { status: 500 }
    );
  }
}

// PATCH /api/photos/[id] - Update a photo
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

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

    const body: WinePhotoUpdate = await request.json();

    // Verify ownership
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from("wine_photos")
      .select("user_id")
      .eq("id", id)
      .single();

    const existingData = existing as { user_id: string } | null;
    if (!existingData || existingData.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "Photo not found or unauthorized" },
        { status: 404 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: photo, error: updateError } = await (supabase as any)
      .from("wine_photos")
      .update(body)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { success: false, error: "Failed to update photo" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, photo });
  } catch (error) {
    console.error("Photo update error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update photo",
      },
      { status: 500 }
    );
  }
}
