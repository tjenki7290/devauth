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
//deployment --- Because Render runs behind a proxy, cookies marked secure: true will not work without this.
app.set('trust proxy', 1);
const server = http.createServer(app);
const io = new Server(server, {
  cors: {    
    origin: [
    process.env.FRONTEND_URL,
    process.env.TEST_CLIENT_URL
  ],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const PORT = process.env.PORT || 3000;

// Make io accessible to routes
app.set('io', io);

// Middleware
app.use(cors({
  origin: [
    'https://devauth-frontend.onrender.com',
    'https://devauth-test-client.onrender.com'
  ],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use('/auth', authRoutes);
app.use('/auth-cookie', authCookieRoutes);
app.use('/config', configRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ 
    message: 'DevAuth Mock OAuth Server',
    status: 'running',
    endpoints: {
      authorize: '/auth/:provider/authorize',
      token: '/auth/:provider/token',
      userinfo: '/auth/:provider/userinfo',
      config: '/config/providers'
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 DevAuth server running on port ${PORT}`);
  console.log(`🔌 WebSocket server ready for real-time updates`);
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('👁️  Dashboard connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('👋 Dashboard disconnected:', socket.id);
  });
});