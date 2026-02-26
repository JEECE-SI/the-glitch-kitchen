# The Glitch Kitchen 🍳

A collaborative cooking game built with Next.js, Supabase, and AI-powered recipe testing.

## Overview

The Glitch Kitchen is a multiplayer game where brigades (teams) work together to reconstruct a recipe by collecting and decoding fragments. The game features real-time collaboration, AI-powered recipe validation, and multiple game modes.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **Database**: Supabase (PostgreSQL with real-time subscriptions)
- **AI**: Google Gemini / OpenAI for recipe testing
- **State Management**: Zustand
- **Deployment**: Docker, Docker Compose

## Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn
- Supabase account
- Gemini or OpenAI API key

### Installation

1. **Clone the repository**:
```bash
git clone <your-repo-url>
cd the-glitch-kitchen
```

2. **Install dependencies**:
```bash
npm install
```

3. **Set up environment variables**:
   - Copy `.env.example` to `.env.local`
   - Fill in your Supabase credentials and API keys

4. **Set up the database**:
   - Create a Supabase project
   - Run the SQL script from `supabase_schema.sql` in the Supabase SQL Editor

5. **Run the development server**:
```bash
npm run dev
```

6. **Open** [http://localhost:3000](http://localhost:3000)

## Project Structure

```
├── src/
│   ├── app/              # Next.js app router pages
│   │   ├── admin/        # Admin dashboard
│   │   ├── gm/           # Game Master interface
│   │   ├── player/       # Player interface
│   │   ├── staff/        # Staff interface
│   │   └── api/          # API routes
│   ├── components/       # React components
│   ├── lib/              # Utilities and Supabase client
│   ├── hooks/            # Custom React hooks
│   └── store/            # Zustand state management
├── supabase_schema.sql   # Database schema
├── Dockerfile            # Docker configuration
├── docker-compose.yml    # Docker Compose setup
└── DEPLOYMENT.md         # Deployment guide
```

## Features

- **Real-time Collaboration**: Multiple players can work together in brigades
- **AI Recipe Testing**: Automated recipe validation using AI
- **Fragment System**: Collect and decode recipe fragments
- **Multiple Roles**: Admin, Game Master, Staff, and Player interfaces
- **Prestige Points**: Competitive ranking system
- **Game Logs**: Track all game events and actions

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Database Schema

The database includes:
- `games` - Game sessions
- `brigades` - Teams/groups
- `players` - Individual players
- `recipe_notes` - Recipe reconstruction progress
- `inventory` - Fragment storage
- `catalog_*` - Game content catalogs
- `game_logs` - Event logging

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions including:
- Docker deployment
- VPS setup
- Nginx configuration
- SSL setup
- Environment configuration

### Quick Deploy with Docker

```bash
docker-compose up -d --build
```

## Environment Variables

Required environment variables (see `.env.example`):

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
```

## License

MIT
