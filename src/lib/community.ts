import type { PostCategory } from '@/types/db'

/** Post categories with their display labels — used by the composer and filter. */
export const POST_CATEGORIES: { id: PostCategory; label: string }[] = [
  { id: 'recipe', label: 'Recipe' },
  { id: 'food_idea', label: 'Food idea' },
  { id: 'tip', label: 'Tip' },
  { id: 'progress', label: 'Progress' },
  { id: 'question', label: 'Question' },
  { id: 'motivation', label: 'Motivation' },
]

export const CATEGORY_LABELS = Object.fromEntries(
  POST_CATEGORIES.map((c) => [c.id, c.label]),
) as Record<PostCategory, string>

/** The fixed reaction set. One reaction per user per post. */
export const REACTION_EMOJIS = ['👍', '❤️', '🔥', '💪', '👏', '😂'] as const
