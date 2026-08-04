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
 *  Labels are the menu's own wording and needn't match the route: `/progress`
 *  is what `/` redirects to, so it reads as "Dashboard" and leads the list. */
export const NAV_ITEMS = [
  { to: '/progress', label: 'Dashboard', Icon: ChartIcon, end: false },
  { to: '/add-food', label: 'Food Diary', Icon: PlusIcon, end: false },
  { to: '/workouts', label: 'Workouts', Icon: DumbbellIcon, end: false },
  { to: '/community', label: 'Community', Icon: UsersIcon, end: false },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon, end: false },
] as const
