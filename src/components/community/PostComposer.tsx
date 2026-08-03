import { useRef, useState, type ChangeEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { uploadImage } from '@/lib/storage'
import { POST_CATEGORIES } from '@/lib/community'
import type { PostCategory } from '@/types/db'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { ImageIcon, XIcon } from '@/components/ui/icons'
import { LazyMediaPicker, type PickedGif } from './LazyMediaPicker'

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
  const [picker, setPicker] = useState<'emoji' | 'gif' | null>(null)
  // A chosen GIF is hot-linked from the provider, so there's no file to upload.
  const [gifUrl, setGifUrl] = useState<string | null>(null)
  const contentRef = useRef<HTMLTextAreaElement | null>(null)

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return

    setGifUrl(null)
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
    setGifUrl(null)
  }

  /** Insert at the caret rather than appending, so it lands where you were typing. */
  function insertEmoji(emoji: string) {
    const el = contentRef.current
    if (!el) {
      setContent((c) => c + emoji)
    } else {
      const start = el.selectionStart ?? content.length
      const end = el.selectionEnd ?? content.length
      const next = content.slice(0, start) + emoji + content.slice(end)
      setContent(next)
      // Restore the caret after React re-renders with the new value.
      window.requestAnimationFrame(() => {
        el.focus()
        el.setSelectionRange(start + emoji.length, start + emoji.length)
      })
    }
    setPicker(null)
  }

  function chooseGif(gif: PickedGif) {
    // A GIF replaces an uploaded image: a post carries one image_url.
    if (preview) URL.revokeObjectURL(preview)
    setFile(null)
    setPreview(gif.url)
    setGifUrl(gif.url)
    setPicker(null)
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
      const imageUrl = file ? await uploadImage('post-images', user.id, file) : gifUrl

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
            ref={contentRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="input resize-none"
            placeholder="Share the details…"
          />

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setPicker('emoji')}
              className="btn-secondary !px-3 !py-1.5 text-xs"
            >
              😊 Emoji
            </button>
            <button
              type="button"
              onClick={() => setPicker('gif')}
              className="btn-secondary !px-3 !py-1.5 text-xs"
            >
              GIF
            </button>
          </div>
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
          <span className="label">{gifUrl ? 'GIF' : 'Image (optional)'}</span>
          {preview ? (
            <div className="relative">
              <img
                src={preview}
                alt=""
                className={`max-h-48 w-full rounded-xl ${gifUrl ? 'object-contain' : 'object-cover'}`}
              />
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

      <LazyMediaPicker
        open={picker !== null}
        onClose={() => setPicker(null)}
        onPickEmoji={insertEmoji}
        onPickGif={chooseGif}
        initialTab={picker ?? 'emoji'}
      />
    </Modal>
  )
}
