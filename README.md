# Full-Stack Authentication Platform with Rust Integration

A modern full-stack application for user management, including registering and logging in with email + password. Node.js + Express backend with PostgreSQL database and React frontend, featuring high-performance password security analysis and hashing powered by Rust.

## Features

- **JWT Authentication**: Secure token-based authentication with protected routes
- **Password Security Analysis**: CPU-intensive cryptographic operations handled by Rust for 10-50x speedup
  - Entropy calculation
  - Pattern analysis (repeated characters, sequential patterns, strength scoring)
  - Argon2 hashing
- **React Frontend**: Modern UI development with TypeScript
- **Modern Database**: User data and password hashes secured in PostgreSQL database
- **Production Ready**: Rate limiting, CORS, REST, ACID

## Tech Stack

### Backend
- Node.js + Express.js (TypeScript)
- Rust (via NAPI-RS) for performance-critical operations

### Frontend
- React (TypeScript)
- HTML/CSS

### Database
- PostgreSQL

## Performance Comparisons
Password Hashing Performance Benchmark
======================================
100 passwords:
--------------------------------------------------------------------------------
Node bcrypt (10 rounds):       5.10s
Node Argon2:                   4.39s
Rust Argon2 (sequential):      1.61s
Rust Argon2 (parallel):        0.56s
Rust parallel speedup: 2.89x faster than sequential, 7.86x faster than Node
1000 passwords:
--------------------------------------------------------------------------------
Node bcrypt (10 rounds):       50.20s
Node Argon2:                   44.29s
Rust Argon2 (sequential):      16.12s
Rust Argon2 (parallel):        5.57s
Rust parallel speedup: 2.89x faster than sequential, 7.95x faster than Node

Key Insights
================================================================================
Rust parallel processing shows ~8.0x speedup for batch operations

## Prerequisites

- Node.js 18+ 
- Rust toolchain (rustc, cargo) (may need Visual Studio Build Tools for Windows development)
- npm or yarn
- Git
  
## Installation

### 1. Install Rust

**Windows:**
Download and run https://rustup.rs/ (rustup-init.exe)

**macOS/Linux:**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 2. Clone and Install Dependencies

```bash
git clone https://github.com/t7aziz/fullstack-user-auth-app.git
cd fullstack-user-auth-app

# Install all dependencies (backend, frontend, and Rust module)
npm run install:all
```

### 3. Environment Variables

Create a `.env` file in the root directory and fill in the needed variables:

```env
DB_USER=
DB_HOST=
DB_DATABASE=
DB_PASSWORD=
DB_PORT=
PORT=3000
JWT_SECRET=
```

### 3. Build Everything

```bash
npm run build:all
```

## Running the Application

### Development Mode (Both servers with hot reload)

```bash
npm run dev:full
```

This starts:
- Backend API on http://localhost:3000
- Frontend on http://localhost:3001

### Production Mode

```bash
# Build everything
npm run build:all

# Start backend
npm start
```

## WIP 

- [ ] Rate limiting with Redis
- [ ] Docker containerization
- [ ] SHA for hashing large files using Rust
- [ ] WebSocket real-time features?
- [ ] Deploy somewhere?

## License

MIT

## Author

Taha Aziz - [GitHub Profile](https://github.com/t7aziz)
