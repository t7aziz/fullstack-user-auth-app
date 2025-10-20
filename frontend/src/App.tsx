import React, { useState, useEffect } from 'react';
import './App.css';

interface User {
  id: string;
  name: string;
  email: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [breachStatus, setBreachStatus] = useState<{ breached: boolean; count: number | null } | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });

  const API_BASE = 'http://localhost:3000';

  // Check if user is logged in on app start
  useEffect(() => {
    if (token) {
      fetchProfile();
    }
  }, [token]);

  const fetchProfile = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        // Token is invalid
        localStorage.removeItem('token');
        setToken(null);
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setBreachStatus(null);

    // Validate email
    if (!formData.email.includes('@')) {
      setError('Please enter a valid email address.');
      setLoading(false);
      return;
    }

    // Validate password length
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    // Additional check: if registering, ensure the full name is provided
    if (!isLogin && formData.name.trim() === '') {
      setError('Full name is required for registration.');
      setLoading(false);
      return;
    }

    const endpoint = isLogin ? '/login' : '/api/users';
    const body = isLogin
      ? { email: formData.email, password: formData.password }
      : formData;

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        setFormData({ name: '', email: '', password: '' });

        if (!isLogin && data.breach !== undefined) {
          setBreachStatus({ breached: !!data.breach, count: data.breachCount ?? null });
        } else if (isLogin && data.breach !== undefined) {
          setBreachStatus({ breached: !!data.breach, count: data.breachCount ?? null });
        }
      } else {
        setError(data.error || 'Something went wrong');
      }
    } catch (err) {
      console.error('Error submitting form:', err);
      setError('Network error. Make sure the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setFormData({ name: '', email: '', password: '' });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  if (user) {
    return (
      <div className="App">
        <header className="App-header">
          <h1>Welcome, {user.name}!</h1>
          {breachStatus && (
            <div className={`breach-status ${breachStatus.breached ? 'breached' : 'secure'}`}>
              {breachStatus.breached
                ? `Password breached: seen ${breachStatus.count?.toLocaleString() ?? 'an unknown number of'} times (HIBP)`
                : 'Password secure: not found in known breaches (HIBP)'}
            </div>
          )}
          <div className="user-info">
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>ID:</strong> {user.id}</p>
          </div>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </header>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>PERN Stack + Rust User Auth Demo</h1>
        <div className="auth-container">
          <div className="auth-toggle">
            <button
              onClick={() => setIsLogin(true)}
              className={isLogin ? 'active' : ''}
            >
              Login
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={!isLogin ? 'active' : ''}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {!isLogin && (
              <input
                type="text"
                name="name"
                placeholder="Full Name"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            )}

            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleInputChange}
              required
            />

            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleInputChange}
              required
            />

            <button type="submit" disabled={loading}>
              {loading ? 'Loading...' : isLogin ? 'Login' : 'Register'}
            </button>
          </form>

          {error && <p className="error">{error}</p>}
        </div>
      </header>
    </div>
  );
}

export default App;