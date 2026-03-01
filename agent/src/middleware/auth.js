/**
 * Authentication middleware
 * Verifies API key for all requests
 */
const crypto = require('crypto');
const config = require('../config');

/**
 * Timing-safe comparison of two strings
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} Whether the strings are equal
 */
function timingSafeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Compare against self to maintain constant time
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * API key authentication middleware
 * Verifies that the request includes a valid API key
 */
function apiKeyAuth(req, res, next) {
  const { apiKey } = config.getConfig();

  // Reject all requests if no API key is configured
  if (!apiKey || apiKey.trim() === '') {
    console.warn('[AUTH] No API key configured, rejecting request');
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: API key not configured on server'
    });
  }

  // Get API key from header, query, or body
  const providedKey =
    req.headers['x-api-key'] ||
    req.query.apiKey ||
    (req.body && req.body.apiKey);

  // Verify the API key using timing-safe comparison
  if (!providedKey || !timingSafeCompare(providedKey, apiKey)) {
    console.warn(`[AUTH] Invalid API key provided from ${req.ip}`);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid API key'
    });
  }

  // API key is valid, continue
  next();
}

/**
 * Socket.IO authentication middleware
 * Verifies that the socket connection includes a valid API key
 */
function socketAuth(socket, next) {
  const { apiKey } = config.getConfig();
  const address = socket.handshake.address;

  // Reject all connections if no API key is configured
  if (!apiKey || apiKey.trim() === '') {
    console.warn('[AUTH] No API key configured, rejecting socket connection');
    return next(new Error('Unauthorized: API key not configured on server'));
  }

  // Get API key from handshake query, auth, or headers
  const queryKey = socket.handshake.query && socket.handshake.query.apiKey;
  const authKey = socket.handshake.auth && socket.handshake.auth.apiKey;
  const headerKey = socket.handshake.headers['x-api-key'];

  const providedKey = queryKey || authKey || headerKey;
  const keySource = queryKey ? 'query' : (authKey ? 'auth' : (headerKey ? 'header' : 'none'));

  // Verify the API key
  if (!providedKey) {
    console.warn(`[AUTH] Socket connection rejected - no API key provided from ${address}`);
    return next(new Error('Unauthorized: No API key provided'));
  }

  if (!timingSafeCompare(providedKey, apiKey)) {
    console.warn(`[AUTH] Socket connection rejected - invalid API key from ${address}`);
    return next(new Error('Unauthorized: Invalid API key'));
  }

  // API key is valid, continue
  console.log(`[AUTH] Socket connection authenticated from ${address} using ${keySource} auth`);
  socket.auth = { authenticated: true, method: keySource };
  next();
}

module.exports = {
  apiKeyAuth,
  socketAuth
};
