/**
 * Socket.IO server setup
 * Configures and initializes the Socket.IO server
 */
const { Server } = require('socket.io');
const { socketAuth } = require('../middleware/auth');
const { handleRequest } = require('./handlers');

/**
 * Initialize and configure the Socket.IO server
 * @param {Object} server - HTTP or HTTPS server
 * @returns {Object} The configured Socket.IO server
 */
function setupSocketServer(server) {
  // Create Socket.IO server attached to HTTP/HTTPS server
  const io = new Server(server, {
    cors: {
      origin: "*", // Allow connections from any origin
      methods: ["GET", "POST"],
      credentials: true
    },
    // Socket.IO-specific options
    pingTimeout: 30000,
    pingInterval: 10000,
    connectTimeout: 45000,
    maxHttpBufferSize: 5e6, // 5MB
    transports: ['websocket', 'polling'], // Start with WebSocket, fallback to polling
  });
  
  // Use authentication middleware
  io.use(socketAuth);
  
  // Socket.IO connection handling
  io.on('connection', (socket) => {
    // Get connection details from handshake
    const req = socket.request;
    const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const transport = socket.conn.transport.name; // websocket or polling
    const query = socket.handshake.query || {};
    
    console.log(`[SOCKET] New connection from ${clientIp} using ${transport} transport`);
    console.log(`[SOCKET] Connection query parameters:`, query);
    console.log(`[SOCKET] Socket ID: ${socket.id}`);
    
    // Send a welcome message to confirm connection
    socket.emit('welcome', { 
      message: 'Connected to NetherDeck Agent',
      socketId: socket.id,
      time: new Date().toISOString()
    });
    
    // Handle socket disconnect
    socket.on('disconnect', (reason) => {
      console.log(`[SOCKET] Client disconnected (ID: ${socket.id}): ${reason}`);
    });
    
    // Handle connection errors
    socket.on('error', (error) => {
      console.error(`[SOCKET] Socket error for client ${socket.id}:`, error);
    });
    
    // Handle requests
    socket.on('request', async (data, callback) => {
      try {
        console.log(`[SOCKET] Received request: ${data.action}${data.type ? ' (' + data.type + ')' : ''}`);
        
        // Process the request
        const response = await handleRequest(data, callback);
        
        // If no callback is provided, emit a response event
        if (typeof callback !== 'function') {
          socket.emit('response', response);
        }
      } catch (err) {
        console.error(`[SOCKET] Error handling request:`, err);
        
        // Create error response
        const errorResponse = {
          id: data?.id,
          success: false,
          error: err.message
        };
        
        // Send error response
        if (typeof callback === 'function') {
          callback(errorResponse);
        } else {
          socket.emit('response', errorResponse);
        }
      }
    });
  });
  
  return io;
}

module.exports = {
  setupSocketServer
};