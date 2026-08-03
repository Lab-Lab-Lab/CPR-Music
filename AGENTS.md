# AGENTS.md

## Project Overview

MusicCPR (CPR-Music) is a Next.js 14 web application for music education. It provides tools for students and teachers to work with musical concepts like melody, chord scales, and composition through a structured course-based system. The frontend communicates with a separate backend API.

## Tech Stack

- **Framework**: Next.js 14 (Pages Router)
- **Language**: JavaScript (no TypeScript)
- **State Management**: Redux (with next-redux-wrapper, redux-thunk)
- **Data Fetching**: SWR, React Query
- **UI**: React Bootstrap 2, react-icons
- **Music/Audio**: Flat Embed (score editor), Tone.js, WaveSurfer.js, WebMIDI, Web Audio API, ffmpeg (wasm)
- **Auth**: NextAuth.js v4
- **Monitoring**: Sentry
- **Deployment**: Cloudflare (via @opennextjs/cloudflare)
- **Node**: ^22.2.0

## Project Structure

```
pages/                  # Next.js pages (Pages Router)
  api/                  # API routes (auth, audio-proxy)
  auth/                 # Sign in/out pages
  courses/              # Course management and activity pages
    [slug]/             # Dynamic course routes
      [piece]/          # Piece-specific routes (Create, activities, grading)
components/             # React components
  forms/                # Form components (add/edit course, student, upload)
  student/              # Student-facing components (connect, respond, course, etc.)
lib/                    # Utility libraries
  flat.js               # Flat.io score editor integration
  variations.js         # Music variation logic
  courses.js            # Course data helpers
  enrollments.js        # Enrollment data helpers
  audioUtils.js         # Audio processing utilities
  dawUtils.js           # DAW-related utilities
  Track.js, *Synth.js   # Audio synthesis and playback
styles/                 # CSS modules and global styles
public/                 # Static assets (logos, screenshots, sample files)
store.js                # Redux store configuration
reducers.js             # Redux reducers
types.js                # Action type constants
```

## Development

```bash
npm install
npm run dev             # Start dev server (localhost:3000)
npm run build           # Production build
npm run deploy          # Build and deploy to Cloudflare
```

Requires a backend running at `http://localhost:8000` in development (configured in `.env.development`).

## Environment Variables

- `NEXT_PUBLIC_BACKEND_HOST` - Backend API URL
- `SECRET` - NextAuth secret
- `NEXTAUTH_URL` - NextAuth base URL

## Code Conventions

- ESLint with Airbnb config + Prettier
- React functional components
- No TypeScript - plain JavaScript throughout
- CSS Modules for component styles

## Backend Communication

The frontend proxies requests to the backend via Next.js rewrites:
- `/backend/*` -> backend API
- `/media/*` -> backend media files

## Key Integrations

- **Flat.io** (`flat-embed`): Embedded music score editor/viewer used throughout for displaying and editing musical notation
- **Tone.js**: Audio synthesis and playback
- **WaveSurfer.js**: Audio waveform visualization
- **WebMIDI**: MIDI device input support
