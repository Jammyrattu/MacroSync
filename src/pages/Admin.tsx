import { useState } from 'react'
import { Tabs } from '@/components/ui/Tabs'
import { AdminUsersTab } from '@/components/admin/AdminUsersTab'
import { AdminRoutinesTab } from '@/components/admin/AdminRoutinesTab'
import { AdminChallengesTab } from '@/components/admin/AdminChallengesTab'
import { AdminExercisesTab } from '@/components/admin/AdminExercisesTab'

const TABS = [
  { id: 'users', label: 'Users' },
  { id: 'routines', label: 'Routines' },
  { id: 'challenges', label: 'Challenges' },
  { id: 'exercises', label: 'Exercises' },
] as const

type TabId = (typeof TABS)[number]['id']

/** Admin console. Reachable only through AdminRoute; every action is RLS-gated. */
export function Admin() {
  const [tab, setTab] = useState<TabId>('users')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Admin</h1>
        <p className="text-sm text-slate-500">
          Manage roles, remove accounts and content, and edit the exercise library.
        </p>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'users' ? <AdminUsersTab /> : null}
      {tab === 'routines' ? <AdminRoutinesTab /> : null}
      {tab === 'challenges' ? <AdminChallengesTab /> : null}
      {tab === 'exercises' ? <AdminExercisesTab /> : null}
    </div>
  )
}
