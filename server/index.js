import "dotenv/config";
import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import pg from "pg";

const { Pool } = pg;
const scrypt = promisify(scryptCallback);
const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const port = Number(process.env.PORT || 3000);
const cookieName = "travel_assist_session";
const sessionLifetimeSeconds = 7 * 24 * 60 * 60;
const passwordKeyLength = 64;
const scryptOptions = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const here = dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set before the API can start.");
}

app.disable("x-powered-by");
app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 1));
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https://images.unsplash.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
      },
    },
  }),
);
app.use(express.json({ limit: "8kb" }));
app.use("/api/auth", (_request, response, next) => {
  response.set("Cache-Control", "no-store");
  next();
});

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function hashClientAddress(address) {
  return createHmac("sha256", process.env.RATE_LIMIT_HMAC_KEY || process.env.DATABASE_URL)
    .update(address)
    .digest("hex");
}

function readSessionToken(request) {
  const cookies = request.headers.cookie?.split(";") ?? [];
  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");
    if (separator < 0 || cookie.slice(0, separator).trim() !== cookieName) continue;
    return cookie.slice(separator + 1).trim();
  }
  return null;
}

function setSessionCookie(response, token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `${cookieName}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${sessionLifetimeSeconds}${secure}`,
  );
}

function clearSessionCookie(response) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `${cookieName}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`,
  );
}

function isValidEmail(email) {
  return (
    typeof email === "string" &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

async function derivePasswordKey(password, salt) {
  return scrypt(password, salt, passwordKeyLength, scryptOptions);
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await derivePasswordKey(password, salt);
  return `scrypt$32768$8$1$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

async function verifyPassword(password, encodedHash) {
  const [algorithm, cost, blockSize, parallelism, encodedSalt, encodedKey] =
    encodedHash.split("$");
  if (
    algorithm !== "scrypt" ||
    cost !== "32768" ||
    blockSize !== "8" ||
    parallelism !== "1" ||
    !encodedSalt ||
    !encodedKey
  ) {
    throw new Error("A stored password hash has an unsupported format.");
  }

  const salt = Buffer.from(encodedSalt, "base64url");
  const expectedKey = Buffer.from(encodedKey, "base64url");
  if (salt.length !== 16 || expectedKey.length !== passwordKeyLength) {
    throw new Error("A stored password hash is invalid.");
  }

  const actualKey = await derivePasswordKey(password, salt);
  return timingSafeEqual(actualKey, expectedKey);
}

async function createSession(response, user) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionLifetimeSeconds * 1000);
  await pool.query(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
    [hashToken(token), user.id, expiresAt],
  );
  setSessionCookie(response, token);
}

function requireJson(request, response, next) {
  if (!request.is("application/json")) {
    return response.status(415).json({ error: "Send the request as JSON." });
  }
  next();
}

async function enforceAuthRateLimit(request, response, next) {
  try {
    const clientHash = hashClientAddress(
      request.ip || request.socket.remoteAddress || "unknown",
    );
    const { rows } = await pool.query(
      `INSERT INTO auth_rate_limits (client_hash, window_started_at, request_count)
       VALUES ($1, NOW(), 1)
       ON CONFLICT (client_hash) DO UPDATE SET
         request_count = CASE
           WHEN auth_rate_limits.window_started_at <= NOW() - INTERVAL '15 minutes' THEN 1
           ELSE auth_rate_limits.request_count + 1
         END,
         window_started_at = CASE
           WHEN auth_rate_limits.window_started_at <= NOW() - INTERVAL '15 minutes' THEN NOW()
           ELSE auth_rate_limits.window_started_at
         END
       RETURNING request_count, window_started_at`,
      [clientHash],
    );
    const limit = 10;

    if (rows[0].request_count > limit) {
      const retryAfter = Math.max(
        1,
        Math.ceil(
          (new Date(rows[0].window_started_at).getTime() + 15 * 60 * 1000 - Date.now()) /
            1000,
        ),
      );
      response.set("Retry-After", String(retryAfter));
      return response.status(429).json({
        error: "Too many sign-in attempts. Please wait a few minutes and try again.",
      });
    }

    next();
  } catch (error) {
    next(error);
  }
}

app.get("/api/live", (_request, response) => {
  response.json({ status: "ok" });
});

app.get("/api/health", async (_request, response, next) => {
  try {
    await pool.query("SELECT 1");
    response.json({ status: "ok" });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", async (request, response, next) => {
  try {
    const token = readSessionToken(request);
    if (!token) return response.json({ user: null });

    const { rows } = await pool.query(
      `SELECT users.id, users.full_name AS "fullName", users.email
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = $1 AND sessions.expires_at > NOW()`,
      [hashToken(token)],
    );
    if (!rows[0]) {
      clearSessionCookie(response);
      return response.json({ user: null });
    }

    response.json({ user: rows[0] });
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/auth/signup",
  requireJson,
  enforceAuthRateLimit,
  async (request, response, next) => {
    try {
      const { fullName, email, password } = request.body ?? {};
      if (
        typeof fullName !== "string" ||
        fullName.trim().length === 0 ||
        fullName.trim().length > 80 ||
        !isValidEmail(email) ||
        typeof password !== "string" ||
        password.length < 12 ||
        password.length > 128 ||
        Buffer.byteLength(password, "utf8") > 512
      ) {
        return response.status(400).json({
          error: "Enter your name, a valid email, and a password of 12–128 characters.",
        });
      }

      const user = {
        id: randomUUID(),
        fullName: fullName.trim(),
        email: normalizeEmail(email),
      };
      const passwordHash = await hashPassword(password);

      try {
        await pool.query(
          "INSERT INTO users (id, full_name, email, password_hash) VALUES ($1, $2, $3, $4)",
          [user.id, user.fullName, user.email, passwordHash],
        );
      } catch (error) {
        if (error.code === "23505") {
          return response.status(409).json({
            error: "An account with that email already exists. Try signing in instead.",
          });
        }
        throw error;
      }

      await createSession(response, user);
      response.status(201).json({ user });
    } catch (error) {
      next(error);
    }
  },
);

app.post(
  "/api/auth/signin",
  requireJson,
  enforceAuthRateLimit,
  async (request, response, next) => {
    try {
      const { email, password } = request.body ?? {};
      if (
        !isValidEmail(email) ||
        typeof password !== "string" ||
        password.length === 0 ||
        password.length > 128 ||
        Buffer.byteLength(password, "utf8") > 512
      ) {
        return response.status(400).json({ error: "Enter a valid email and password." });
      }

      const { rows } = await pool.query(
        `SELECT id, full_name AS "fullName", email, password_hash
         FROM users WHERE email = $1`,
        [normalizeEmail(email)],
      );
      if (!rows[0]) {
        await derivePasswordKey(password, Buffer.alloc(16, 0x5a));
        return response.status(401).json({ error: "Email or password is incorrect." });
      }

      if (!(await verifyPassword(password, rows[0].password_hash))) {
        return response.status(401).json({ error: "Email or password is incorrect." });
      }

      const user = { id: rows[0].id, fullName: rows[0].fullName, email: rows[0].email };
      await createSession(response, user);
      response.json({ user });
    } catch (error) {
      next(error);
    }
  },
);

app.post("/api/auth/signout", requireJson, async (request, response, next) => {
  try {
    const token = readSessionToken(request);
    if (token) {
      await pool.query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
    }
    clearSessionCookie(response);
    response.json({ success: true });
  } catch (error) {
    next(error);
  }
});

app.use(express.static(join(here, "..", "dist"), { index: false }));
app.use((request, response, next) => {
  if (request.method !== "GET" || request.path.startsWith("/api/")) return next();
  response.sendFile(join(here, "..", "dist", "index.html"), (error) => {
    if (error) next(error);
  });
});
app.use((request, response) => {
  response.status(404).json({ error: "Not found." });
});
app.use((error, _request, response, _next) => {
  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) console.error("Request failed:", error.message);
  response.status(status).json({
    error: status >= 500 ? "Something went wrong. Please try again." : "Invalid request.",
  });
});

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      full_name VARCHAR(80) NOT NULL,
      email VARCHAR(254) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash CHAR(64) PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);
    CREATE TABLE IF NOT EXISTS auth_rate_limits (
      client_hash CHAR(64) PRIMARY KEY,
      window_started_at TIMESTAMPTZ NOT NULL,
      request_count INTEGER NOT NULL
    );
  `);
}

async function start() {
  await initializeDatabase();
  const cleanup = setInterval(async () => {
    try {
      await pool.query("DELETE FROM sessions WHERE expires_at <= NOW()");
      await pool.query(
        "DELETE FROM auth_rate_limits WHERE window_started_at < NOW() - INTERVAL '1 day'",
      );
    } catch (error) {
      console.error("Could not clean up expired authentication records:", error.message);
    }
  }, 60 * 60 * 1000);
  cleanup.unref();

  app.listen(port, "0.0.0.0", () => {
    console.log(`Travel Assist API listening on port ${port}`);
  });
}

start().catch((error) => {
  console.error("Could not start the Travel Assist API:", error.message);
  process.exitCode = 1;
});
