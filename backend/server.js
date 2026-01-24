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

// Required for Render cookies + proxies
app.set('trust proxy', 1);

const server = http.createServer(app);

// ✅ Allowed origins
const ALLOWED_ORIGINS = [
  'https://devauth-frontend.onrender.com',
  'https://devauth-test-client.onrender.com',
];

// ✅ Express CORS (REST endpoints)
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow curl / server calls
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error('CORS blocked'));
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ✅ Socket.IO CORS (THIS was the missing piece)
const io = new Server(server, {
  path: '/socket.io',
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Make io available to routes
app.set('io', io);

// Routes
app.use('/auth', authRoutes);
app.use('/auth-cookie', authCookieRoutes);
app.use('/config', configRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({
    message: 'DevAuth Mock OAuth Server',
    status: 'running',
  });
});

// Socket events
io.on('connection', (socket) => {
  console.log('👁️ Dashboard connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('👋 Dashboard disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 DevAuth backend running on ${PORT}`);
});
