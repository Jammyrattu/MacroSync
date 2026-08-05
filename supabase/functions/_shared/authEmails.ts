/**
 * The emails Supabase Auth itself sends — signup confirmation and password
 * reset.
 *
 * Unlike everything else in this folder, these are NOT sent by an edge
 * function. GoTrue renders them from templates stored in the project's auth
 * config, so the copy lives here and is pushed up as HTML with
 * `scripts/apply-auth-emails.mjs`. Keeping the source in the repo is the point:
 * the config is not diffable, and templates that only exist in a dashboard
 * drift silently.
 *
 * `{{ .ConfirmationURL }}` is a Go template placeholder GoTrue substitutes at
 * send time. It survives renderEmail's HTML escaping because it contains no
 * characters that get escaped.
 *
 * Delivery goes through Resend SMTP, configured on the same auth config. The
 * built-in Supabase mailer it replaced was capped at two emails an hour for
 * the entire project.
 */

import type { EmailContent } from './emails.ts'

/** Matches mailer_otp_exp on the auth config — keep the two in step. */
const EXPIRY = '1 hour'

export const AUTH_EMAILS: Record<'confirmation' | 'recovery', EmailContent> = {
  confirmation: {
    subject: 'Confirm your email address',
    preview: 'One tap and your MacroSync account is ready.',
    heading: 'Confirm your email address',
    body: [
      'Welcome to MacroSync. Confirm this address and your account is ready to use.',
    ],
    cta: { label: 'Confirm email address', url: '{{ .ConfirmationURL }}' },
    footnote: `This link works once and expires in ${EXPIRY}.`,
    footer:
      "You're getting this because this address was used to sign up for MacroSync. If that wasn't you, ignore this email and no account will be created.",
  },

  recovery: {
    subject: 'Reset your password',
    preview: 'Choose a new password for your MacroSync account.',
    heading: 'Reset your password',
    body: ['We got a request to reset the password on your MacroSync account.'],
    cta: { label: 'Choose a new password', url: '{{ .ConfirmationURL }}' },
    footnote: `This link works once and expires in ${EXPIRY}.`,
    footer:
      "If you didn't ask for this, nothing has changed — ignore this email and your password stays as it is.",
  },
}
