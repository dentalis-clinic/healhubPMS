import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "clinic-logos";
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const formData = await request.formData();
    const file = formData.get("logo");

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: "File must be JPEG, PNG, WebP, or SVG" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: "File must be under 2 MB" },
        { status: 400 }
      );
    }

    const ext = file.type === "image/svg+xml" ? "svg" : file.type.split("/")[1];
    const path = `${auth.clinic.id}/logo.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const supabase = createAdminClient();

    // Ensure bucket exists (safe to call on every upload — no-ops if already present)
    const { error: bucketError } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      allowedMimeTypes: ALLOWED_TYPES,
      fileSizeLimit: MAX_SIZE_BYTES,
    });
    // Ignore "already exists" error (error code 409 / message contains "already exists")
    if (bucketError && !bucketError.message.includes("already exists")) {
      return NextResponse.json(
        { success: false, error: "Storage setup failed: " + bucketError.message },
        { status: 500 }
      );
    }

    // Upsert — overwrites any existing logo at the same path
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { success: false, error: "Upload failed: " + uploadError.message },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(uploadData.path);

    // Append cache-buster so browsers don't serve the stale version after re-upload
    const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    await prisma.clinic.update({
      where: { id: auth.clinic.id },
      data: { logo: logoUrl },
    });

    return NextResponse.json({ success: true, logo: logoUrl });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to upload logo" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const supabase = createAdminClient();

    // Try to remove all known extension variants
    await supabase.storage.from(BUCKET).remove([
      `${auth.clinic.id}/logo.png`,
      `${auth.clinic.id}/logo.jpg`,
      `${auth.clinic.id}/logo.jpeg`,
      `${auth.clinic.id}/logo.webp`,
      `${auth.clinic.id}/logo.svg`,
    ]);

    await prisma.clinic.update({
      where: { id: auth.clinic.id },
      data: { logo: null },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to remove logo" }, { status: 500 });
  }
}
