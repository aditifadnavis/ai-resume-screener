import { useState } from 'react';

const THRESHOLD = 60; // score at/above this = AI suggests "shortlist"

export default function App() {
  const [jd, setJd] = useState('');
  const [resumes, setResumes] = useState([{ id: 1, text: '' }]);
  const [data, setData] = useState(null);
  const [decisions, setDecisions] = useState({}); // recruiter's final call per resume id
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const updateResume = (id, text) => setResumes(resumes.map((r) => (r.id === id ? { ...r, text } : r)));
  const addResume = () => resumes.length < 10 && setResumes([...resumes, { id: Date.now(), text: '' }]);

  async function screen() {
    setLoading(true); setError(''); setData(null); setDecisions({});
    try {
      const res = await fetch('/api/screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: jd, resumes: resumes.filter((r) => r.text.trim()) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Request failed');
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const suggestion = (r) => (r.total >= THRESHOLD ? 'shortlist' : 'reject');
  const decided = data ? data.results.filter((r) => decisions[r.id]) : [];
  const overrides = decided.filter((r) => decisions[r.id] !== suggestion(r)).length;

  return (
    <main className="wrap">
      <h1>AI Resume Screener</h1>
      <p className="sub">AI ranks candidates. The recruiter makes the final decision.</p>

      <label>Job description</label>
      <textarea rows={6} value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the job description..." />

      <label>Resumes ({resumes.length}/10)</label>
      {resumes.map((r, i) => (
        <textarea key={r.id} rows={5} value={r.text} onChange={(e) => updateResume(r.id, e.target.value)}
          placeholder={`Paste resume #${i + 1} text (first line = candidate name)...`} />
      ))}
      <div className="row">
        <button className="ghost" onClick={addResume}>+ Add resume</button>
        <button onClick={screen} disabled={loading || !jd.trim()}>{loading ? 'Screening...' : 'Screen candidates'}</button>
      </div>
      {error && <p className="err">{error}</p>}

      {data && (
        <>
          <div className="metrics">
            <span>Mode: <b>{data.mode === 'llm' ? 'LLM' : 'Demo'}</b></span>
            <span>Weights: skills {data.weights.skills * 100}% · experience {data.weights.experience * 100}% · education {data.weights.education * 100}%</span>
            <span>Recruiter override rate: <b>{decided.length ? Math.round((overrides / decided.length) * 100) : 0}%</b> ({overrides}/{decided.length})</span>
          </div>
          {data.results.map((r, rank) => (
            <div className="card" key={r.id}>
              <div className="head">
                <h3>#{rank + 1} {r.name || `Resume ${r.id}`}</h3>
                <span className={`score ${r.total >= THRESHOLD ? 'good' : 'low'}`}>{r.total}</span>
              </div>
              {r.error ? <p className="err">{r.error}</p> : (
                <>
                  <p>{r.summary}</p>
                  <div className="chips">
                    {r.skills.matched.map((s) => <span className="chip ok" key={s}>{s}</span>)}
                    {r.skills.missing.map((s) => <span className="chip miss" key={s}>{s}</span>)}
                  </div>
                  <p className="small">Experience {r.experience.score}: {r.experience.reason}</p>
                  <p className="small">Education {r.education.score}: {r.education.reason}</p>
                  {r.flags.length > 0 && <p className="small">Flags: {r.flags.join(', ')}</p>}
                </>
              )}
              <div className="row">
                <span className="small">AI suggests: <b>{suggestion(r)}</b></span>
                {['shortlist', 'reject'].map((d) => (
                  <button key={d} className={decisions[r.id] === d ? '' : 'ghost'} onClick={() => setDecisions({ ...decisions, [r.id]: d })}>
                    {d === 'shortlist' ? 'Shortlist' : 'Reject'}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </main>
  );
}
