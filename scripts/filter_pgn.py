#!/usr/bin/env python3
"""
filter_pgn.py

Filter a PGN file for games where both White and Black ratings are within a given range (e.g., 800-1400).

Usage:
  python3 scripts/filter_pgn.py --in all_games.pgn --out filtered_800_1400.pgn --min 800 --max 1400

Requirements:
  pip install python-chess

This script streams through a PGN file and writes matching games to the output file. It also creates a JSONL file (same prefix) with metadata (white, black, ratings, date, eco, url if present).

Why this is useful:
- You asked not to rely on Lichess; this lets you build or bring any large PGN dump (from FICS, TWIC, Kaggle, or other sources) and extract a practical subset for 800-1400 players.
- The resulting filtered PGN can be uploaded to Supabase Storage, S3, or kept locally for the app to serve.

"""
import argparse
import sys
import chess.pgn
import json


def parse_args():
    p = argparse.ArgumentParser(description="Filter PGN by rating range")
    p.add_argument('--in', dest='input', required=True, help='Input PGN file path')
    p.add_argument('--out', dest='output', required=True, help='Output PGN file path for filtered games')
    p.add_argument('--min', dest='min_rating', type=int, default=800, help='Minimum rating (inclusive)')
    p.add_argument('--max', dest='max_rating', type=int, default=1400, help='Maximum rating (inclusive)')
    p.add_argument('--jsonl', dest='jsonl', help='Output JSONL metadata path (optional)')
    return p.parse_args()


def get_int_header(game, key):
    v = game.headers.get(key)
    if v is None:
        return None
    try:
        return int(v)
    except Exception:
        # Some dumps use ? or - instead of a number
        try:
            # try to extract digits
            import re
            m = re.search(r"(\d+)", v)
            if m:
                return int(m.group(1))
        except Exception:
            return None
    return None


def game_matches(game, min_rating, max_rating):
    w = get_int_header(game, 'WhiteElo') or get_int_header(game, 'WhiteRating') or get_int_header(game, 'White')
    b = get_int_header(game, 'BlackElo') or get_int_header(game, 'BlackRating') or get_int_header(game, 'Black')
    if w is None or b is None:
        return False
    return (min_rating <= w <= max_rating) and (min_rating <= b <= max_rating)


def main():
    args = parse_args()
    input_path = args.input
    output_path = args.output
    jsonl_path = args.jsonl or (output_path + '.jsonl')

    infile = open(input_path, 'r', encoding='utf-8', errors='replace')
    out_pgn = open(output_path, 'w', encoding='utf-8')
    out_jsonl = open(jsonl_path, 'w', encoding='utf-8')

    pgn = infile
    count_in = 0
    count_out = 0
    while True:
        game = chess.pgn.read_game(pgn)
        if game is None:
            break
        count_in += 1
        try:
            if game_matches(game, args.min_rating, args.max_rating):
                exporter = chess.pgn.StringExporter(headers=True, variations=True, comments=True)
                s = game.accept(exporter)
                out_pgn.write(s + '\n\n')
                meta = {
                    'White': game.headers.get('White'),
                    'Black': game.headers.get('Black'),
                    'WhiteElo': game.headers.get('WhiteElo'),
                    'BlackElo': game.headers.get('BlackElo'),
                    'Event': game.headers.get('Event'),
                    'Site': game.headers.get('Site'),
                    'Date': game.headers.get('Date'),
                    'Round': game.headers.get('Round'),
                    'Result': game.headers.get('Result'),
                    'ECO': game.headers.get('ECO'),
                    'Opening': game.headers.get('Opening'),
                }
                out_jsonl.write(json.dumps(meta, ensure_ascii=False) + '\n')
                count_out += 1
        except Exception as e:
            # Skip malformed games but keep processing
            print(f"Failed to process a game: {e}", file=sys.stderr)
            continue

    infile.close()
    out_pgn.close()
    out_jsonl.close()

    print(f"Processed {count_in} games; wrote {count_out} games to {output_path} and metadata to {jsonl_path}")


if __name__ == '__main__':
    main()
