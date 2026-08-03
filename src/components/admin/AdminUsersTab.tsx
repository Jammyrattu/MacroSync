import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Profile, UserRole, UserRoleRow } from '@/types/db'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { Alert } from '@/components/ui/Alert'

interface ManagedUser extends Profile {
  role: UserRole | null
}

const ROLE_BADGE: Record<UserRole, string> = {
  admin: 'bg-brand-50 text-brand-700',
  moderator: 'bg-ocean-50 text-ocean-700',
}

/** Manage roles and remove accounts. Admin-only; see AdminRoute. */
export function AdminUsersTab() {
  const { user } = useAuth()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: true }),
      supabase.from('user_roles').select('*'),
    ])

    const roles = new Map(
      ((rolesRes.data ?? []) as UserRoleRow[]).map((r) => [r.user_id, r.role]),
    )
    setUsers(
      ((profilesRes.data ?? []) as Profile[]).map((p) => ({ ...p, role: roles.get(p.id) ?? null })),
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function flash(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 4000)
  }

  async function setRole(target: ManagedUser, role: UserRole | null) {
    setBusy(target.id)
    setError('')

    const { error: writeError } =
      role === null
        ? await supabase.from('user_roles').delete().eq('user_id', target.id)
        : await supabase
            .from('user_roles')
            .upsert({ user_id: target.id, role, granted_by: user?.id }, { onConflict: 'user_id' })

    setBusy(null)

    if (writeError) {
      setError(writeError.message)
      return
    }
    flash(
      role === null
        ? `${target.display_name ?? 'User'} is now an ordinary user.`
        : `${target.display_name ?? 'User'} is now a ${role}.`,
    )
    await load()
  }

  /**
   * Account deletion runs through an edge function: removing a row from
   * auth.users needs the service_role key, which cannot ship to the browser.
   */
  async function deleteUser(target: ManagedUser) {
    const name = target.display_name ?? 'this user'
    if (
      !window.confirm(
        `Permanently delete ${name}?\n\nThis removes their account and everything they own — posts, comments, routines and logs. It cannot be undone.`,
      )
    ) {
      return
    }

    setBusy(target.id)
    setError('')

    const { data, error: fnError } = await supabase.functions.invoke('admin-delete-user', {
      body: { userId: target.id },
    })

    setBusy(null)

    if (fnError) {
      // The function returns its reason in the body; surface that over the
      // generic "non-2xx status code" the client throws.
      const detail = (data as { error?: string } | null)?.error
      setError(detail ?? fnError.message)
      return
    }

    flash(`${name} was deleted.`)
    await load()
  }

  if (loading) {
    return (
      <div className="card py-16">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      <Alert tone="error">{error}</Alert>

      <ul className="card divide-y divide-slate-100 overflow-hidden">
        {users.map((u) => {
          const isSelf = u.id === user?.id
          const working = busy === u.id

          return (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Link to={`/u/${u.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar url={u.avatar_url} name={u.display_name} size={38} />
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900">
                      {u.display_name ?? 'Anonymous'}
                    </span>
                    {u.role ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ROLE_BADGE[u.role]}`}
                      >
                        {u.role}
                      </span>
                    ) : null}
                    {isSelf ? <span className="text-[11px] text-slate-400">you</span> : null}
                  </span>
                  {u.bio ? (
                    <span className="block truncate text-xs text-slate-500">{u.bio}</span>
                  ) : null}
                </span>
              </Link>

              <div className="flex shrink-0 gap-2">
                {u.role === 'admin' ? (
                  // Admins are managed in the database on purpose — promoting
                  // another admin from the UI is an easy way to lose control of
                  // the project by accident.
                  <span className="self-center text-xs text-slate-400">admin</span>
                ) : u.role === 'moderator' ? (
                  <button
                    type="button"
                    disabled={working}
                    onClick={() => void setRole(u, null)}
                    className="btn-secondary !px-3 !py-1.5 text-xs"
                  >
                    {working ? '…' : 'Remove moderator'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={working}
                    onClick={() => void setRole(u, 'moderator')}
                    className="btn-secondary !px-3 !py-1.5 text-xs"
                  >
                    {working ? '…' : 'Make moderator'}
                  </button>
                )}

                {!isSelf ? (
                  <button
                    type="button"
                    disabled={working}
                    onClick={() => void deleteUser(u)}
                    className="btn-secondary !px-3 !py-1.5 text-xs !text-red-600 hover:!bg-red-50"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>

      <p className="px-1 text-xs text-slate-500">
        Deleting an account also removes everything it owns. To add another admin, set their role in
        the <code>user_roles</code> table directly.
      </p>
    </div>
  )
}
