import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import helmet from 'helmet';

// --- MOCK DATABASE INTERFACE ---
interface User {
  id: string;
  email: string;
  passwordHash: string;
}

const MOCK_DB: User[] = [
  {
    id: 'user_123',
    email: 'user@example.com',
    passwordHash: '$2a$10$w.2.1.2.3.4.5.6.7.8.9.0.1.2.3.4.5.6.7.8.9.0.1.2.3' 
  }
];

const db = {
  getUserByEmail: async (email: string): Promise<User | null> => {
    await new Promise(resolve => setTimeout(resolve, 50)); 
    return MOCK_DB.find(u => u.email === email) || null;
  },
  getUserById: async (id: string): Promise<User | null> => {
    await new Promise(resolve => setTimeout(resolve, 50));
    return MOCK_DB.find(u => u.id === id) || null;
  }
};

// --- SECURITY CONFIGURATION ---

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_do_not_use_in_prod';
const IS_PROD = process.env.NODE_ENV === 'production';

app.use(helmet());
app.use(express.json());
app.use(cookieParser());

// Rate Limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 5, 
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true, 
  legacyHeaders: false, 
});

// Timing Attack Prep
let DUMMY_HASH = '';
(async () => {
  DUMMY_HASH = await bcrypt.hash('dummy_timing_attack_prevention', 10);
})();

// Validation Schema
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// --- MIDDLEWARE ---
interface AuthRequest extends Request {
  user?: { uid: string; email: string };
  cookies: { [key: string]: string };
}

const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.cookies.auth_session;
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { uid: string; email: string };
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// --- ENDPOINTS ---

// 1. Login
app.post('/api/auth/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    const validationResult = loginSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ error: 'Invalid input format' });
    }

    const { email, password } = validationResult.data;
    const user = await db.getUserByEmail(email);

    // Timing Attack Mitigation
    const hashToCompare = user ? user.passwordHash : DUMMY_HASH;
    const isMatch = await bcrypt.compare(password, hashToCompare);

    if (!user || !isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create Token
    const token = jwt.sign(
      { uid: user.id, email: user.email }, 
      JWT_SECRET, 
      { expiresIn: '30d' }
    );

    // Set Cookie
    res.cookie('auth_session', token, {
      httpOnly: true, 
      secure: IS_PROD, 
      sameSite: 'strict', 
      maxAge: 30 * 24 * 60 * 60 * 1000, 
      path: '/', 
    });

    return res.status(200).json({ success: true, message: 'Logged in successfully', user: { email: user.email } });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('auth_session', {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'strict',
    path: '/'
  });
  return res.status(200).json({ message: 'Logged out' });
});

// 3. Me (Check Session)
app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res: Response) => {
  // If middleware passes, token is valid
  return res.status(200).json({ 
    isAuthenticated: true, 
    user: { email: req.user?.email } 
  });
});

if (require.main === module) {
  app.listen(3001, () => {
    console.log('Auth server running on port 3001');
  });
}

export default app;