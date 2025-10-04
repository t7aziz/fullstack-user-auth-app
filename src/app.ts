import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import cryptoAnalyzer from '../rust-crypto-analyzer';
import pool from './db'; 
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT env variable not found');
}

app.use(express.json());
app.use(cors());

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
app.post('/register', async (req: Request, res: Response) => {
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
      return res.status(400).json({ error: 'User with this email already exists' });
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

// Needs to be fixed to actually use db
app.get('/profile', authenticateToken, (req: AuthRequest, res: Response) => {
  res.json({
    message: 'Protected route accessed',
    user: req.user
  });
});

// Needs to be fixed to actually use db
app.get('/users/:id', (req: Request, res: Response) => {
  const userId = req.params.id;
  res.json({ 
    message: `Getting user with ID: ${userId}`,
    user: {
      id: userId,
      name: 'John Doe',
      email: 'john@example.com'
    }
  });
});

// Other Routes (PUT, DELETE, etc) (WIP)

// Should list API methods
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

/*

### Public Endpoints

**POST /register**
```bash
curl -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com", "password": "SecurePass123!"}'
```

**POST /login**
```bash
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"email": "john@example.com", "password": "SecurePass123!"}'
```

**POST /check-password** (Test password security)
```bash
curl -X POST http://localhost:3000/check-password \
  -H "Content-Type: application/json" \
  -d '{"password": "TestPassword123!"}'
```

### Protected Endpoints (Require JWT Token)

**GET /profile**
```bash
curl http://localhost:3000/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

*/