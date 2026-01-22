const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const configManager = require('../utils/configManager');

// In-memory session storage 
const sessions = new Map();
const authCodes = new Map();

// Cookie-based authorization endpoint
router.get('/:provider/authorize', (req, res) => {
  const { provider } = req.params;
  const { client_id, redirect_uri, scope, state } = req.query;

  const io = req.app.get('io');
  io.emit('oauth_event', {
    step: 'authorization_requested',
    provider: provider + ' (cookie)',
    timestamp: new Date().toISOString(),
    data: { client_id, redirect_uri, scope, state, auth_type: 'cookie-based' }
  });

  const providerConfig = configManager.getProviderConfig(provider);
  if (!providerConfig) {
    return res.status(400).send('Invalid provider');
  }

  const userData = configManager.getUserData(provider);
  const code = crypto.randomBytes(32).toString('hex');
  
  authCodes.set(code, {
    provider,
    client_id,
    redirect_uri,
    scope,
    createdAt: Date.now(),
    expiresIn: 600000
  });

  setTimeout(() => authCodes.delete(code), 600000);

  console.log(`📝 [COOKIE] Authorization code generated for ${provider}: ${code}`);

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>DevAuth - Cookie-Based ${provider.charAt(0).toUpperCase() + provider.slice(1)}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }
        .login-container {
          background: white;
          padding: 40px;
          border-radius: 10px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          text-align: center;
          max-width: 400px;
        }
        .logo {
          font-size: 48px;
          margin-bottom: 20px;
        }
        h1 {
          margin: 0 0 10px 0;
          color: #333;
        }
        .subtitle {
          color: #666;
          margin-bottom: 30px;
        }
        .info {
          background: #f5f5f5;
          padding: 15px;
          border-radius: 5px;
          margin-bottom: 20px;
          text-align: left;
          font-size: 14px;
        }
        .info strong {
          color: #f5576c;
        }
        button {
          background: #f5576c;
          color: white;
          border: none;
          padding: 12px 30px;
          font-size: 16px;
          border-radius: 5px;
          cursor: pointer;
          transition: background 0.3s;
          margin: 5px;
        }
        button:hover {
          background: #e04558;
        }
        .deny {
          background: #dc3545;
        }
        .deny:hover {
          background: #c82333;
        }
        .badge {
          display: inline-block;
          background: #f5576c;
          color: white;
          padding: 5px 10px;
          border-radius: 15px;
          font-size: 12px;
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="login-container">
        <div class="logo">🍪</div>
        <h1>Cookie-Based Auth</h1>
        <p class="subtitle">Mock ${provider.charAt(0).toUpperCase() + provider.slice(1)} Login</p>
        
        <div class="info">
          <div><strong>Auth Type:</strong> Session-Based (Cookie)</div>
          <div><strong>App:</strong> ${client_id}</div>
          <div><strong>User:</strong> ${userData.email || userData.mail || userData.userPrincipalName || userData.login}</div>
        </div>

        <p>This app would like to access your ${provider} account</p>
        
        <form method="POST" action="/auth-cookie/${provider}/consent">
          <input type="hidden" name="code" value="${code}" />
          <input type="hidden" name="redirect_uri" value="${redirect_uri}" />
          <input type="hidden" name="state" value="${state || ''}" />
          <button type="submit" name="action" value="allow">Allow Access</button>
          <button type="submit" name="action" value="deny" class="deny">Deny</button>
        </form>

        <div class="badge">COOKIE-BASED SESSION</div>
      </div>
    </body>
    </html>
  `);
});

// Handle consent
router.post('/:provider/consent', express.urlencoded({ extended: true }), (req, res) => {
  const { code, redirect_uri, state, action } = req.body;
  const { provider } = req.params;
  const io = req.app.get('io');

  if (action === 'deny') {
    io.emit('oauth_event', {
      step: 'user_denied',
      provider: provider + ' (cookie)',
      timestamp: new Date().toISOString(),
      data: { auth_type: 'cookie-based' }
    });
    
    const errorUrl = `${redirect_uri}?error=access_denied&error_description=User%20denied%20access${state ? `&state=${state}` : ''}`;
    return res.redirect(errorUrl);
  }

  io.emit('oauth_event', {
    step: 'user_authenticated',
    provider: provider + ' (cookie)',
    timestamp: new Date().toISOString(),
    data: { code: code.substring(0, 10) + '...', auth_type: 'cookie-based' }
  });

  const redirectUrl = `${redirect_uri}?code=${code}${state ? `&state=${state}` : ''}`;
  console.log(`✅ [COOKIE] User approved - redirecting to: ${redirectUrl}`);
  res.redirect(redirectUrl);
});

// Token endpoint - creates session instead of JWT
router.post('/:provider/token', (req, res) => {
  const { provider } = req.params;
  const { code, client_id, redirect_uri } = req.body;
  const io = req.app.get('io');

  console.log(`🔄 [COOKIE] Token exchange requested for ${provider}`);

  const codeData = authCodes.get(code);
  
  if (!codeData) {
    return res.status(400).json({
      error: 'invalid_grant',
      error_description: 'Authorization code is invalid or expired'
    });
  }

  if (codeData.provider !== provider || codeData.redirect_uri !== redirect_uri) {
    return res.status(400).json({
      error: 'invalid_grant',
      error_description: 'Code does not match the request parameters'
    });
  }

  authCodes.delete(code);

  // Create session instead of JWT
  const sessionId = crypto.randomBytes(32).toString('hex');
  const userData = configManager.getUserData(provider);
  
  sessions.set(sessionId, {
    provider,
    userId: userData.sub || userData.id || userData.login,
    userData: userData,
    createdAt: Date.now(),
    expiresAt: Date.now() + 3600000 // 1 hour
  });

  console.log(`✅ [COOKIE] Session created for ${provider}: ${sessionId}`);

  io.emit('oauth_event', {
    step: 'session_created',
    provider: provider + ' (cookie)',
    timestamp: new Date().toISOString(),
    data: { 
      session_id: sessionId.substring(0, 20) + '...',
      storage: 'server-side',
      auth_type: 'cookie-based'
    }
  });

  res.cookie('session_id', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // true on Render
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 3600000,
    path: '/'
  });
  

  res.json({
    access_token: sessionId, // Return session ID as token for compatibility
    token_type: 'Session',
    expires_in: 3600,
    session_based: true
  });
});

// UserInfo endpoint - validates session
router.get('/:provider/userinfo', (req, res) => {
  const { provider } = req.params;
  const io = req.app.get('io');
  
  // Try to get session from cookie or Authorization header
  const sessionId = req.cookies.session_id || 
                    (req.headers.authorization?.startsWith('Bearer ') ? 
                     req.headers.authorization.substring(7) : null);

  io.emit('oauth_event', {
    step: 'userinfo_requested',
    provider: provider + ' (cookie)',
    timestamp: new Date().toISOString(),
    data: { auth_type: 'cookie-based', validation: 'server-side session lookup' }
  });

  if (!sessionId) {
    return res.status(401).json({
      error: 'invalid_session',
      error_description: 'Missing session cookie or authorization header'
    });
  }

  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(401).json({
      error: 'invalid_session',
      error_description: 'Session not found or expired'
    });
  }

  if (session.provider !== provider) {
    return res.status(401).json({
      error: 'invalid_session',
      error_description: 'Session is not valid for this provider'
    });
  }

  // Check if session expired
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    return res.status(401).json({
      error: 'session_expired',
      error_description: 'Session has expired'
    });
  }

  console.log(`✅ [COOKIE] Session validated for ${provider}`);

  io.emit('oauth_event', {
    step: 'userinfo_accessed',
    provider: provider + ' (cookie)',
    timestamp: new Date().toISOString(),
    data: { 
      email: session.userData.email || session.userData.mail || session.userData.userPrincipalName,
      auth_type: 'cookie-based'
    }
  });

  res.json(session.userData);
});

module.exports = router;