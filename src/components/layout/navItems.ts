import {
  ChartIcon,
  DumbbellIcon,
  HomeIcon,
  PlusIcon,
  SettingsIcon,
  UsersIcon,
} from '@/components/ui/icons'

/** Single source of truth for the six destinations — desktop and mobile nav
 *  both render from this, so they can never drift apart. */
export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', Icon: HomeIcon, end: true },
  { to: '/add-food', label: 'Add Food', Icon: PlusIcon, end: false },
  { to: '/progress', label: 'Progress', Icon: ChartIcon, end: false },
  { to: '/workouts', label: 'Workouts', Icon: DumbbellIcon, end: false },
  { to: '/community', label: 'Community', Icon: UsersIcon, end: false },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon, end: false },
] as const
