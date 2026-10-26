import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'User.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Secret for token signing
const AUTH_SECRET = process.env.AUTH_SECRET || 'dealerdata-super-secret-saas-key-2026';

// Hash password with salt
export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  // If stored as plaintext in legacy/seed, upgrade it
  if (!storedHash.includes(':')) {
    return password === storedHash;
  }
  const [salt, originalHash] = storedHash.split(':');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === originalHash;
}

// Initial default SaaS users
const DEFAULT_USERS = [
  {
    id: 'user_admin',
    email: 'admin@dealerdata.com',
    password: hashPassword('admin123', 'seed_salt_12345'),
    full_name: 'Sarah Connor (Director of Ops)',
    role: 'admin',
    company: 'Aaron Automotive Group',
    plan: 'Enterprise',
    dealer_group_ids: 'grp_aaron',
    store_ids: 'store_aaron_ford_escondido,store_aaron_ford_lake_elsinore,store_aaron_cdjr,store_aaron_chevrolet,store_aaron_kia',
    created_at: new Date('2026-01-01').toISOString(),
  },
  {
    id: 'user_manager',
    email: 'manager@aaronford.com',
    password: hashPassword('manager123', 'seed_salt_12345'),
    full_name: 'Marcus Vance (GM - Aaron Ford)',
    role: 'manager',
    company: 'Aaron Ford Escondido',
    plan: 'Pro',
    dealer_group_ids: 'grp_aaron',
    store_ids: 'store_aaron_ford_escondido',
    created_at: new Date('2026-01-15').toISOString(),
  },
  {
    id: 'user_analyst',
    email: 'analyst@dealerdata.com',
    password: hashPassword('analyst123', 'seed_salt_12345'),
    full_name: 'Elena Rostova (Lead Analyst)',
    role: 'user',
    company: 'Aaron Automotive Group',
    plan: 'Starter',
    dealer_group_ids: 'grp_aaron',
    store_ids: 'store_aaron_ford_escondido',
    created_at: new Date('2026-02-01').toISOString(),
  }
];

export async function findUserByEmail(email) {
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();

  if (process.env.DATABASE_URL) {
    try {
      const u = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (u) {
        return {
          id: u.id,
          email: u.email,
          password: u.password,
          full_name: u.fullName,
          role: u.role,
          company: u.company,
          plan: u.plan,
          dealer_group_ids: u.dealerGroupIds,
          store_ids: u.storeIds,
          created_at: u.createdAt,
        };
      }
    } catch (e) {
      console.warn('Prisma findUserByEmail fallback to local JSON:', e.message);
    }
  }

  const users = getUsers();
  return users.find(u => u.email.toLowerCase() === cleanEmail) || null;
}

export function getUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(DEFAULT_USERS, null, 2), 'utf-8');
    return DEFAULT_USERS;
  }
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0 || !parsed[0].password) {
      fs.writeFileSync(USERS_FILE, JSON.stringify(DEFAULT_USERS, null, 2), 'utf-8');
      return DEFAULT_USERS;
    }
    return parsed;
  } catch {
    return DEFAULT_USERS;
  }
}

export function saveUsers(users) {
  if (process.env.DATABASE_URL) return;
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

export function getSessions() {
  if (process.env.DATABASE_URL || !fs.existsSync(SESSIONS_FILE)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

export function saveSessions(sessions) {
  if (process.env.DATABASE_URL) return;
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf-8');
}

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  if (process.env.DATABASE_URL) {
    try {
      await prisma.session.create({
        data: {
          token,
          userId,
          expiresAt,
        },
      });
      return token;
    } catch (e) {
      console.warn('Prisma createSession fallback to local JSON:', e.message);
    }
  }

  // Fallback to local sessions store only if database is offline or not configured
  const sessions = getSessions();
  sessions[token] = {
    userId,
    createdAt: Date.now(),
    expiresAt: expiresAt.getTime(),
  };
  saveSessions(sessions);
  return token;
}

export async function getSessionUser(token) {
  if (!token) return null;

  if (process.env.DATABASE_URL) {
    try {
      const dbSession = await prisma.session.findUnique({
        where: { token },
        include: { user: true },
      });
      if (dbSession && dbSession.user) {
        if (new Date(dbSession.expiresAt).getTime() < Date.now()) {
          await prisma.session.delete({ where: { token } }).catch(() => {});
          return null;
        }
        const { password, ...safeUser } = dbSession.user;
        return {
          id: safeUser.id,
          email: safeUser.email,
          full_name: safeUser.fullName,
          role: safeUser.role,
          company: safeUser.company,
          plan: safeUser.plan,
          dealer_group_ids: safeUser.dealerGroupIds,
          store_ids: safeUser.storeIds,
          created_at: safeUser.createdAt,
        };
      }
    } catch (e) {
      console.warn('Prisma getSessionUser fallback to local JSON:', e.message);
    }
  }

  // Fallback to local session file
  const sessions = getSessions();
  const session = sessions[token];
  if (!session) return null;
  if (session.expiresAt && session.expiresAt < Date.now()) {
    delete sessions[token];
    saveSessions(sessions);
    return null;
  }
  const users = getUsers();
  const user = users.find(u => u.id === session.userId);
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
}

export async function destroySession(token) {
  if (!token) return;

  if (process.env.DATABASE_URL) {
    try {
      await prisma.session.delete({ where: { token } }).catch(() => {});
    } catch {}
    return;
  }

  const sessions = getSessions();
  if (sessions[token]) {
    delete sessions[token];
    saveSessions(sessions);
  }
}
