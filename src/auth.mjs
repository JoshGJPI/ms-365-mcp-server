import { PublicClientApplication } from '@azure/msal-node';
import keytar from 'keytar';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import logger from './logger.mjs';
import { buildScopesFromEndpoints } from '../index.mjs';

const SERVICE_NAME = 'ms-365-mcp-server';
const TOKEN_CACHE_ACCOUNT = 'msal-token-cache';
const FALLBACK_DIR = path.dirname(fileURLToPath(import.meta.url));
const FALLBACK_PATH = path.join(FALLBACK_DIR, '..', '.ms365-token-cache.json');

class AuthManager {
  constructor(config, scopes = buildScopesFromEndpoints()) {
    logger.info(`Initializing AuthManager with client ID: ${config.auth.clientId}`);
    logger.info(`And scopes are ${scopes.join(', ')}`, scopes);
    this.config = config;
    this.scopes = scopes;
    this.msalApp = new PublicClientApplication(this.config);
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async loadTokenCache() {
    try {
      let cacheData;

      try {
        const cachedData = await keytar.getPassword(SERVICE_NAME, TOKEN_CACHE_ACCOUNT);
        if (cachedData) {
          cacheData = cachedData;
          logger.info('Found token in system keychain');
        }
      } catch (keytarError) {
        logger.warn(`Keychain access failed, falling back to file storage: ${keytarError.message}`);
      }

      if (!cacheData && fs.existsSync(FALLBACK_PATH)) {
        cacheData = fs.readFileSync(FALLBACK_PATH, 'utf8');
        logger.info('Found token in fallback file storage');
      }

      if (cacheData) {
        this.msalApp.getTokenCache().deserialize(cacheData);
        logger.info('Successfully loaded token cache');
      } else {
        logger.info('No existing token cache found, starting fresh');
      }
    } catch (error) {
      logger.error(`Error loading token cache: ${error.message}`);
      // Clear any existing token cache to prevent corrupted data
      try {
        await keytar.deletePassword(SERVICE_NAME, TOKEN_CACHE_ACCOUNT);
        logger.info('Cleared system keychain token due to load error');
      } catch (e) {}
      
      if (fs.existsSync(FALLBACK_PATH)) {
        try {
          fs.unlinkSync(FALLBACK_PATH);
          logger.info('Cleared fallback token file due to load error');
        } catch (e) {}
      }
    }
  }

  async saveTokenCache() {
    try {
      const cacheData = this.msalApp.getTokenCache().serialize();

      try {
        await keytar.setPassword(SERVICE_NAME, TOKEN_CACHE_ACCOUNT, cacheData);
      } catch (keytarError) {
        logger.warn(`Keychain save failed, falling back to file storage: ${keytarError.message}`);

        fs.writeFileSync(FALLBACK_PATH, cacheData);
      }
    } catch (error) {
      logger.error(`Error saving token cache: ${error.message}`);
    }
  }

  async getToken(forceRefresh = false) {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > Date.now() && !forceRefresh) {
      return this.accessToken;
    }

    const accounts = await this.msalApp.getTokenCache().getAllAccounts();

    if (accounts.length > 0) {
      const silentRequest = {
        account: accounts[0],
        scopes: this.scopes,
      };

      try {
        const response = await this.msalApp.acquireTokenSilent(silentRequest);
        this.accessToken = response.accessToken;
        this.tokenExpiry = new Date(response.expiresOn).getTime();
        return this.accessToken;
      } catch (error) {
        logger.info('Silent token acquisition failed, using device code flow');
      }
    }

    throw new Error('No valid token found');
  }

  async acquireTokenByDeviceCode(hack) {
    // First clear any existing tokens to ensure a fresh start
    try {
      await this.logout();
      logger.info('Cleared existing tokens for fresh login');
    } catch (logoutError) {
      logger.warn(`Error during pre-login cleanup: ${logoutError.message}`);
    }
    
    // Log the configuration for debugging
    logger.info('MSAL Authentication Configuration:');
    logger.info(`Client ID: ${this.config.auth.clientId}`);
    logger.info(`Authority: ${this.config.auth.authority}`);
    logger.info(`Scopes: ${this.scopes.join(', ')}`);
    
    // Try with a simplified scope set for debugging
    const reducedScopes = ['User.Read'];
    logger.info(`Attempting with reduced scopes: ${reducedScopes.join(', ')}`);
    
    const deviceCodeRequest = {
      scopes: reducedScopes, // Just try with minimal scopes
      deviceCodeCallback: (response) => {
        logger.info(`Device code details: ${JSON.stringify(response)}`);
        
        // Forward the complete device code response to the user
        if (hack) {
          hack('Microsoft login required:\n\n' + 
               `${response.message}\n\n` +
               'After completing authentication in your browser, run the "ms365-verify-login" command');
        } else {
          console.log(response.message);
        }
        logger.info('Device code login initiated');
      },
    };

    try {
      logger.info('Requesting device code...');
      const response = await this.msalApp.acquireTokenByDeviceCode(deviceCodeRequest);
      logger.info('Device code login successful');
      this.accessToken = response.accessToken;
      this.tokenExpiry = new Date(response.expiresOn).getTime();
      await this.saveTokenCache();
      return this.accessToken;
    } catch (error) {
      logger.error(`Error in device code flow: ${error.message}`);
      
      // Log extended error details
      if (error.errorCode) {
        logger.error(`Error details: ${JSON.stringify({
          errorCode: error.errorCode,
          errorMessage: error.errorMessage,
          subError: error.subError || 'none',
          correlationId: error.correlationId || 'none'
        })}`);
      }
      
      // Check if it's a client ID issue
      if (error.errorCode === 'invalid_client') {
        logger.error('Invalid client ID - check your Azure AD app registration');
      }
      // Check if it's a scope issue
      else if (error.errorMessage && error.errorMessage.includes('scope')) {
        logger.error('Scope issue detected - the app might not have the requested permissions');
      }
      // Check if it's a network issue
      else if (error.errorCode === 'network_error') {
        logger.error('Network error detected - check your internet connection and firewall');
      }
      
      throw error;
    }
  }

  async testLogin() {
    try {
      logger.info('Testing login...');
      const token = await this.getToken();

      if (!token) {
        logger.error('Login test failed - no token received');
        return {
          success: false,
          message: 'Login failed - no token received',
        };
      }

      logger.info('Token retrieved successfully, testing Graph API access...');

      try {
        const response = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const userData = await response.json();
          logger.info('Graph API user data fetch successful');
          return {
            success: true,
            message: 'Login successful',
            userData: {
              displayName: userData.displayName,
              userPrincipalName: userData.userPrincipalName,
            },
          };
        } else {
          const errorText = await response.text();
          logger.error(`Graph API user data fetch failed: ${response.status} - ${errorText}`);
          return {
            success: false,
            message: `Login successful but Graph API access failed: ${response.status}`,
          };
        }
      } catch (graphError) {
        logger.error(`Error fetching user data: ${graphError.message}`);
        return {
          success: false,
          message: `Login successful but Graph API access failed: ${graphError.message}`,
        };
      }
    } catch (error) {
      logger.error(`Login test failed: ${error.message}`);
      return {
        success: false,
        message: `Login failed: ${error.message}`,
      };
    }
  }

  async logout() {
    try {
      const accounts = await this.msalApp.getTokenCache().getAllAccounts();
      for (const account of accounts) {
        await this.msalApp.getTokenCache().removeAccount(account);
      }
      this.accessToken = null;
      this.tokenExpiry = null;

      try {
        await keytar.deletePassword(SERVICE_NAME, TOKEN_CACHE_ACCOUNT);
      } catch (keytarError) {
        logger.warn(`Keychain deletion failed: ${keytarError.message}`);
      }

      if (fs.existsSync(FALLBACK_PATH)) {
        fs.unlinkSync(FALLBACK_PATH);
      }

      return true;
    } catch (error) {
      logger.error(`Error during logout: ${error.message}`);
      throw error;
    }
  }
}

export default AuthManager;