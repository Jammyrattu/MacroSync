import { Outlet } from 'react-router'
import { TopNav } from './TopNav'
import { BottomNav } from './BottomNav'

/**
 * Chrome for every signed-in screen: top nav on desktop, bottom tab bar on
 * mobile. The bottom padding reserves space for the fixed tab bar so page
 * content is never hidden behind it.
 */
export function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav />
      <main className="mx-auto w-full max-w-3xl px-4 pt-4 pb-24 md:max-w-5xl md:px-6 md:pb-10">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
