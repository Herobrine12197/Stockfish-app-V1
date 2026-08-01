# Stockfish-app-V1 — Chess Analysis App (MVP skeleton)

This repository is the starting point for the chess analysis app that will let users paste PGN and analyze with Stockfish. I created an initial Next.js skeleton on branch feat/analysis-app.

What this initial commit contains:
- Basic Next.js app structure (pages/)
- A landing page with PGN paste area and a placeholder chessboard component
- Instructions for installing dependencies and next steps

Important notes about Lichess database usage
- Lichess provides public API endpoints and monthly game database dumps. The full database is extremely large (hundreds of GB). For an interactive web app, I recommend one of the following approaches:
  1. Use the Lichess API (https://lichess.org/api) or opening explorer endpoints for on-demand access to specific game samples or opening statistics.
  2. Download a curated subset (e.g., top-rated games, specific years, or openings) and store them in a cloud object store (S3) and a Postgres / Supabase index for fast querying.
  3. For full-scale analytics, host the Lichess DB on a server with sufficient storage and build indexes (this is expensive and not necessary for MVP).

Next steps I will take after you confirm:
- Add stockfish.wasm client-side integration and per-move analysis UI.
- Integrate chess.js for PGN parsing and move navigation.
- Add Supabase integration for storing PGNs and analysis results (if you confirm Supabase).

Run locally

1. Install dependencies:
   npm install
2. Run dev server:
   npm run dev

License: MIT. Note that Stockfish is GPL licensed; any distributed copies must include the Stockfish license.
