const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const configManager = require('../utils/configManager');

// In-memory storage for authorization codes
const authCodes = new Map();

// Step 2: Authorization Endpoint - Shows login page and generates auth code
router.get('/:provider/authorize', (req, res) => {
  const { provider } = req.params;
  const { client_id, redirect_uri, scope, state, response_type } = req.query;

  // Emit event to dashboard
  const io = req.app.get('io');
  io.emit('oauth_event', {
    step: 'authorization_requested',
    provider,
    timestamp: new Date().toISOString(),
    data: { client_id, redirect_uri, scope, state }
  });

  // Validate provider exists in config
  const providerConfig = configManager.getProviderConfig(provider);
  if (!providerConfig) {
    return res.status(400).send('Invalid provider');
  }

  // Get user data from config manager
  const userData = configManager.getUserData(provider);

  // Validate required OAuth parameters
  if (!client_id || !redirect_uri) {
    return res.status(400).send('Missing required parameters: client_id and redirect_uri');
  }

  // Generate authorization code
  const code = crypto.randomBytes(32).toString('hex');
  
  // Store the code with associated data (expires in 10 minutes)
  authCodes.set(code, {
    provider,
    client_id,
    redirect_uri,
    scope,
    createdAt: Date.now(),
    expiresIn: 600000 // 10 minutes
  });

  // Clean up old codes
  setTimeout(() => authCodes.delete(code), 600000);

  console.log(`📝 Authorization code generated for ${provider}: ${code}`);

  // Return a simple HTML page simulating the OAuth login
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>DevAuth - Mock ${provider.charAt(0).toUpperCase() + provider.slice(1)} Login</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
          color: #667eea;
        }
        button {
          background: #667eea;
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
          background: #5568d3;
        }
        .deny {
          background: #dc3545;
        }
        .deny:hover {
          background: #c82333;
        }
        .badge {
          display: inline-block;
          background: #667eea;
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
        <div class="logo">🔐</div>
        <h1>Mock ${provider.charAt(0).toUpperCase() + provider.slice(1)} Login</h1>
        <p class="subtitle">DevAuth OAuth Simulator</p>
        
        <div class="info">
          <div><strong>App:</strong> ${client_id}</div>
          <div><strong>Scope:</strong> ${scope || 'default'}</div>
          <div><strong>User:</strong> ${userData.email || userData.mail || userData.userPrincipalName || userData.login}</div>
        </div>

        <p>This app would like to access your ${provider} account</p>
        
        <form method="POST" action="/auth/${provider}/consent">
          <input type="hidden" name="code" value="${code}" />
          <input type="hidden" name="redirect_uri" value="${redirect_uri}" />
          <input type="hidden" name="state" value="${state || ''}" />
          <button type="submit" name="action" value="allow">Allow Access</button>
          <button type="submit" name="action" value="deny" class="deny">Deny</button>
        </form>

        <div class="badge">MOCK ENVIRONMENT</div>
      </div>
    </body>
    </html>
  `);
});

// Handle consent (allow/deny)
router.post('/:provider/consent', express.urlencoded({ extended: true }), (req, res) => {
  const { code, redirect_uri, state, action } = req.body;
  const { provider } = req.params;
  const io = req.app.get('io');

  console.log('📝 Consent form submitted:', { code, redirect_uri, state, action });

  if (!redirect_uri) {
    return res.status(400).send('Missing redirect_uri');
  }

  // Check if user denial is simulated
  if (configManager.isFailureModeEnabled('userDenial') || action === 'deny') {
    // User denied access
    io.emit('oauth_event', {
      step: 'user_denied',
      provider,
      timestamp: new Date().toISOString(),
      data: { redirect_uri, simulated: configManager.isFailureModeEnabled('userDenial') }
    });
    
    const errorUrl = `${redirect_uri}?error=access_denied&error_description=User%20denied%20access${state ? `&state=${state}` : ''}`;
    console.log(`❌ User denied - redirecting to: ${errorUrl}`);
    return res.redirect(errorUrl);
  }

  if (!code) {
    const errorUrl = `${redirect_uri}?error=invalid_request&error_description=Missing%20authorization%20code${state ? `&state=${state}` : ''}`;
    console.log(`❌ Missing code - redirecting to: ${errorUrl}`);
    return res.redirect(errorUrl);
  }

  // User allowed access
  io.emit('oauth_event', {
    step: 'user_authenticated',
    provider,
    timestamp: new Date().toISOString(),
    data: { code: code.substring(0, 10) + '...', state }
  });

  io.emit('oauth_event', {
    step: 'code_generated',
    provider,
    timestamp: new Date().toISOString(),
    data: { code: code.substring(0, 10) + '...', redirect_uri }
  });

  // User allowed access - redirect with authorization code
  const redirectUrl = `${redirect_uri}?code=${code}${state ? `&state=${state}` : ''}`;
  console.log(`✅ User approved - redirecting to: ${redirectUrl}`);
  res.redirect(redirectUrl);
});

// Step 3: Token Endpoint - Exchange authorization code for tokens
router.post('/:provider/token', (req, res) => {
  const { provider } = req.params;
  const { code, client_id, redirect_uri, grant_type } = req.body;
  const io = req.app.get('io');

  console.log(`🔄 Token exchange requested for ${provider}`);

  io.emit('oauth_event', {
    step: 'token_exchange_requested',
    provider,
    timestamp: new Date().toISOString(),
    data: { code: code?.substring(0, 10) + '...', grant_type }
  });

  // Validate grant_type
  if (grant_type !== 'authorization_code') {
    return res.status(400).json({
      error: 'unsupported_grant_type',
      error_description: 'Only authorization_code grant type is supported'
    });
  }

  // Retrieve and validate authorization code
  const codeData = authCodes.get(code);
  
  // Check if invalid code mode is enabled
  if (configManager.isFailureModeEnabled('invalidCode')) {
    io.emit('oauth_event', {
      step: 'invalid_code_simulated',
      provider,
      timestamp: new Date().toISOString(),
      data: { error: 'invalid_grant' }
    });
    
    return res.status(400).json({
      error: 'invalid_grant',
      error_description: 'Authorization code is invalid (simulated failure)'
    });
  }
  
  if (!codeData) {
    return res.status(400).json({
      error: 'invalid_grant',
      error_description: 'Authorization code is invalid or expired'
    });
  }

  // Validate that the code matches the request
  if (codeData.provider !== provider || codeData.redirect_uri !== redirect_uri) {
    return res.status(400).json({
      error: 'invalid_grant',
      error_description: 'Code does not match the request parameters'
    });
  }

  // Check if code is expired
  if (Date.now() - codeData.createdAt > codeData.expiresIn) {
    authCodes.delete(code);
    return res.status(400).json({
      error: 'invalid_grant',
      error_description: 'Authorization code has expired'
    });
  }

  // Delete the code (one-time use)
  authCodes.delete(code);

  // Generate tokens
  const userData = configManager.getUserData(provider);
  
  // Check if expired token mode is enabled
  const expiresIn = configManager.isFailureModeEnabled('expiredToken') ? 1 : 3600;
  
  const accessToken = jwt.sign(
    { 
      sub: userData.sub || userData.id || userData.login,
      provider,
      scope: codeData.scope 
    },
    process.env.JWT_SECRET,
    { expiresIn: configManager.isFailureModeEnabled('expiredToken') ? '1s' : '1h' }
  );

  const refreshToken = crypto.randomBytes(32).toString('hex');

  console.log(`✅ Tokens generated for ${provider}${configManager.isFailureModeEnabled('expiredToken') ? ' (expires in 1 second)' : ''}`);

  io.emit('oauth_event', {
    step: 'token_exchanged',
    provider,
    timestamp: new Date().toISOString(),
    data: { 
      access_token: accessToken.substring(0, 20) + '...',
      expires_in: expiresIn,
      simulated_expiry: configManager.isFailureModeEnabled('expiredToken')
    }
  });

  // Return tokens in OAuth 2.0 format
  res.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: expiresIn,
    refresh_token: refreshToken,
    scope: codeData.scope
  });
});

// Step 4: UserInfo Endpoint - Return user data with valid token
router.get('/:provider/userinfo', (req, res) => {
  const { provider } = req.params;
  const authHeader = req.headers.authorization;
  const io = req.app.get('io');

  io.emit('oauth_event', {
    step: 'userinfo_requested',
    provider,
    timestamp: new Date().toISOString(),
    data: {}
  });

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    io.emit('oauth_event', {
      step: 'invalid_token_error',
      provider,
      timestamp: new Date().toISOString(),
      data: { error: 'Missing Authorization header' }
    });
    
    return res.status(401).json({
      error: 'invalid_token',
      error_description: 'Missing or invalid Authorization header'
    });
  }

  const token = authHeader.substring(7);

  // Check if invalid token mode is enabled
  if (configManager.isFailureModeEnabled('invalidToken')) {
    io.emit('oauth_event', {
      step: 'invalid_token_simulated',
      provider,
      timestamp: new Date().toISOString(),
      data: { error: 'invalid_token' }
    });
    
    return res.status(401).json({
      error: 'invalid_token',
      error_description: 'Token is invalid (simulated failure)'
    });
  }

  // Check if rate limited mode is enabled
  if (configManager.isFailureModeEnabled('rateLimited')) {
    io.emit('oauth_event', {
      step: 'rate_limited_simulated',
      provider,
      timestamp: new Date().toISOString(),
      data: { error: 'rate_limit_exceeded' }
    });
    
    return res.status(429).json({
      error: 'rate_limit_exceeded',
      error_description: 'Too many requests (simulated failure)'
    });
  }

  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.provider !== provider) {
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'Token is not valid for this provider'
      });
    }

    console.log(`✅ User info requested for ${provider}`);

    io.emit('oauth_event', {
      step: 'userinfo_accessed',
      provider,
      timestamp: new Date().toISOString(),
      data: { 
        email: configManager.getUserData(provider).email || 
               configManager.getUserData(provider).mail ||
               configManager.getUserData(provider).userPrincipalName 
      }
    });

    // Return mock user data from config manager
    res.json(configManager.getUserData(provider));

  } catch (error) {
    return res.status(401).json({
      error: 'invalid_token',
      error_description: error.message
    });
  }
});

module.exports = router;