/**
 * MacroSync email templates.
 *
 * Deliberately old-fashioned HTML: nested tables, inline styles, no flexbox or
 * grid. Gmail strips <style> blocks in some clients and Outlook renders through
 * Word, so anything modern degrades to an unstyled wall of text. The one
 * <style> block carries a media query for phones, which is additive — if it's
 * stripped, the fixed 600px layout still reads.
 */

const BRAND = '#059669'
const BRAND_DARK = '#047857'
const INK = '#0f172a'
const MUTED = '#64748b'
const LINE = '#e2e8f0'
const SURFACE = '#f8fafc'

export interface EmailContent {
  subject: string
  /** One-line preview shown in the inbox next to the subject. */
  preview: string
  heading: string
  /** Paragraphs of body copy. */
  body: string[]
  cta?: { label: string; url: string }
  /** Small print under the button. */
  footnote?: string
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/** Wraps content in the branded shell. Everything here is inline-styled. */
export function renderEmail(content: EmailContent, appUrl: string): string {
  const paragraphs = content.body
    .map(
      (text) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${INK};">${text}</p>`,
    )
    .join('')

  const cta = content.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px;">
         <tr><td align="center" bgcolor="${BRAND}" style="border-radius:10px;">
           <a href="${escapeHtml(content.cta.url)}"
              style="display:inline-block;padding:12px 26px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">
             ${escapeHtml(content.cta.label)}
           </a>
         </td></tr>
       </table>`
    : ''

  const footnote = content.footnote
    ? `<p style="margin:8px 0 0;font-size:13px;line-height:1.5;color:${MUTED};">${content.footnote}</p>`
    : ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(content.subject)}</title>
<style>
  /* Additive only — if a client strips this, the 600px table still works. */
  @media only screen and (max-width:620px) {
    .wrap { width:100% !important; }
    .pad { padding-left:20px !important; padding-right:20px !important; }
    .h1 { font-size:20px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .shell { background:#0b1220 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${SURFACE};">
  <!-- Inbox preview text, hidden in the body itself. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(content.preview)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         class="shell" style="background:${SURFACE};padding:28px 12px;">
    <tr><td align="center">

      <table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0"
             style="width:600px;max-width:600px;background:#ffffff;border:1px solid ${LINE};border-radius:16px;overflow:hidden;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

        <tr><td class="pad" style="padding:22px 32px 0;">
          <span style="font-size:17px;font-weight:700;color:${BRAND_DARK};letter-spacing:-0.2px;">MacroSync</span>
        </td></tr>

        <tr><td class="pad" style="padding:18px 32px 0;">
          <h1 class="h1" style="margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:700;color:${INK};">
            ${escapeHtml(content.heading)}
          </h1>
          ${paragraphs}
          ${cta}
          ${footnote}
        </td></tr>

        <tr><td class="pad" style="padding:24px 32px 26px;">
          <hr style="border:none;border-top:1px solid ${LINE};margin:0 0 14px;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED};">
            You're getting this because of activity on your MacroSync account.
            <a href="${escapeHtml(appUrl)}/settings" style="color:${BRAND_DARK};">Manage email preferences</a>
            to change what we send, or turn these off entirely.
          </p>
        </td></tr>

      </table>

      <p style="margin:14px 0 0;font-size:12px;color:${MUTED};font-family:system-ui,-apple-system,sans-serif;">
        MacroSync · <a href="${escapeHtml(appUrl)}" style="color:${MUTED};">macrosync.co.uk</a>
      </p>

    </td></tr>
  </table>
</body>
</html>`
}

/** Plain-text alternative. Improves deliverability and serves text-only clients. */
export function renderText(content: EmailContent, appUrl: string): string {
  const lines = [
    content.heading,
    '',
    ...content.body.map((p) => p.replace(/<[^>]+>/g, '')),
  ]
  if (content.cta) lines.push('', `${content.cta.label}: ${content.cta.url}`)
  if (content.footnote) lines.push('', content.footnote.replace(/<[^>]+>/g, ''))
  lines.push('', '—', `Manage email preferences: ${appUrl}/settings`)
  return lines.join('\n')
}

const strong = (value: string) => `<strong>${escapeHtml(value)}</strong>`

// ---------------------------------------------------------------------------
// The five notifications.
// ---------------------------------------------------------------------------

export const templates = {
  comment: (opts: { actorName: string; postTitle: string; excerpt: string; appUrl: string }): EmailContent => ({
    subject: `${opts.actorName} commented on your post`,
    preview: opts.excerpt.slice(0, 90),
    heading: 'You have a new comment',
    body: [
      `${strong(opts.actorName)} commented on your post ${strong(opts.postTitle)}.`,
      `<span style="display:block;padding:12px 14px;background:${SURFACE};border-left:3px solid ${BRAND};border-radius:0 8px 8px 0;color:${INK};">${escapeHtml(opts.excerpt)}</span>`,
    ],
    cta: { label: 'View the conversation', url: `${opts.appUrl}/community` },
  }),

  follow: (opts: { followerName: string; followerId: string; appUrl: string }): EmailContent => ({
    subject: `${opts.followerName} started following you`,
    preview: `${opts.followerName} is now following you on MacroSync.`,
    heading: 'You have a new follower',
    body: [`${strong(opts.followerName)} is now following you on MacroSync.`],
    cta: { label: `View ${opts.followerName}'s profile`, url: `${opts.appUrl}/u/${opts.followerId}` },
  }),

  challenge_invite: (opts: {
    inviterName: string
    challengeName: string
    rules: string
    startsOn: string
    minCheckins: number
    appUrl: string
  }): EmailContent => ({
    subject: `${opts.inviterName} invited you to "${opts.challengeName}"`,
    preview: `Starts ${opts.startsOn} · check in ${opts.minCheckins}× a week.`,
    heading: `You've been invited to a challenge`,
    body: [
      `${strong(opts.inviterName)} invited you to join ${strong(opts.challengeName)}.`,
      opts.rules
        ? `<span style="display:block;padding:12px 14px;background:${SURFACE};border-left:3px solid ${BRAND};border-radius:0 8px 8px 0;color:${INK};">${escapeHtml(opts.rules)}</span>`
        : '',
      `Starts ${strong(opts.startsOn)}. Check in at least ${strong(`${opts.minCheckins} times a week`)}.`,
    ].filter(Boolean),
    cta: { label: 'Accept or decline', url: `${opts.appUrl}/challenges` },
    footnote: 'You can only join before it starts — the roster closes on the start date.',
  }),

  challenge_checkin: (opts: {
    actorName: string
    challengeName: string
    doneThisWeek: number
    required: number
    appUrl: string
  }): EmailContent => ({
    subject: `${opts.actorName} checked in — ${opts.challengeName}`,
    preview: `${opts.doneThisWeek} of ${opts.required} check-ins this week.`,
    heading: `${opts.actorName} just checked in`,
    body: [
      `${strong(opts.actorName)} has checked in for ${strong(opts.challengeName)} — that's ${strong(`${opts.doneThisWeek} of ${opts.required}`)} for the week.`,
      `Your turn.`,
    ],
    cta: { label: 'Check in now', url: `${opts.appUrl}/challenges` },
  }),

  daily_reminder: (opts: {
    challengeName: string
    doneThisWeek: number
    required: number
    appUrl: string
  }): EmailContent => {
    const remaining = Math.max(0, opts.required - opts.doneThisWeek)
    return {
      subject: `Don't forget to check in — ${opts.challengeName}`,
      preview: `${remaining} more check-in${remaining === 1 ? '' : 's'} needed this week.`,
      heading: 'Time to check in',
      body: [
        `You haven't checked in today for ${strong(opts.challengeName)}.`,
        `You're on ${strong(`${opts.doneThisWeek} of ${opts.required}`)} for this week — ${strong(`${remaining} to go`)}.`,
      ],
      cta: { label: 'Check in', url: `${opts.appUrl}/challenges` },
      footnote: "We only send this when you're short for the week. Hit your target and it stops.",
    }
  },
}
