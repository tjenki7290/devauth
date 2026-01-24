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

/* 🔑 ALLOWED ORIGINS */
const allowedOrigins = [
  'https://devauth-frontend.onrender.com',
  'https://devauth-test-client.onrender.com'
];

/* 🔑 EXPRESS CORS (MUST BE FIRST) */
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* 🔑 ROUTES */
app.use('/auth', authRoutes);
app.use('/auth-cookie', authCookieRoutes);
app.use('/config', configRoutes);

/* 🔑 HEALTH CHECK */
app.get('/', (req, res) => {
  res.json({
    message: 'DevAuth Mock OAuth Server',
    status: 'running'
  });
});

/* 🔑 HTTP SERVER */
const server = http.createServer(app);

/* 🔑 SOCKET.IO */
const io = new Server(server, {
  path: '/socket.io',
  cors: {
    origin: allowedOrigins,
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

/* 🔑 LISTEN */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 DevAuth server running on port ${PORT}`);
});
