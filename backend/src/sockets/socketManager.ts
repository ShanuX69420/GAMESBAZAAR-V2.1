import { Server as SocketIOServer } from 'socket.io';

class SocketManager {
  private io: SocketIOServer | null = null;

  setIo(io: SocketIOServer) {
    this.io = io;
  }

  getIo(): SocketIOServer {
    if (!this.io) {
      throw new Error('Socket.io server not initialized');
    }
    return this.io;
  }

  isInitialized(): boolean {
    return this.io !== null;
  }
}

export const socketManager = new SocketManager();