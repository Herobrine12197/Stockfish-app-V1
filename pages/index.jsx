import { useState, useEffect } from 'react'
import { Chess } from 'chess.js'
import dynamic from 'next/dynamic'

const Chessboard = dynamic(() => import('react-chessboard').then(mod => mod.Chessboard), { ssr: false })

export default function Home() {
  const [pgn, setPgn] = useState('')
  const [game, setGame] = useState(null)
  const [fen, setFen] = useState('start')
  const [moveIndex, setMoveIndex] = useState(0)

  useEffect(() => {
    if (!pgn) return
    try {
      const chess = new Chess()
      const ok = chess.load_pgn(pgn)
      if (!ok) {
        setGame(null)
        return
      }
      const history = chess.history({ verbose: true })
      setGame({ chess, history })
      // reset to start
      chess.reset()
      setFen(chess.fen())
      setMoveIndex(0)
    } catch (e) {
      console.error('Failed to parse PGN', e)
      setGame(null)
    }
  }, [pgn])

  useEffect(() => {
    if (!game) return
    const chess = new Chess()
    chess.load_pgn(pgn)
    chess.reset()
    for (let i = 0; i < moveIndex; i++) {
      const mv = game.history[i]
      chess.move(mv)
    }
    setFen(chess.fen())
  }, [moveIndex, game, pgn])

  const onNext = () => setMoveIndex(i => Math.min(game.history.length, i + 1))
  const onPrev = () => setMoveIndex(i => Math.max(0, i - 1))

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h1>Stockfish App V1 (MVP skeleton)</h1>
      <section style={{ display: 'flex', gap: 20, marginTop: 20 }}>
        <div style={{ flex: 1 }}>
          <label>Paste PGN</label>
          <textarea value={pgn} onChange={e => setPgn(e.target.value)} rows={12} style={{ width: '100%', fontFamily: 'monospace' }} placeholder="Paste PGN here"></textarea>
          <div style={{ marginTop: 8 }}>
            <button onClick={() => { setPgn('[Event \"Casual\"]\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6') }}>Load sample</button>
          </div>
        </div>

        <div style={{ width: 420 }}>
          <div style={{ marginBottom: 8 }}>
            <strong>Board</strong>
          </div>
          <Chessboard position={fen === 'start' ? undefined : fen} boardWidth={400} />

          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <button onClick={onPrev} disabled={!game}>Prev</button>
            <button onClick={onNext} disabled={!game}>Next</button>
            <span style={{ marginLeft: 8 }}>{game ? `${moveIndex}/${game.history.length}` : 'No game loaded'}</span>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Notes</h2>
        <ul>
          <li>Next: integrate stockfish.wasm for client-side analysis.</li>
          <li>Next: add Supabase integration for storing games/analyses (if you confirm).</li>
          <li>Lichess DB: see README for options—use API or curated subset for MVP.</li>
        </ul>
      </section>
    </main>
  )
}
