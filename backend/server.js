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
app.set('trust proxy', 1);

const server = http.createServer(app);

/* =========================
   ✅ CORS — HTTP (FIXED)
   ========================= */
const ALLOWED_ORIGINS = [
  'https://devauth-frontend.onrender.com',
  'https://devauth-test-client.onrender.com'
];

app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true
}));

/* =========================
   Middleware
   ========================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* =========================
   Routes
   ========================= */
app.use('/auth', authRoutes);
app.use('/auth-cookie', authCookieRoutes);
app.use('/config', configRoutes);

/* =========================
   Health Check
   ========================= */
app.get('/', (req, res) => {
  res.json({
    message: 'DevAuth Mock OAuth Server',
    status: 'running'
  });
});

/* =========================
   ✅ Socket.IO (FIXED)
   ========================= */
const io = new Server(server, {
  path: '/socket.io',
  cors: {
    origin: ALLOWED_ORIGINS,
    credentials: true
  }
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log('👁️ Dashboard connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('👋 Dashboard disconnected:', socket.id);
  });
});

/* =========================
   Start Server
   ========================= */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 DevAuth server running on port ${PORT}`);
});
