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
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || 'https://oriented-escargot-7784.upstash.io',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || 'AR5oAAImcDFiZGQ3YjIwZDg3ODI0OTdiOGIyYTBhY2FhZTQ5YjRlM3AxNzc4NA',
});

// --- TYPES ---
interface Task {
  id: string;
  title: string;
  description: string;
  isCompleted: boolean;
  completedAt: number | null;
  createdAt: number;
}

interface DailyStat {
  date: string;
  completedCount: number;
  totalTasksAtEnd: number;
}

interface UserSettings {
  themeId: string;
  soundEnabled: boolean;
  language?: string;
}

interface UserProfile {
  id: string;
  email: string;
  username: string;
  usernameChangeCount: number;
  passwordHash: string;
  createdAt: number;
  settings: UserSettings;
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
  max: 20, 
  message: { error: 'Too many attempts, please try again later.' },
  standardHeaders: true, 
  legacyHeaders: false, 
});

// Validation
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  language: z.string().optional(),
});

const loginSchema = z.object({
  identifier: z.string(), // email or username
  password: z.string(),
});

const usernameSchema = z.string()
  .min(3)
  .max(20)
  .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores allowed');

// --- HELPERS ---

// Generate a unique username based on email part
async function generateUniqueUsername(email: string): Promise<string> {
  let base = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
  if (base.length < 3) base = base.padEnd(3, 'x');
  if (base.length > 15) base = base.substring(0, 15);
  
  let candidate = base;
  let attempts = 0;
  
  while (await redis.exists(`username:${candidate.toLowerCase()}`)) {
    attempts++;
    // Add 4 random digits
    const suffix = Math.floor(1000 + Math.random() * 9000);
    candidate = `${base}${suffix}`;
    if (attempts > 10) throw new Error("Could not generate unique username");
  }
  return candidate;
}

// Helper: Get Tasks (Handles migration from String Array to Hash & Sorting)
async function getTasks(uid: string): Promise<Task[]> {
  const key = `data:tasks:${uid}`;
  const orderKey = `data:tasks:order:${uid}`;
  const type = await redis.type(key);

  // Migration: If currently stored as a JSON string (old format), convert to Hash
  if (type === 'string') {
    const raw = await redis.get<Task[]>(key);
    const tasks = Array.isArray(raw) ? raw : [];
    
    // Delete the old string key
    await redis.del(key);
    
    // Convert to Hash map and store
    if (tasks.length > 0) {
      const hashData: Record<string, string> = {};
      const orderIds: string[] = [];
      tasks.forEach(t => {
        hashData[t.id] = JSON.stringify(t);
        orderIds.push(t.id);
      });
      await redis.hset(key, hashData);
      // Also save the order from the array
      await redis.set(orderKey, orderIds);
    }
    return tasks;
  } 
  
  // Standard Hash Fetch
  if (type === 'hash') {
    const rawMap = await redis.hgetall<Record<string, string>>(key);
    if (!rawMap) return [];
    
    // Values are JSON strings, parse them back to objects
    const tasks = Object.values(rawMap)
      .map(val => {
        try {
          return typeof val === 'string' ? JSON.parse(val) : val;
        } catch (e) {
          return null;
        }
      })
      .filter((t): t is Task => t !== null);

    // Fetch Order to sort tasks
    const order = await redis.get<string[]>(orderKey);
    
    if (order && Array.isArray(order)) {
      const taskMap = new Map(tasks.map(t => [t.id, t]));
      const sortedTasks: Task[] = [];
      
      // 1. Add tasks in order
      order.forEach(id => {
        const t = taskMap.get(id);
        if (t) {
          sortedTasks.push(t);
          taskMap.delete(id); // Remove from map so we know what's left
        }
      });
      
      // 2. Append any remaining tasks (orphans not in order list)
      // Sort them by creation date to be deterministic
      const remaining = Array.from(taskMap.values()).sort((a, b) => a.createdAt - b.createdAt);
      
      return [...sortedTasks, ...remaining];
    }
    
    // If no order key exists, sort by createdAt default
    return tasks.sort((a, b) => a.createdAt - b.createdAt);
  }

  // If 'none' or other, return empty array
  return [];
}

// Helper: Save Tasks (Sync logic using Hash)
async function saveTasks(uid: string, tasks: any[]) {
  const key = `data:tasks:${uid}`;
  
  // Clean input tasks
  const cleanTasks = tasks.map(t => ({
     id: t.id,
     title: t.title,
     description: t.description || '',
     isCompleted: t.isCompleted,
     completedAt: t.completedAt,
     createdAt: t.createdAt
  }));

  if (cleanTasks.length === 0) {
    // If empty list, remove the key
    await redis.del(key);
    return;
  }

  // Safety check for migration/type mismatch
  const type = await redis.type(key);
  if (type === 'string') {
    await redis.del(key);
  }

  // Sync Strategy:
  const currentIds = await redis.hkeys(key);
  const newIdsSet = new Set(cleanTasks.map(t => t.id));
  
  const pipeline = redis.pipeline();

  // Tasks to delete (present in DB but missing in payload)
  const idsToDelete = currentIds.filter(id => !newIdsSet.has(id));
  if (idsToDelete.length > 0) {
    pipeline.hdel(key, ...idsToDelete);
  }

  // Tasks to update/add
  const hashUpdates: Record<string, string> = {};
  cleanTasks.forEach(t => {
    hashUpdates[t.id] = JSON.stringify(t);
  });
  
  if (Object.keys(hashUpdates).length > 0) {
     pipeline.hset(key, hashUpdates);
  }

  await pipeline.exec();
}

// --- MIDDLEWARE HELPERS ---
interface AuthRequest extends Request {
  user?: { uid: string; email: string };
  cookies: { [key: string]: string };
}

const requireAuth = (req: any, res: any, next: NextFunction) => {
  const authReq = req as AuthRequest;
  const token = authReq.cookies?.auth_session;
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

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
    httpOnly: true, 
    secure: IS_PROD, 
    sameSite: 'strict', 
    maxAge: 30 * 24 * 60 * 60 * 1000, 
    path: '/', 
  });
};

// --- ENDPOINTS ---

// 1. Register
app.post('/api/auth/register', authLimiter as any, async (req: any, res: any) => {
  try {
    const validationResult = registerSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ error: 'Invalid input format' });
    }

    const { email, password, language } = validationResult.data;
    const cleanEmail = email.toLowerCase();

    // Check email existence
    const existingUid = await redis.get(`email:${cleanEmail}`);
    if (existingUid) {
      return res.status(409).json({ error: 'User already exists' });
    }
    
    // Check old style existence for safety
    const oldUser = await redis.get(`user:${cleanEmail}`);
    if (oldUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const username = await generateUniqueUsername(cleanEmail);

    const newUser: UserProfile = {
      id: userId,
      email: cleanEmail,
      username: username,
      usernameChangeCount: 0,
      passwordHash,
      createdAt: Date.now(),
      settings: {
        themeId: 'neon-blue',
        soundEnabled: true,
        language: language || 'en'
      }
    };

    // Transactional-ish save
    await redis.set(`user:${userId}`, newUser);
    await redis.set(`email:${cleanEmail}`, userId);
    await redis.set(`username:${username.toLowerCase()}`, userId);
    
    // Initialize History (Hash for tasks is auto-created, Order key auto-created on save)
    await redis.set(`data:history:${userId}`, []);

    const token = jwt.sign({ uid: userId, email: cleanEmail }, JWT_SECRET, { expiresIn: '30d' });
    setAuthCookie(res, token);

    return res.status(201).json({ 
      success: true, 
      user: { 
        email: newUser.email, 
        username: newUser.username,
        settings: newUser.settings,
        data: { tasks: [], history: [] } 
      } 
    });

  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Login (Supports Migration & Email/Username)
app.post('/api/auth/login', authLimiter as any, async (req: any, res: any) => {
  try {
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) return res.status(400).json({ error: 'Invalid input' });

    const { identifier, password } = validationResult.data;
    const cleanId = identifier.toLowerCase();
    
    let userId = null;
    let userProfile = null;
    let requiresMigration = false;
    let oldUserPayload: any = null;

    // A. Attempt to resolve UID
    if (cleanId.includes('@')) {
       // It's an email
       userId = await redis.get<string>(`email:${cleanId}`);
       
       // CHECK FOR LEGACY USER (Migration Trigger)
       if (!userId) {
          oldUserPayload = await redis.get(`user:${cleanId}`);
          if (oldUserPayload) requiresMigration = true;
       }
    } else {
       // It's a username
       userId = await redis.get<string>(`username:${cleanId}`);
    }

    // B. Validation
    if (!userId && !requiresMigration) {
      const dummyHash = await bcrypt.hash('dummy', 10);
      await bcrypt.compare(password, dummyHash);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // C. Get Profile (New System)
    if (userId) {
      userProfile = await redis.get<UserProfile>(`user:${userId}`);
    } else if (requiresMigration && oldUserPayload) {
      // Use old payload for password check
      userProfile = { 
         ...oldUserPayload, 
         id: oldUserPayload.id || uuidv4(), // Should have ID, but fallback
         passwordHash: oldUserPayload.passwordHash 
      } as UserProfile;
    }

    if (!userProfile) return res.status(401).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, userProfile.passwordHash);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    // D. Execute Migration if needed
    if (requiresMigration && oldUserPayload) {
       console.log(`Migrating user: ${cleanId}`);
       const newUid = userProfile.id;
       const newUsername = await generateUniqueUsername(cleanId);
       
       // Clean old data structure
       const oldTasks = oldUserPayload.data?.tasks || [];
       const oldHistory = oldUserPayload.data?.history || [];
       
       const newUserProfile: UserProfile = {
         id: newUid,
         email: cleanId,
         username: newUsername,
         usernameChangeCount: 0,
         passwordHash: oldUserPayload.passwordHash,
         createdAt: oldUserPayload.createdAt || Date.now(),
         settings: oldUserPayload.settings || { themeId: 'neon-blue', soundEnabled: true, language: 'en' }
       };

       // Save New Structure
       await redis.set(`user:${newUid}`, newUserProfile);
       await redis.set(`email:${cleanId}`, newUid);
       await redis.set(`username:${newUsername.toLowerCase()}`, newUid);
       
       // Handle Tasks Migration via helper logic or direct
       if (oldTasks.length > 0) {
          // Manually migrate here 
          const hashData: Record<string, string> = {};
          const orderIds: string[] = [];
          oldTasks.forEach((t: any) => {
             const cleanT = {
                id: t.id,
                title: t.title,
                description: t.description || '',
                isCompleted: t.isCompleted,
                completedAt: t.lastCompletedDate ? new Date(t.lastCompletedDate).getTime() : null,
                createdAt: t.createdAt || Date.now()
             };
             hashData[t.id] = JSON.stringify(cleanT);
             orderIds.push(t.id);
          });
          await redis.hset(`data:tasks:${newUid}`, hashData);
          await redis.set(`data:tasks:order:${newUid}`, orderIds);
       }

       await redis.set(`data:history:${newUid}`, oldHistory);
       
       // Delete Old Key
       await redis.del(`user:${cleanId}`);

       userId = newUid;
       userProfile = newUserProfile;
    }

    // E. Fetch Data (Separated Collections with Hash support)
    const tasks = await getTasks(userId!); 
    const history = await redis.get<DailyStat[]>(`data:history:${userId}`) || [];

    const token = jwt.sign({ uid: userProfile.id, email: userProfile.email }, JWT_SECRET, { expiresIn: '30d' });
    setAuthCookie(res, token);

    return res.status(200).json({ 
      success: true, 
      user: { 
        email: userProfile.email,
        username: userProfile.username,
        usernameChangeCount: userProfile.usernameChangeCount,
        settings: userProfile.settings,
        data: { tasks, history }
      } 
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Logout
app.post('/api/auth/logout', (req: any, res: any) => {
  res.clearCookie('auth_session', { httpOnly: true, secure: IS_PROD, sameSite: 'strict', path: '/' });
  return res.status(200).json({ message: 'Logged out' });
});

// 4. Me (Get Full Data)
app.get('/api/auth/me', requireAuth as any, async (req: any, res: any) => {
  const authReq = req as AuthRequest;
  if (!authReq.user) return res.status(401).json({ error: 'Unauthorized' });

  const userId = authReq.user.uid;
  const user = await redis.get<UserProfile>(`user:${userId}`);

  if (!user) return res.status(404).json({ error: 'User not found' });

  // Fetch separate collections with Hash logic
  const tasks = await getTasks(userId);
  const history = await redis.get<DailyStat[]>(`data:history:${userId}`) || [];

  return res.status(200).json({ 
    isAuthenticated: true, 
    user: { 
      email: user.email,
      username: user.username,
      usernameChangeCount: user.usernameChangeCount || 0,
      settings: user.settings,
      data: { tasks, history }
    } 
  });
});

// 5. Update Settings & Profile
app.post('/api/user/settings', requireAuth as any, async (req: any, res: any) => {
  const authReq = req as AuthRequest;
  const userId = authReq.user?.uid;
  const user = await redis.get<UserProfile>(`user:${userId}`);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { themeId, soundEnabled, language, username } = req.body;

  // Handle Username Change
  if (username && username.toLowerCase() !== user.username.toLowerCase()) {
     const cleanUser = username.toLowerCase();
     const formatCheck = usernameSchema.safeParse(username);
     if (!formatCheck.success) return res.status(400).json({ error: 'Invalid username format' });
     const count = user.usernameChangeCount || 0;
     if (count >= 3) return res.status(403).json({ error: 'Max username changes reached' });
     const exists = await redis.exists(`username:${cleanUser}`);
     if (exists) return res.status(409).json({ error: 'Username taken' });

     await redis.del(`username:${user.username.toLowerCase()}`); 
     await redis.set(`username:${cleanUser}`, userId);
     user.username = username;
     user.usernameChangeCount = count + 1;
  }

  user.settings = { 
    themeId: themeId || user.settings?.themeId || 'neon-blue', 
    soundEnabled: soundEnabled ?? user.settings?.soundEnabled ?? true,
    language: language || user.settings?.language || 'en'
  };

  await redis.set(`user:${userId}`, user);

  return res.status(200).json({ 
    success: true, 
    settings: user.settings, 
    username: user.username, 
    usernameChangeCount: user.usernameChangeCount 
  });
});

// 6. Sync Data (Tasks via Hash, Order via String, History separate)
app.post('/api/user/data', requireAuth as any, async (req: any, res: any) => {
  const authReq = req as AuthRequest;
  const userId = authReq.user?.uid;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  
  const { tasks, history, order } = req.body;

  if (tasks && Array.isArray(tasks)) {
    await saveTasks(userId, tasks);
  }

  if (history && Array.isArray(history)) {
    await redis.set(`data:history:${userId}`, history);
  }
  
  // Handle Order separately
  if (order && Array.isArray(order)) {
    await redis.set(`data:tasks:order:${userId}`, order);
  }

  return res.status(200).json({ success: true });
});

export default app;