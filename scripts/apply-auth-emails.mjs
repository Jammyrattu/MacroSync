/**
 * Push the auth email templates and the Resend SMTP settings to Supabase.
 *
 * The auth config isn't a migration and can't be diffed, so this script is the
 * record of what it should contain. Re-runnable: it sets the same values every
 * time.
 *
 *   SB_TOKEN=<management token> RESEND_KEY=<resend key> \
 *     node scripts/apply-auth-emails.mjs [--check]
 *
 * --check reports what is live without writing anything.
 */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PROJECT_REF = 'vyxnizdzawlvhpgzlsgi'
const APP_URL = 'https://www.macrosync.co.uk'

const SMTP = {
  smtp_host: 'smtp.resend.com',
  // Implicit TLS. Sent as a string because the config API rejects a number.
  smtp_port: '465',
  smtp_user: 'resend',
  smtp_admin_email: 'accounts@macrosync.co.uk',
  smtp_sender_name: 'MacroSync',
  // The built-in mailer capped the WHOLE PROJECT at 2 auth emails an hour.
  // 20 clears real signup volume while keeping a hammered password-reset from
  // eating the Resend daily quota that the app's other emails share;
  // smtp_max_frequency (60s per address) is the per-user brake.
  rate_limit_email_sent: 20,
}

const checkOnly = process.argv.includes('--check')
const token = process.env.SB_TOKEN
if (!token) throw new Error('SB_TOKEN is required')

// The templates render through the same shell as every other MacroSync email,
// which is a Deno module — bundle it so Node can call it rather than keeping a
// second copy of the layout here.
const out = mkdtempSync(join(tmpdir(), 'authmail-'))
writeFileSync(
  join(out, 'entry.ts'),
  `export { renderEmail, renderText } from ${JSON.stringify(join(ROOT, 'supabase/functions/_shared/emails.ts').replace(/\\/g, '/'))}
export { AUTH_EMAILS } from ${JSON.stringify(join(ROOT, 'supabase/functions/_shared/authEmails.ts').replace(/\\/g, '/'))}`,
)
writeFileSync(
  join(out, 'rolldown.config.mjs'),
  `export default {
  input: ${JSON.stringify(join(out, 'entry.ts'))},
  output: { file: ${JSON.stringify(join(out, 'bundle.mjs'))}, format: 'esm' },
}`,
)
execFileSync(
  process.execPath,
  [join(ROOT, 'node_modules/rolldown/bin/cli.mjs'), '-c', join(out, 'rolldown.config.mjs')],
  { stdio: 'pipe', cwd: ROOT },
)
const { renderEmail, AUTH_EMAILS } = await import('file://' + join(out, 'bundle.mjs'))

const templates = {
  mailer_subjects_confirmation: AUTH_EMAILS.confirmation.subject,
  mailer_templates_confirmation_content: renderEmail(AUTH_EMAILS.confirmation, APP_URL),
  mailer_subjects_recovery: AUTH_EMAILS.recovery.subject,
  mailer_templates_recovery_content: renderEmail(AUTH_EMAILS.recovery, APP_URL),
}

const configUrl = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`

if (checkOnly) {
  const live = await (await fetch(configUrl, { headers: { Authorization: `Bearer ${token}` } })).json()
  for (const [key, value] of Object.entries({ ...SMTP, ...templates })) {
    const same = String(live[key] ?? '') === String(value)
    console.log(`${same ? 'same' : 'DIFF'}  ${key}`)
  }
  console.log(`\nsmtp_pass set: ${Boolean(live.smtp_pass)}`)
  process.exit(0)
}

if (!process.env.RESEND_KEY) throw new Error('RESEND_KEY is required (it is the SMTP password)')

const res = await fetch(configUrl, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ ...SMTP, smtp_pass: process.env.RESEND_KEY, ...templates }),
})

if (!res.ok) {
  console.error('failed:', res.status, (await res.text()).slice(0, 400))
  process.exit(1)
}
console.log('auth email config applied')

// Leaves a copy on disk so the rendered HTML can be eyeballed in a browser
// before anyone finds it in their inbox.
for (const [name, html] of [
  ['confirmation', templates.mailer_templates_confirmation_content],
  ['recovery', templates.mailer_templates_recovery_content],
]) {
  const path = join(out, `${name}.html`)
  writeFileSync(path, html.replaceAll('{{ .ConfirmationURL }}', '#preview'))
  console.log('  preview:', path)
}

// The placeholder has to survive rendering, or the button in a real email
// points nowhere. Checked here rather than trusted, because the shell escapes
// the CTA url and an escaping change would break this silently.
for (const [name, html] of Object.entries(templates)) {
  if (name.startsWith('mailer_templates') && !html.includes('{{ .ConfirmationURL }}')) {
    console.error(`ERROR: ${name} lost its {{ .ConfirmationURL }} placeholder`)
    process.exit(1)
  }
}
