import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import helmet from 'helmet';
import { Redis } from '@upstash/redis';
import { v4 as uuidv4 } from 'uuid';

// --- DATABASE CONFIGURATION ---
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

// --- TYPES RE-DEFINITION (Backend Context) ---
interface Task {
  id: string;
  groupId?: string;
  type?: 'simple' | 'counter';
  title: string;
  description: string;
  isCompleted: boolean;
  completedAt: number | null;
  count?: number;
  log?: any[];
  createdAt: number;
  updatedBy?: string;
}

interface UserProfile {
  id: string;
  email: string;
  username: string;
  usernameChangeCount: number;
  passwordHash: string;
  createdAt: number;
  settings: any;
}

interface Group {
  id: string;
  name: string;
  ownerId: string;
  createdAt: number;
}

interface GroupMember {
  id: string;
  username: string;
  role: 'owner' | 'member';
  joinedAt: number;
}

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
}

// --- CONFIGURATION ---
const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_do_not_use_in_prod';
const IS_PROD = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);
app.use(helmet() as any);
app.use(express.json({ limit: '10mb' }) as any);
app.use(cookieParser() as any);

// Rate Limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 50, 
  standardHeaders: true, 
  legacyHeaders: false, 
});

// Validation Schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  language: z.string().optional(),
});
const loginSchema = z.object({
  identifier: z.string(),
  password: z.string(),
});
const groupSchema = z.object({
  name: z.string().min(3).max(30),
});

// --- HELPERS & SERVICES ---

async function generateAndClaimUniqueUsername(email: string, userId: string): Promise<string> {
  let base = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
  if (base.length < 3) base = base.padEnd(3, 'x');
  if (base.length > 15) base = base.substring(0, 15);
  
  let candidate = base;
  let attempts = 0;
  
  while (attempts < 10) {
    const result = await redis.set(`username:${candidate.toLowerCase()}`, userId, { nx: true });
    if (result === 'OK') return candidate;
    attempts++;
    const suffix = Math.floor(1000 + Math.random() * 9000);
    candidate = `${base}${suffix}`;
  }
  throw new Error("Could not generate unique username");
}

async function getTasks(uid: string): Promise<Task[]> {
  const key = `data:tasks:${uid}`;
  const orderKey = `data:tasks:order:${uid}`;
  
  const [type, rawMap, order] = await Promise.all([
    redis.type(key),
    redis.hgetall<Record<string, string>>(key).catch(() => null),
    redis.get<string[]>(orderKey)
  ]);

  if (type === 'hash' && rawMap) {
    const tasks = Object.values(rawMap)
      .map(val => {
        try { return typeof val === 'string' ? JSON.parse(val) : val; } catch (e) { return null; }
      })
      .filter((t): t is Task => t !== null);

    if (order && Array.isArray(order)) {
      const taskMap = new Map(tasks.map(t => [t.id, t]));
      const sortedTasks: Task[] = [];
      order.forEach(id => {
        const t = taskMap.get(id);
        if (t) {
          sortedTasks.push(t);
          taskMap.delete(id);
        }
      });
      return [...sortedTasks, ...Array.from(taskMap.values())];
    }
    return tasks.sort((a, b) => a.createdAt - b.createdAt);
  }
  return [];
}

async function saveTasks(uid: string, tasks: any[], forceEmpty: boolean = false) {
  const key = `data:tasks:${uid}`;
  const cleanTasks = tasks.map(t => ({
     id: t.id,
     type: t.type || 'simple',
     title: t.title,
     description: t.description || '',
     isCompleted: t.isCompleted,
     completedAt: t.completedAt,
     count: typeof t.count === 'number' ? t.count : 0,
     log: Array.isArray(t.log) ? t.log : [],
     createdAt: t.createdAt
  }));

  if (cleanTasks.length === 0 && !forceEmpty) return;

  const type = await redis.type(key);
  if (type === 'string') await redis.del(key);

  const currentIds = await redis.hkeys(key);
  const newIdsSet = new Set(cleanTasks.map(t => t.id));
  const pipeline = redis.pipeline();

  const idsToDelete = currentIds.filter(id => !newIdsSet.has(id));
  if (idsToDelete.length > 0) pipeline.hdel(key, ...idsToDelete);

  const hashUpdates: Record<string, string> = {};
  cleanTasks.forEach(t => { hashUpdates[t.id] = JSON.stringify(t); });
  
  if (Object.keys(hashUpdates).length > 0) pipeline.hset(key, hashUpdates);
  await pipeline.exec();
}

// --- MIDDLEWARE ---
interface AuthRequest extends Request {
  user?: { uid: string; email: string };
  cookies: { [key: string]: string };
}

const requireAuth = (req: any, res: any, next: NextFunction) => {
  const authReq = req as AuthRequest;
  const token = authReq.cookies?.auth_session;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { uid: string; email: string };
    authReq.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const setAuthCookie = (res: any, token: string) => {
  res.cookie('auth_session', token, {
    httpOnly: true, secure: IS_PROD, sameSite: 'strict', maxAge: 30 * 24 * 60 * 60 * 1000, path: '/', 
  });
};

// --- AUTH ENDPOINTS ---
app.post('/api/auth/register', authLimiter as any, async (req: any, res: any) => {
  try {
    const { email, password, language } = registerSchema.parse(req.body);
    const cleanEmail = email.toLowerCase();

    if (await redis.get(`email:${cleanEmail}`)) return res.status(409).json({ error: 'User exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const username = await generateAndClaimUniqueUsername(cleanEmail, userId);

    const newUser: UserProfile = {
      id: userId,
      email: cleanEmail,
      username: username,
      usernameChangeCount: 0,
      passwordHash,
      createdAt: Date.now(),
      settings: { themeId: 'neon-blue', soundEnabled: true, language: language || 'en' }
    };

    await redis.set(`user:${userId}`, newUser);
    await redis.set(`email:${cleanEmail}`, userId);

    const token = jwt.sign({ uid: userId, email: cleanEmail }, JWT_SECRET, { expiresIn: '30d' });
    setAuthCookie(res, token);
    return res.status(201).json({ success: true, user: newUser });
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', authLimiter as any, async (req: any, res: any) => {
  try {
    const { identifier, password } = loginSchema.parse(req.body);
    const cleanId = identifier.toLowerCase();
    
    let userId = cleanId.includes('@') 
      ? await redis.get<string>(`email:${cleanId}`) 
      : await redis.get<string>(`username:${cleanId}`);

    if (!userId) {
       // Legacy check
       const oldUser = await redis.get<any>(`user:${cleanId}`);
       if (oldUser) userId = oldUser.id; // Assume migrated or partial state
       else return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = await redis.get<UserProfile>(`user:${userId}`);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ uid: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    setAuthCookie(res, token);
    return res.status(200).json({ success: true, user });
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/logout', (req: any, res: any) => {
  res.clearCookie('auth_session');
  return res.status(200).json({ message: 'Logged out' });
});

// Check Username Availability
app.post('/api/auth/check-username', requireAuth as any, async (req: any, res: any) => {
  const { username } = req.body;
  if (!username || username.length < 3 || username.length > 20) {
    return res.status(400).json({ error: 'Invalid length' });
  }
  
  // Check if taken by SOMEONE ELSE
  const existingId = await redis.get<string>(`username:${username.toLowerCase()}`);
  
  // Available if null OR if it belongs to me
  const isAvailable = !existingId || existingId === req.user.uid;
  
  return res.json({ available: isAvailable });
});

app.get('/api/auth/me', requireAuth as any, async (req: any, res: any) => {
  const userId = req.user.uid;
  const user = await redis.get<UserProfile>(`user:${userId}`);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const tasks = await getTasks(userId);
  const history = await redis.get(`data:history:${userId}`) || [];
  res.set('Cache-Control', 'no-store');
  return res.status(200).json({ isAuthenticated: true, user: { ...user, data: { tasks, history } } });
});

// --- PERSONAL DATA SYNC ---
app.post('/api/user/data', requireAuth as any, async (req: any, res: any) => {
  const userId = req.user.uid;
  const { tasks, history, order, forceEmpty } = req.body;

  if (tasks && Array.isArray(tasks)) await saveTasks(userId, tasks, !!forceEmpty);
  if (history && Array.isArray(history)) await redis.set(`data:history:${userId}`, history);
  if (order && Array.isArray(order)) await redis.set(`data:tasks:order:${userId}`, order);

  return res.status(200).json({ success: true });
});

app.post('/api/user/settings', requireAuth as any, async (req: any, res: any) => {
  const userId = req.user.uid;
  const user = await redis.get<UserProfile>(`user:${userId}`);
  if (!user) return res.status(404).json({});

  const { themeId, soundEnabled, language, username } = req.body;

  if (username && username.toLowerCase() !== user.username.toLowerCase()) {
     const claimed = await redis.set(`username:${username.toLowerCase()}`, userId, { nx: true });
     if (!claimed) return res.status(409).json({ error: 'Username taken' });
     await redis.del(`username:${user.username.toLowerCase()}`); 
     user.username = username;
     user.usernameChangeCount = (user.usernameChangeCount || 0) + 1;
  }

  user.settings = { 
    themeId: themeId || user.settings.themeId, 
    soundEnabled: soundEnabled ?? user.settings.soundEnabled,
    language: language || user.settings.language
  };
  await redis.set(`user:${userId}`, user);
  return res.status(200).json({ success: true, settings: user.settings, username: user.username });
});

// --- GROUPS API ---

// Create Group
app.post('/api/groups', requireAuth as any, async (req: any, res: any) => {
  try {
    const { name } = groupSchema.parse(req.body);
    const userId = req.user.uid;
    const groupId = uuidv4();

    const group: Group = { id: groupId, name, ownerId: userId, createdAt: Date.now() };

    // Atomic Multi transaction
    const pipeline = redis.pipeline();
    pipeline.hset(`group:${groupId}:meta`, group as unknown as Record<string, unknown>);
    pipeline.sadd(`group:${groupId}:members`, userId);
    pipeline.sadd(`user:${userId}:groups`, groupId);
    await pipeline.exec();

    return res.status(201).json(group);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to create group' });
  }
});

// Get My Groups
app.get('/api/groups', requireAuth as any, async (req: any, res: any) => {
  const userId = req.user.uid;
  const groupIds = await redis.smembers(`user:${userId}:groups`);
  
  if (groupIds.length === 0) {
      res.set('Cache-Control', 'no-store');
      return res.json([]);
  }

  const pipeline = redis.pipeline();
  groupIds.forEach(gid => pipeline.hgetall(`group:${gid}:meta`));
  const groups = await pipeline.exec();
  
  res.set('Cache-Control', 'no-store');
  return res.json(groups.filter(g => g !== null));
});

// Get Pending Invites for User
app.get('/api/user/invites', requireAuth as any, async (req: any, res: any) => {
  const userId = req.user.uid;
  const groupIds = await redis.smembers(`user:${userId}:invites`);
  
  if (groupIds.length === 0) {
      res.set('Cache-Control', 'no-store');
      return res.json([]);
  }

  const pipeline = redis.pipeline();
  groupIds.forEach(gid => pipeline.hgetall(`group:${gid}:meta`));
  const groups = await pipeline.exec();
  
  res.set('Cache-Control', 'no-store');
  return res.json(groups.filter(g => g !== null));
});

// Invite User (To Pending)
app.post('/api/groups/:id/invite', requireAuth as any, async (req: any, res: any) => {
  const { username } = req.body;
  const groupId = req.params.id;

  if (!username) return res.status(400).json({ error: 'Username required' });
  
  // 1. Find User
  const targetId = await redis.get<string>(`username:${username.toLowerCase()}`);
  if (!targetId) return res.status(404).json({ error: 'User not found' });

  // 2. Check if already member
  const isMember = await redis.sismember(`group:${groupId}:members`, targetId);
  if (isMember) return res.status(409).json({ error: 'User is already a member' });

  // 3. Add to invites
  const pipeline = redis.pipeline();
  pipeline.sadd(`group:${groupId}:invites`, targetId);
  pipeline.sadd(`user:${targetId}:invites`, groupId);
  await pipeline.exec();

  return res.json({ success: true });
});

// Accept Invite
app.post('/api/groups/:id/accept', requireAuth as any, async (req: any, res: any) => {
  const groupId = req.params.id;
  const userId = req.user.uid;

  // Verify invite exists
  const hasInvite = await redis.sismember(`user:${userId}:invites`, groupId);
  if (!hasInvite) return res.status(400).json({ error: 'No invite found' });

  const pipeline = redis.pipeline();
  // Remove from invites
  pipeline.srem(`group:${groupId}:invites`, userId);
  pipeline.srem(`user:${userId}:invites`, groupId);
  // Add to members
  pipeline.sadd(`group:${groupId}:members`, userId);
  pipeline.sadd(`user:${userId}:groups`, groupId);
  await pipeline.exec();

  return res.json({ success: true });
});

// Decline Invite
app.post('/api/groups/:id/decline', requireAuth as any, async (req: any, res: any) => {
  const groupId = req.params.id;
  const userId = req.user.uid;

  const pipeline = redis.pipeline();
  pipeline.srem(`group:${groupId}:invites`, userId);
  pipeline.srem(`user:${userId}:invites`, groupId);
  await pipeline.exec();

  return res.json({ success: true });
});

// Kick Member
app.post('/api/groups/:id/kick', requireAuth as any, async (req: any, res: any) => {
  const groupId = req.params.id;
  const { userId: targetId } = req.body;
  const requesterId = req.user.uid;

  const groupMeta = (await redis.hgetall(`group:${groupId}:meta`)) as unknown as Group | null;
  if (!groupMeta) return res.status(404).json({ error: 'Group not found' });

  if (groupMeta.ownerId !== requesterId) {
    return res.status(403).json({ error: 'Only owner can kick members' });
  }

  if (targetId === requesterId) {
     return res.status(400).json({ error: 'Cannot kick yourself' });
  }

  const pipeline = redis.pipeline();
  pipeline.srem(`group:${groupId}:members`, targetId);
  pipeline.srem(`user:${targetId}:groups`, groupId);
  await pipeline.exec();

  return res.json({ success: true });
});

// Leave Group
app.post('/api/groups/:id/leave', requireAuth as any, async (req: any, res: any) => {
  const groupId = req.params.id;
  const requesterId = req.user.uid;

  const groupMeta = (await redis.hgetall(`group:${groupId}:meta`)) as unknown as Group | null;
  if (!groupMeta) return res.status(404).json({ error: 'Group not found' });

  if (groupMeta.ownerId === requesterId) {
    return res.status(400).json({ error: 'Owner cannot leave. Delete group instead.' });
  }

  const pipeline = redis.pipeline();
  pipeline.srem(`group:${groupId}:members`, requesterId);
  pipeline.srem(`user:${requesterId}:groups`, groupId);
  await pipeline.exec();

  return res.json({ success: true });
});

// Delete Group
app.delete('/api/groups/:id', requireAuth as any, async (req: any, res: any) => {
  const groupId = req.params.id;
  const requesterId = req.user.uid;

  const groupMeta = (await redis.hgetall(`group:${groupId}:meta`)) as unknown as Group | null;
  if (!groupMeta) return res.status(404).json({ error: 'Group not found' });

  if (groupMeta.ownerId !== requesterId) {
    return res.status(403).json({ error: 'Only owner can delete group' });
  }

  // Get all members to cleanup their references
  const members = await redis.smembers(`group:${groupId}:members`);
  const invites = await redis.smembers(`group:${groupId}:invites`);
  
  const pipeline = redis.pipeline();
  
  // Remove group from all members' lists
  members.forEach(mid => pipeline.srem(`user:${mid}:groups`, groupId));
  // Remove group from all invitees' lists
  invites.forEach(mid => pipeline.srem(`user:${mid}:invites`, groupId));

  // Delete Group Data
  pipeline.del(`group:${groupId}:meta`);
  pipeline.del(`group:${groupId}:members`);
  pipeline.del(`group:${groupId}:invites`);
  pipeline.del(`tasks:group:${groupId}`);
  pipeline.del(`chat:${groupId}:messages`);

  await pipeline.exec();

  return res.json({ success: true });
});


// Get Group Members
app.get('/api/groups/:id/members', requireAuth as any, async (req: any, res: any) => {
  const groupId = req.params.id;
  const userId = req.user.uid;

  // Security: Must be a member to see members
  const isMember = await redis.sismember(`group:${groupId}:members`, userId);
  if (!isMember) return res.status(403).json({ error: 'Not a member' });

  const memberIds = await redis.smembers(`group:${groupId}:members`);
  const groupMeta = (await redis.hgetall(`group:${groupId}:meta`)) as unknown as Group | null;
  
  // Fetch user details for each member
  const pipeline = redis.pipeline();
  memberIds.forEach(mid => pipeline.get(`user:${mid}`));
  const users = await pipeline.exec();

  const members = users
    .map((u: any) => u ? u : null)
    .filter(u => u !== null)
    .map((u: UserProfile) => ({
      id: u.id,
      username: u.username,
      role: groupMeta?.ownerId === u.id ? 'owner' : 'member',
      joinedAt: 0 // Simplification, we don't store join date in set
    }));

  res.set('Cache-Control', 'no-store');
  return res.json(members);
});

// --- GROUP TASKS (ATOMIC) ---

// Get Group Tasks
app.get('/api/groups/:id/tasks', requireAuth as any, async (req: any, res: any) => {
  const groupId = req.params.id;
  
  // Verify membership
  const isMember = await redis.sismember(`group:${groupId}:members`, req.user.uid);
  if (!isMember) return res.status(403).json({ error: 'Not a member' });

  const [rawMap, orderRaw] = await Promise.all([
    redis.hgetall<Record<string, string>>(`tasks:group:${groupId}`),
    redis.get<string>(`tasks:group:order:${groupId}`) // It might be stored as string (JSON)
  ]);

  res.set('Cache-Control', 'no-store');
  
  if (!rawMap) return res.json([]);

  // Robust parsing: Upstash might return object (if auto-deserialized) OR string
  let tasks = Object.values(rawMap).map((s: any) => {
      try {
          return typeof s === 'string' ? JSON.parse(s) : s;
      } catch (e) {
          return null;
      }
  }).filter(t => t !== null);
  
  // Sort by order
  let order: string[] = [];
  try {
      if (orderRaw) order = typeof orderRaw === 'string' ? JSON.parse(orderRaw) : orderRaw;
  } catch(e) {}

  if (order && Array.isArray(order) && order.length > 0) {
      const taskMap = new Map(tasks.map((t: any) => [t.id, t]));
      const sortedTasks: any[] = [];
      order.forEach(id => {
        const t = taskMap.get(id);
        if (t) {
          sortedTasks.push(t);
          taskMap.delete(id);
        }
      });
      // Append any new tasks not in order list
      tasks = [...sortedTasks, ...Array.from(taskMap.values())];
  } else {
      tasks.sort((a: any, b: any) => a.createdAt - b.createdAt);
  }

  return res.json(tasks);
});

// Update/Create Task (HSET)
app.post('/api/groups/:id/tasks', requireAuth as any, async (req: any, res: any) => {
  const groupId = req.params.id;
  
  // Verify membership
  const isMember = await redis.sismember(`group:${groupId}:members`, req.user.uid);
  if (!isMember) return res.status(403).json({ error: 'Not a member' });

  const task = req.body as Task; // Full task object
  
  // Tag the updater
  const user = await redis.get<UserProfile>(`user:${req.user.uid}`);
  task.updatedBy = user?.username || 'Unknown';
  task.groupId = groupId;

  await redis.hset(`tasks:group:${groupId}`, { [task.id]: JSON.stringify(task) });
  return res.json(task);
});

// Post Group Order
app.post('/api/groups/:id/tasks/order', requireAuth as any, async (req: any, res: any) => {
  const groupId = req.params.id;
  const { order } = req.body;
  
  const isMember = await redis.sismember(`group:${groupId}:members`, req.user.uid);
  if (!isMember) return res.status(403).json({ error: 'Not a member' });
  
  if (!Array.isArray(order)) return res.status(400).json({error: 'Invalid order'});

  await redis.set(`tasks:group:order:${groupId}`, JSON.stringify(order));
  return res.json({ success: true });
});

// Delete Task (HDEL)
app.delete('/api/groups/:id/tasks/:taskId', requireAuth as any, async (req: any, res: any) => {
  const { id, taskId } = req.params;
  
  // Verify membership
  const isMember = await redis.sismember(`group:${id}:members`, req.user.uid);
  if (!isMember) return res.status(403).json({ error: 'Not a member' });

  await redis.hdel(`tasks:group:${id}`, taskId);
  return res.json({ success: true });
});

// --- REAL-TIME CHAT (POLLING) ---

app.get('/api/groups/:id/chat', requireAuth as any, async (req: any, res: any) => {
  try {
    const groupId = req.params.id;
    const userId = req.user.uid;

    // Verify membership (security and cleanup)
    const isMember = await redis.sismember(`group:${groupId}:members`, userId);
    if (!isMember) {
        // Return empty array to stop UI errors/spinners if membership was revoked
        return res.json([]); 
    }

    // Get last 100 messages
    const raw = await redis.lrange(`chat:${groupId}:messages`, -100, -1);
    
    if (!raw || !Array.isArray(raw)) {
        return res.json([]);
    }

    // Safely parse messages. Upstash might auto-deserialize if they are JSON strings.
    const messages = raw.map((s: any) => {
        try {
            // If it's already an object (auto-deserialized), return it.
            // If it's a string, parse it.
            return typeof s === 'string' ? JSON.parse(s) : s;
        } catch(e) {
            return null;
        }
    }).filter(m => m !== null);

    res.set('Cache-Control', 'no-store');
    return res.json(messages);
  } catch (error) {
    console.error("Chat GET error:", error);
    // Return empty array on server error to prevent frontend hangs
    return res.status(500).json([]);
  }
});

app.post('/api/groups/:id/chat', requireAuth as any, async (req: any, res: any) => {
  const groupId = req.params.id;
  const { text } = req.body;
  
  // Verify membership first
  const isMember = await redis.sismember(`group:${groupId}:members`, req.user.uid);
  if (!isMember) return res.status(403).json({ error: 'Not a member' });

  // Securely get user from session
  const user = await redis.get<UserProfile>(`user:${req.user.uid}`);
  const senderName = user ? user.username : 'Unknown';
  
  const msg: ChatMessage = {
    id: uuidv4(),
    sender: senderName,
    text,
    timestamp: Date.now()
  };

  await redis.rpush(`chat:${groupId}:messages`, JSON.stringify(msg));
  // Trim to keep only last 500 messages to save space
  await redis.ltrim(`chat:${groupId}:messages`, -500, -1);
  
  return res.json(msg);
});

export default app;