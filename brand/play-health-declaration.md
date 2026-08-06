# Play Console — Health apps declaration

Play Console → **App content** → **Health apps**.

Every answer below is taken from what the code actually does, not from what the
app sounds like it might do. Where a form question doesn't match what's written
here, stop and ask rather than guessing — a wrong answer on this form is a policy
violation, not a typo.

---

## What MacroSync actually does with health data

| | |
|---|---|
| Source | Google Health REST API, over OAuth, in the browser |
| Scopes | `googlehealth.activity_and_fitness.readonly`<br>`googlehealth.sleep.readonly` |
| Access | **Read only.** The app cannot create, change or delete anything in Google Health |
| Stored | `steps`, `distance_m`, `active_calories`, `exercise_minutes`, `sleep_minutes`, `sleep_deep_minutes`, `sleep_light_minutes`, `sleep_rem_minutes`, `sleep_awake_minutes` |
| Also collected in-app | Age, sex, height, weight and weight history — typed by the user, not from Google |
| Who can see it | Only the user it belongs to. Enforced by row-level security; administrators are excluded by policy, not just by the UI |
| Health Connect | **Not used.** See below — this is the answer people get wrong |

---

## The one that trips people up: Health Connect

**Answer: No, the app does not use Health Connect.**

Health Connect is an on-device Android API. An app that uses it declares
`android.permission.health.*` in its Android manifest and goes through a separate
Google approval process.

MacroSync is a Trusted Web Activity. Its manifest declares **no health permissions
at all** — the only one it declares is `POST_NOTIFICATIONS`, for push. The health
data arrives from Google's **cloud** API through a browser OAuth flow, which is a
different mechanism with a different review path.

If Play Console offers you a Health Connect section, decline it. Declaring
permissions the app doesn't have will fail review.

---

## Suggested answers

The form's exact wording changes; match on meaning, and check anything that
doesn't line up.

| Question | Answer | Why |
|---|---|---|
| Does your app have health features? | **Yes** | It reads and displays health data |
| Which category? | **Fitness and wellness** — logging and tracking | Nutrition and exercise tracking for general wellbeing |
| Is it a medical device? | **No** | No diagnosis, no treatment, no clinical measurement |
| Does it make medical claims? | **No** | The copy is deliberately factual; it estimates calories from body weight and work done, and says so |
| Health research or clinical trials? | **No** | |
| Telemedicine or connecting users to clinicians? | **No** | |
| Prescriptions, pharmacy, drugs? | **No** | |
| Mental health, crisis or self-harm support? | **No** | |
| Sexual or reproductive health? | **No** | |
| COVID-19 features? | **No** | |
| Does it use Health Connect? | **No** | See above |
| Does it access health data from another source? | **Yes — Google Health API, read only** | |
| Is health data shared with third parties? | **No** | It goes to your Supabase project and nowhere else. Supabase and Vercel are processors hosting it on your behalf; no health figure is ever sent to Resend, GIPHY or Open Food Facts |

---

## Data safety — the health rows

The Health apps declaration and the Data safety form have to agree. For the health
part specifically:

| Data type | Collected | Shared | Required | Purpose |
|---|---|---|---|---|
| Health info *(age, sex, height, weight, sleep and its stages)* | Yes | No | **Required** | App functionality |
| Fitness info *(steps, distance, active calories, exercise minutes, workouts, sets, reps)* | Yes | No | **Optional** | App functionality |

**Health info is Required.** Age, sex, height and weight are collected during
onboarding and `OnboardedGate` will not let anyone into the app until that is
finished — there is no skip. The Google Health half genuinely is optional, but a data
type counts as Required if any part of it is.

Fitness info is optional: the app works as a food diary alone, and connecting Google
Health can be skipped at signup and undone later.

See `play-data-safety.md` for the full form.

Also tick, for both rows:

- Data is **encrypted in transit** — everything is HTTPS
- Users **can request deletion** — Settings → Delete account, which removes the
  account and every row attached to it
- Users **can request that data is deleted** — same route

---

## Still outstanding, separately from Play

The two scopes above are **Restricted** under the Google API Services User Data
Policy. Until the OAuth client passes Google's security review it will serve at
most 100 users, and Play approval does not change that — they're two different
reviews at two different companies.

The privacy policy Google asks for in that review already exists at
`https://www.macrosync.co.uk/privacy` and covers the health section in detail.
