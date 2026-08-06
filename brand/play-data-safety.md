# Play Console — Data safety

Play Console → **App content** → **Data safety**.

Every row below comes from reading the schema, the storage buckets and the network
calls, not from what the app looks like it does. Play cross-checks this form against
the app's actual behaviour, so an over-declaration is as much a problem as an
under-declaration.

---

## The three opening questions

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** — everything is HTTPS: Supabase, Vercel, Google, Resend, Open Food Facts, GIPHY |
| Do you provide a way for users to request that their data is deleted? | **Yes** — Settings → Delete account |

That last one is only true as of today. Until the account-deletion feature shipped it
would have been a false declaration.

---

## Data types — what to tick

Everything is **collected**, nothing is **shared**. Play defines "shared" as transfer
to a third party for their own use. Supabase and Vercel host the data on your behalf
as processors, and Resend delivers mail on your behalf — none of those count.

### Personal info

| Type | Collected | Shared | Required? | Purposes |
|---|---|---|---|---|
| **Name** | Yes | No | **Optional** — display name can be left blank | App functionality, Account management |
| **Email address** | Yes | No | **Required** — it is the login | App functionality, Account management, Developer communications |
| **User IDs** | Yes | No | Required | App functionality, Account management |

"Developer communications" belongs on email because you send notification and
challenge emails to it.

### Health and fitness

| Type | Collected | Shared | Required? | Purposes |
|---|---|---|---|---|
| **Health info** | Yes | No | **Required** | App functionality |
| **Fitness info** | Yes | No | **Optional** | App functionality |

**Health info is Required, not Optional.** Age, sex, height and weight are collected
during onboarding, and `OnboardedGate` will not let anyone into the app until that is
finished — there is no skip. The Google Health part (sleep and its stages) *is*
optional, but a data type is Required if any of it is, and the body metrics are.

Fitness info — workouts, sets, reps, steps, distance, active calories, exercise
minutes — is genuinely optional. You can use the app purely as a food diary.

### Photos and videos

| Type | Collected | Shared | Required? | Purposes |
|---|---|---|---|---|
| **Photos** | Yes | No | Optional | App functionality |

Avatars, community post images and challenge check-in photos.

### App activity

| Type | Collected | Shared | Required? | Purposes |
|---|---|---|---|---|
| **Other user-generated content** | Yes | No | Optional | App functionality |
| **In-app search history** | Yes | No | Optional | App functionality — **tick "processed ephemerally"** |

User-generated content covers posts, comments, check-in notes and routine names.

Search history is food and GIF searches. They are sent to Open Food Facts and GIPHY
to answer the query and are never written to your database, so they qualify as
ephemeral. Tick that box — without it you are declaring you keep a search history you
do not keep.

### Device or other IDs

| Type | Collected | Shared | Required? | Purposes |
|---|---|---|---|---|
| **Device or other IDs** | Yes | No | Optional | App functionality |

The Web Push subscription endpoint. It identifies a browser installation, which is
what Play means by "device or other ID". Optional because push is opt-in and off by
default.

---

## What NOT to tick, and why

Ticking these would be a false declaration just as much as omitting a real one.

| | |
|---|---|
| **Location** | No geolocation API is used anywhere. The "distance" figure from Google Health is a total in metres, not a position |
| **Financial info** | The app is free and takes no payments |
| **Files and docs** | The CSV import reads the file with `file.text()` **in the browser** and only stores the routines it derives. The file itself never leaves the device |
| **Crash logs / Diagnostics** | No Sentry, no Firebase, no analytics SDK of any kind — verified across the whole codebase |
| **Messages** | There is no direct messaging. Comments are public content, declared under user-generated content |
| **Contacts, Calendar, Audio, Installed apps, Web browsing** | Never requested or accessed |

---

## Security practices section

| Question | Answer |
|---|---|
| Encrypted in transit | **Yes** |
| Users can request data deletion | **Yes** — Settings → Delete account |
| Committed to Play Families Policy | No — the app is not aimed at children |
| Independent security review | No |

---

## Where this has to agree with other forms

- **Health apps declaration** — the health rows here must match it. See
  `play-health-declaration.md`.
- **Privacy policy** at `https://www.macrosync.co.uk/privacy` already lists Supabase,
  Vercel, Resend, Google, Open Food Facts and GIPHY as the third parties involved,
  and says health data is visible only to the user it belongs to. Nothing above
  contradicts it.
- **Target audience** — set 18+ or 13+, not a children's audience. Declaring a child
  audience pulls in the Families policy, which this app is not built for.
