import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const MODEL = process.env.MODEL || 'claude-sonnet-5-5';
const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

// Weighted scoring model: the LLM scores each dimension, the server computes the total.
const WEIGHTS = { skills: 0.5, experience: 0.3, education: 0.2 };

const SYSTEM = `You are a resume screening assistant helping a recruiter.
Compare the resume to the job description and return ONLY valid JSON, no markdown, in this shape:
{"name": string,
 "skills": {"score": 0-100, "matched": [string], "missing": [string]},
 "experience": {"score": 0-100, "reason": string},
 "education": {"score": 0-100, "reason": string},
 "summary": string (max 2 sentences),
 "flags": [string]}
Rules: treat synonyms as matches (e.g. "JS" = "JavaScript"); credit transferable skills; if information is
missing add it to "flags" instead of guessing; ignore name, gender, age and photo when scoring.`;

function parseJSON(text) {
  const cleaned = text.replace(/```json|```/g, '');
  return JSON.parse(cleaned.slice(cleaned.indexOf('{'), cleaned.lastIndexOf('}') + 1));
}

// Demo mode (no API key): simple keyword overlap so the UI is still usable.
function mockAnalyse(jd, resume) {
  const words = (s) => new Set(s.toLowerCase().match(/[a-z+#.]{3,}/g) || []);
  const jdW = [...words(jd)], resW = words(resume);
  const matched = jdW.filter((w) => resW.has(w)).slice(0, 8);
  const score = Math.min(100, Math.round((matched.length / Math.max(jdW.length, 1)) * 250));
  return {
    name: resume.split('\n')[0].slice(0, 40) || 'Candidate',
    skills: { score, matched, missing: jdW.filter((w) => !resW.has(w)).slice(0, 5) },
    experience: { score, reason: 'Demo mode: keyword overlap only.' },
    education: { score: 60, reason: 'Demo mode: not evaluated.' },
    summary: 'Demo mode result. Add ANTHROPIC_API_KEY for real LLM analysis.',
    flags: ['demo-mode'],
  };
}

async function analyse(jd, resume) {
  if (!client) return mockAnalyse(jd, resume);
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1000,
    system: SYSTEM,
    messages: [{ role: 'user', content: `JOB DESCRIPTION:\n${jd}\n\nRESUME:\n${resume}` }],
  });
  return parseJSON(msg.content.map((b) => b.text || '').join(''));
}

app.post('/api/screen', async (req, res) => {
  const { jobDescription, resumes } = req.body || {};
  if (!jobDescription?.trim() || !Array.isArray(resumes) || !resumes.length)
    return res.status(400).json({ error: 'jobDescription and at least one resume are required' });
  if (resumes.length > 10) return res.status(400).json({ error: 'Max 10 resumes per request' });

  const results = await Promise.all(
    resumes.map(async (r) => {
      try {
        const a = await analyse(jobDescription, r.text);
        const total = Math.round(
          a.skills.score * WEIGHTS.skills + a.experience.score * WEIGHTS.experience + a.education.score * WEIGHTS.education
        );
        return { id: r.id, total, ...a };
      } catch (e) {
        console.error(e.message);
        return { id: r.id, error: 'Could not analyse this resume', total: 0 };
      }
    })
  );
  res.json({ weights: WEIGHTS, mode: client ? 'llm' : 'demo', results: results.sort((a, b) => b.total - a.total) });
});

app.get('/api/health', (_, res) => res.json({ ok: true, mode: client ? 'llm' : 'demo' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server on :${PORT} (${client ? 'LLM mode' : 'demo mode'})`));
