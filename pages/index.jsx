import { useState, useEffect, useRef } from 'react'
import { Chess } from 'chess.js'
import dynamic from 'next/dynamic'

const Chessboard = dynamic(() => import('react-chessboard').then(mod => mod.Chessboard), { ssr: false })

const SESSION_KEY = 'sf_app_uploaded_pgns'

export default function Home() {
  const [pgn, setPgn] = useState('')
  const [game, setGame] = useState(null)
  const [fen, setFen] = useState('start')
  const [moveIndex, setMoveIndex] = useState(0)
  const [showTopN, setShowTopN] = useState(2)
  const [searchDepth, setSearchDepth] = useState(12)
  const [analysisCache, setAnalysisCache] = useState({})
  const engineRef = useRef(null)
  const [analysisState, setAnalysisState] = useState({}) // { fen: [{move,score,pv}, ...] }

  const [uploadedGames, setUploadedGames] = useState([]) // {id,name,pgn}

  useEffect(() => {
    // load uploaded games from sessionStorage
    try {
      const raw = typeof window !== 'undefined' ? sessionStorage.getItem(SESSION_KEY) : null
      if (raw) {
        const parsed = JSON.parse(raw)
        setUploadedGames(parsed)
      }
    } catch (e) {
      console.warn('Failed to load session uploads', e)
    }
  }, [])

  useEffect(() => {
    // persist uploaded games to sessionStorage whenever they change
    try {
      if (typeof window !== 'undefined') sessionStorage.setItem(SESSION_KEY, JSON.stringify(uploadedGames))
    } catch (e) {
      console.warn('Failed to persist session uploads', e)
    }
  }, [uploadedGames])

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
      if (mv && mv.san) chess.move(mv.san)
      else if (mv) chess.move(mv)
    }
    setFen(chess.fen())
  }, [moveIndex, game, pgn])

  // initialize stockfish engine on client-side only
  useEffect(() => {
    if (typeof window === 'undefined') return
    let mounted = true
    ;(async () => {
      try {
        const Stockfish = (await import('stockfish')).default || (await import('stockfish')).Stockfish || (await import('stockfish'))
        const engine = Stockfish()
        engineRef.current = engine
      } catch (e) {
        console.warn('Stockfish failed to load in this environment', e)
        engineRef.current = null
      }
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!fen || fen === '') return
    analyzePosition(fen, showTopN, searchDepth)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, showTopN, searchDepth])

  function analyzePosition(fenToAnalyze, topN = 2, depth = 12) {
    const cacheKey = `${fenToAnalyze}::${topN}::${depth}`
    if (analysisCache[cacheKey]) {
      setAnalysisState(prev => ({ ...prev, [fenToAnalyze]: analysisCache[cacheKey] }))
      return
    }
    const engine = engineRef.current
    if (!engine) {
      setAnalysisState(prev => ({ ...prev, [fenToAnalyze]: [] }))
      return
    }

    let lines = []

    const onMessage = (event) => {
      const data = typeof event === 'string' ? event : (event.data || '')
      const line = String(data).trim()
      if (line.startsWith('info')) {
        try {
          const mp = /multipv (\d+)/.exec(line)
          const multipv = mp ? parseInt(mp[1], 10) : 1
          const scoreCp = /score cp ([-\d]+)/.exec(line)
          const scoreMate = /score mate ([-\d]+)/.exec(line)
          let score = null
          if (scoreCp) score = { type: 'cp', value: parseInt(scoreCp[1], 10) }
          else if (scoreMate) score = { type: 'mate', value: parseInt(scoreMate[1], 10) }
          const pvM = /pv (.+)$/.exec(line)
          const pv = pvM ? pvM[1].trim() : null
          if (pv) {
            lines[multipv - 1] = { move: pv.split(' ')[0], pv, score }
            lines = lines.slice(0, topN)
            setAnalysisState(prev => ({ ...prev, [fenToAnalyze]: lines }))
          }
        } catch (e) {}
      }
      if (line.startsWith('bestmove')) {
        setAnalysisCacheState(prev => ({ [cacheKey]: lines }))
        try {
          if (typeof engine.removeEventListener === 'function') engine.removeEventListener('message', onMessage)
          else engine.onmessage = null
        } catch (e) {}
      }
    }

    try {
      if (typeof engine.addEventListener === 'function') engine.addEventListener('message', onMessage)
      else engine.onmessage = onMessage
    } catch (e) {
      try { engine.onmessage = onMessage } catch (e) { }
    }

    try {
      engine.postMessage('uci')
      engine.postMessage('setoption name MultiPV value ' + topN)
      engine.postMessage('isready')
      engine.postMessage('ucinewgame')
      engine.postMessage('position fen ' + fenToAnalyze)
      engine.postMessage('go depth ' + depth)
    } catch (e) {
      console.warn('Failed to postMessage to engine', e)
      try {
        if (typeof engine.removeEventListener === 'function') engine.removeEventListener('message', onMessage)
        else engine.onmessage = null
      } catch (e) {}
    }
  }

  function setAnalysisCacheState(updater) {
    setAnalysisCache(prev => {
      const next = typeof updater === 'function' ? { ...prev, ...updater(prev) } : { ...prev, ...updater }
      return next
    })
  }

  const onNext = () => setMoveIndex(i => (game ? Math.min(game.history.length, i + 1) : 0))
  const onPrev = () => setMoveIndex(i => Math.max(0, i - 1))

  const handleFile = async (file) => {
    const text = await file.text()
    // add to session uploads
    const id = Date.now().toString()
    const name = file.name || `upload-${id}`
    const item = { id, name, pgn: text }
    setUploadedGames(prev => [item, ...prev])
    setPgn(text)
  }

  const saveCurrentToSession = () => {
    if (!pgn || pgn.trim() === '') return
    const id = Date.now().toString()
    const name = `manual-${id}`
    const item = { id, name, pgn }
    setUploadedGames(prev => [item, ...prev])
  }

  const loadUploadedGame = (id) => {
    const item = uploadedGames.find(g => g.id === id)
    if (item) setPgn(item.pgn)
  }

  const deleteUploadedGame = (id) => {
    setUploadedGames(prev => prev.filter(g => g.id !== id))
  }

  const clearSessionUploads = () => {
    setUploadedGames([])
  }

  const downloadFile = (content, filename, mime = 'text/plain') => {
    try {
      const blob = new Blob([content], { type: mime })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Failed to download file', e)
    }
  }

  const exportCurrentPGN = () => {
    if (!pgn || pgn.trim() === '') return
    // attempt to derive filename from game headers
    let filename = 'exported_game.pgn'
    try {
      const chess = new Chess()
      const ok = chess.load_pgn(pgn)
      if (ok) {
        const white = chess.header('White') || 'White'
        const black = chess.header('Black') || 'Black'
        filename = `${white}_vs_${black}.pgn`.replace(/[^a-zA-Z0-9_\-\.]/g, '_')
      }
    } catch (e) {}
    downloadFile(pgn, filename, 'application/x-chess-pgn')
  }

  const exportAnalysisJSON = () => {
    if (!game) return
    // Build analysis per move: for each move, compute FEN after move and include analysisState[fen] if present
    const chess = new Chess()
    chess.load_pgn(pgn)
    chess.reset()
    const moves = chess.history({ verbose: false })
    const perMove = []
    for (let i = 0; i < moves.length; i++) {
      chess.move(moves[i])
      const f = chess.fen()
      perMove.push({ move: moves[i], fen: f, analysis: analysisState[f] || [] })
    }
    const payload = {
      meta: {
        exported_at: new Date().toISOString(),
        move_count: moves.length
      },
      perMove
    }
    downloadFile(JSON.stringify(payload, null, 2), 'analysis_export.json', 'application/json')
  }

  const renderNotation = () => {
    if (!game) return null
    const moves = game.chess.history()
    const rows = []
    for (let i = 0; i < moves.length; i += 2) {
      const white = moves[i]
      const black = moves[i + 1]
      const moveNumber = Math.floor(i / 2) + 1
      rows.push(
        <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', alignItems: 'center' }}>
          <div style={{ width: 40, color: '#666' }}>{moveNumber}.</div>
          <div style={{ minWidth: 80, cursor: 'pointer', color: moveIndex === i + 1 ? 'blue' : 'inherit' }} onClick={() => setMoveIndex(i + 1)}>{white}</div>
          <div style={{ minWidth: 80, cursor: 'pointer', color: moveIndex === i + 2 ? 'blue' : 'inherit' }} onClick={() => setMoveIndex(i + 2)}>{black || ''}</div>
        </div>
      )
    }
    return <div style={{ marginTop: 12 }}>{rows}</div>
  }

  const currentAnalysis = analysisState[fen] || []

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h1>Stockfish App V1 — Curated Practical Games (Session Uploads)</h1>

      <section style={{ display: 'flex', gap: 20, marginTop: 20 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontWeight: '600' }}>Paste PGN or upload file (uploads saved to session)</label>
          <textarea value={pgn} onChange={e => setPgn(e.target.value)} rows={10} style={{ width: '100%', fontFamily: 'monospace' }} placeholder="Paste PGN here"></textarea>
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="file" accept=".pgn" onChange={e => { if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]) }} />
            <button onClick={() => { setPgn('[Event "Casual"]\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6') }}>Load sample</button>
            <button onClick={saveCurrentToSession} disabled={!pgn || pgn.trim() === ''}>Save to session</button>
            <button onClick={clearSessionUploads} style={{ marginLeft: 'auto' }} disabled={uploadedGames.length === 0}>Clear session uploads</button>
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={{ display: 'block', fontWeight: '600' }}>Analysis settings</label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
              <div>
                <div>Show top N moves</div>
                <input type="range" min={1} max={4} value={showTopN} onChange={e => setShowTopN(parseInt(e.target.value, 10))} /> <strong>{showTopN}</strong>
              </div>
              <div>
                <div>Search depth</div>
                <input type="number" min={6} max={24} value={searchDepth} onChange={e => setSearchDepth(parseInt(e.target.value, 10) || 12)} style={{ width: 80 }} />
              </div>
            </div>
            <div style={{ marginTop: 8, color: '#555' }}>
              The engine runs client-side (stockfish.wasm). Deep searches may be slow in the browser; increase depth as needed.
            </div>
          </div>

          <section style={{ marginTop: 24 }}>
            <h2>Notation</h2>
            {renderNotation()}
          </section>

          <section style={{ marginTop: 20 }}>
            <h2>Session uploads ({uploadedGames.length})</h2>
            {uploadedGames.length === 0 && <div style={{ color: '#666' }}>No uploads in this session yet. Upload a .pgn or paste and click "Save to session".</div>}
            <ul style={{ paddingLeft: 0, listStyle: 'none' }}>
              {uploadedGames.map(g => (
                <li key={g.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #eee' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{g.name}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => loadUploadedGame(g.id)}>Load</button>
                    <button onClick={() => deleteUploadedGame(g.id)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div style={{ width: 420 }}>
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Board</strong>
            <div style={{ fontSize: 12, color: '#666' }}>Move {moveIndex} / {game ? game.history.length : 0}</div>
          </div>
          <Chessboard position={fen === 'start' ? undefined : fen} boardWidth={400} />

          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <button onClick={onPrev} disabled={!game}>Prev</button>
            <button onClick={onNext} disabled={!game}>Next</button>
            <button onClick={exportCurrentPGN} disabled={!pgn} style={{ marginLeft: '8px' }}>Download PGN</button>
            <button onClick={exportAnalysisJSON} disabled={!game} style={{ marginLeft: '4px' }}>Download Analysis (JSON)</button>
          </div>

          <div style={{ marginTop: 12 }}>
            <h3>Engine suggestions (top {showTopN})</h3>
            {currentAnalysis.length === 0 && <div style={{ color: '#666' }}>Analysis not available yet for this position.</div>}
            <ol>
              {currentAnalysis.map((a, idx) => (
                <li key={idx} style={{ marginBottom: 6 }}>
                  <div><strong>{a.move}</strong> — PV: {a.pv}</div>
                  <div style={{ fontSize: 13, color: '#444' }}>{a.score ? (a.score.type === 'cp' ? `${(a.score.value/100).toFixed(2)}` : `mate ${a.score.value}`) : 'n/a'}</div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

    </main>
  )
}
