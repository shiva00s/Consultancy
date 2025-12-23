// src-electron/services/realtimeSync.cjs

const { Server } = require('socket.io');

class RealtimeSync {
  constructor(httpServer) {
    this.io = new Server(httpServer, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
      transports: ['websocket', 'polling']
    });

    this.connectedClients = new Map();
    this.setupHandlers();
    console.log('✅ Real-time sync initialized');
  }

  setupHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);
      this.connectedClients.set(socket.id, { connectedAt: Date.now() });

      socket.on('disconnect', () => {
        this.connectedClients.delete(socket.id);
        console.log(`🔌 Client disconnected: ${socket.id}`);
      });
    });
  }

  // Broadcast to all clients
  broadcast(eventName, data) {
    this.io.emit(eventName, data);
    console.log(`📡 Broadcast: ${eventName}`, data);
  }

  // Get connection count
  getConnectionCount() {
    return this.connectedClients.size;
  }
}

module.exports = RealtimeSync;
