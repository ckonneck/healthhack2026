import express from "express";
import fs from "fs";
import cors from "cors";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";
import { buildAssessPrompt } from "./prompt.js";

const app = express();

// ─────────────────────────────
// MIDDLEWARE (MUST BE FIRST)
// ─────────────────────────────
app.use(cors());
app.use(express.json());


// ─────────────────────────────
// EMBEDDING CACHE
// ─────────────────────────────
const embeddingCache = new Map();

// ─────────────────────────────
// BUILD TEXT FOR EMBEDDING
// ─────────────────────────────
function buildEmbeddingText(entry) {
  return [
    entry.name,
    entry.specialty,
    entry.description,
    ...(entry.tags || [])
  ]
    .filter(Boolean)
    .join(" ");
}

// ─────────────────────────────
// COSINE SIMILARITY
// ─────────────────────────────
function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB);
}

// ─────────────────────────────
// GET EMBEDDING (WITH CACHE)
// ─────────────────────────────
async function getEmbedding(text) {
  if (!client) return null;

  if (embeddingCache.has(text)) {
    return embeddingCache.get(text);
  }

  const res = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text
  });

  const vector = res.data[0].embedding;
  embeddingCache.set(text, vector);
  return vector;
}
// ─────────────────────────────
// DB HELPERS
// ─────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, "db.json");

function loadDB() {
  try {
    console.log("📂 DB PATH:", DB_PATH);

    const raw = fs.readFileSync(DB_PATH, "utf-8");

    console.log("📄 RAW DB LENGTH:", raw.length);
    console.log("📄 RAW DB PREVIEW:", raw.slice(0, 200));

    const parsed = JSON.parse(raw);

    console.log("📦 PARSED TYPE:", Array.isArray(parsed) ? "array" : typeof parsed);
    console.log("📦 PARSED KEYS:", parsed && typeof parsed === "object" ? Object.keys(parsed) : parsed);

    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.services)) return parsed.services;

    console.warn("⚠️ DB format invalid");
    return [];
  } catch (err) {
    console.error("❌ DB LOAD FAILED:", err.message);
    return [];
  }
}

function saveDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("⚠️ DB save failed:", err.message);
  }
}

function loadDBDocument() {
  try {
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return { services: parsed };
    }

    if (Array.isArray(parsed.services)) {
      return parsed;
    }

    return { services: [] };
  } catch (err) {
    console.error("⚠️ DB document load failed:", err.message);
    return { services: [] };
  }
}

function saveDBDocument(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function normalizeServiceEntry(entry = {}) {
  const cleanText = value => (typeof value === "string" ? value.trim() : "");
  const rawTags = Array.isArray(entry.tags)
    ? entry.tags
    : typeof entry.tags === "string"
      ? entry.tags.split(",")
      : [];

  const service = {
    name: cleanText(entry.name),
    type: cleanText(entry.type),
    specialty: cleanText(entry.specialty),
    address: cleanText(entry.address),
    hours: cleanText(entry.hours),
    tags: rawTags
      .map(tag => cleanText(String(tag)).toLowerCase())
      .filter(Boolean),
    description: cleanText(entry.description)
  };

  const missing = Object.entries(service)
    .filter(([key, value]) => (key === "tags" ? !value.length : !value))
    .map(([key]) => key);

  return { service, missing };
}

// ─────────────────────────────
// OPENAI (OPTIONAL)
// ─────────────────────────────
let client = null;

if (process.env.OPENAI_API_KEY) {
  try {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    console.log("🧠 OpenAI enabled");
  } catch (err) {
    console.warn("⚠️ OpenAI init failed, fallback mode");
  }
} else {
  console.warn("⚠️ No API key — running in fallback mode");
}

// ─────────────────────────────
// SAFE TEXT HELPERS
// ─────────────────────────────
function safeText(...parts) {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function normalizeSearchText(value = "") {
  return String(value ?? "")
    .toLowerCase()
    .trim();
}

function scoreServiceMatch(service = {}, queryText = "", zipText = "") {
  const name = normalizeSearchText(service.name);
  const type = normalizeSearchText(service.type);
  const category = normalizeSearchText(service.category);
  const specialty = normalizeSearchText(service.specialty);
  const description = normalizeSearchText(service.description);
  const address = normalizeSearchText(service.address);
  const tags = Array.isArray(service.tags)
    ? service.tags.map(tag => normalizeSearchText(tag)).filter(Boolean)
    : [];

  const allText = safeText(
    name,
    type,
    category,
    specialty,
    description,
    address,
    ...tags
  );

  let score = 0;
  let queryMatched = !queryText;

  if (queryText) {
    if (name.includes(queryText)) {
      score += 10;
      queryMatched = true;
    }
    if (specialty.includes(queryText)) {
      score += 8;
      queryMatched = true;
    }
    if (type.includes(queryText)) {
      score += 7;
      queryMatched = true;
    }
    if (category.includes(queryText)) {
      score += 5;
      queryMatched = true;
    }
    if (description.includes(queryText)) {
      score += 5;
      queryMatched = true;
    }
    if (address.includes(queryText)) {
      score += 4;
      queryMatched = true;
    }
    if (tags.some(tag => tag.includes(queryText))) {
      score += 6;
      queryMatched = true;
    }
    if (allText.includes(queryText)) {
      score += 2;
      queryMatched = true;
    }
  }

  if (zipText && address.includes(zipText)) {
    score += 10;
  }

  const terms = queryText.split(/\s+/).filter(Boolean);

  terms.forEach(term => {
    if (name.includes(term)) {
      score += 4;
      queryMatched = true;
    }
    if (specialty.includes(term)) {
      score += 3;
      queryMatched = true;
    }
    if (type.includes(term)) {
      score += 3;
      queryMatched = true;
    }
    if (category.includes(term)) {
      score += 2;
      queryMatched = true;
    }
    if (description.includes(term)) {
      score += 2;
      queryMatched = true;
    }
    if (address.includes(term)) {
      score += 2;
      queryMatched = true;
    }
    if (tags.some(tag => tag.includes(term))) {
      score += 3;
      queryMatched = true;
    }
  });

  if (!queryMatched) {
    return 0;
  }

  return score;
}

// ─────────────────────────────
// KEYWORD SCORING (SAFE)
// ─────────────────────────────
async function getTopMatches(text, db) {
  console.log("🧠 EMBEDDING MATCH MODE");

  if (!client) {
    console.warn("⚠️ No AI client — cannot use embeddings");
    return { matches: [] };
  }

  if (!db || db.length === 0) {
    console.warn("⚠️ DB EMPTY");
    return { matches: [] };
  }

  try {
    // 👉 embed user query
    const queryVec = await getEmbedding(text);

    const scored = [];

    for (const entry of db) {
      const content = buildEmbeddingText(entry);

      const entryVec = await getEmbedding(content);
      if (!entryVec) continue;

      const score = cosineSimilarity(queryVec, entryVec);

      scored.push({ ...entry, score });
    }

    const matches = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    console.log("🏁 TOP MATCHES:", matches.map(m => m.name));
    return { matches };

  } catch (err) {
    console.error("⚠️ Embedding match failed:", err.message);
    return { matches: [] };
  }
}
// ─────────────────────────────
// HEALTH CHECK
// ─────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    ai: client ? "enabled" : "disabled"
  });
});

// ─────────────────────────────
// ADD ENTRY
// ─────────────────────────────
app.post("/add", (req, res) => {
  const { service, missing } = normalizeServiceEntry(req.body || {});

  if (missing.length) {
    return res.status(400).json({
      ok: false,
      error: `Missing required fields: ${missing.join(", ")}`
    });
  }

  const dbDocument = loadDBDocument();

  if (!Array.isArray(dbDocument.services)) {
    dbDocument.services = [];
  }

  dbDocument.services.push(service);
  saveDBDocument(dbDocument);

  res.json({
    ok: true,
    service
  });
});

// ─────────────────────────────
// SEARCH
// ─────────────────────────────
app.post("/search",async (req, res) => {
  const query = req.body.query || "";
  const db = loadDB();

  const { matches } = await getTopMatches(query, db);

  res.json({ results: matches });
});

// ─────────────────────────────
// SERVICES (FIXED - WAS MISSING BEFORE)
// ─────────────────────────────
app.post("/services", (req, res) => {
  const { query = "", zip = "" } = req.body || {};
  const services = loadDB();
  const queryText = normalizeSearchText(query);
  const zipText = normalizeSearchText(zip);

  if (!queryText && !zipText) {
    return res.json({ results: [] });
  }

  const results = services
    .map(service => ({
      service,
      score: scoreServiceMatch(service, queryText, zipText)
    }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(entry => entry.service);

  res.json({ results });
});

// ─────────────────────────────
// ASSESS
// ─────────────────────────────
app.post("/assess", async (req, res) => {
  const { problem = "", notes = "", severity, duration } = req.body;

  const db = loadDB();
  const text = `${problem} ${notes}`;

  const { matches } = await getTopMatches(text, db);

  console.log("Top matches:", matches.map(m => m.title));

  // 🧱 FALLBACK
  if (!client) {
    return res.json({
      answer:
        matches.length
          ? "📚 Relevant info:\n\n" +
            matches.map(m => `• ${m.title}: ${m.details}`).join("\n")
          : "No strong matches found.",
      matches,
      mode: "fallback"
    });
  }

  // 🤖 AI MODE
  try {
    const messages = buildAssessPrompt({
      problem,
      duration,
      severity,
      notes,
      context: matches
    });

    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages
    });

    res.json({
      answer: response.choices[0].message.content,
      matches,
      mode: "ai"
    });

  } catch (err) {
    console.error("⚠️ AI failed:", err.message);

    res.json({
      answer:
        "⚠️ AI failed. Showing best matches:\n\n" +
        matches.map(m => `• ${m.title}`).join("\n"),
      matches,
      mode: "fallback-error"
    });
  }
});

// ─────────────────────────────
// ASK
// ─────────────────────────────
app.post("/ask", async (req, res) => {
  console.log("📨 REQUEST BODY:", req.body);
  const query = req.body.query || "";
  const db = loadDB();
  console.log("📊 DB LOADED IN ROUTE:", db.length);
  const { matches } = await getTopMatches(query, db);
  console.log("📤 SENDING MATCHES:", matches.length);
  if (!client) {
    return res.json({
      answer:
        matches.length
          ? "📚 From your wiki:\n\n" +
            matches.map(m => `• ${m.title}: ${m.details}`).join("\n")
          : "No matching entries found.",
      contextUsed: matches,
      mode: "fallback"
    });
  }

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "You are a wiki assistant. Use ONLY provided context."
        },
        {
          role: "user",
          content: `
Query: ${query}

Context:
${JSON.stringify(matches)}
          `
        }
      ]
    });

    res.json({
      answer: response.choices[0].message.content,
      contextUsed: matches,
      mode: "ai"
    });

  } catch (err) {
    console.error("⚠️ AI failed:", err.message);

    res.json({
      answer:
        "⚠️ AI unavailable. Showing matches:\n\n" +
        matches.map(m => `• ${m.title}`).join("\n"),
      contextUsed: matches,
      mode: "fallback-error"
    });
  }
});

// ─────────────────────────────
// START SERVER
// ─────────────────────────────

app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});
