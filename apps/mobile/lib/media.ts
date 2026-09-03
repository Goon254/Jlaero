import { SUPABASE_URL } from "./config";

export function publicPhotoUrl(bucket: string, path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}
