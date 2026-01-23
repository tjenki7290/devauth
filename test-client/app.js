require('dotenv').config();
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8080;

// Set EJS as template engine
app.set('view engine', 'ejs');
app.use(express.static('public'));

// In-memory session storage (in production, use proper session management)
const sessions = new Map();

// Home page with login buttons
app.get('/', (req, res) => {
  const sessionId = req.query.session;
  const userData = sessionId ? sessions.get(sessionId) : null;

  res.render('index', { 
    userData,
    oauthServer: process.env.OAUTH_SERVER,
    clientId: process.env.CLIENT_ID,
    callbackUrl: process.env.CALLBACK_URL
  });
});

// Comparison page
app.get('/compare', (req, res) => {
  res.render('compare');
});

//live comparison page
app.get('/live-compare', (req, res) => {
  res.render('live-compare');
});

// Initiate OAuth flow
app.get('/login/:provider', (req, res) => {
  const { provider } = req.params;
  const state = crypto.randomBytes(16).toString('hex');

  // Store state for CSRF protection
  sessions.set(state, { provider, timestamp: Date.now() });

  // Clean up old states after 10 minutes
  setTimeout(() => sessions.delete(state), 600000);

  // Redirect to OAuth authorization endpoint
  const authUrl = `${process.env.OAUTH_SERVER}/auth/${provider}/authorize?` +
    `client_id=${process.env.CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(process.env.CALLBACK_URL)}&` +
    `scope=email profile&` +
    `state=${state}&` +
    `response_type=code`;

  console.log(`🔐 Redirecting to ${provider} OAuth: ${authUrl}`);
  res.redirect(authUrl);
});

// Cookie-based login flow
app.get('/login-cookie/:provider', (req, res) => {
  const { provider } = req.params;
  const state = crypto.randomBytes(16).toString('hex');

  // Store state for CSRF protection
  sessions.set(state, { provider, timestamp: Date.now(), authType: 'cookie' });

  // Clean up old states after 10 minutes
  setTimeout(() => sessions.delete(state), 600000);

  // Redirect to cookie-based OAuth authorization endpoint
  const authUrl = `${process.env.OAUTH_SERVER}/auth-cookie/${provider}/authorize?` +
    `client_id=${process.env.CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(process.env.CALLBACK_URL + '-cookie')}&` +
    `scope=email profile&` +
    `state=${state}&` +
    `response_type=code`;

  console.log(`🍪 Redirecting to ${provider} Cookie OAuth: ${authUrl}`);
  res.redirect(authUrl);
});

// OAuth callback endpoint
app.get('/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  // Handle user denial
  if (error) {
    return res.render('error', { 
      error: error,
      description: error_description || 'User denied access'
    });
  }

  // Validate state (CSRF protection)
  const sessionData = sessions.get(state);
  if (!sessionData) {
    return res.render('error', { 
      error: 'invalid_state',
      description: 'Invalid or expired state parameter'
    });
  }

  const { provider } = sessionData;
  sessions.delete(state); // Remove used state

  if (!code) {
    return res.render('error', { 
      error: 'no_code',
      description: 'No authorization code received'
    });
  }

  console.log(`✅ Received authorization code: ${code}`);

  try {
    // Exchange authorization code for access token
    console.log('🔄 Exchanging code for token...');
    const tokenResponse = await axios.post(
      `${process.env.OAUTH_SERVER}/auth/${provider}/token`,
      {
        code: code,
        client_id: process.env.CLIENT_ID,
        redirect_uri: process.env.CALLBACK_URL,
        grant_type: 'authorization_code'
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    console.log('✅ Token received');

    // If token expires quickly (< 10 seconds), wait to demonstrate expiration
    if (expires_in < 10) {
      console.log(`⏱️  Token expires in ${expires_in} seconds. Waiting ${expires_in + 1} seconds to demonstrate expiration...`);
      await new Promise(resolve => setTimeout(resolve, (expires_in + 1) * 1000));
      console.log('⏰ Token should now be expired. Attempting to use it...');
    }

    // Get user info with access token
    console.log('👤 Fetching user info...');
    const userInfoResponse = await axios.get(
      `${process.env.OAUTH_SERVER}/auth/${provider}/userinfo`,
      {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      }
    );

    const userInfo = userInfoResponse.data;
    console.log('✅ User info received:', userInfo);

    // Create session
    const sessionId = crypto.randomBytes(16).toString('hex');
    sessions.set(sessionId, {
      provider,
      userInfo,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in,
      loginTime: new Date().toISOString(),
      authType: 'jwt'
    });

    // Redirect back to home with session
    res.redirect(`/?session=${sessionId}`);

  } catch (error) {
    console.error('❌ OAuth error:', error.response?.data || error.message);
    
    // Check if it's a token expiration error
    if (error.response?.status === 401 && error.response?.data?.error === 'invalid_token') {
      return res.render('error', { 
        error: 'expired_token',
        description: 'The access token has expired. This demonstrates how apps must handle token expiration and refresh tokens.'
      });
    }
    
    res.render('error', { 
      error: 'oauth_failed',
      description: error.response?.data?.error_description || error.message
    });
  }
});

// Cookie callback endpoint
app.get('/callback-cookie', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  // Handle user denial
  if (error) {
    return res.render('error', { 
      error: error,
      description: error_description || 'User denied access'
    });
  }

  // Validate state (CSRF protection)
  const sessionData = sessions.get(state);
  if (!sessionData) {
    return res.render('error', { 
      error: 'invalid_state',
      description: 'Invalid or expired state parameter'
    });
  }

  const { provider } = sessionData;
  sessions.delete(state); // Remove used state

  if (!code) {
    return res.render('error', { 
      error: 'no_code',
      description: 'No authorization code received'
    });
  }

  console.log(`✅ [COOKIE] Received authorization code: ${code}`);

  try {
    // Exchange authorization code for session
    console.log('🔄 [COOKIE] Exchanging code for session...');
    const tokenResponse = await axios.post(
      `${process.env.OAUTH_SERVER}/auth-cookie/${provider}/token`,
      {
        code: code,
        client_id: process.env.CLIENT_ID,
        redirect_uri: process.env.CALLBACK_URL + '-cookie',
        grant_type: 'authorization_code'
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const { access_token: sessionId, expires_in } = tokenResponse.data;
    console.log('✅ [COOKIE] Session created');

    // Get user info with session
    console.log('👤 [COOKIE] Fetching user info...');
    const userInfoResponse = await axios.get(
      `${process.env.OAUTH_SERVER}/auth-cookie/${provider}/userinfo`,
      {
        headers: {
          'Authorization': `Bearer ${sessionId}`
        }
      }
    );

    const userInfo = userInfoResponse.data;
    console.log('✅ [COOKIE] User info received:', userInfo);

    // Create client-side session
    const clientSessionId = crypto.randomBytes(16).toString('hex');
    sessions.set(clientSessionId, {
      provider,
      userInfo,
      sessionId: sessionId,
      expiresIn: expires_in,
      loginTime: new Date().toISOString(),
      authType: 'cookie'
    });

    // Redirect back to home with session
    res.redirect(`/?session=${clientSessionId}`);

  } catch (error) {
    console.error('❌ [COOKIE] OAuth error:', error.response?.data || error.message);
    res.render('error', { 
      error: 'oauth_failed',
      description: error.response?.data?.error_description || error.message
    });
  }
});

// Logout
app.get('/logout', (req, res) => {
  const sessionId = req.query.session;
  if (sessionId) {
    sessions.delete(sessionId);
  }
  res.redirect('/');
});

app.listen(PORT, () => {
  console.log(`🧪 Test Client running on port ${PORT}`);
});