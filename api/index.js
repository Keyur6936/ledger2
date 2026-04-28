require("dotenv").config();

const crypto = require("crypto");
const cors = require("cors");
const express = require("express");
const { Pool } = require("pg");

const app = express();

const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || "").trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "";
const SESSION_COOKIE = "ledger_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL DEFAULT 'default',
      amount     NUMERIC(12,2) NOT NULL,
      category   TEXT NOT NULL,
      notes      TEXT DEFAULT '',
      date       DATE NOT NULL,
      month      TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS income (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL DEFAULT 'default',
      amount     NUMERIC(12,2) NOT NULL,
      source     TEXT NOT NULL,
      notes      TEXT DEFAULT '',
      date       DATE NOT NULL,
      month      TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

initDB().catch(console.error);

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    authConfigured: isAuthConfigured()
  });
});

app.get("/api/auth/session", (req, res) => {
  if (!isAuthConfigured()) {
    return res.status(503).json({ error: missingAuthConfigMessage() });
  }

  const session = readSession(req);
  if (!session) {
    clearSession(res);
    return res.json({ authenticated: false });
  }

  res.json({
    authenticated: true,
    username: session.sub
  });
});

app.post("/api/auth/login", (req, res) => {
  if (!isAuthConfigured()) {
    return res.status(503).json({ error: missingAuthConfigMessage() });
  }

  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  if (!secureEquals(username, ADMIN_USERNAME) || !secureEquals(password, ADMIN_PASSWORD)) {
    return res.status(401).json({ error: "Invalid admin credentials." });
  }

  writeSession(res, ADMIN_USERNAME);
  res.json({
    authenticated: true,
    username: ADMIN_USERNAME
  });
});

app.post("/api/auth/logout", (req, res) => {
  clearSession(res);
  res.json({ ok: true, authenticated: false });
});

app.use("/api/expenses", requireAdmin);
app.use("/api/income", requireAdmin);

app.get("/api/expenses", async (req, res) => {
  try {
    const { month = currentMonth() } = req.query;
    const { rows } = await pool.query(
      `SELECT * FROM expenses WHERE month = $1 ORDER BY date DESC, created_at DESC`,
      [month]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/expenses", async (req, res) => {
  try {
    const { id, amount, category, notes, date } = req.body;
    const month = date.slice(0, 7);
    const { rows } = await pool.query(
      `INSERT INTO expenses (id, amount, category, notes, date, month)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, amount, category, notes || "", date, month]
    );
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/expenses/:id", async (req, res) => {
  try {
    const { amount, category, notes, date } = req.body;
    const month = date.slice(0, 7);
    const { rows } = await pool.query(
      `UPDATE expenses SET amount = $1, category = $2, notes = $3, date = $4, month = $5
       WHERE id = $6 RETURNING *`,
      [amount, category, notes || "", date, month, req.params.id]
    );
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/expenses/:id", async (req, res) => {
  try {
    await pool.query(`DELETE FROM expenses WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/income", async (req, res) => {
  try {
    const { month = currentMonth() } = req.query;
    const { rows } = await pool.query(
      `SELECT * FROM income WHERE month = $1 ORDER BY date DESC, created_at DESC`,
      [month]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/income", async (req, res) => {
  try {
    const { id, amount, source, notes, date } = req.body;
    const month = date.slice(0, 7);
    const { rows } = await pool.query(
      `INSERT INTO income (id, amount, source, notes, date, month)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, amount, source, notes || "", date, month]
    );
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/income/:id", async (req, res) => {
  try {
    const { amount, source, notes, date } = req.body;
    const month = date.slice(0, 7);
    const { rows } = await pool.query(
      `UPDATE income SET amount = $1, source = $2, notes = $3, date = $4, month = $5
       WHERE id = $6 RETURNING *`,
      [amount, source, notes || "", date, month, req.params.id]
    );
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/income/:id", async (req, res) => {
  try {
    await pool.query(`DELETE FROM income WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function isAuthConfigured() {
  return Boolean(ADMIN_USERNAME && ADMIN_PASSWORD && SESSION_SECRET);
}

function missingAuthConfigMessage() {
  const missing = [];
  if (!ADMIN_USERNAME) missing.push("ADMIN_USERNAME");
  if (!ADMIN_PASSWORD) missing.push("ADMIN_PASSWORD");
  if (!SESSION_SECRET) missing.push("SESSION_SECRET");
  return "Admin login is not configured. Missing: " + missing.join(", ");
}

function secureEquals(left, right) {
  const leftBuffer = Buffer.from(String(left || ""), "utf8");
  const rightBuffer = Buffer.from(String(right || ""), "utf8");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function currentMonth() {
  const date = new Date();
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
}

function signValue(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

function createSessionToken(username) {
  const payload = Buffer.from(JSON.stringify({
    sub: username,
    exp: Date.now() + SESSION_TTL_MS
  }), "utf8").toString("base64url");

  return payload + "." + signValue(payload);
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return header.split(/;\s*/).reduce((cookies, part) => {
    if (!part) return cookies;
    const separator = part.indexOf("=");
    if (separator === -1) return cookies;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    try {
      cookies[name] = decodeURIComponent(value);
    } catch (error) {
      cookies[name] = value;
    }
    return cookies;
  }, {});
}

function serializeCookie(name, value, maxAgeMs) {
  const parts = [
    name + "=" + encodeURIComponent(value),
    "Path=/",
    "HttpOnly",
    "SameSite=Lax"
  ];

  if (Number.isFinite(maxAgeMs)) {
    parts.push("Max-Age=" + Math.max(0, Math.floor(maxAgeMs / 1000)));
  }

  if (IS_PRODUCTION) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function writeSession(res, username) {
  const token = createSessionToken(username);
  res.setHeader("Set-Cookie", serializeCookie(SESSION_COOKIE, token, SESSION_TTL_MS));
}

function clearSession(res) {
  res.setHeader("Set-Cookie", serializeCookie(SESSION_COOKIE, "", 0));
}

function readSession(req) {
  if (!isAuthConfigured()) return null;

  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  if (!secureEquals(signature, signValue(payload))) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!session || typeof session.sub !== "string" || typeof session.exp !== "number") {
      return null;
    }
    if (session.exp < Date.now()) {
      return null;
    }
    return session;
  } catch (error) {
    return null;
  }
}

function requireAdmin(req, res, next) {
  if (!isAuthConfigured()) {
    return res.status(503).json({ error: missingAuthConfigMessage() });
  }

  const session = readSession(req);
  if (!session) {
    clearSession(res);
    return res.status(401).json({ error: "Admin login required." });
  }

  req.admin = session;
  next();
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Ledger API running on http://localhost:" + PORT));

module.exports = app;
