# 📘 Introduction: Signal-First Book Distillation App

This application is a **personal knowledge distillation system** designed to extract **only the highest-value ideas** from long-form non-fiction books.

Most productivity, time management, and personal finance books contain a **small number of solid ideas** wrapped in large amounts of repetition, storytelling, and motivational filler. This app exists to **remove that noise**, preserve the real signal, and reconstruct the book around **decision-changing ideas** rather than chapters or prose.

The goal is **not to summarize** books faster.
The goal is to **understand them better with less time**.

---

## What This App Is

- A **signal extraction engine**, not a summarizer
- An **idea-first system**, not chapter-based
- A tool for **analytical readers** who value clarity over persuasion
- A personal knowledge system optimized for **decision impact**

The output is a **reconstructed version of the book** that:

- Removes repetition and filler
- Preserves only core principles and constraints
- Keeps only the best, most generalizable examples
- Collapses weak books aggressively
- Produces a dense, readable result typically **5–20%** of the original length

---

## What This App Is Not

This app is **explicitly not**:

- A motivational tool
- An entertainment reader
- A chapter-faithful summary
- A prose-preserving system
- A replacement for deep reading when behavior change is the goal

If removing a sentence does not reduce understanding, it **must be removed**.

---

## Core Philosophy

This system follows three non-negotiable principles:

1. **Signal over completeness**
   It is better to extract fewer ideas clearly than many ideas poorly.

2. **Ideas over storytelling**
   Knowledge is preserved as principles, rules, and constraints — not narratives.

3. **Reconstruction over compression**
   The book is rebuilt around insights that survive strict filtering, not shortened uniformly.

---

## Intended Outcome

After processing a book with this system, the user should be able to:

- Identify all meaningful ideas in under an hour
- Understand how those ideas affect decisions
- Ignore the original book without losing insight
- Avoid rereading repetitive or low-value content

If a book contains little real substance, the system should reflect that by producing **very little output**.

---

## Guiding Rule (Overrides All Others)

> **If removing something does not reduce understanding, remove it.**

This rule governs every stage of the system, from claim extraction to final output.

# 📘 Project Guideline: Signal-First Book Distillation App (Next.js)

## 1. Project Overview

Build a **personal knowledge distillation application** that:

- Accepts full-length non-fiction books (PDF)
- Removes fluff, repetition, and filler
- Extracts only **decision-changing ideas**
- Preserves **only the best examples**
- Reconstructs the book around ideas (not chapters)
- Produces a **clean, dense output (5–20%)**

This is **not a summarizer**.
It is a **signal extraction and idea reconstruction system**.

---

## 2. Tech Stack (Final)

### Core

- **Next.js (App Router)** – frontend + backend
- **Node.js runtime**
- **Vercel AI SDK** – LLM orchestration
- **MongoDB Atlas (or local MongoDB)**
- **Mongoose** – schema & persistence
- **Passport.js** – authentication
- **Google OAuth 2.0**

### Libraries

- `pdf-parse` – PDF text extraction
- `multer` or `formidable` – file uploads
- `passport-google-oauth20`
- `jsonwebtoken` (optional)
- `zod` (for schema validation, recommended)

---

## 3. High-Level Architecture

![Image](https://miro.medium.com/1%2A6LyIlAxDmwMisIMfZ8blHg.png)

![Image](https://learn.microsoft.com/en-us/samples/azure/ai-document-processing-pipeline/azure-ai-document-processing-pipeline-python/media/flow.png)

![Image](https://www.researchgate.net/publication/350200706/figure/fig2/AS%3A1015456265691136%401619115048998/Abstractive-Summarization-Pipeline.ppm)

```
User (Browser)
  ↓
Next.js App Router
  ├── UI (Upload, Progress, Results)
  ├── API Routes (/api/*)
  │
  ├── Auth (Passport + Google)
  ├── PDF Processing
  ├── AI Distillation Pipeline
  └── MongoDB (Mongoose)
```

---

## 4. Authentication (Google Login with Passport.js)

### Goals

- Personal use, but secure
- Google login only
- User-specific book history

### Steps

#### 4.1 Google OAuth Setup

- Create Google OAuth app
- Get:

  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`

- Callback URL:

```
/api/auth/google/callback
```

#### 4.2 Passport Strategy

```ts
passport.use(
  new GoogleStrategy(
    {
      clientID,
      clientSecret,
      callbackURL,
    },
    async (accessToken, refreshToken, profile, done) => {
      // find or create user in MongoDB
    }
  )
);
```

#### 4.3 User Model (Mongoose)

```ts
User {
  googleId: String,
  email: String,
  name: String,
  createdAt: Date
}
```

#### 4.4 Session Handling

- Use cookies or JWT (JWT simpler in Next.js)
- Auth middleware for protected routes

---

## 5. Database Design (MongoDB)

### Core Collections

#### 5.1 Book

```ts
Book {
  userId,
  title,
  status: "uploaded | processing | completed",
  createdAt
}
```

#### 5.2 Chunk

```ts
Chunk {
  bookId,
  order,
  text,
  pageRange
}
```

#### 5.3 Claim

```ts
Claim {
  bookId,
  chunkId,
  text,
  label: "core | supporting | redundant | filler",
  score
}
```

#### 5.4 Idea (Clustered)

```ts
Idea {
  bookId,
  title,
  principle,
  examples[],
  behaviorDelta
}
```

#### 5.5 FinalOutput

```ts
FinalOutput {
  bookId,
  markdown,
  createdAt
}
```

---

## 6. Summarization Philosophy (Must Be Followed)

### What to KEEP

- Core principles
- Constraints
- Decision rules
- Generalizable examples

### What to REMOVE

- Personal anecdotes
- Repetition
- Motivational fluff
- Obvious advice
- Chapter structure

---

## 7. AI Distillation Pipeline (Core Logic)

### Step 1: PDF Upload

**Route**

```
POST /api/book/upload
```

Actions:

- Save file
- Create Book record
- Set status = `uploaded`

---

### Step 2: Text Extraction

- Use `pdf-parse`
- Strip headers/footers
- Preserve page numbers if possible

Output saved to DB.

---

### Step 3: Intelligent Chunking

Rules:

- ~800–1500 tokens
- No mid-paragraph splits
- Preserve order

Saved as `Chunk` documents.

---

### Step 4: Claim Extraction (Critical)

For **each chunk**, call the LLM.

**Prompt Concept**

```
Extract only claims that can stand alone as advice or principles.
Ignore stories, tone, persuasion, and repetition.
```

Output:

- List of explicit claims per chunk

---

### Step 5: Bullshit Filtering & Scoring

For each claim:

- Evaluate usefulness
- Label:

  - core
  - supporting
  - redundant
  - filler

Discard `redundant` + `filler`.

---

### Step 6: Example Selection

Rules:

- Max 1–2 examples per core idea
- Must clarify application
- Must be generalizable

Reject:

- Emotional stories
- Author-centric narratives

---

### Step 7: Idea Clustering (Key Step)

Merge similar claims into **idea clusters**.

Result:

- 7–12 ideas per book (max)
- Weak books collapse more

---

### Step 8: Book Reconstruction (Final Output)

Generate **Markdown**, not prose.

Structure:

```md
# Book Distillation

## Idea 1: <Sharp Title>

### Core Principle

(clear, dense explanation)

### What This Changes

- Decisions
- Trade-offs

### Best Example

(one example)

---

## Idea 2: ...
```

No chapters. No fluff.

---

## 8. Adjustable Compression (Better Than 10%)

Rules:

- No fixed percentage
- Output determined by:

  - Number of valid ideas
  - Strength of ideas

Target ranges:

- Weak book: ~5%
- Normal book: ~10–15%
- Dense book: ~20%

---

## 9. Frontend (Next.js)

### Pages

- `/login`
- `/dashboard`
- `/upload`
- `/book/[id]`
- `/settings`

### Features

- Upload PDF
- Show processing steps
- View final distilled output
- Markdown rendering
- Download summary

---

## 10. API Routes Summary

```
POST   /api/auth/google
GET    /api/auth/callback
POST   /api/book/upload
POST   /api/book/process
GET    /api/book/:id
GET    /api/book/:id/output
```

Each step should be:

- Persistent
- Restartable
- Idempotent

---

## 11. Background Processing (Important)

For large books:

- Run pipeline step-by-step
- Store intermediate results
- Show progress in UI

Avoid single long blocking requests.

---

## 12. Success Criteria

The system is successful if:

- A 300-page book becomes ~20–40 dense pages
- You never feel repetition
- You can extract decisions in <1 hour
- You stop reading full productivity books

---

## 13. Guiding Rule (Override Everything)

> **If removing something does not reduce understanding, remove it.**

---

## 14. Final Instruction for Your AI IDE (Copy This)

> Build a Next.js full-stack app implementing the above system.
> Plan thoroughly, generate todos, design schemas, implement step by step.
> Prioritize signal extraction, idea reconstruction, and minimal fluff.
> This is a personal, high-quality knowledge tool — not a generic summarizer.

---

# 📘 LLM PROMPT SPECIFICATION

**(Signal-First Book Distillation System)**

---

## GLOBAL RULE (Used in Every Prompt)

> You are not a summarizer.
> You are a signal extraction system.
> If removing something does not reduce understanding, remove it.

---

## 1️⃣ CLAIM EXTRACTION PROMPT (MOST IMPORTANT)

### Purpose

Convert raw text into **explicit, standalone claims**.

### Model

- Use a **cheap + reliable model** (first pass)

### Prompt

```
You are extracting CLAIMS from a non-fiction book.

DEFINITION:
A claim is a statement that can stand alone as:
- a principle
- a rule
- a recommendation
- a causal insight
- a constraint that affects decisions

INSTRUCTIONS:
- Ignore storytelling, anecdotes, tone, and persuasion
- Ignore examples unless they introduce a new idea
- Rewrite claims clearly and precisely
- Do NOT summarize paragraphs
- Do NOT add new ideas
- Extract ONLY ideas that could be useful advice

OUTPUT FORMAT (JSON):
[
  {
    "claim": "...",
    "type": "principle | rule | recommendation | constraint | causal"
  }
]

TEXT:
{{CHUNK_TEXT}}
```

---

## 2️⃣ BULLSHIT FILTERING & CLAIM SCORING

### Purpose

Decide which claims survive.

### Model

- Medium intelligence model

### Prompt

```
You are evaluating extracted claims from a non-fiction book.

TASK:
Label each claim based on its actual usefulness.

LABEL DEFINITIONS:
- core_insight: Changes decisions or introduces a real constraint
- supporting_insight: Clarifies or strengthens a core insight
- redundant: Repeats an idea already stated elsewhere
- filler: Obvious, generic, or low-value advice

CRITERIA:
- Would an intelligent reader already know this?
- Does this introduce a trade-off?
- Does this change behavior?
- Does this add a constraint?

INSTRUCTIONS:
- Be strict
- Most claims should NOT survive
- Do not justify weak claims

OUTPUT FORMAT (JSON):
[
  {
    "claim": "...",
    "label": "core_insight | supporting_insight | redundant | filler",
    "reason": "short explanation"
  }
]

CLAIMS:
{{CLAIMS_JSON}}
```

👉 **Discard `redundant` and `filler` immediately.**

---

## 3️⃣ EXAMPLE EXTRACTION (SELECTIVE)

### Purpose

Attach only **high-quality examples** to core insights.

### Prompt

```
You are extracting EXAMPLES that clarify core insights.

RULES:
- Examples must clarify application
- Examples must be generalizable
- Keep at most 1–2 examples per insight
- Reject emotional or personal stories
- Reject author-centric anecdotes

INSTRUCTIONS:
- Keep examples only if they increase understanding
- Do NOT keep examples just for illustration
- Shorten examples aggressively

OUTPUT FORMAT (JSON):
[
  {
    "insight": "...",
    "example": "...",
    "reason_kept": "clarifies application | removes ambiguity"
  }
]

TEXT:
{{ORIGINAL_TEXT}}
CORE INSIGHTS:
{{CORE_INSIGHTS}}
```

---

## 4️⃣ IDEA CLUSTERING (DEDUPLICATION)

### Purpose

Merge similar claims into **single ideas**.

### Model

- Strong reasoning model (this matters)

### Prompt

```
You are clustering similar insights into IDEA CLUSTERS.

TASK:
- Merge claims that express the same underlying idea
- Remove wording differences
- Produce one clear, sharp idea per cluster

INSTRUCTIONS:
- Prefer fewer ideas over more
- Each idea must represent a unique decision rule
- Rewrite ideas clearly and concisely

OUTPUT FORMAT (JSON):
[
  {
    "idea_title": "...",
    "merged_claims": [
      "...",
      "..."
    ]
  }
]

CLAIMS:
{{FILTERED_CLAIMS}}
```

---

## 5️⃣ CORE PRINCIPLE REWRITE (CLEAN & DENSE)

### Purpose

Turn clustered claims into **clean explanations**.

### Prompt

```
You are writing the CORE PRINCIPLE of an idea.

RULES:
- Be precise and dense
- Avoid motivational language
- Avoid repetition
- Avoid examples here
- Explain the idea as a decision rule

OUTPUT:
2–4 short paragraphs maximum.

IDEA:
{{IDEA_CLUSTER}}
```

---

## 6️⃣ BEHAVIOR DELTA GENERATION (ANTI–FAKE LEARNING)

### Purpose

Force action, not passive reading.

### Prompt

```
You are generating a BEHAVIOR DELTA.

TASK:
Explain how this idea should change decisions for someone who does NOT already believe it.

RULES:
- Be concrete
- Avoid generic advice
- Focus on trade-offs

OUTPUT FORMAT:
If you already believe this, skip it.
If not, this should change how you:
- decide
- prioritize
- schedule

IDEA:
{{CORE_PRINCIPLE}}
```

---

## 7️⃣ FINAL BOOK RECONSTRUCTION (MARKDOWN)

### Purpose

Produce the **final output**.

### Model

- Best available model (final pass)

### Prompt

```
You are reconstructing a non-fiction book around IDEAS, not chapters.

GOAL:
Produce a signal-dense distillation of the book.

RULES:
- No chapters
- No repetition
- No motivational fluff
- No author voice
- No storytelling
- Prefer clarity over persuasion

STRUCTURE (MANDATORY):

# Book Distillation

## Idea 1: <Sharp Title>

### Core Principle
...

### What This Changes
...

### Best Example
...

---

## Idea 2: ...

CONSTRAINTS:
- Max 7–12 ideas total
- Max 1 example per idea
- Remove anything that does not add understanding

INPUT IDEAS:
{{IDEAS_WITH_EXAMPLES_AND_DELTAS}}
```

---

## 8️⃣ FINAL QUALITY CHECK (OPTIONAL BUT STRONG)

### Prompt

```
You are reviewing a book distillation.

TASK:
Identify:
- Any remaining fluff
- Any repeated ideas
- Any weak insights that could be removed

OUTPUT:
- List items to remove or improve
- Be strict

TEXT:
{{FINAL_OUTPUT}}
```

---

## 🔑 IMPLEMENTATION NOTES (IMPORTANT)

- Cache every step in MongoDB
- Never re-run expensive steps unnecessarily
- Use cheaper models for early stages
- Use strongest model only for:

  - idea clustering
  - final reconstruction

---

## 🧠 CORE SYSTEM RULE (FINAL)

> **Extraction > Evaluation > Reconstruction**
> Never summarize what you can distill.
