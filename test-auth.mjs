#!/usr/bin/env node

// Basic test script for Microsoft 365 device code authentication
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { PublicClientApplication } from '@azure/msal-node';
import fs from 'fs';

// Setup path for .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = resolve(__dirname, '.env');

// Load environment variables from .env file
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error(`Error loading .env file: ${result.error.message}`);
  process.exit(1);
} else {
  console.log(`Loaded environment variables from ${envPath}`);
  console.log(`MS365_CLIENT_ID: ${process.env.MS365_CLIENT_ID || 'NOT SET'}`);
}

// Simple MSAL configuration
const msalConfig = {
  auth: {
    clientId: process.env.MS365_CLIENT_ID,
    authority: 'https://login.microsoftonline.com/common',
  },
};

// Minimal scope for testing
const scopes = ['User.Read'];

async function testLogin() {
  console.log('Starting Microsoft 365 authentication test');
  console.log(`Using client ID: ${msalConfig.auth.clientId}`);
  console.log(`Using scopes: ${scopes.join(', ')}`);
  
  try {
    // Initialize MSAL app
    const msalApp = new PublicClientApplication(msalConfig);
    
    // Set up device code request
    const deviceCodeRequest = {
      scopes: scopes,
      deviceCodeCallback: (response) => {
        console.log('\n------ AUTHENTICATION REQUIRED ------');
        console.log(response.message);
        console.log('-----------------------------------\n');
      },
    };
    
    console.log('Requesting device code...');
    const response = await msalApp.acquireTokenByDeviceCode(deviceCodeRequest);
    
    console.log('Authentication successful!');
    console.log(`Access token acquired (first 10 chars): ${response.accessToken.substring(0, 10)}...`);
    console.log(`Token expires: ${new Date(response.expiresOn).toLocaleString()}`);
    
    return response;
  } catch (error) {
    console.error('Authentication error:');
    console.error(`Error code: ${error.errorCode || 'N/A'}`);
    console.error(`Error message: ${error.errorMessage || error.message || 'Unknown error'}`);
    
    if (error.errorCode === 'invalid_client') {
      console.error('The client ID appears to be invalid or not recognized by Azure AD.');
    } else if (error.errorMessage && error.errorMessage.includes('invalid_grant')) {
      console.error('Invalid grant error - this typically occurs when:');
      console.error('1. The app registration is not configured correctly in Azure AD');
      console.error('2. The requested scopes are not allowed for this application');
      console.error('3. Tenant policy restrictions might be blocking this authentication flow');
    }
    
    throw error;
  }
}

// Run the test
testLogin()
  .then(() => {
    console.log('Test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Test failed');
    process.exit(1);
  });
