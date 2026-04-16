import express from "express";
import fs from "fs";
import cors from "cors";
import OpenAI from "openai";
import { buildAssessPrompt } from "./prompt.js";

const app = express();

// ─────────────────────────────
// MIDDLEWARE (MUST BE FIRST)
// ─────────────────────────────
app.use(cors());
app.use(express.json());

// ─────────────────────────────
// DB HELPERS
// ─────────────────────────────
function loadDB() {
  try {
    const raw = fs.readFileSync("./db.json", "utf-8");
    const parsed = JSON.parse(raw);

    // SUPPORT BOTH STRUCTURES:
    // 1) [ ...services ]
    // 2) { services: [ ... ] }

    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.services)) return parsed.services;

    console.warn("⚠️ DB format invalid:", parsed);
    return [];
  } catch (err) {
    console.error("⚠️ DB load failed:", err.message);
    return [];
  }
}

function saveDB(data) {
  fs.writeFileSync("./db.json", JSON.stringify(data, null, 2));
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

// ─────────────────────────────
// KEYWORD SCORING (SAFE)
// ─────────────────────────────
function getTopMatches(text, db) {
  const keywords = text
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2);

  const list = Array.isArray(db) ? db : [];

  const scored = list.map(entry => {
    let score = 0;

    const content = [
      entry.name,
      entry.type,
      entry.specialty,
      entry.description,
      ...(entry.tags || [])
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    keywords.forEach(word => {
      if (content.includes(word)) score += 1;
    });
    console.log("HITTING 1");
    return { ...entry, score };
  });

  const matches = scored
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
console.log("HITTING THE 2");

  return { keywords, matches };
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
  const db = loadDB();

  const list = Array.isArray(db) ? db : [];
  list.push(req.body);

  saveDB(list);
  res.json({ ok: true });
});

// ─────────────────────────────
// SEARCH
// ─────────────────────────────
app.post("/search", (req, res) => {
  const query = req.body.query || "";
  const db = loadDB();

  const { matches } = getTopMatches(query, db);

  res.json({ results: matches });
});

// ─────────────────────────────
// SERVICES (FIXED - WAS MISSING BEFORE)
// ─────────────────────────────
app.post("/services", (req, res) => {
  const { query = "" } = req.body || {};
  const db = loadDB();

  const services = Array.isArray(db.services) ? db.services : [];

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);

  const results = services
    .map(service => {
      let score = 0;

      const tags = Array.isArray(service.tags) ? service.tags : [];

      words.forEach(word => {
        if (service.name?.toLowerCase().includes(word)) score++;

        tags.forEach(tag => {
          if ((tag || "").toLowerCase().includes(word)) score++;
        });
      });

      return { ...service, score };
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  res.json({ results });
});

// ─────────────────────────────
// ASSESS
// ─────────────────────────────
app.post("/assess", async (req, res) => {
  const { problem = "", notes = "", severity, duration } = req.body;

  const db = loadDB();
  const text = `${problem} ${notes}`;

  const { matches } = getTopMatches(text, db);

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
  const query = req.body.query || "";
  const db = loadDB();

  const { matches } = getTopMatches(query, db);

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