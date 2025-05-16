#!/usr/bin/env node

// Load environment variables from .env file
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';
import keytar from 'keytar';
import { safeLog, safeError, safeWarn } from './src/utils/logging.mjs';

// Setup path for .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = resolve(__dirname, '.env');

// Load environment variables from .env file
const result = dotenv.config({ path: envPath });

if (result.error) {
  safeError(`Error loading .env file: ${result.error.message}`);
} else {
  safeLog(`Loaded environment variables from ${envPath}`);
}

import { parseArgs } from './src/cli.mjs';
import logger from './src/logger.mjs';
import AuthManager from './src/auth.mjs';
import MicrosoftGraphServer from './src/server.mjs';
import { version } from './src/version.mjs';

// Troubleshooting function to check environment and clear tokens
async function troubleshootLogin() {
  logger.info('Running MS365 troubleshooting...');
  
  // Check .env file
  if (fs.existsSync(envPath)) {
    logger.info(`Found .env file at ${envPath}`);
    const envContent = fs.readFileSync(envPath, 'utf8');
    logger.info(`Contents of .env file:\n${envContent}`);
  } else {
    logger.error(`No .env file found at ${envPath}`);
  }
  
  // Check environment variables
  if (!process.env.MS365_CLIENT_ID) {
    logger.error('MS365_CLIENT_ID environment variable is not set');
  } else {
    logger.info(`MS365_CLIENT_ID is set to: ${process.env.MS365_CLIENT_ID}`);
  }
  
  // Check for token cache files
  const cachePath = resolve(__dirname, '.ms365-token-cache.json');
  if (fs.existsSync(cachePath)) {
    logger.info(`Token cache file exists at ${cachePath}`);
    try {
      fs.unlinkSync(cachePath);
      logger.info('Removed token cache file');
    } catch (error) {
      logger.error(`Failed to remove token cache file: ${error.message}`);
    }
  } else {
    logger.info('No token cache file found');
  }
  
  // Check keychain
  try {
    const hasToken = await keytar.getPassword('ms-365-mcp-server', 'msal-token-cache');
    if (hasToken) {
      logger.info('Token found in system keychain');
      try {
        await keytar.deletePassword('ms-365-mcp-server', 'msal-token-cache');
        logger.info('Removed token from keychain');
      } catch (deleteError) {
        logger.error(`Failed to remove token from keychain: ${deleteError.message}`);
      }
    } else {
      logger.info('No token found in system keychain');
    }
  } catch (keytarError) {
    logger.warn(`Keychain access failed: ${keytarError.message}`);
  }
  
  // Check for BQE tokens that might interfere
  try {
    const hasBqeToken = await keytar.getPassword('bqe-core-mcp', 'bqe-core-token');
    if (hasBqeToken) {
      logger.warn('BQE CORE token found in system keychain - this might interfere with MS365 login');
    } else {
      logger.info('No BQE CORE token found in system keychain');
    }
  } catch (keytarError) {
    logger.warn(`BQE keychain check failed: ${keytarError.message}`);
  }
  
  // Log test info for MSAL configuration
  logger.info('MSAL Configuration Info:');
  const msalConfig = {
    clientId: process.env.MS365_CLIENT_ID || 'NOT SET',
    authority: 'https://login.microsoftonline.com/common',
  };
  logger.info(JSON.stringify(msalConfig, null, 2));
  
  const result = { message: 'Troubleshooting completed and tokens cleared' };
  safeLog('Troubleshooting completed', result);
  return result;
}

async function main() {
  try {
    const args = parseArgs();

    // Handle troubleshoot command
    if (args.troubleshoot) {
      const result = await troubleshootLogin();
      safeLog('Troubleshooting result', result);
      process.exit(0);
    }

    const authManager = new AuthManager();
    await authManager.loadTokenCache();

    if (args.login) {
      await authManager.acquireTokenByDeviceCode();
      logger.info('Login completed, testing connection with Graph API...');
      const result = await authManager.testLogin();
      safeLog('Login result', result);
      process.exit(0);
    }

    if (args.verifyLogin) {
      logger.info('Verifying MS365 login...');
      const result = await authManager.testLogin();
      safeLog('Verification result', result);
      process.exit(0);
    }

    if (args.logout) {
      await authManager.logout();
      safeLog('Logout result', { message: 'Logged out successfully' });
      process.exit(0);
    }

    const server = new MicrosoftGraphServer(authManager, args);
    await server.initialize(version);
    await server.start();
  } catch (error) {
    logger.error(`Startup error: ${error}`);
    safeError('Startup error', error);
    process.exit(1);
  }
}

main();
