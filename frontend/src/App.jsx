import { useState, useEffect, useRef } from 'react';
import { Settings, RefreshCw, Copy, Check, Server, Code, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import axios from 'axios';
import { io } from 'socket.io-client';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE;
const TEST_CLIENT_BASE = import.meta.env.VITE_TEST_CLIENT_BASE;

function App() {
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState('google');
  const [userData, setUserData] = useState({});
  const [originalUserData, setOriginalUserData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState('');
  const [logs, setLogs] = useState([]);
  const [oauthEvents, setOauthEvents] = useState([]);
  const [socket, setSocket] = useState(null);
  const [failureModes, setFailureModes] = useState({
    userDenial: false,
    expiredToken: false,
    invalidToken: false,
    rateLimited: false,
    invalidCode: false
  });
  const flowVizRef = useRef(null);
  
  // Collapsible section states
  const [isIntegrationGuideOpen, setIsIntegrationGuideOpen] = useState(false);
  const [isQuickTestUrlsOpen, setIsQuickTestUrlsOpen] = useState(false);
  const [isFailureSimOpen, setIsFailureSimOpen] = useState(false);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);

  // Fetch providers on mount
  useEffect(() => {
    fetchProviders();
    fetchFailureModes();
    
    const newSocket = io(API_BASE, {
      transports: ['polling'], // Render Free friendly
    });
       
    newSocket.on('connect', () => {
      console.log('✅ Connected to WebSocket');
      addLog('Connected to OAuth server', 'success');
    });

    newSocket.on('oauth_event', (event) => {
      console.log('📡 OAuth Event:', event);
      setOauthEvents(prev => [...prev, event].slice(-50)); // Keep last 50, add to end
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from WebSocket');
      addLog('Disconnected from server', 'error');
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Fetch user data when provider changes
  useEffect(() => {
    if (selectedProvider) {
      fetchUserData(selectedProvider);
    }
  }, [selectedProvider]);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (flowVizRef.current) {
      flowVizRef.current.scrollTop = flowVizRef.current.scrollHeight;
    }
  }, [oauthEvents]);

  const fetchProviders = async () => {
    try {
      const response = await axios.get(`${API_BASE}/config/providers`);
      setProviders(response.data.providers);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching providers:', error);
      setLoading(false);
    }
  };

  const fetchUserData = async (provider) => {
    try {
      const response = await axios.get(`${API_BASE}/config/providers/${provider}/userdata`);
      setUserData(response.data.userData);
      setOriginalUserData(response.data.userData);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchFailureModes = async () => {
    try {
      const response = await axios.get(`${API_BASE}/config/failure-modes`);
      setFailureModes(response.data.failureModes);
    } catch (error) {
      console.error('Error fetching failure modes:', error);
    }
  };

  const toggleFailureMode = async (mode) => {
    const newValue = !failureModes[mode];
    try {
      await axios.put(`${API_BASE}/config/failure-modes/${mode}`, { enabled: newValue });
      setFailureModes(prev => ({ ...prev, [mode]: newValue }));
      addLog(`${mode} ${newValue ? 'enabled' : 'disabled'}`, newValue ? 'warning' : 'info');
    } catch (error) {
      console.error('Error toggling failure mode:', error);
      addLog(`Failed to toggle ${mode}`, 'error');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_BASE}/config/providers/${selectedProvider}/userdata`, userData);
      setOriginalUserData(userData);
      addLog(`Updated user data for ${selectedProvider}`, 'success');
      setTimeout(() => setSaving(false), 500);
    } catch (error) {
      console.error('Error saving user data:', error);
      addLog(`Failed to update ${selectedProvider}`, 'error');
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm(`Reset ${selectedProvider} to default configuration?`)) return;
    
    try {
      await axios.post(`${API_BASE}/config/providers/${selectedProvider}/reset`);
      await fetchUserData(selectedProvider);
      addLog(`Reset ${selectedProvider} to defaults`, 'info');
    } catch (error) {
      console.error('Error resetting provider:', error);
      addLog(`Failed to reset ${selectedProvider}`, 'error');
    }
  };

  const handleInputChange = (key, value) => {
    setUserData(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const addLog = (message, type = 'info') => {
    setLogs(prev => [{
      id: Date.now(),
      message,
      type,
      timestamp: new Date().toLocaleTimeString()
    }, ...prev.slice(0, 49)]);
  };

  const hasChanges = JSON.stringify(userData) !== JSON.stringify(originalUserData);

  const getStepIcon = (step) => {
    const icons = {
      authorization_requested: '🔐',
      user_authenticated: '✅',
      user_denied: '❌',
      code_generated: '🎟️',
      token_exchange_requested: '🔄',
      token_exchanged: '🎫',
      userinfo_requested: '👤',
      userinfo_accessed: '✓'
    };
    return icons[step] || '📝';
  };

  const getStepLabel = (step) => {
    const labels = {
      authorization_requested: 'Authorization Requested',
      user_authenticated: 'User Authenticated',
      user_denied: 'User Denied Access',
      code_generated: 'Authorization Code Generated',
      token_exchange_requested: 'Token Exchange Requested',
      token_exchanged: 'Access Token Issued',
      userinfo_requested: 'UserInfo Requested',
      userinfo_accessed: 'UserInfo Returned',
      invalid_code_simulated: 'Invalid Code (Simulated)',
      invalid_token_simulated: 'Invalid Token (Simulated)',
      invalid_token_error: 'Invalid Token Error',
      rate_limited_simulated: 'Rate Limited (Simulated)'
    };
    return labels[step] || step;
  };

  const clearOAuthEvents = () => {
    setOauthEvents([]);
  };

  const getFailureModeLabel = (mode) => {
    const labels = {
      userDenial: 'User Denies Permission',
      expiredToken: 'Token Expires Immediately',
      invalidToken: 'Invalid Token',
      rateLimited: 'Rate Limit Exceeded',
      invalidCode: 'Invalid Authorization Code'
    };
    return labels[mode] || mode;
  };

  const getFailureModeDescription = (mode) => {
    const descriptions = {
      userDenial: 'Automatically deny OAuth consent',
      expiredToken: 'Issue tokens that expire in 1 second',
      invalidToken: 'Reject all token validations',
      rateLimited: 'Return 429 rate limit errors',
      invalidCode: 'Reject all authorization codes'
    };
    return descriptions[mode] || '';
  };

  const getAuthUrl = () => {
    return `${API_BASE}/auth/${selectedProvider}/authorize?client_id=my_test_app&redirect_uri=${TEST_CLIENT_BASE}/callback&scope=email%20profile&state=random123`;
  };

  const getTokenUrl = () => {
    return `${API_BASE}/auth/${selectedProvider}/token`;
  };

  const getUserInfoUrl = () => {
    return `${API_BASE}/auth/${selectedProvider}/userinfo`;
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Loading DevAuth Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <Server size={32} />
            <h1>DevAuth Dashboard</h1>
          </div>
          <div className="badge">OAuth Mock Server</div>
        </div>
      </header>

      <div className="container">
        {/* Left Sidebar - Provider Selection & Config */}
        <aside className="sidebar">
          <div className="section">
            <h2>
              <Settings size={20} />
              Select Provider
            </h2>
            <div className="provider-list">
              {providers.map(provider => (
                <button
                  key={provider.id}
                  className={`provider-btn ${selectedProvider === provider.id ? 'active' : ''}`}
                  onClick={() => setSelectedProvider(provider.id)}
                >
                  <span className="provider-icon">
                    {provider.id === 'google' && '🔵'}
                    {provider.id === 'github' && '⚫'}
                    {provider.id === 'microsoft' && '🔷'}
                    {!['google', 'github', 'microsoft'].includes(provider.id) && '🔐'}
                  </span>
                  {provider.name}
                </button>
              ))}
            </div>
          </div>

          <div className="section">
            <button
              onClick={() => setIsIntegrationGuideOpen(!isIntegrationGuideOpen)}
              className="w-full flex items-center justify-between p-0 bg-transparent border-0 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <h2 className="flex items-center gap-2">
                <Code size={20} />
                Integration Guide
              </h2>
              {isIntegrationGuideOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            
            {isIntegrationGuideOpen && (
              <div className="mt-4">
                <div className="info-box">
                  <p><strong>🔐 Proper OAuth Flow:</strong></p>
                  <p>1. Your app generates a random <code>state</code> parameter</p>
                  <p>2. Store the <code>state</code> in your session</p>
                  <p>3. Redirect user to the authorization URL with your <code>state</code></p>
                  <p>4. Validate the <code>state</code> when OAuth redirects back</p>
                </div>

                <div className="url-list">
                  <div className="url-item">
                    <label>1. Authorization Endpoint</label>
                    <div className="url-box">
                      <code>/auth/{selectedProvider}/authorize</code>
                    </div>
                    <div className="endpoint-details">
                      <strong>Query Parameters:</strong>
                      <ul>
                        <li><code>client_id</code> - Your app identifier</li>
                        <li><code>redirect_uri</code> - Your callback URL</li>
                        <li><code>scope</code> - Requested permissions (e.g., "email profile")</li>
                        <li><code>state</code> - Random string for CSRF protection</li>
                      </ul>
                    </div>
                  </div>

                  <div className="url-item">
                    <label>2. Token Endpoint</label>
                    <div className="url-box">
                      <code>/auth/{selectedProvider}/token</code>
                    </div>
                    <div className="endpoint-details">
                      <strong>POST Body (JSON):</strong>
                      <ul>
                        <li><code>code</code> - Authorization code from callback</li>
                        <li><code>client_id</code> - Your app identifier</li>
                        <li><code>redirect_uri</code> - Must match authorization request</li>
                        <li><code>grant_type</code> - "authorization_code"</li>
                      </ul>
                    </div>
                  </div>

                  <div className="url-item">
                    <label>3. UserInfo Endpoint</label>
                    <div className="url-box">
                      <code>/auth/{selectedProvider}/userinfo</code>
                    </div>
                    <div className="endpoint-details">
                      <strong>Header:</strong>
                      <ul>
                        <li><code>Authorization: Bearer YOUR_ACCESS_TOKEN</code></li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="section">
            <button
              onClick={() => setIsQuickTestUrlsOpen(!isQuickTestUrlsOpen)}
              className="w-full flex items-center justify-between p-0 bg-transparent border-0 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <h2>🧪 IMPORTANT: TEST CLIENT URL</h2>
              {isQuickTestUrlsOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            
            {isQuickTestUrlsOpen && (
              <div className="mt-4">
                <div className="info-box" style={{background: '#fff3cd', borderColor: '#ffc107'}}>
                  <p style={{color: '#856404'}}><strong>For production:</strong></p>
                  <p style={{color: '#856404'}}>This URL will direct you to the test-client which will mimic an OAuth page.</p>
                </div>

                <div className="url-list">
                  <div className="url-item">
                    <label>Test Client URL</label>
                    <div className="url-box">
                      <code style={{ fontSize: '0.7rem' }}>
                        {`https://devauth-test-client.onrender.com`}
                      </code>
                      <button 
                        className="copy-btn"
                        onClick={() => copyToClipboard(`https://devauth-test-client.onrender.com`, 'test-auth')}
                        title="Copy URL"
                      >
                        {copied === 'test-auth' ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                    <p style={{fontSize: '0.8rem', color: '#666', marginTop: '0.5rem'}}>
                      Opens test client to landing page, choose your provider to proceed.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content - User Data Editor */}
        <main className="main-content">
          {/* Real-Time OAuth Flow Visualization */}
          <div className="section visualization-section">
            <div className="section-header">
              <h2>
                <Activity size={20} />
                Real-Time OAuth Flow
              </h2>
              <button 
                className="btn btn-secondary"
                onClick={clearOAuthEvents}
                disabled={oauthEvents.length === 0}
              >
                Clear Events
              </button>
            </div>

            {oauthEvents.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">👁️</div>
                <p>Waiting for OAuth activity...</p>
                <p style={{fontSize: '0.875rem', color: '#666', marginTop: '0.5rem'}}>
                  Start an OAuth flow from the test client to see events here in real-time
                </p>
              </div>
            ) : (
              <div className="oauth-flow-viz" ref={flowVizRef}>
                {oauthEvents.map((event, index) => (
                  <div key={index} className={`flow-step ${event.step}`}>
                    <div className="flow-step-icon">{getStepIcon(event.step)}</div>
                    <div className="flow-step-content">
                      <div className="flow-step-header">
                        <span className="flow-step-title">{getStepLabel(event.step)}</span>
                        <span className="flow-step-provider">{event.provider}</span>
                      </div>
                      <div className="flow-step-time">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </div>
                      {Object.keys(event.data).length > 0 && (
                        <div className="flow-step-data">
                          {Object.entries(event.data).map(([key, value]) => (
                            <div key={key} className="data-item">
                              <span className="data-key">{key}:</span>
                              <span className="data-value">{value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Failure Simulation Controls */}
          <div className="section">
            <button
              onClick={() => setIsFailureSimOpen(!isFailureSimOpen)}
              className="w-full flex items-center justify-between p-0 bg-transparent border-0 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <h2>⚠️ Failure Simulation</h2>
              {isFailureSimOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>

            {isFailureSimOpen && (
              <div className="mt-4">
                <div className="info-box" style={{background: '#fff3cd', borderColor: '#ffc107', marginBottom: '1.5rem'}}>
                  <p style={{color: '#856404'}}><strong>🧪 Test Error Handling:</strong></p>
                  <p style={{color: '#856404'}}>Enable these modes to simulate OAuth failures and see how your app handles errors.</p>
                </div>

                <div className="failure-modes">
                  {Object.keys(failureModes).map(mode => (
                    <div key={mode} className="failure-mode-item">
                      <div className="failure-mode-content">
                        <div className="failure-mode-header">
                          <label className="switch">
                            <input
                              type="checkbox"
                              checked={failureModes[mode]}
                              onChange={() => toggleFailureMode(mode)}
                            />
                            <span className="slider"></span>
                          </label>
                          <span className="failure-mode-title">
                            {getFailureModeLabel(mode)}
                          </span>
                        </div>
                        <p className="failure-mode-description">
                          {getFailureModeDescription(mode)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="section">
            <div className="section-header">
              <h2>Mock User Data - {selectedProvider}</h2>
              <div className="actions">
                <button 
                  className="btn btn-secondary"
                  onClick={handleReset}
                >
                  <RefreshCw size={16} />
                  Reset to Default
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={!hasChanges || saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>

            {hasChanges && (
              <div className="alert alert-warning">
                You have unsaved changes
              </div>
            )}

            <div className="form-grid">
              {Object.keys(userData).map(key => (
                <div key={key} className="form-group">
                  <label>{key}</label>
                  <input
                    type="text"
                    value={userData[key] || ''}
                    onChange={(e) => handleInputChange(key, e.target.value)}
                    className="input"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Request Logs */}
          <div className="section">
            <button
              onClick={() => setIsActivityLogOpen(!isActivityLogOpen)}
              className="w-full flex items-center justify-between p-0 bg-transparent border-0 cursor-pointer hover:opacity-80 transition-opacity mb-4"
            >
              <h2>Activity Log</h2>
              {isActivityLogOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            
            {isActivityLogOpen && (
              <div className="logs">
                {logs.length === 0 ? (
                  <div className="empty-state">
                    <p>No activity yet. Make changes to see logs here.</p>
                  </div>
                ) : (
                  logs.map(log => (
                    <div key={log.id} className={`log-item log-${log.type}`}>
                      <span className="log-time">{log.timestamp}</span>
                      <span className="log-message">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;