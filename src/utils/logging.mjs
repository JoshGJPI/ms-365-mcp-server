// Helper function for safe logging in MCP - ensures all console output is valid JSON
export function safeLog(message, data) {
  // Use process.stderr.write to write a properly formatted JSON message to stderr
  // This avoids the console.log mechanism that's causing the JSON parsing errors
  const logMessage = {
    type: 'log',
    message,
    data: data !== undefined ? (typeof data === 'object' ? JSON.stringify(data) : String(data)) : undefined
  };
  
  // Only log in development mode to avoid cluttering the output
  if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
    process.stderr.write(JSON.stringify(logMessage) + '\n');
  }
}

// Safe error logging
export function safeError(message, error) {
  const logMessage = {
    type: 'error',
    message,
    error: error ? (error.message || String(error)) : undefined
  };
  
  // Always log errors, regardless of environment
  process.stderr.write(JSON.stringify(logMessage) + '\n');
}

// Safe warning logging
export function safeWarn(message, data) {
  const logMessage = {
    type: 'warn',
    message,
    data: data !== undefined ? (typeof data === 'object' ? JSON.stringify(data) : String(data)) : undefined
  };
  
  // Only log in development mode to avoid cluttering the output
  if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
    process.stderr.write(JSON.stringify(logMessage) + '\n');
  }
}
