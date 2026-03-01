/**
 * Query Service
 * Provides API for Minecraft server querying
 */
const QueryClient = require('../models/QueryClient');

class QueryService {
  constructor() {
    // Cache for query results to avoid spamming servers
    this.cache = new Map();
    
    // Cache expiration time (1 minute)
    this.cacheExpiry = 60 * 1000;
    
    // Cache cleanup interval
    this.cleanupInterval = setInterval(() => this._cleanupCache(), 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Execute a query to a Minecraft server
   * @param {string} host - Server hostname or IP
   * @param {number} port - Server port
   * @param {string} mode - Query mode ('basic' or 'full')
   * @param {boolean} [bypassCache=false] - Whether to bypass the cache
   * @returns {Promise<Object>} A promise that resolves with server information
   */
  async query(host, port, mode = 'basic', bypassCache = false) {
    // Validate input
    if (!host) {
      throw new Error('Missing required host parameter');
    }
    
    port = parseInt(port, 10) || 25565;
    
    // Check cache unless bypassing
    if (!bypassCache) {
      const cached = this._getFromCache(host, port, mode);
      if (cached) {
        return cached;
      }
    }
    
    try {
      // Create a new query client
      const client = new QueryClient(host, port);
      
      // Execute the query based on mode
      let result;
      if (mode === 'full') {
        result = await client.fullQuery();
      } else {
        result = await client.basicQuery();
      }
      
      // Cache the result
      this._addToCache(host, port, mode, result);
      
      return result;
    } catch (err) {
      throw new Error(`Query failed: ${err.message}`);
    }
  }

  /**
   * Get a result from the cache
   * @param {string} host - Server hostname or IP
   * @param {number} port - Server port
   * @param {string} mode - Query mode
   * @returns {Object|null} The cached result or null if not found or expired
   * @private
   */
  _getFromCache(host, port, mode) {
    const key = `${host}:${port}:${mode}`;
    const cached = this.cache.get(key);
    
    if (cached && (Date.now() - cached.timestamp < this.cacheExpiry)) {
      console.log(`[QUERY-SERVICE] Using cached result for ${key}`);
      return cached.data;
    }
    
    return null;
  }

  /**
   * Add a result to the cache
   * @param {string} host - Server hostname or IP
   * @param {number} port - Server port
   * @param {string} mode - Query mode
   * @param {Object} data - The query result
   * @private
   */
  _addToCache(host, port, mode, data) {
    const key = `${host}:${port}:${mode}`;
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clean up expired cache entries
   * @private
   */
  _cleanupCache() {
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheExpiry) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Shut down the service and clean up resources
   */
  shutdown() {
    console.log('[QUERY-SERVICE] Shutting down Query service');
    
    // Clear cleanup interval
    clearInterval(this.cleanupInterval);
    
    // Clear cache
    this.cache.clear();
  }
}

module.exports = new QueryService();