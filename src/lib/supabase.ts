import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export const ADMIN_EMAIL = 'visionavaxforex@gmail.com';
export const WHATSAPP_NUMBER = '+255746715235';
export const PAYMENT_NAME = 'LAURENT MATABAZI';

/**
 * uploadFile — simple, reliable upload for ALL file types and sizes.
 *
 * Uses Supabase SDK `.upload()` directly which handles auth token automatically.
 * For videos/large files with progress tracking, uses XHR.
 *
 * @param bucket     — e.g. 'media', 'avatars', 'courses'
 * @param path       — file path inside bucket (no leading slash)
 * @param file       — the File object
 * @param onProgress — optional (loaded, total) callback for XHR uploads
 * @returns public URL string
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: File,
  onProgress?: (loaded: number, total: number) => void
): Promise<string> {
  // Sanitize path — remove spaces and special chars except dot/dash/underscore
  const safePath = path.replace(/[^\w.\-/]/g, '_');

  // If caller wants progress OR file is video/large → use XHR
  if (onProgress || file.type.startsWith('video/') || file.size > 10 * 1024 * 1024) {
    return uploadWithXHR(bucket, safePath, file, onProgress);
  }

  // Small file — use Supabase SDK (simplest, most reliable)
  const { error } = await supabase.storage
    .from(bucket)
    .upload(safePath, file, { upsert: true, contentType: file.type || 'application/octet-stream' });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(bucket).getPublicUrl(safePath);
  return data.publicUrl;
}

/**
 * uploadWithXHR — XHR upload with real progress events.
 * Used automatically for videos and large files.
 */
function uploadWithXHR(
  bucket: string,
  path: string,
  file: File,
  onProgress?: (loaded: number, total: number) => void
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    // Get current session token — falls back to anon key
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token || supabaseAnonKey;

    // Encode each segment of the path separately
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${encodedPath}`;
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodedPath}`;

    const xhr = new XMLHttpRequest();

    // Progress
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded, e.total);
    });

    // Done
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(file.size, file.size);
        resolve(publicUrl);
      } else {
        let msg = `Upload failed (${xhr.status})`;
        try {
          const parsed = JSON.parse(xhr.responseText);
          msg += `: ${parsed.error || parsed.message || xhr.responseText.slice(0, 200)}`;
        } catch {
          msg += `: ${xhr.responseText.slice(0, 200)}`;
        }
        reject(new Error(msg));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

    xhr.open('POST', uploadUrl);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('x-upsert', 'true');
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.send(file);
  });
}

/**
 * uploadFileWithProgress — alias requiring onProgress (for video lessons etc.)
 */
export async function uploadFileWithProgress(
  bucket: string,
  path: string,
  file: File,
  onProgress: (loaded: number, total: number) => void
): Promise<string> {
  return uploadWithXHR(bucket, path.replace(/[^\w.\-/]/g, '_'), file, onProgress);
}

export function getPublicUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export function openWhatsApp(number: string, message: string) {
  const clean = number.replace(/\D/g, '');
  const encoded = encodeURIComponent(message);
  window.open(`https://wa.me/${clean}?text=${encoded}`, '_blank');
}

export function isVIPActive(profile: { is_vip: boolean; vip_expires_at?: string | null }): boolean {
  if (!profile.is_vip) return false;
  if (!profile.vip_expires_at) return true;
  return new Date(profile.vip_expires_at) > new Date();
}

export function generateReferralCode(userId: string): string {
  return `VAF${userId.slice(0, 6).toUpperCase()}`;
}
