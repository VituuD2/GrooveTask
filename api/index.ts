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
  lastCompletedDate: string | null;
  createdAt: number;
}

interface DailyStat {
  date: string;
  completedCount: number;
  totalTasksAtEnd: number;
}

interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: number;
  settings?: {
    themeId: string;
    soundEnabled: boolean;
    language?: string;
  };
  data?: {
    tasks: Task[];
    history: DailyStat[];
  };
}

// --- CONFIGURATION ---
const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_do_not_use_in_prod';
const IS_PROD = process.env.NODE_ENV === 'production';

// Critical for Vercel/Proxies
app.set('trust proxy', 1);

// Middleware
app.use(helmet() as any);
app.use(express.json({ limit: '10mb' }) as any); // Increased limit for data sync
app.use(cookieParser() as any);

// Rate Limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 20, 
  message: { error: 'Too many attempts, please try again later.' },
  standardHeaders: true, 
  legacyHeaders: false, 
});

// Validation Schema
const authSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  language: z.string().optional(),
});

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
    const validationResult = authSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ error: 'Invalid input format' });
    }

    const { email, password, language } = validationResult.data;
    const userKey = `user:${email.toLowerCase()}`;

    // Check if user exists
    const existingUser = await redis.get(userKey);
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Create new user
    const passwordHash = await bcrypt.hash(password, 10);
    const newUser: User = {
      id: uuidv4(),
      email: email.toLowerCase(),
      passwordHash,
      createdAt: Date.now(),
      settings: {
        themeId: 'neon-blue',
        soundEnabled: true,
        language: language || 'en'
      },
      data: {
        tasks: [],
        history: []
      }
    };

    // Save to Redis
    await redis.set(userKey, newUser);

    // Auto-login (Create Token)
    const token = jwt.sign(
      { uid: newUser.id, email: newUser.email }, 
      JWT_SECRET, 
      { expiresIn: '30d' }
    );

    setAuthCookie(res, token);

    return res.status(201).json({ 
      success: true, 
      message: 'Account created', 
      user: { 
        email: newUser.email, 
        settings: newUser.settings,
        data: newUser.data 
      } 
    });

  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Login
app.post('/api/auth/login', authLimiter as any, async (req: any, res: any) => {
  try {
    const validationResult = authSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ error: 'Invalid input format' });
    }

    const { email, password } = validationResult.data;
    const userKey = `user:${email.toLowerCase()}`;
    
    // Fetch user from Redis
    const user = await redis.get<User>(userKey);

    // Timing Attack Mitigation
    if (!user) {
      const dummyHash = await bcrypt.hash('dummy', 10);
      await bcrypt.compare(password, dummyHash);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create Token
    const token = jwt.sign(
      { uid: user.id, email: user.email }, 
      JWT_SECRET, 
      { expiresIn: '30d' }
    );

    setAuthCookie(res, token);

    return res.status(200).json({ 
      success: true, 
      message: 'Logged in successfully', 
      user: { 
        email: user.email, 
        settings: user.settings,
        data: user.data || { tasks: [], history: [] }
      } 
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Logout
app.post('/api/auth/logout', (req: any, res: any) => {
  res.clearCookie('auth_session', {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'strict',
    path: '/'
  });
  return res.status(200).json({ message: 'Logged out' });
});

// 4. Me (Check Session & Get Full Data)
app.get('/api/auth/me', requireAuth as any, async (req: any, res: any) => {
  const authReq = req as AuthRequest;
  if (!authReq.user) return res.status(401).json({ error: 'Unauthorized' });

  // Fetch full user data to get settings and data
  const userKey = `user:${authReq.user.email.toLowerCase()}`;
  const user = await redis.get<User>(userKey);

  if (!user) return res.status(404).json({ error: 'User not found' });

  return res.status(200).json({ 
    isAuthenticated: true, 
    user: { 
      email: user.email,
      settings: user.settings,
      data: user.data || { tasks: [], history: [] }
    } 
  });
});

// 5. Update Settings
app.post('/api/user/settings', requireAuth as any, async (req: any, res: any) => {
  const authReq = req as AuthRequest;
  if (!authReq.user) return res.status(401).json({ error: 'Unauthorized' });

  const { themeId, soundEnabled, language } = req.body;

  const userKey = `user:${authReq.user.email.toLowerCase()}`;
  const user = await redis.get<User>(userKey);

  if (!user) return res.status(404).json({ error: 'User not found' });

  // Update settings
  user.settings = { 
    themeId: themeId || user.settings?.themeId || 'neon-blue', 
    soundEnabled: soundEnabled ?? user.settings?.soundEnabled ?? true,
    language: language || user.settings?.language || 'en'
  };
  await redis.set(userKey, user);

  return res.status(200).json({ success: true, settings: user.settings });
});

// 6. Sync User Data (Tasks & History)
app.post('/api/user/data', requireAuth as any, async (req: any, res: any) => {
  const authReq = req as AuthRequest;
  if (!authReq.user) return res.status(401).json({ error: 'Unauthorized' });

  const { tasks, history } = req.body;

  if (!Array.isArray(tasks) || !Array.isArray(history)) {
     return res.status(400).json({ error: 'Invalid data format' });
  }

  const userKey = `user:${authReq.user.email.toLowerCase()}`;
  const user = await redis.get<User>(userKey);

  if (!user) return res.status(404).json({ error: 'User not found' });

  // Update data
  user.data = { tasks, history };
  await redis.set(userKey, user);

  return res.status(200).json({ success: true });
});

export default app;