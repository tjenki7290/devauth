require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const configRoutes = require('./routes/config');
const authCookieRoutes = require('./routes/authCookie');

const app = express();

/**
 * IMPORTANT for Render + secure cookies + WebSockets
 */
app.set('trust proxy', 1);

const server = http.createServer(app);

/**
 * ✅ ALLOWED ORIGINS (MUST MATCH EXACTLY)
 */
const allowedOrigins = [
  'https://devauth-frontend.onrender.com',
  'https://devauth-test-client.onrender.com',
];

/**
 * ✅ SOCKET.IO (WebSocket only — no polling)
 */
const io = new Server(server, {
  path: '/socket.io',
  transports: ['websocket'],
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

/**
 * Make io accessible in routes
 */
app.set('io', io);

/**
 * ✅ EXPRESS CORS (for REST endpoints)
 */
app.use(cors({
  origin(origin, callback) {
    // Allow server-to-server / curl
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

/**
 * Middleware
 */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/**
 * Routes
 */
app.use('/auth', authRoutes);
app.use('/auth-cookie', authCookieRoutes);
app.use('/config', configRoutes);

/**
 * Health check
 */
app.get('/', (req, res) => {
  res.json({
    message: 'DevAuth Mock OAuth Server',
    status: 'running',
    endpoints: {
      authorize: '/auth/:provider/authorize',
      token: '/auth/:provider/token',
      userinfo: '/auth/:provider/userinfo',
      config: '/config/providers',
    },
  });
});

/**
 * WebSocket handling
 */
io.on('connection', (socket) => {
  console.log('👁️ Dashboard connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('👋 Dashboard disconnected:', socket.id);
  });
});

/**
 * Start server
 */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 DevAuth server running on port ${PORT}`);
  console.log(`🔌 WebSocket server ready`);
});
