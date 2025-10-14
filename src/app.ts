import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import cryptoAnalyzer from '../rust-crypto-analyzer';
import { checkPasswordBreached } from './services/hibp';
import pool from './db'; 

const loggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
};
const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT env variable not found');
}

app.use(express.json());
app.use(cors());
app.use(loggerMiddleware);

interface AuthRequest extends Request {
  user?: { id: string; email: string; name: string };
}

const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded as { id: string; email: string; name: string };
    next();
  });
};

// API routes (passwords are dealt with in the rust module)
app.post('/api/users', async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Password policy check
    const analysis = cryptoAnalyzer.checkPasswordPolicy(password);
    if (!analysis.isCompliant) {
      return res.status(400).json({ 
        error: 'Password does not meet security requirements.',
        feedback: analysis.feedback
      });
    }

    // Check if user exists in the database (should not return 'user with this email alr exists due to security)
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    const hashedPassword = cryptoAnalyzer.hashPassword(password);
    
    // Insert the new user into the database
    const newUserResult = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, email, name',
      [name, email, hashedPassword]
    );
    
    const newUser = newUserResult.rows[0];

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, name: newUser.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: newUser.id, email: newUser.email, name: newUser.name }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find the user in the database
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];

    // Password verification
    const validPassword = cryptoAnalyzer.verifyPasswordHash(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/', (req: Request, res: Response) => {
  res.json({ 
    message: 'API Server with Authentication!', 
    timestamp: new Date().toISOString() 
  });
});

// Gets logged in user's profile
app.get('/api/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    // We query the DB to get the freshest data, as the JWT data could be stale.
    const result = await pool.query(
      'SELECT id, name, email, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific user by ID
app.get('/api/users/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // select specific columns to avoid ever sending back the password hash.
    const result = await pool.query(
        'SELECT id, name, email, created_at FROM users WHERE id = $1',
        [id]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
      console.error(`Error fetching user ${req.params.id}:`, error);
      res.status(500).json({ error: 'Internal server error' });
  }
});

// NEW: HIBP Need to change this so that the frontend isn't passing the password through, should take userid or something and check the database
app.post('/api/check-breach', async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    
    // Hash password with SHA-1 in Rust (fast!)
    const passwordHash = cryptoAnalyzer.hashPasswordSha1(password);
    
    // Check against HIBP
    const result = await checkPasswordBreached(passwordHash);
    
    res.json({
      breached: result.breached,
      breachCount: result.count,
      message: result.breached 
        ? `This password has been exposed in ${result.count.toLocaleString()} data breaches!`
        : 'This password has not been found in any known data breaches.'
    });
    
  } catch (error) {
    console.error('Breach check error:', error);
    res.status(500).json({ error: 'Failed to check breach status' });
  }
});

// Should list API methods
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});