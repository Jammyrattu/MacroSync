# Play Console — creating the app

The values on this page are the ones that cannot be changed later. Get these right
and everything else on the listing is editable forever.

---

## The package name

```
uk.co.macrosync.app
```

Checked against the Play Store on 6 Aug 2026 — nothing is published under it.

**This can never be changed.** Not renamed, not corrected, not reused. It is how Play,
Android and every installed copy identify the app for its whole life. If it turns out
to be wrong the only fix is a new listing with no reviews, no ratings and no installs.

It also has to match the shell exactly. Bubblewrap writes `packageId` into
`twa-manifest.json`, and if the two disagree the upload is rejected with a package
mismatch — so tell me if you type anything other than the string above.

Why this one: it is `macrosync.co.uk` reversed, which is the Java convention and the
thing that shows you own the domain the app points at. `com.macrosync.app` was also
free but claims a domain you don't have.

---

## Create app

**All apps → Create app.**

| Field | Value | Changeable later? |
|---|---|---|
| App name | `MacroSync` | Yes |
| Default language | English (United Kingdom) – en-GB | Yes |
| App or game | App | Yes |
| Free or paid | **Free** | **No, once published** |
| Package name *(if asked)* | `uk.co.macrosync.app` | **Never** |

Then tick both declarations — Developer Programme Policies, and US export laws — and
press **Create app**.

### The two that bite

**Free is a one-way door.** A published free app can never become paid. Paid can become
free, once. If there is any chance MacroSync is ever paid-for, it has to launch that
way. Subscriptions and in-app purchases are a separate thing and can be added to a free
app at any time, so "free with a subscription later" is fine — that is the route most
apps take.

**The Google account that creates this owns it forever.** Transferring an app between
developer accounts is possible but slow and paid. Use the account you intend to keep,
not a personal one you might lose access to.

### If it doesn't ask for a package name

Most Play Console flows don't — the package name is taken from the first App Bundle you
upload, and fixed from that moment. That is fine. It still has to be
`uk.co.macrosync.app`, and it will be, because Bubblewrap is configured with it.

---

## What happens next

Creating the app gets you a dashboard of setup tasks. The order that avoids waiting on
yourself:

1. **Store listing** — paste from `store-listing.md`, upload the screenshots, the
   feature graphic, and `public/icons/icon-play-512.png` as the app icon.
2. **App access** — the `review@macrosync.co.uk` credentials.
3. **Content rating, Data safety, Health declaration** — ask first; the answers come
   from what the code actually stores and guessing at your own app's data handling is
   how a submission gets rejected.
4. **Closed testing** — needs the `.aab`, which needs the keystore, which is the step
   we do together.
