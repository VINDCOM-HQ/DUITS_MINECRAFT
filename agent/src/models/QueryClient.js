/**
 * Query Client Model
 * Handles UDP query requests to Minecraft servers for status information
 * 
 * This implementation uses the proper Minecraft Query Protocol (not Legacy Server List Ping)
 */
const dgram = require('dgram');
const crypto = require('crypto');
const dns = require('dns');
const { v4: uuidv4 } = require('uuid');

function makeSessionId() {
  // Generate a 32-bit signed integer, then mask to low 4 bits per byte for compatibility
  let id = crypto.randomBytes(4).readInt32BE(0);
  return (id & 0x0f0f0f0f) >> 0;
}

class QueryClient {
  constructor(host, port) {
    this.id = uuidv4();
    this.host = host.trim();
    this.port = port || 25565;
    this.socket = null;
    this.timeout = 10000; // 10 seconds timeout
    this.session = makeSessionId();
    this.lastActivity = Date.now();
  }

  /**
   * Execute a basic query to get minimal server information
   * @returns {Promise<Object>} A promise that resolves with server information
   */
  async basicQuery() {
    try {
      console.log(`[QUERY:${this.id}] Executing basic query to ${this.host}:${this.port}`);
      this.lastActivity = Date.now();
      
      // Resolve SRV records if this is a hostname (not IP)
      await this._resolveSrv();
      console.log(`[QUERY:${this.id}] Using ${this.host}:${this.port} for query`);
      
      // Create a UDP socket with error handling
      this.socket = dgram.createSocket({
        type: 'udp4',
        reuseAddr: true
      });
      
      // Execute the query with proper protocol
      const info = await this._queryBasic();
      
      console.log(`[QUERY:${this.id}] Basic query successful`);
      return info;
    } catch (err) {
      console.error(`[QUERY:${this.id}] Basic query failed:`, err.message);
      throw err;
    } finally {
      this.close();
    }
  }
  
  /**
   * Execute a full query to get detailed server information
   * @returns {Promise<Object>} A promise that resolves with detailed server information
   */
  async fullQuery() {
    try {
      console.log(`[QUERY:${this.id}] Executing full query to ${this.host}:${this.port}`);
      this.lastActivity = Date.now();
      
      // Resolve SRV records if this is a hostname (not IP)
      await this._resolveSrv();
      console.log(`[QUERY:${this.id}] Using ${this.host}:${this.port} for query`);
      
      // Create a UDP socket with error handling
      this.socket = dgram.createSocket({
        type: 'udp4',
        reuseAddr: true
      });
      
      // Execute the query with proper protocol
      const info = await this._queryFull();
      
      console.log(`[QUERY:${this.id}] Full query successful`);
      return info;
    } catch (err) {
      console.error(`[QUERY:${this.id}] Full query failed:`, err.message);
      throw err;
    } finally {
      this.close();
    }
  }
  
  /**
   * Close the UDP socket
   */
  close() {
    if (this.socket) {
      try {
        this.socket.close();
        console.log(`[QUERY:${this.id}] Socket closed`);
      } catch (err) {
        console.error(`[QUERY:${this.id}] Error closing socket:`, err.message);
      }
      this.socket = null;
    }
  }
  
  /**
   * Resolve SRV records for Minecraft servers
   * @private
   */
  async _resolveSrv() {
    // Skip SRV lookup for direct IP addresses
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(this.host)) {
      return;
    }
    
    try {
      const records = await new Promise((resolve) => {
        dns.resolveSrv(`_minecraft._tcp.${this.host}`, (err, records) => {
          if (err || !records || records.length === 0) {
            console.log(`[QUERY:${this.id}] No SRV records found for ${this.host}`);
            return resolve(null);
          }
          resolve(records);
        });
      });
      
      if (records && records.length > 0) {
        const rec = records[0]; // Use the first record
        console.log(`[QUERY:${this.id}] Found SRV record: ${rec.name}:${rec.port}`);
        this.host = rec.name;
        this.port = rec.port;
      }
    } catch (err) {
      console.warn(`[QUERY:${this.id}] SRV lookup error:`, err.message);
      // Continue with original host/port
    }
  }
  
  /**
   * Send buffer and await a single UDP response
   * @private
   * @param {Buffer} buffer - The buffer to send
   * @returns {Promise<Buffer>} A promise that resolves with the response buffer
   */
  _sendAndReceive(buffer) {
    return new Promise((resolve, reject) => {
      // Create a timeout for the request
      const timer = setTimeout(() => {
        console.error(`[QUERY:${this.id}] Request timed out after ${this.timeout}ms`);
        this.socket.removeAllListeners('message');
        reject(new Error(`Query timed out after ${this.timeout}ms`));
      }, this.timeout);
      
      // Set up the message listener
      this.socket.once('message', (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      
      // Set up error listener
      this.socket.once('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      
      // Send the request
      console.log(`[QUERY:${this.id}] Sending ${buffer.length} bytes to ${this.host}:${this.port}`);
      this.socket.send(buffer, 0, buffer.length, this.port, this.host, (err) => {
        if (err) {
          clearTimeout(timer);
          reject(err);
        }
      });
    });
  }
  
  /**
   * Perform handshake to get challenge token
   * @private
   * @returns {Promise<number>} A promise that resolves with the challenge token
   */
  async _handshake() {
    console.log(`[QUERY:${this.id}] Sending handshake to ${this.host}:${this.port}`);
    
    // Create handshake packet:
    // 0xFEFD - Magic number
    // 0x09 - Handshake type
    // (int) session ID
    const buf = Buffer.alloc(7);
    buf.writeUInt16BE(0xFEFD, 0);
    buf.writeUInt8(0x09, 2);
    buf.writeInt32BE(this.session, 3);
    
    // Send handshake and receive response
    const msg = await this._sendAndReceive(buf);
    
    // Parse response:
    // 0x09 - Handshake response type
    // (int) matching session ID
    // (string) challenge token as ASCII string
    if (msg[0] !== 0x09) {
      throw new Error(`Invalid handshake response, type ${msg[0]}`);
    }
    
    const serverSession = msg.readInt32BE(1);
    if (serverSession !== this.session) {
      throw new Error('Session ID mismatch in handshake response');
    }
    
    // Extract challenge token (ASCII string)
    const tokenStr = msg.toString('ascii', 5, msg.length - 1);
    const token = parseInt(tokenStr, 10);
    
    if (isNaN(token)) {
      throw new Error('Invalid challenge token');
    }
    
    console.log(`[QUERY:${this.id}] Handshake successful, token: ${token}`);
    return token;
  }
  
  /**
   * Execute basic query using Minecraft query protocol
   * @private
   * @returns {Promise<Object>} A promise that resolves with basic server information
   */
  async _queryBasic() {
    console.log(`[QUERY:${this.id}] Starting basic query protocol`);
    
    // Get challenge token from handshake
    const token = await this._handshake();
    
    // Create basic stat request:
    // 0xFEFD - Magic number
    // 0x00 - Stat type
    // (int) session ID
    // (int) challenge token
    const buf = Buffer.alloc(11);
    buf.writeUInt16BE(0xFEFD, 0);
    buf.writeUInt8(0x00, 2);
    buf.writeInt32BE(this.session, 3);
    buf.writeInt32BE(token, 7);
    
    // Send stat request and receive response
    const msg = await this._sendAndReceive(buf);
    
    // Parse response:
    // 0x00 - Stat response type
    // (int) matching session ID
    // (payload) null-terminated strings
    if (msg[0] !== 0x00) {
      throw new Error(`Invalid basic stat response, type ${msg[0]}`);
    }
    
    const serverSession = msg.readInt32BE(1);
    if (serverSession !== this.session) {
      throw new Error('Session ID mismatch in basic stat response');
    }
    
    // Parse payload as series of null-terminated strings
    let offset = 5;
    
    // Helper to read null-terminated strings
    const readString = () => {
      let end = offset;
      while (msg[end] !== 0x00 && end < msg.length) end++;
      const str = msg.toString('utf8', offset, end);
      offset = end + 1;
      return str;
    };
    
    // Read strings in order (MOTD, game type, map, player count, max players)
    const motd = readString();
    const gameType = readString();
    const map = readString();
    const numPlayers = readString();
    const maxPlayers = readString();
    
    // Read host port (little-endian short)
    const hostPort = offset + 2 <= msg.length ? msg.readUInt16LE(offset) : this.port;
    offset += 2;
    
    // Read host IP if available
    const hostIp = offset < msg.length ? readString() : this.host;
    
    // Prepare normalized result to match non-agent response format
    const result = {
      hostname: motd,
      gameType: gameType,
      map: map,
      numPlayers: numPlayers,
      maxPlayers: maxPlayers,
      hostPort: hostPort,
      hostIp: hostIp,
      version: 'Unknown', // Not available in basic query
      
      // Also include fields from original lib/query.js format
      motd: motd, // This is needed for compatibility with some codepaths
      players: { 
        online: numPlayers, 
        max: maxPlayers 
      }
    };
    
    console.log(`[QUERY:${this.id}] Basic query completed: ${result.hostname}, Players: ${result.numPlayers}/${result.maxPlayers}`);
    return result;
  }
  
  /**
   * Execute full query using Minecraft query protocol
   * @private
   * @returns {Promise<Object>} A promise that resolves with detailed server information
   */
  async _queryFull() {
    console.log(`[QUERY:${this.id}] Starting full query protocol`);
    
    // Get challenge token from handshake
    const token = await this._handshake();
    
    // Create full stat request:
    // 0xFEFD - Magic number
    // 0x00 - Stat type
    // (int) session ID
    // (int) challenge token
    // 0x00000000 - Padding
    const buf = Buffer.alloc(15);
    buf.writeUInt16BE(0xFEFD, 0);
    buf.writeUInt8(0x00, 2);
    buf.writeInt32BE(this.session, 3);
    buf.writeInt32BE(token, 7);
    buf.writeInt32BE(0, 11); // Padding
    
    // Send stat request and receive response with detailed logging
    console.log(`[QUERY:${this.id}] Sending full stat packet`);
    const msg = await this._sendAndReceive(buf);
    console.log(`[QUERY:${this.id}] Received full stat response, ${msg.length} bytes`);
    
    // Log the first few bytes for debugging
    const headerBytes = msg.slice(0, Math.min(16, msg.length));
    console.log(`[QUERY:${this.id}] Response header bytes:`, headerBytes);
    
    // Parse response:
    // 0x00 - Stat response type
    // (int) matching session ID
    // (payload) key-value pairs followed by player list
    if (msg[0] !== 0x00) {
      throw new Error(`Invalid full stat response, type ${msg[0]}`);
    }
    
    const serverSession = msg.readInt32BE(1);
    if (serverSession !== this.session) {
      throw new Error('Session ID mismatch in full stat response');
    }
    
    // Skip the stat type byte and session ID (5 bytes) plus 11 bytes of padding
    // IMPORTANT: This MUST match the offset used in the lib/query.js implementation
    let offset = 5 + 11; // Exactly matching the non-agent implementation
    console.log(`[QUERY:${this.id}] Using standard offset ${offset} for key-value pairs (matching non-agent implementation)`);
    
    // DO NOT look for splitnum header - the client implementation doesn't do this
    
    // Read key-value pairs
    const data = {};
    
    // Helper to read a null-terminated string with bounds checking
    const readString = () => {
      if (offset >= msg.length) {
        console.warn(`[QUERY:${this.id}] Attempted to read beyond message bounds at offset ${offset}/${msg.length}`);
        return '';
      }
      
      let end = offset;
      while (end < msg.length && msg[end] !== 0x00) end++;
      
      // If we hit the end without a null terminator, use the end of the buffer
      if (end >= msg.length) {
        console.warn(`[QUERY:${this.id}] No null terminator found, using end of buffer`);
        end = msg.length;
      }
      
      const str = msg.toString('utf8', offset, end);
      offset = end + 1; // Skip the null terminator
      return str;
    };
    
    // Log parsing position for debugging
    console.log(`[QUERY:${this.id}] Starting to read key-value pairs at offset ${offset}/${msg.length}`);
    
    // Match the exact parsing algorithm from the non-agent implementation
    while (true) {
      let start = offset;
      while (offset < msg.length && msg[offset] !== 0x00) offset++;
      if (offset === start) { 
        offset++; 
        console.log(`[QUERY:${this.id}] Found empty key, ending key-value section`);
        break; 
      }
      const key = msg.toString('utf8', start, offset);
      offset++;
      start = offset;
      while (offset < msg.length && msg[offset] !== 0x00) offset++;
      const val = msg.toString('utf8', start, offset);
      offset++;
      data[key] = val; // IMPORTANT: Do not lowercase the keys to match non-agent exactly
      
      // Log key-value pairs for debugging
      console.log(`[QUERY:${this.id}] Parsed key-value: "${key}" = "${val}"`);
    }
    
    // Log all data keys found
    console.log(`[QUERY:${this.id}] Parsed ${Object.keys(data).length} data fields:`, Object.keys(data));
    
    // Skip exactly 10 bytes to match the non-agent implementation
    offset += 10;
    console.log(`[QUERY:${this.id}] Skipping exactly 10 bytes to player list at offset ${offset}/${msg.length}`);
    
    // Read player list - use identical algorithm to the non-agent implementation
    const players = [];
    while (true) {
      let start = offset;
      while (offset < msg.length && msg[offset] !== 0x00) offset++;
      if (offset === start) { 
        offset++; 
        console.log(`[QUERY:${this.id}] Found empty player name, ending player list`);
        break; 
      }
      const playerName = msg.toString('utf8', start, offset);
      players.push(playerName);
      offset++;
      
      // Debugging: log player names
      console.log(`[QUERY:${this.id}] Found player: "${playerName}"`);
    }
    
    // Extract plugins using EXACTLY the same regex split as non-agent code
    // This is critical - the split pattern must match EXACTLY
    const plugins = data.plugins ? data.plugins.split(/[:;]/g) : [];
    
    // Use shift() to get software name EXACTLY like the non-agent implementation
    const software = plugins.shift() || '';
    console.log(`[QUERY:${this.id}] Parsed software: "${software}", plugins:`, plugins);
    
    // CRITICAL: Create the result object in EXACTLY the same structure as the non-agent implementation
    // The order and naming of fields must match exactly
    const result = {
      motd: data.hostname,
      version: data.version,
      software: software,
      plugins: plugins,
      map: data.map,
      players: { 
        online: parseInt(data.numplayers, 10), 
        max: parseInt(data.maxplayers, 10), 
        list: players 
      },
      hostIp: data.hostip,
      hostPort: parseInt(data.hostport, 10)
    };
    
    console.log(`[QUERY:${this.id}] Full query completed: ${result.motd}, Players: ${result.players.online}/${result.players.max}`);
    return result;
  }
}

module.exports = QueryClient;