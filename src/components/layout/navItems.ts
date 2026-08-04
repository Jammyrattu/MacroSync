import {
  ChartIcon,
  DumbbellIcon,
  PlusIcon,
  SettingsIcon,
  UsersIcon,
} from '@/components/ui/icons'

/** Single source of truth for the five destinations — desktop and mobile nav
 *  both render from this, so they can never drift apart.
 *
 *  There's no separate home entry: `/` redirects to Progress, so a "Dashboard"
 *  item would have been a second link to a page already in this list. */
export const NAV_ITEMS = [
  { to: '/add-food', label: 'Add Food', Icon: PlusIcon, end: false },
  { to: '/progress', label: 'Progress', Icon: ChartIcon, end: false },
  { to: '/workouts', label: 'Workouts', Icon: DumbbellIcon, end: false },
  { to: '/community', label: 'Community', Icon: UsersIcon, end: false },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon, end: false },
] as const
