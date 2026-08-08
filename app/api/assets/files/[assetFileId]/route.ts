import { NextResponse } from "next/server";
import { AgencyAccessError } from "@/lib/auth/access";
import { requireAssetFileViewer } from "@/lib/server/assets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request, context: { params: { assetFileId: string } }) {
  try {
    const viewer = await requireAssetFileViewer(context.params.assetFileId);
    const admin = createSupabaseAdminClient();
    const url = new URL(request.url);
    const download = url.searchParams.get("download") === "1";
    const { data, error } = await admin.storage.from(viewer.file.storage_bucket).createSignedUrl(viewer.file.storage_path, 120, download ? { download: viewer.file.original_filename } : undefined);
    if (error || !data?.signedUrl) throw new Error(error?.message ?? "Secure asset URL could not be created.");
    return NextResponse.redirect(data.signedUrl);
  } catch (error) {
    if (error instanceof AgencyAccessError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Asset access failed." }, { status: 400 });
  }
}
