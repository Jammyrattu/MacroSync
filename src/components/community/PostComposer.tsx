import { useState, type ChangeEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { uploadImage } from '@/lib/storage'
import { POST_CATEGORIES } from '@/lib/community'
import type { PostCategory } from '@/types/db'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { ImageIcon, XIcon } from '@/components/ui/icons'

/** Create a post, with an optional image uploaded to the post-images bucket. */
export function PostComposer({
  open,
  onClose,
  onPosted,
}: {
  open: boolean
  onClose: () => void
  onPosted: () => void
}) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<PostCategory>('tip')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return

    setFile(selected)
    // Object URL is revoked when it's replaced or cleared, below.
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old)
      return URL.createObjectURL(selected)
    })
  }

  function clearImage() {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setFile(null)
  }

  function reset() {
    setTitle('')
    setContent('')
    setCategory('tip')
    clearImage()
    setError('')
  }

  async function handleSubmit() {
    if (!user) return
    if (!title.trim()) {
      setError('Give your post a title.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const imageUrl = file ? await uploadImage('post-images', user.id, file) : null

      const { error: postError } = await supabase.from('community_posts').insert({
        user_id: user.id,
        title: title.trim(),
        content: content.trim(),
        category,
        image_url: imageUrl,
      })
      if (postError) throw new Error(postError.message)

      reset()
      onPosted()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the post.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New post">
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="post-title">
            Title
          </label>
          <input
            id="post-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
            placeholder="High-protein overnight oats"
          />
        </div>

        <div>
          <label className="label" htmlFor="post-content">
            Content
          </label>
          <textarea
            id="post-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="input resize-none"
            placeholder="Share the details…"
          />
        </div>

        <div>
          <span className="label">Category</span>
          <div className="grid grid-cols-3 gap-2">
            {POST_CATEGORIES.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setCategory(option.id)}
                aria-pressed={category === option.id}
                className={`rounded-xl border-2 px-2 py-2 text-xs font-semibold transition-colors ${
                  category === option.id
                    ? 'border-brand-500 bg-brand-50 text-brand-800'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="label">Image (optional)</span>
          {preview ? (
            <div className="relative">
              <img src={preview} alt="" className="max-h-48 w-full rounded-xl object-cover" />
              <button
                type="button"
                onClick={clearImage}
                className="absolute top-2 right-2 rounded-full bg-slate-900/70 p-1.5 text-white"
                aria-label="Remove image"
              >
                <XIcon className="size-4" />
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-6 text-slate-500 hover:border-brand-400 hover:text-brand-600">
              <ImageIcon className="size-7" />
              <span className="text-sm font-medium">Choose an image</span>
              <input type="file" accept="image/*" onChange={handleFile} className="sr-only" />
            </label>
          )}
        </div>

        <Alert tone="error">{error}</Alert>

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
