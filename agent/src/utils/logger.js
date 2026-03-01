/**
 * Logger utility
 * Provides a consistent logging format and functionality
 */
const morgan = require('morgan');

/**
 * Create a custom Morgan format with timestamps and colors
 * @param {string} format - The log format (e.g., 'combined', 'dev', 'common')
 * @returns {Function} Morgan middleware with the specified format
 */
function createLogger(format = 'combined') {
  // Define custom token for timestamps
  morgan.token('timestamp', () => {
    return new Date().toISOString();
  });
  
  // Define custom token for response time with color
  morgan.token('response-time-colored', (req, res) => {
    const time = morgan['response-time'](req, res);
    const ms = parseFloat(time);
    
    // Color based on response time
    if (ms < 100) {
      return `\x1b[32m${time} ms\x1b[0m`; // Green
    } else if (ms < 500) {
      return `\x1b[33m${time} ms\x1b[0m`; // Yellow
    } else {
      return `\x1b[31m${time} ms\x1b[0m`; // Red
    }
  });
  
  // Define custom token for status code with color
  morgan.token('status-colored', (req, res) => {
    const status = res.statusCode;
    
    // Color based on status code
    if (status >= 500) {
      return `\x1b[31m${status}\x1b[0m`; // Red
    } else if (status >= 400) {
      return `\x1b[33m${status}\x1b[0m`; // Yellow
    } else if (status >= 300) {
      return `\x1b[36m${status}\x1b[0m`; // Cyan
    } else {
      return `\x1b[32m${status}\x1b[0m`; // Green
    }
  });
  
  // Define available formats
  const formats = {
    // Standard Apache common log format
    'common': '[:timestamp] :remote-addr - :remote-user ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"',
    
    // Apache combined log format with Referer and User-Agent
    'combined': '[:timestamp] :remote-addr - :remote-user ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"',
    
    // Developer format with colors
    'dev': '[:timestamp] \x1b[36m:method\x1b[0m \x1b[36m:url\x1b[0m :status-colored :response-time-colored',
    
    // Short format
    'short': '[:timestamp] :remote-addr :method :url :status :response-time ms'
  };
  
  // Use the requested format or fall back to combined
  const logFormat = formats[format] || formats['combined'];
  
  return morgan(logFormat);
}

module.exports = {
  createLogger
};