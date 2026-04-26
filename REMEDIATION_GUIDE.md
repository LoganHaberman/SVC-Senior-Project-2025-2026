# Security Remediation Guide
## CLP Dashboard - Quick Fix Reference

This guide provides code examples for fixing the critical security vulnerabilities.

---

## 1. Setup Environment Variables

### .env (Create this file in project root)
```
# Database Configuration
DB_HOST=your-secure-host.rds.amazonaws.com
DB_USER=your_secure_user
DB_PASSWORD=your_secure_password
DB_NAME=clp_database

# JWT Configuration
JWT_SECRET=your_very_secure_random_string_here_min_32_chars
JWT_EXPIRY=1h

# API Configuration
PORT=3001
NODE_ENV=production
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# CORS
CORS_ENABLED=true
```

### .gitignore (Update existing)
```
# Environment variables
.env
.env.local
.env.*.local

# Database backups
*.sql
*.backup

# Upload directory
uploads/

# Dependencies
node_modules/

# Build
build/
dist/

# Logs
*.log
logs/

# OS
.DS_Store
Thumbs.db
```

---

## 2. Secure Backend Setup

### Install Required Dependencies
```bash
npm install dotenv bcrypt jsonwebtoken express-rate-limit helmet cors validator morgan
```

### backend/config/database.js
```javascript
require('dotenv').config();
const mysql = require('mysql');

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.connect(err => {
  if (err) {
    console.error('Database Connection Error:', err.message);
    // Don't expose full error to logs in production
    process.exit(1);
  } else {
    console.log('✓ Database connected securely');
  }
});

module.exports = db;
```

### backend/middleware/auth.js
```javascript
const jwt = require('jsonwebtoken');

// Verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.log('Token verification failed:', err.message);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Check user role
const authorize = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.user.role !== requiredRole && requiredRole !== 'any') {
      return res.status(403).json({ 
        error: `${requiredRole} access required` 
      });
    }

    next();
  };
};

// Validate user owns the resource
const validateOwnership = (getUserIdFromParams) => {
  return (req, res, next) => {
    const targetUserId = getUserIdFromParams(req.params);
    
    // Admin can access anything
    if (req.user.role === 'admin') {
      return next();
    }

    // User can only access their own data
    if (req.user.userId !== targetUserId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    next();
  };
};

module.exports = { authenticateToken, authorize, validateOwnership };
```

### backend/middleware/validation.js
```javascript
const validator = require('validator');

// Validate student name
const validateStudentName = (req, res, next) => {
  const { studentName } = req.body;

  if (!studentName || typeof studentName !== 'string') {
    return res.status(400).json({ error: 'Invalid student name' });
  }

  const trimmed = studentName.trim();

  if (trimmed.length < 2 || trimmed.length > 255) {
    return res.status(400).json({ 
      error: 'Student name must be 2-255 characters' 
    });
  }

  // Only allow letters, spaces, hyphens, apostrophes
  if (!validator.matches(trimmed, /^[a-zA-Z\s'-]+$/)) {
    return res.status(400).json({ 
      error: 'Student name contains invalid characters' 
    });
  }

  req.body.studentName = trimmed;
  next();
};

// Validate numeric ID
const validateNumericId = (paramName) => {
  return (req, res, next) => {
    const id = req.params[paramName];

    if (!validator.isInt(id)) {
      return res.status(400).json({ 
        error: `Invalid ${paramName}` 
      });
    }

    next();
  };
};

module.exports = { validateStudentName, validateNumericId };
```

### backend/middleware/errorHandler.js
```javascript
// Global error handler
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err.message);

  // Don't expose sensitive details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  const errorMessage = isDevelopment ? err.message : 'Internal server error';

  res.status(err.status || 500).json({
    error: errorMessage,
    ...(isDevelopment && { stack: err.stack })
  });
};

module.exports = errorHandler;
```

### backend/routes/auth.js
```javascript
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const router = express.Router();

// Login endpoint with proper security
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate inputs
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Query database
    db.query(
      'SELECT id, username, password_hash, role, email FROM users WHERE username = ?',
      [username],
      async (err, result) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Server error' });
        }

        if (result.length === 0) {
          // Don't reveal if user exists (timing attack mitigation)
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result[0];

        // Verify password
        const passwordValid = await bcrypt.compare(password, user.password_hash);

        if (!passwordValid) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Create JWT token
        const token = jwt.sign(
          {
            userId: user.id,
            username: user.username,
            role: user.role,
            email: user.email
          },
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRY }
        );

        // Log successful login (for audit trail)
        console.log(`✓ User logged in: ${username} (ID: ${user.id})`);

        res.json({
          success: true,
          token,
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            email: user.email
          }
        });
      }
    );
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Change password endpoint
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Validate new password
    if (newPassword.length < 12) {
      return res.status(400).json({ 
        error: 'Password must be at least 12 characters' 
      });
    }

    // Get user from database
    db.query(
      'SELECT password_hash FROM users WHERE id = ?',
      [userId],
      async (err, result) => {
        if (err || result.length === 0) {
          return res.status(500).json({ error: 'Server error' });
        }

        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, result[0].password_hash);
        if (!isValid) {
          return res.status(401).json({ error: 'Current password incorrect' });
        }

        // Hash new password
        const newHash = await bcrypt.hash(newPassword, 10);

        // Update database
        db.query(
          'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
          [newHash, userId],
          (err) => {
            if (err) {
              return res.status(500).json({ error: 'Password change failed' });
            }

            console.log(`✓ Password changed for user ${userId}`);
            res.json({ success: true, message: 'Password updated successfully' });
          }
        );
      }
    );
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
```

---

## 3. Secure File Upload

### backend/routes/roster.js
```javascript
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/auth');

// Configure multer with security
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Prevent directory traversal attacks
    const sanitizedName = path.basename(file.originalname);
    const timestamp = Date.now();
    cb(null, `roster_${timestamp}_${sanitizedName}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  },
  fileFilter: (req, file, cb) => {
    // Strict file type checking
    if (file.mimetype !== 'text/csv' && !file.originalname.endsWith('.csv')) {
      return cb(new Error('Only CSV files are allowed'));
    }

    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.csv') {
      return cb(new Error('Invalid file extension'));
    }

    cb(null, true);
  }
});

// Upload roster - admin only
router.post(
  '/upload',
  authenticateToken,
  authorize('admin'),
  upload.single('rosterFile'),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const uploadedFile = req.file.path;
    const students = [];

    // Process CSV
    fs.createReadStream(uploadedFile)
      .pipe(csv())
      .on('data', (row) => {
        // Validate row data
        if (row.id && row.name) {
          const id = String(row.id).trim();
          const name = String(row.name).trim();

          // Basic validation
          if (id.length > 0 && name.length > 0 && name.length <= 255) {
            students.push({ id, name });
          }
        }
      })
      .on('end', () => {
        // Insert into database instead of file-based storage
        const query = 'INSERT INTO students (id, name) VALUES ?';
        const values = students.map(s => [s.id, s.name]);

        db.query(query, [values], (err) => {
          // Clean up uploaded file
          fs.unlink(uploadedFile, (unlinkErr) => {
            if (unlinkErr) console.error('File cleanup error:', unlinkErr);
          });

          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to save roster' });
          }

          console.log(`✓ Roster uploaded by admin ${req.user.id}: ${students.length} students`);

          res.json({
            success: true,
            message: `Roster uploaded with ${students.length} students`
          });
        });
      })
      .on('error', (err) => {
        // Clean up file
        fs.unlink(uploadedFile, () => {});
        console.error('CSV parsing error:', err);
        res.status(400).json({ error: 'Invalid CSV file' });
      });
  }
);

module.exports = router;
```

---

## 4. Secure Express Server Setup

### backend/server.js
```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();

// ========== SECURITY MIDDLEWARE ==========

// Security headers
app.use(helmet());

// CORS - restrict to allowed origins
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Body parser with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request logging
const logStream = fs.createWriteStream(
  path.join(__dirname, 'logs', 'access.log'),
  { flags: 'a' }
);
if (!fs.existsSync(path.join(__dirname, 'logs'))) {
  fs.mkdirSync(path.join(__dirname, 'logs'), { recursive: true });
}
app.use(morgan('combined', { stream: logStream }));
app.use(morgan('dev')); // Console logging

// Rate limiting on login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts, try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiting
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100 // 100 requests per minute per IP
});

// ========== ROUTES ==========

// Apply rate limiting
app.use('/api/login', loginLimiter);
app.use('/api/', apiLimiter);

// Import routes
const authRoutes = require('./routes/auth');
const rosterRoutes = require('./routes/roster');

app.use('/api/auth', authRoutes);
app.use('/api/roster', rosterRoutes);

// ========== ERROR HANDLING ==========

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  const isDev = process.env.NODE_ENV === 'development';
  const status = err.status || 500;
  const message = isDev ? err.message : 'Internal server error';

  res.status(status).json({
    error: message,
    ...(isDev && { stack: err.stack })
  });
});

// ========== SERVER STARTUP ==========

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT} [${NODE_ENV}]`);
  console.log(`✓ CORS enabled for: ${corsOptions.origin}`);
});

module.exports = app;
```

---

## 5. Frontend Security Updates

### src/api/client.ts
```typescript
const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3001/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Get token from localStorage
function getAuthToken(): string | null {
  return localStorage.getItem('authToken');
}

// Make authenticated request
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('authToken');
      window.location.href = '/';
    }
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export { apiRequest, getAuthToken };
```

### src/Login/LoginPg.tsx (Updated)
```typescript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LoginPg: React.FC = () => {
  const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3001/api';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate inputs client-side
      if (!username.trim() || !password.trim()) {
        setError('Username and password are required');
        return;
      }

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Login failed');
        return;
      }

      const data = await res.json();
      
      // Store token securely
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('userId', data.user.id);
      localStorage.setItem('userRole', data.user.role);

      // Navigate based on role
      if (data.user.role === 'student') navigate('/studentdash');
      else if (data.user.role === 'professor') navigate('/professordash');
      else if (data.user.role === 'admin') navigate('/admindash');
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 350, margin: '60px auto', padding: 24 }}>
      <h2>CLP Dashboard Login</h2>
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
            style={{ width: '100%', padding: 8 }}
            required
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            style={{ width: '100%', padding: 8 }}
            required
          />
        </div>
        {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
        <button
          type="submit"
          disabled={loading}
          style={{ width: '100%', padding: 8 }}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
};

export default LoginPg;
```

---

## 6. Database Migration for Password Hashing

### migration_add_password_hashing.sql
```sql
-- Add password_hash column if not exists
ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);

-- Hash existing passwords (if migrating from plaintext)
-- WARNING: This is a one-time operation
-- In production, do this manually with bcrypt in your application

-- For demonstration:
-- UPDATE users SET password_hash = bcrypt(password) WHERE password_hash IS NULL;

-- After migration, drop the old password column
-- ALTER TABLE users DROP COLUMN password;

-- Create users table with hashing (for new installations)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  role ENUM('student', 'professor', 'admin') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  INDEX idx_username (username)
);
```

---

## Quick Implementation Checklist

- [ ] Create `.env` file with secure values
- [ ] Update `.gitignore` to exclude `.env`
- [ ] Install security packages: `npm install dotenv bcrypt jsonwebtoken express-rate-limit helmet morgan validator`
- [ ] Implement authentication middleware
- [ ] Implement authorization checks
- [ ] Add input validation
- [ ] Secure file upload handling
- [ ] Add rate limiting
- [ ] Add security headers with Helmet
- [ ] Update database schema for password hashing
- [ ] Implement error handling
- [ ] Add request logging
- [ ] Test all endpoints with security considerations
- [ ] Rotate database credentials
- [ ] Review CORS settings
- [ ] Enable HTTPS in production

---

## Testing Your Fixes

```bash
# Test dependencies for vulnerabilities
npm audit

# Update vulnerable packages
npm audit fix

# Run security tests
npm test

# Check for hardcoded secrets
npm install -g detect-secrets
detect-secrets scan

# Lint for security issues
npm install -D eslint-plugin-security
```

---

## Production Deployment Checklist

- [ ] All environment variables set in production
- [ ] HTTPS/SSL enabled
- [ ] Database backups configured
- [ ] Monitoring and alerting setup
- [ ] Error logs don't expose sensitive data
- [ ] Rate limiting configured appropriately
- [ ] CORS only allows frontend domain
- [ ] Security headers properly set
- [ ] JWT secrets rotated
- [ ] Database credentials rotated
- [ ] Backup procedures tested
- [ ] Incident response plan documented
