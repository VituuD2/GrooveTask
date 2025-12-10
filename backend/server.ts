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
// We check standard Upstash env vars, Vercel KV vars, and finally fallback to the hardcoded keys provided.
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || 'https://oriented-escargot-7784.upstash.io',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || 'AR5oAAImcDFiZGQ3YjIwZDg3ODI0OTdiOGIyYTBhY2FhZTQ5YjRlM3AxNzc4NA',
});

interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: number;
}

// --- SECURITY CONFIGURATION ---

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_do_not_use_in_prod';
const IS_PROD = process.env.NODE_ENV === 'production';

// Use 'as any' to avoid TS overload errors with middleware
app.use(helmet() as any);
app.use(express.json() as any);
app.use(cookieParser() as any);

// Rate Limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 10, 
  message: { error: 'Too many attempts, please try again later.' },
  standardHeaders: true, 
  legacyHeaders: false, 
});

// Validation Schema
const authSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// --- MIDDLEWARE ---
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

    const { email, password } = validationResult.data;
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
      createdAt: Date.now()
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

    return res.status(201).json({ success: true, message: 'Account created', user: { email: newUser.email } });

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

    // Timing Attack Mitigation (Always hash something)
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

    return res.status(200).json({ success: true, message: 'Logged in successfully', user: { email: user.email } });

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

// 4. Me (Check Session)
app.get('/api/auth/me', requireAuth as any, async (req: any, res: any) => {
  // If middleware passes, token is valid
  const authReq = req as AuthRequest;
  return res.status(200).json({ 
    isAuthenticated: true, 
    user: { email: authReq.user?.email } 
  });
});

if (require.main === module) {
  app.listen(3001, () => {
    console.log('Auth server running on port 3001');
  });
}

export default app;