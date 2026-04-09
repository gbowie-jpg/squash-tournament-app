# Admin User Guide — Seattle Squash Tournament App

## Overview

The app has two admin areas:
- **`/admin`** — top-level: create tournaments, manage homepage, global email
- **`/t/[slug]/admin`** — per-tournament: matches, players, draws, email, settings

Sign in at `/login` with your organizer email and password.

---

## Setting Up a New Tournament

### 1. Create the tournament

Go to **Admin → Tournaments → + New Tournament**

Fill in:
- **Tournament Name** — becomes the URL slug (e.g. "Seattle City Championships" → `/t/seattle-city-championships`)
- Start/end dates, venue, number of courts

### 2. Fill in tournament details

Go to **Tournament Admin → ⚙️ Tournament Settings**

Fill in the sections:

**Hero Appearance** (top of the page)
- **Background Gradient** — click a swatch to pick the banner color (12 options)
- **Text Color** — pick a color for the headline, subtitle, and labels (10 options)
- **Hero Background Image** — paste a URL for a full-width photo (overrides gradient)
  - Toggle **Dark overlay** on/off — overlay keeps text readable over bright photos
- **Tournament Graphic** — paste a URL for the small logo/icon shown in the corner and on cards

**Basic Info**
- Category (e.g. "Open/Adult"), Location City, Venue, Address, dates, Description

**Schedule Dates**
- Entry Open, Registration Deadline, Draw Lock Date, Entry Closed
- These appear in the Schedule sidebar on the public page

**Contact**
- Contact Name, Email, Phone — shown in the Contact card on the public page

**Info Sections**
- Latest Information, Accommodations, Entry Info, Rules
- Each appears as a collapsible accordion on the public page

### 3. Add courts

Go to **Tournament Admin → Courts → + Add Court**

Add all courts by name ("Court 1", "Show Court", etc.).

### 4. Add players

Go to **Tournament Admin → Players**

Options:
- **Manual entry** — add one at a time
- **CSV import** — upload a CSV with columns: `name, draw, seed, club, email, phone`

Players with emails are automatically added to the email marketing list.

### 5. Generate draws and schedule

Go to **Tournament Admin → Draws & Scheduling**

- Generate brackets per draw division
- Auto-schedule matches to courts

### 6. On tournament day — Match Management

Go to **Tournament Admin → Matches**

For each match:
1. **Assign to court** — pick from the court dropdown
2. **Update status** — Scheduled → On Deck → In Progress → Completed
3. **Enter scores** — game by game (e.g. 11-7, 9-11, 11-5)

---

## During the Tournament

### Push Announcements

Go to **Tournament Admin → Announcements**

- Type your message, pick Normal or Urgent
- Check **Send push notification** to also broadcast to all subscribed users' browsers
- Urgent announcements appear highlighted in red

### Live Court Board

The public URL `/t/[slug]/courts` shows all courts live. Works great on a lobby TV or phone. Share this URL with players and spectators.

### Player Lookup

Players can go to `/t/[slug]/players` and search their name to find their matches.

---

## Email Marketing

### Per-tournament email

Go to **Tournament Admin → Email Marketing**

Three tabs:
- **Recipients** — view/manage the email list, filter by type (player/volunteer/invitee/other), CSV import, manual add
- **Compose** — write subject + body, choose which segment to send to, see live recipient count
- **History** — all campaigns sent for this tournament

**Auto-sync:** Players and volunteers added to the tournament automatically appear in Recipients.

### Global email

Go to **Admin → Email Marketing** (top-level)

Tag-based — assign tags to recipients (e.g. "members", "newsletter"), then target by tag.

---

## Volunteer Management

### Public signup

Volunteers go to `/t/[slug]/volunteer` and fill in their name, email, password, availability, and skills. This creates a Supabase Auth account so they can access tournament info.

### Managing volunteers

Go to **Tournament Admin → Volunteers & Refs**

- See all signups with contact info and availability
- Assign volunteers as referees to specific matches

---

## Homepage & Site Content

Go to **Admin → 🖼️ Site Content**

### Homepage Hero section

- **Background Gradient** — 12 color options with live preview
- **Text Color** — 10 options (white, cream, yellow, amber, orange, lime, sky, teal, rose, purple)
- **Hero Background Image URL** — full-width photo (leave blank for gradient only)
  - **Dark overlay toggle** — appears when image is set; keeps text readable
- **Headline** and **Subheading** — editable text
- **Button 1 & 2** — label and link for the two CTA buttons

### Tournament Hero Images section

Shows all tournaments with their current images at a glance:
- **✓ Hero bg** — background image is set
- **✓ Graphic** — tournament logo/icon is set
- Click **Edit Image** to go directly to that tournament's settings

---

## Push Notifications (PWA)

Users who visit the site can click the **🔔 Enable Notifications** button in the nav to subscribe to push notifications.

To send a push:
1. Go to **Tournament Admin → Announcements**
2. Write your announcement
3. Check **Send push notification**
4. Click **Publish**

The notification goes to all subscribed browsers instantly.

**Note:** `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` must be set in Vercel for push to work.

---

## Uploading Images

The app doesn't have a built-in image uploader. To add images:

1. Go to **Supabase Dashboard → Storage**
2. Open (or create) the `tournament-images` bucket
3. Upload your image
4. Click the image → **Get URL** → copy the public URL
5. Paste the URL into the Image URL field in Tournament Settings or Site Content

The bucket should be set to **public** so URLs work without auth.

---

## Settings & Integrations

Go to **Admin → ⚙️ Settings**

- **Integration status** — checks if Resend and VAPID are configured
- **URL structure reference** — all routes in the app
- **Vercel environment variables** — checklist of all required env vars
- **Quick links** — Supabase, Vercel, Resend, GitHub

---

## Environment Variables (Vercel)

Add these in Vercel project → Settings → Environment Variables:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (server-only) |
| `RESEND_API_KEY` | From resend.com/api-keys |
| `RESEND_FROM_EMAIL` | e.g. noreply@seattlesquash.com |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Push notification public key |
| `VAPID_PRIVATE_KEY` | Push notification private key |

---

## Pending / Known Limitations

- **Resend domain** — emails may only go to verified addresses until the sending domain (seattlesquash.com or authentum.com) is verified in Resend
- **No live score entry from phone** — referee scoring app is on the wishlist
- **No ClubLocker sync** — players need to be added manually or via CSV
- **Court board is not yet real-time** — requires Supabase Realtime subscription setup
