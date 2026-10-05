# AI Resume Screener (Full Stack + LLM)

Recruiters paste a job description and up to 10 resumes. An LLM (Claude API) analyses each resume and the
backend ranks candidates with a weighted scoring model. The recruiter makes the final shortlist/reject
call, and the app tracks the **recruiter override rate**.

**Stack:** React (Vite) · Node.js + Express · Anthropic Claude API · REST

## How it works
1. `POST /api/screen` receives the JD + resumes.
2. For each resume, the server prompts the LLM to return structured JSON (sub-scores, matched/missing skills, flags).
3. The server computes the final score: **skills 50% + experience 30% + education 20%** (deterministic, easy to tune).
4. React shows a ranked list; the recruiter overrides the AI suggestion if they disagree.

## Run it
```bash
# Terminal 1 - backend
cd server && npm install
cp .env.example .env      # add ANTHROPIC_API_KEY (blank = demo mode)
npm start

# Terminal 2 - frontend
cd client && npm install && npm run dev    # http://localhost:5173
```

## Design decisions
- LLM scores dimensions; code computes the total, so results are explainable and weights are adjustable.
- Prompt ignores name/gender/age and flags missing info instead of guessing.
- Recruiter stays the decision-maker; override rate measures how far the AI deviates from human judgment.
- API key stays on the server and is never exposed to the browser.

## Possible next steps
PDF upload and parsing · saving results to MongoDB · auth · bias audit across sample sets
