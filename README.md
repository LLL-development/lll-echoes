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
- **Hosting:** Cloudflare Pages (via `@cloudflare/next-on-pages`)
- **Database:** Supabase Postgres
- **Storage:** Supabase Storage
- **Rendering:** html2canvas (client-side notepad export)

## Getting Started

### Prerequisites

- Node.js 20+
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
   Run the SQL migration in `supabase/migrations/001_initial.sql` in your Supabase SQL editor.

5. Run the development server:
   ```bash
   npm run dev
   ```

    Open [http://localhost:3500](http://localhost:3500) in your browser.

### Build for production

```bash
npm run build
```

### Deploy to Cloudflare Pages

```bash
npm run cf:build
```

Then connect the repo to Cloudflare Pages or upload the `.vercel/output` directory.

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
