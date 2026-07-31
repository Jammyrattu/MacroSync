import { supabase } from '@/lib/supabase'

/**
 * Uploads to the public storage buckets.
 *
 * Every path starts with the uploader's user id — the storage RLS policy checks
 * `(storage.foldername(name))[1] = auth.uid()`, so a path without that prefix
 * is rejected.
 */

const MAX_BYTES = 5 * 1024 * 1024

export async function uploadImage(
  bucket: 'avatars' | 'post-images',
  userId: string,
  file: File,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('That file is not an image.')
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Images must be smaller than 5 MB.')
  }

  const extension = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${userId}/${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw new Error(error.message)

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}
