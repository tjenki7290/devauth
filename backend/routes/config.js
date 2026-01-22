const express = require('express');
const router = express.Router();
const configManager = require('../utils/configManager');

// Get all providers
router.get('/providers', (req, res) => {
  try {
    const summary = configManager.getProvidersSummary();
    res.json({
      success: true,
      providers: summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get specific provider configuration
router.get('/providers/:provider', (req, res) => {
  const { provider } = req.params;
  
  try {
    const config = configManager.getProviderConfig(provider);
    
    if (!config) {
      return res.status(404).json({
        success: false,
        error: `Provider '${provider}' not found`
      });
    }

    res.json({
      success: true,
      provider: provider,
      config: config
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get user data for a provider
router.get('/providers/:provider/userdata', (req, res) => {
  const { provider } = req.params;
  
  try {
    const userData = configManager.getUserData(provider);
    
    if (!userData) {
      return res.status(404).json({
        success: false,
        error: `Provider '${provider}' not found`
      });
    }

    res.json({
      success: true,
      provider: provider,
      userData: userData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update user data for a provider
router.put('/providers/:provider/userdata', (req, res) => {
  const { provider } = req.params;
  const userData = req.body;
  
  try {
    const updatedData = configManager.updateUserData(provider, userData);
    
    res.json({
      success: true,
      provider: provider,
      userData: updatedData,
      message: `User data updated for ${provider}`
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Reset provider to defaults
router.post('/providers/:provider/reset', (req, res) => {
  const { provider } = req.params;
  
  try {
    const resetConfig = configManager.resetProvider(provider);
    
    res.json({
      success: true,
      provider: provider,
      config: resetConfig,
      message: `Provider '${provider}' reset to defaults`
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Reset all providers to defaults
router.post('/reset-all', (req, res) => {
  try {
    configManager.resetAll();
    
    res.json({
      success: true,
      message: 'All providers reset to defaults'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Add custom provider
router.post('/providers', (req, res) => {
  const { providerId, name, scopes, userData } = req.body;
  
  if (!providerId) {
    return res.status(400).json({
      success: false,
      error: 'providerId is required'
    });
  }

  try {
    const newProvider = configManager.addCustomProvider(providerId, {
      name,
      scopes,
      userData
    });
    
    res.status(201).json({
      success: true,
      provider: providerId,
      config: newProvider,
      message: `Custom provider '${providerId}' created`
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get failure modes
router.get('/failure-modes', (req, res) => {
  try {
    const modes = configManager.getFailureModes();
    res.json({
      success: true,
      failureModes: modes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Toggle failure mode
router.put('/failure-modes/:mode', (req, res) => {
  const { mode } = req.params;
  const { enabled } = req.body;

  try {
    const modes = configManager.setFailureMode(mode, enabled);
    res.json({
      success: true,
      failureModes: modes,
      message: `Failure mode '${mode}' ${enabled ? 'enabled' : 'disabled'}`
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Reset all failure modes
router.post('/failure-modes/reset', (req, res) => {
  try {
    const modes = configManager.resetFailureModes();
    res.json({
      success: true,
      failureModes: modes,
      message: 'All failure modes reset'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;