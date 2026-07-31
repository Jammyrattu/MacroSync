import { NavLink } from 'react-router'
import { NAV_ITEMS } from './navItems'

/** Mobile tab bar. Hidden at md and up, where TopNav takes over. */
export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
      {/* pb keeps the tabs clear of the iOS home indicator. */}
      <div className="mx-auto grid max-w-lg grid-cols-6 pb-[env(safe-area-inset-bottom)]">
        {NAV_ITEMS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors ${
                isActive ? 'text-brand-600' : 'text-slate-500'
              }`
            }
          >
            <Icon className="size-5" />
            <span className="leading-none">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
