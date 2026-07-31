import { Link, NavLink } from 'react-router'
import { Logo } from '@/components/ui/Logo'
import { useAuth } from '@/hooks/useAuth'
import { NAV_ITEMS } from './navItems'
import { Avatar } from '@/components/ui/Avatar'

/** Desktop header. Hidden below md, where BottomNav takes over. */
export function TopNav() {
  const { profile, user } = useAuth()

  return (
    <header className="sticky top-0 z-30 hidden border-b border-slate-200 bg-white/90 backdrop-blur md:block">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
        <Link to="/" aria-label="MacroSync home">
          <Logo />
        </Link>

        <nav className="flex flex-1 items-center gap-1">
          {NAV_ITEMS.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Icon className="size-[18px]" />
              {label}
            </NavLink>
          ))}
        </nav>

        <Link to="/settings" className="shrink-0" aria-label="Your profile">
          <Avatar url={profile?.avatar_url} name={profile?.display_name ?? user?.email} size={36} />
        </Link>
      </div>
    </header>
  )
}
