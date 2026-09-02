"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Uploads into a public bucket under {userId}/{recordId}/ and inserts a row
// into the photos table. Works for aircraft photos and sale-listing photos.
export function PhotoUploader({
  recordId,
  nextPosition,
  bucket = "aircraft-photos",
  table = "aircraft_photos",
  column = "aircraft_id",
}: {
  recordId: string;
  nextPosition: number;
  bucket?: string;
  table?: string;
  column?: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Not signed in");
      setBusy(false);
      return;
    }

    let position = nextPosition;
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name} is over 10MB`);
        continue;
      }
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${recordId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, file, { contentType: file.type });
      if (upErr) {
        setError(upErr.message);
        continue;
      }
      const { error: dbErr } = await supabase.from(table).insert({
        [column]: recordId,
        file_path: path,
        position: position++,
      });
      if (dbErr) setError(dbErr.message);
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <label className="inline-block cursor-pointer rounded-full border border-slate-700 px-5 py-2 text-sm hover:border-gold hover:text-gold">
        {busy ? "Uploading…" : "+ Add photos"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          disabled={busy}
          onChange={(e) => onFiles(e.target.files)}
        />
      </label>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
