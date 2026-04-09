# Seattle Squash Tournament App — Claude Code Context

## What This Is

Real-time tournament companion app for **SSRA (Seattle Squash Racquets Association)**.
Deployed at **squash-tournament-app.vercel.app** (custom domain pending).

**This is NOT a Club Locker replacement.** Club Locker handles registration, draws, and seeding. This fills the gap Club Locker ignores: live communication and management during the tournament day. Strategy: companion app now, absorb Club Locker functions over time.

**Owner:** Geof Bowie (gbowie@gmail.com). Personal project, not FASTSIGNS work.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Supabase (Postgres) |
| Auth | Supabase Auth (email/password — organizers only) |
| Real-time | Supabase Realtime |
| Deployment | Vercel (auto-deploy on push to main) |
| Email | Resend API |
| Push notifications | Web Push / VAPID |
| PWA | manifest.json + custom service worker |

---

## Key Commands

```bash
npm run dev     # start dev server on localhost:3000
npm run build   # production build
npx tsc --noEmit  # type check (ignore .next/types/ errors — those are generated)
```

**Run migrations:** `SUPABASE_ACCESS_TOKEN=sbp_... npx supabase db query --linked -f file.sql`

---

## Environment Variables

Required in `.env.local` and Vercel:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
RESEND_FROM_EMAIL
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
```

VAPID keys (already generated):
- Public: `BOmOGJHaXQcsUPcQLFK60yaXXqeDf3B11ilJPzqGSNtODW69GsArKVoIGE4-ibqLtu4-_7JjyxvuLzNXObL1-bc`
- Private: `xOqjO3aHTLIOXRgQR5B535IIxA5gzZK4b9US04qvIbc`

---

## Project Structure

```
src/
  app/
    page.tsx                          # Homepage — tournament list + hero
    layout.tsx                        # Root layout — manifest, ServiceWorkerRegistrar
    login/page.tsx                    # Auth
    admin/
      page.tsx                        # Top-level admin dashboard
      tournaments/page.tsx            # Create/manage tournaments
      content/page.tsx                # Homepage hero + tournament graphics editor
      email/page.tsx                  # Global email marketing (tag-based)
      settings/page.tsx               # Integrations, env vars, URL reference
      users/page.tsx                  # User management (superadmin)
    t/[slug]/
      page.tsx                        # Public tournament landing page
      courts/page.tsx                 # Live court board (real-time)
      players/page.tsx                # Player lookup / draw sheet
      announcements/page.tsx          # Public announcements feed
      volunteer/page.tsx              # Public volunteer signup (creates auth account)
      admin/
        page.tsx                      # Tournament admin dashboard
        matches/page.tsx              # Match management (assign courts, scores)
        courts/page.tsx               # Court management
        players/page.tsx              # Player management + CSV import
        draws/page.tsx                # Draw generation + scheduling
        announcements/page.tsx        # Announcement composer + push notifications
        volunteers/page.tsx           # Volunteer/referee management
        email/page.tsx                # Tournament email marketing
        settings/page.tsx             # Tournament settings (hero, contact, schedule, etc.)
    api/
      tournaments/[id]/route.ts       # GET/PATCH/DELETE tournament
      tournaments/[id]/players/route.ts
      tournaments/[id]/matches/route.ts
      tournaments/[id]/courts/route.ts
      tournaments/[id]/announcements/route.ts
      tournaments/[id]/volunteers/route.ts
      tournaments/[id]/email/route.ts
      tournaments/route.ts            # GET all / POST create
      site-settings/route.ts          # GET/PATCH homepage settings
      auth/me/route.ts
      push/subscribe/route.ts         # Save/remove push subscriptions
      push/send/route.ts              # Broadcast push to all subscribers
      email/route.ts                  # Global email send (Resend)
  components/
    layout/
      SiteNav.tsx                     # Top nav with logo, links, PushManager
      SiteFooter.tsx
    CountdownTimer.tsx                # Live countdown (client component)
    InfoAccordion.tsx                 # Collapsible info sections (client component)
    PushManager.tsx                   # Enable/disable push notifications
    ServiceWorkerRegistrar.tsx        # Silent SW registration on load
  lib/
    supabase/
      client.ts                       # Browser Supabase client
      server.ts                       # Server Supabase client
      admin.ts                        # Admin client (service role)
      types.ts                        # Hand-written DB types (keep in sync with schema)
      auth-check.ts                   # requireAuth() helper
    gradients.ts                      # GRADIENT_PRESETS, TEXT_COLOR_PRESETS, heroBackground()
    useTournament.ts                  # Client hook: fetch tournament by slug
    useAuth.ts                        # Client hook: Supabase auth state
    email.ts                          # Resend integration, buildCampaignHtml()
    utils.ts                          # slugify(), etc.
  public/
    manifest.json                     # PWA manifest
    sw.js                             # Service worker (caching + push handling)
    logo.png                          # Seattle Squash logo
```

---

## Data Model Summary

Full schema in `DATA-MODEL.md`. Core tables:

| Table | Purpose |
|-------|---------|
| `tournaments` | Top-level container with all hero/display settings |
| `courts` | Physical courts per tournament |
| `players` | Participants (no auth) |
| `matches` | Core table — status, scores, court assignment |
| `announcements` | Organizer messages, normal/urgent priority |
| `volunteers` | Signup data, creates Supabase auth account |
| `email_recipients` | Per-tournament marketing list (player/volunteer/invitee/other) |
| `email_campaigns` | Sent campaigns with status/count |
| `email_sends` | Per-recipient send records |
| `push_subscriptions` | VAPID push endpoint data |
| `site_settings` | Key/value store for homepage content |

---

## Hero / Display System

Tournaments and the homepage both have a full appearance system:

**Fields on `tournaments`:**
- `image_url` — small square graphic/logo (shown in hero corner + listing cards)
- `hero_image_url` — full-width background photo for the hero banner
- `hero_gradient` — key into `GRADIENT_PRESETS` (default: `'navy'`)
- `hero_text_color` — key into `TEXT_COLOR_PRESETS` (default: `'white'`)
- `hero_overlay` — `'true'`/`'false'` — dark tint over background image

**Homepage via `site_settings` keys:**
- `homepage_hero_image`, `homepage_hero_gradient`, `homepage_hero_text_color`, `homepage_hero_overlay`
- `homepage_hero_title`, `homepage_hero_subtitle`, `homepage_cta1_label/href`, `homepage_cta2_label/href`

**`src/lib/gradients.ts` exports:**
- `GRADIENT_PRESETS` — 12 gradient options
- `TEXT_COLOR_PRESETS` — 10 text color options
- `heroBackground(imageUrl, gradientKey, overlay)` — builds CSS background string
- `getTextColors(key)` — returns `{ heading, body, accent }` CSS color strings

---

## Tournament Settings Fields

Beyond the hero, each tournament has:
- `category` (e.g. "Open/Adult")
- `location_city`, `venue`, `address`
- `contact_name`, `contact_email`, `contact_phone`
- `registration_opens`, `registration_deadline`, `draw_lock_date`, `entry_close_date` (dates)
- `info_latest`, `info_accommodations`, `info_entry`, `info_rules` (text, shown as accordion)

All editable at `/t/[slug]/admin/settings`.

---

## PWA

- **manifest.json** at `/public/manifest.json` — installable, standalone display
- **sw.js** at `/public/sw.js` — caches static assets, handles push `showNotification`
- **VAPID keys** generated and stored — need `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` in Vercel
- **PushManager** component in SiteNav — yellow "Enable Notifications" button
- **Send push** from `/t/[slug]/admin/announcements` — "Send push notification" checkbox

---

## Email Marketing

**Three-tier system:**

1. **Global** (`/admin/email`) — tag-based, targets all recipients with matching tags
2. **Per-tournament** (`/t/[slug]/admin/email`) — type-based (player/volunteer/invitee/other)
3. **Push announcements** — browser push via VAPID (not email)

**Auto-sync:** Adding a player or volunteer with an email automatically upserts them into `email_recipients` for that tournament.

**CSV import** available on both global and tournament email pages.

---

## Volunteer Flow

- Public signup at `/t/[slug]/volunteer` — name, email, password, availability, skills
- Creates a Supabase Auth account so volunteer can access tournament info
- Appears in admin volunteers list + auto-added to email recipients

---

## Caching Notes

- Tournament landing pages: `export const dynamic = 'force-dynamic'` — always fresh
- Homepage: `export const dynamic = 'force-dynamic'` — reads from site_settings
- Admin pages are all client components — no server caching issues

---

## URL Structure

```
/                              Homepage
/t/[slug]                      Tournament landing page
/t/[slug]/courts               Live court board
/t/[slug]/players              Player lookup
/t/[slug]/announcements        Announcements feed
/t/[slug]/volunteer            Volunteer signup (public)
/t/[slug]/admin                Tournament admin dashboard
/t/[slug]/admin/settings       Tournament appearance + details editor
/t/[slug]/admin/email          Tournament email marketing
/admin                         Top-level admin
/admin/tournaments             Create/manage tournaments
/admin/content                 Homepage hero + all tournament graphics
/admin/email                   Global email marketing
/admin/settings                Integrations + env var reference
```

---

## Working Preferences

- Brief and direct — no fluff, no cheerleading
- Ask clarifying questions before diving in on anything ambiguous
- Test TypeScript with `npx tsc --noEmit` before committing (ignore `.next/types/` errors)
- Run migrations via Supabase CLI with `SUPABASE_ACCESS_TOKEN`
- Always use `force-dynamic` on server components that read frequently-changing data
- Convert empty strings to `null` before PATCH requests to Supabase

---

## Pending / Wishlist

- [ ] Custom Vercel domain
- [ ] Resend domain verification (authentum.com or seattlesquash.com) so emails reach any recipient
- [ ] Mobile scoring app — ref marks actual start time + live point-by-point scoring
- [ ] ClubLocker CSV player import
- [ ] CSV export for players/results
- [ ] Bracket visualization
- [ ] Supabase Realtime on court board (currently polling or static)
