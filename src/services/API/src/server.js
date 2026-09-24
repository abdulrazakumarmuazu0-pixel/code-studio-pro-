import 'dotenv/config';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import argon2 from 'argon2';
import pg from 'pg';
import crypto from 'node:crypto';

const { Pool } = pg;
const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '127.0.0.1',
  port: Number(process.env.PORT || 8787),
  webOrigin: process.env.WEB_ORIGIN || 'http://localhost:8080',
  databaseUrl: process.env.DATABASE_URL || '',
  cookieName: process.env.SESSION_COOKIE_NAME || 'code_studio_session',
  sessionTtlDays: Math.max(1, Number(process.env.SESSION_TTL_DAYS || 30))
};

if (!config.databaseUrl) throw new Error('DATABASE_URL is required');

const pool = new Pool({ connectionString: config.databaseUrl, max: 10, connectionTimeoutMillis: 5000 });
const app = Fastify({ logger: { level: config.nodeEnv === 'production' ? 'info' : 'debug' }, trustProxy: true });

await app.register(helmet, { contentSecurityPolicy: false });
await app.register(cors, { origin: config.webOrigin, credentials: true });
await app.register(cookie);
await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });

const jsonError = (reply, statusCode, code, message) => reply.code(statusCode).send({ error: { code, message } });
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const getSession = async (request) => {
  const token = request.cookies[config.cookieName];
  if (!token) return null;
  const digest = crypto.createHash('sha256').update(token).digest('hex');
  const result = await pool.query(`
    SELECT u.id, u.email, u.display_name AS "displayName", u.created_at AS "createdAt"
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = $1 AND s.expires_at > now()
  `, [digest]);
  return result.rows[0] || null;
};
const requireUser = async (request, reply) => {
  const user = await getSession(request);
  if (!user) return jsonError(reply, 401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
  request.user = user;
};
const setSession = async (reply, userId) => {
  const token = crypto.randomBytes(32).toString('base64url');
  const digest = crypto.createHash('sha256').update(token).digest('hex');
  await pool.query('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + make_interval(days => $3))', [userId, digest, config.sessionTtlDays]);
  reply.setCookie(config.cookieName, token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: config.sessionTtlDays * 86400
  });
};

app.get('/health/live', async () => ({ status: 'ok', service: 'code-studio-api' }));
app.get('/health/ready', async (_request, reply) => {
  try {
    await pool.query('SELECT 1');
    return { status: 'ready' };
  } catch (error) {
    app.log.error({ err: error }, 'database readiness check failed');
    return jsonError(reply, 503, 'NOT_READY', 'Database is unavailable.');
  }
});

app.post('/v1/auth/register', { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } }, async (request, reply) => {
  const body = request.body || {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 120) : null;
  if (!emailPattern.test(email) || password.length < 10 || password.length > 256) return jsonError(reply, 400, 'INVALID_INPUT', 'Provide a valid email and a password between 10 and 256 characters.');
  try {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const result = await pool.query('INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, display_name AS "displayName", created_at AS "createdAt"', [email, passwordHash, displayName]);
    await setSession(reply, result.rows[0].id);
    return reply.code(201).send({ user: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return jsonError(reply, 409, 'EMAIL_IN_USE', 'An account with that email already exists.');
    app.log.error({ err: error }, 'registration failed');
    return jsonError(reply, 500, 'INTERNAL_ERROR', 'Unable to create the account.');
  }
});

app.post('/v1/auth/login', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request, reply) => {
  const body = request.body || {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const result = await pool.query('SELECT id, email, password_hash, display_name AS "displayName", created_at AS "createdAt" FROM users WHERE email = $1', [email]);
  const user = result.rows[0];
  if (!user || !(await argon2.verify(user.password_hash, password))) return jsonError(reply, 401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  await setSession(reply, user.id);
  delete user.password_hash;
  return { user };
});

app.get('/v1/auth/me', { preHandler: requireUser }, async (request) => ({ user: request.user }));
app.post('/v1/auth/logout', async (request, reply) => {
  const token = request.cookies[config.cookieName];
  if (token) {
    const digest = crypto.createHash('sha256').update(token).digest('hex');
    await pool.query('DELETE FROM sessions WHERE token_hash = $1', [digest]);
  }
  reply.clearCookie(config.cookieName, { path: '/' });
  return { ok: true };
});

app.get('/v1/projects', { preHandler: requireUser }, async (request) => {
  const result = await pool.query('SELECT id, name, description, created_at AS "createdAt", updated_at AS "updatedAt" FROM projects WHERE owner_id = $1 AND archived_at IS NULL ORDER BY updated_at DESC LIMIT 100', [request.user.id]);
  return { projects: result.rows };
});
app.post('/v1/projects', { preHandler: requireUser }, async (request, reply) => {
  const body = request.body || {};
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 500) : null;
  if (!name) return jsonError(reply, 400, 'INVALID_INPUT', 'Project name is required.');
  const result = await pool.query('INSERT INTO projects (owner_id, name, description) VALUES ($1, $2, $3) RETURNING id, name, description, created_at AS "createdAt", updated_at AS "updatedAt"', [request.user.id, name, description]);
  return reply.code(201).send({ project: result.rows[0] });
});

app.setErrorHandler((error, request, reply) => {
  request.log.error({ err: error }, 'unhandled request error');
  return jsonError(reply, 500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
});

const close = async () => { await app.close(); await pool.end(); };
process.once('SIGINT', close);
process.once('SIGTERM', close);
await app.listen({ host: config.host, port: config.port });
