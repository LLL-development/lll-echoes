# Echoes

Developed by LLL Inc.'s dev team — visit us at https://www.live-laugh-love.world

A free, no-login community wall where anyone can create interactive note walls by dragging decorative notepads onto a themed canvas. Like a digital corkboard for testimonials, comments, encouragement, reviews, feedback, and etc — visual, playful, and drag-and-drop.

## Features

- **No login required** — create walls and add notes with zero friction
- **Themed canvases** — testimonials, feedback, reviews, and more
- **Drag & drop** — arrange notepads freely on the wall
- **Rich notepads** — add text and images with free-form positioning
- **Shareable links** — share your wall with a public URL
- **Embeddable** — embed walls on any website via iframe
- **Anonymous editing** — edit your own notes without an account

## Tech Stack

- **Frontend:** Next.js 15 (App Router) + TypeScript
- **Hosting:** Cloudflare Workers (via `@opennextjs/cloudflare`)
- **Database:** Supabase Postgres
- **Storage:** Supabase Storage
- **Rendering:** html2canvas (client-side notepad export)

## Getting Started

### Prerequisites

- Node.js 22.17+ (Node.js 22 is used in CI)
- A Supabase project (free tier works)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd lll-echoes
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env.local` file with:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. Set up the database:
   In your Supabase SQL editor, apply **all** files in `supabase/migrations/`
   in filename order (`001_initial.sql` through `016_walls_update_policy.sql`).
   Apply each migration once and keep track of the files already applied; some
   migrations create tables or policies and cannot be rerun unchanged.
   The initial migration alone is insufficient: later files add required wall
   settings, note content, anonymous grants, and row-level security policies.

5. Run the development server:
   ```bash
   npm run dev
   ```

    Open [http://localhost:3500](http://localhost:3500) in your browser.

### Build for production

Keep the Supabase environment variables from step 3 available during the build.
You can check TypeScript independently of those service credentials with
`npm run typecheck`.

```bash
npm run build
```

### Build and preview for Cloudflare Workers

```bash
npm run cf:build
```

The OpenNext build creates `.open-next/worker.js` and `.open-next/assets`.
Preview that build locally in the Workers runtime with:

```bash
npm run cf:preview
```

Set the Supabase variables before `cf:build` too: Next.js embeds `NEXT_PUBLIC_*`
values during compilation. Use a real Supabase project for database-backed testing.
Local `.env.local` / `.dev.vars` files are ignored by Git.

The build tooling explicitly includes `esbuild`: the OpenNext CLI imports it
directly, so relying on a transitive copy can fail after a clean `npm ci`.

This repository now targets a Worker named `lll-echoes`, rather than the legacy
Cloudflare Pages output. The deployment workflow uses `wrangler deploy --keep-vars`.
This preserves variables already configured on that Worker; it does **not** copy
Pages environment variables or secrets to a new Worker.

Before switching production traffic, configure the new Worker manually in the
Cloudflare dashboard and copy any existing runtime limits that should be retained:

| Worker runtime variable | Purpose |
|-------------------------|---------|
| `ECHOES_WALLS_PER_HOUR_LIMIT` | Global wall creation limit per hour in production |
| `ECHOES_MAX_NOTES_PER_WALL` | Maximum number of notes on each wall |
| `ECHOES_NOTES_PER_HOUR_LIMIT` | Note creation limit per wall per hour |

The Supabase connection is configured separately at **build time**. Set the GitHub
repository secrets `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
the workflow passes these to `cf:build`, and Next.js embeds them in the output.
Copying them only into Worker runtime settings will not update the compiled client.
Use the intended Supabase project URL and its public anonymous key. If overriding
`NEXT_PUBLIC_APP_URL` for settings/OG image requests, supply the public app origin
at build time too; the current workflow only forwards the two Supabase secrets,
so explicitly add that app URL to its build environment when needed.

The existing GitHub secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` select
the deployment account. The token must have permission to deploy Workers; a token
that only deploys Pages is insufficient. Configure or verify those permissions
separately before deployment.

Pages custom domains and production traffic are not moved automatically. Supabase
database contents, policies, and Storage objects (the `notepads` bucket) are also
not copied or provisioned by this Worker deployment. Keep the intended existing
Supabase project, or migrate its data/storage separately and apply the database
setup above for a new project. Building and previewing do not deploy or migrate
any of these resources.

Wall data uses dynamic rendering. This minimal configuration adds no persistent
ISR cache, R2 bucket, or image service; image optimization remains disabled in
`next.config.ts`. If cached server data or ISR is added later, configure the
[OpenNext cache bindings](https://opennext.js.org/cloudflare/caching) first.

## Project Structure

```
├── src/
│   ├── app/                  # Next.js App Router pages
│   │   ├── api/              # API routes
│   │   ├── w/                # Wall routes (viewer, editor)
│   │   └── page.tsx          # Landing page
│   ├── components/           # React components
│   │   └── wall/             # Wall and editor components
│   ├── lib/                  # Utilities
│   │   ├── supabase.ts       # Supabase client
│   │   └── storage.ts        # Supabase Storage helpers
│   └── types/                # TypeScript type definitions
├── supabase/
│   └── migrations/           # Database migrations
└── package.json
```

## Database Schema

### Walls

| Column       | Type      | Description                    |
|-------------|-----------|--------------------------------|
| id          | uuid      | Primary key                    |
| slug        | text      | Unique public identifier       |
| edit_token  | text      | Hashed private access key      |
| mode        | text      | ORGANIZATION or PUBLIC         |
| theme       | text      | Canvas theme (testimonials, etc.) |
| created_at  | timestamptz | Creation timestamp           |

### Note Templates

| Column       | Type      | Description                    |
|-------------|-----------|--------------------------------|
| id          | uuid      | Primary key                    |
| wall_id     | uuid      | Reference to walls             |
| name        | text      | Template name                  |
| style       | jsonb     | Colors, border, shape          |
| is_default  | boolean   | Default template flag          |

### Notes

| Column           | Type      | Description                    |
|-----------------|-----------|--------------------------------|
| id              | uuid      | Primary key                    |
| wall_id         | uuid      | Reference to walls             |
| image_url       | text      | Rendered notepad image URL     |
| x, y            | int       | Position on canvas             |
| width, height   | int       | Note dimensions                |
| rotation        | int       | Rotation in degrees            |
| template_id     | uuid      | Reference to note_templates    |
| author_session_id | text    | Anonymous session UUID         |
| author_name     | text      | Optional display name          |
| created_at      | timestamptz | Creation timestamp           |

## API Routes

| Method | Path                              | Auth              | Description              |
|--------|-----------------------------------|-------------------|--------------------------|
| POST   | `/api/walls`                      | None              | Create a new wall        |
| GET    | `/api/walls/[slug]`               | None              | Get wall + notes         |
| POST   | `/api/walls/[slug]/notes`         | X-Edit-Token      | Add a note               |
| PATCH  | `/api/walls/[slug]/notes/[id]`    | X-Edit-Token      | Edit a note              |
| DELETE | `/api/walls/[slug]/notes/[id]`    | X-Edit-Token      | Delete a note            |
| POST   | `/api/upload`                     | X-Edit-Token      | Upload image to storage  |

## License

MIT License — see [LICENSE](./LICENSE) for details.
