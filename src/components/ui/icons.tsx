import type { SVGProps } from 'react'

/**
 * Inline 24x24 stroke icons — avoids pulling in an icon package for the dozen
 * glyphs this app actually uses. All inherit currentColor.
 */

type IconProps = SVGProps<SVGSVGElement>

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export const HomeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
  </Icon>
)

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const FootprintsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 15c-.6-2.5-.6-4.6 0-6.4C5.6 6.8 6.6 6 8 6s2.4.8 2.6 2.6c.2 1.8 0 3.9-.6 6.4Z" />
    <path d="M4.4 15h5.6c.3 1.5.1 2.6-.6 3.2-.7.6-1.6.9-2.6.8-1-.1-1.8-.5-2.2-1.2-.4-.7-.5-1.6-.2-2.8Z" />
    <path d="M14 19c-.6-2.5-.6-4.6 0-6.4.6-1.8 1.6-2.6 3-2.6s2.4.8 2.6 2.6c.2 1.8 0 3.9-.6 6.4Z" />
  </Icon>
)

export const FlameIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3c.5 2.5-1 3.8-2.3 5.2C8.3 9.7 7 11.2 7 13.8A5 5 0 0 0 17 14c0-3.2-1.8-4.8-3-6.5" />
    <path d="M12 20a2.6 2.6 0 0 1-2.6-2.6c0-1.6 1.4-2.4 2.6-4 1.2 1.6 2.6 2.4 2.6 4A2.6 2.6 0 0 1 12 20Z" />
  </Icon>
)

export const MapPinIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.6" />
  </Icon>
)

export const MoonIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
  </Icon>
)

export const InfoIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </Icon>
)

export const ChartIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Icon>
)

export const DumbbellIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11" />
  </Icon>
)

export const UsersIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
    <circle cx="9" cy="7" r="3.5" />
    <path d="M22 20v-1.5a4 4 0 0 0-3-3.87M16.5 3.6a3.5 3.5 0 0 1 0 6.8" />
  </Icon>
)

export const SettingsIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-1 1.47V21a2 2 0 1 1-4 0v-.11a1.6 1.6 0 0 0-1.05-1.46 1.6 1.6 0 0 0-1.76.32l-.07.06a2 2 0 1 1-2.83-2.83l.06-.06A1.6 1.6 0 0 0 4.6 15a1.6 1.6 0 0 0-1.47-1H3a2 2 0 1 1 0-4h.11a1.6 1.6 0 0 0 1.46-1.05 1.6 1.6 0 0 0-.32-1.76l-.06-.07a2 2 0 1 1 2.83-2.83l.06.06A1.6 1.6 0 0 0 9 4.6a1.6 1.6 0 0 0 1-1.47V3a2 2 0 1 1 4 0v.11a1.6 1.6 0 0 0 1 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.6 1.6 0 0 0-.32 1.77V9a1.6 1.6 0 0 0 1.47 1H21a2 2 0 1 1 0 4h-.11a1.6 1.6 0 0 0-1.47 1z" />
  </Icon>
)

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
)

export const BarcodeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 6V4.5A1.5 1.5 0 0 1 4.5 3H6M18 3h1.5A1.5 1.5 0 0 1 21 4.5V6M21 18v1.5a1.5 1.5 0 0 1-1.5 1.5H18M6 21H4.5A1.5 1.5 0 0 1 3 19.5V18" />
    <path d="M7 8v8M10.5 8v8M14 8v8M17 8v8" />
  </Icon>
)

export const StarIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m12 3.5 2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.65l5.9-.85z" />
  </Icon>
)

export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 6h17M9 6V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6M18.5 6l-.8 13.1a1.5 1.5 0 0 1-1.5 1.4H7.8a1.5 1.5 0 0 1-1.5-1.4L5.5 6" />
  </Icon>
)

export const PencilIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7.5 18.5l-4 1 1-4z" />
  </Icon>
)

export const ChevronLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m15 5-7 7 7 7" />
  </Icon>
)

export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 5 7 7-7 7" />
  </Icon>
)

export const ChevronDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 9 7 7 7-7" />
  </Icon>
)

export const XIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
)

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Icon>
)

export const ImageIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="8.5" cy="9.5" r="1.5" />
    <path d="m4 17 4.5-4.5 3.5 3.5 3-3L20 17" />
  </Icon>
)

export const CommentIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-5.1A8 8 0 1 1 21 11.5z" />
  </Icon>
)

export const CopyIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
  </Icon>
)

export const PlayIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 4.5v15l12-7.5z" />
  </Icon>
)

export const ClockIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5.5l3.5 2" />
  </Icon>
)

export const LogoutIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3M16 17l5-5-5-5M21 12H9" />
  </Icon>
)
