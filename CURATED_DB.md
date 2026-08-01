Curated subset workflow and usage

You asked to avoid Lichess and focus on practical games for players rated 800-1400. I've added a small sample PGN and a Python script to help you build a larger curated dataset from any PGN dump you provide (FICS, TWIC, Kaggle datasets, or other public dumps).

Files added:
- scripts/filter_pgn.py - stream filter to extract games where both players' ratings are between a min and max (defaults 800-1400). Outputs a filtered PGN and a JSONL metadata file.
- sample_games/curated_800_1400.pgn - a small example PGN with a few games in that rating range. Use it to test the app locally.

How to build your curated DB for the app
1. Acquire a PGN dump from a non-Lichess source (examples: FICS dumps, TWIC, Kaggle chess datasets that do not originate from Lichess). Place it as all_games.pgn.
2. Run the filter script:
   pip install python-chess
   python3 scripts/filter_pgn.py --in all_games.pgn --out curated_800_1400.pgn --min 800 --max 1400
3. The script will create curated_800_1400.pgn and curated_800_1400.pgn.jsonl with metadata. Upload the PGN to Supabase Storage or S3 and import the JSONL metadata into Postgres if you want fast search.

Next steps I can take now (pick any):
- Integrate the curated sample into the app UI so the web app can load random practical games for analysis.
- Wire up stockfish.wasm in the frontend and show basic per-move analysis on the current sample games.
- Add a simple API route that serves the curated PGN file from the repo (or from Supabase if you provide credentials) and an endpoint to fetch random games.

Tell me which of those you want next and I will push the code to feat/analysis-app and continue implementing.
