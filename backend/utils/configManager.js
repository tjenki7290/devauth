// Configuration Manager for DevAuth
// Manages provider configurations and mock user data

class ConfigManager {
  constructor() {
    // Default configurations for each provider
    this.defaultConfigs = {
      google: {
        name: 'Google',
        authorizationEndpoint: '/auth/google/authorize',
        tokenEndpoint: '/auth/google/token',
        userInfoEndpoint: '/auth/google/userinfo',
        scopes: ['email', 'profile', 'openid'],
        defaultUserData: {
          sub: '1234567890',
          email: 'test@gmail.com',
          email_verified: true,
          name: 'Test User',
          given_name: 'Test',
          family_name: 'User',
          picture: 'https://via.placeholder.com/150',
          locale: 'en'
        }
      },
      github: {
        name: 'GitHub',
        authorizationEndpoint: '/auth/github/authorize',
        tokenEndpoint: '/auth/github/token',
        userInfoEndpoint: '/auth/github/userinfo',
        scopes: ['user', 'user:email', 'read:user'],
        defaultUserData: {
          id: 9876543210,
          login: 'testuser',
          name: 'Test User',
          email: 'test@github.com',
          avatar_url: 'https://via.placeholder.com/150',
          bio: 'Mock GitHub User',
          location: 'San Francisco, CA',
          company: 'DevAuth Inc',
          public_repos: 42,
          followers: 100,
          following: 50
        }
      },
      microsoft: {
        name: 'Microsoft',
        authorizationEndpoint: '/auth/microsoft/authorize',
        tokenEndpoint: '/auth/microsoft/token',
        userInfoEndpoint: '/auth/microsoft/userinfo',
        scopes: ['openid', 'profile', 'email', 'User.Read'],
        defaultUserData: {
          id: '1111-2222-3333-4444',
          userPrincipalName: 'test@outlook.com',
          displayName: 'Test User',
          givenName: 'Test',
          surname: 'User',
          mail: 'test@outlook.com',
          jobTitle: 'Software Engineer',
          officeLocation: 'Seattle'
        }
      }
    };

    // Active configurations (starts with defaults)
    this.activeConfigs = JSON.parse(JSON.stringify(this.defaultConfigs));

    // Failure simulation modes
    this.failureModes = {
      userDenial: false,
      expiredToken: false,
      invalidToken: false,
      rateLimited: false,
      invalidCode: false
    };
  }

  // Get all available providers
  getProviders() {
    return Object.keys(this.activeConfigs);
  }

  // Get configuration for a specific provider
  getProviderConfig(provider) {
    return this.activeConfigs[provider] || null;
  }

  // Get user data for a specific provider
  getUserData(provider) {
    const config = this.activeConfigs[provider];
    return config ? config.defaultUserData : null;
  }

  // Update user data for a specific provider
  updateUserData(provider, userData) {
    if (!this.activeConfigs[provider]) {
      throw new Error(`Provider '${provider}' not found`);
    }

    // Merge with existing data
    this.activeConfigs[provider].defaultUserData = {
      ...this.activeConfigs[provider].defaultUserData,
      ...userData
    };

    return this.activeConfigs[provider].defaultUserData;
  }

  // Reset provider to default configuration
  resetProvider(provider) {
    if (!this.defaultConfigs[provider]) {
      throw new Error(`Provider '${provider}' not found`);
    }

    this.activeConfigs[provider] = JSON.parse(
      JSON.stringify(this.defaultConfigs[provider])
    );

    return this.activeConfigs[provider];
  }

  // Reset all providers to defaults
  resetAll() {
    this.activeConfigs = JSON.parse(JSON.stringify(this.defaultConfigs));
    return this.activeConfigs;
  }

  // Add a custom provider
  addCustomProvider(providerId, config) {
    if (this.activeConfigs[providerId]) {
      throw new Error(`Provider '${providerId}' already exists`);
    }

    this.activeConfigs[providerId] = {
      name: config.name || providerId,
      authorizationEndpoint: `/auth/${providerId}/authorize`,
      tokenEndpoint: `/auth/${providerId}/token`,
      userInfoEndpoint: `/auth/${providerId}/userinfo`,
      scopes: config.scopes || ['email', 'profile'],
      defaultUserData: config.userData || {}
    };

    return this.activeConfigs[providerId];
  }

  // Get all configurations
  getAllConfigs() {
    return this.activeConfigs;
  }

  // Get summary of all providers
  getProvidersSummary() {
    return Object.keys(this.activeConfigs).map(key => ({
      id: key,
      name: this.activeConfigs[key].name,
      scopes: this.activeConfigs[key].scopes,
      endpoints: {
        authorize: this.activeConfigs[key].authorizationEndpoint,
        token: this.activeConfigs[key].tokenEndpoint,
        userinfo: this.activeConfigs[key].userInfoEndpoint
      }
    }));
  }

  // Failure mode management
  getFailureModes() {
    return this.failureModes;
  }

  setFailureMode(mode, enabled) {
    if (this.failureModes.hasOwnProperty(mode)) {
      this.failureModes[mode] = enabled;
      return this.failureModes;
    }
    throw new Error(`Unknown failure mode: ${mode}`);
  }

  isFailureModeEnabled(mode) {
    return this.failureModes[mode] || false;
  }

  resetFailureModes() {
    this.failureModes = {
      userDenial: false,
      expiredToken: false,
      invalidToken: false,
      rateLimited: false,
      invalidCode: false
    };
    return this.failureModes;
  }
}

// Export singleton instance
module.exports = new ConfigManager();