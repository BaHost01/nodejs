const WebSocket = require('ws');

// WebSocket server configuration
const PORT = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port: PORT });

// Connection tracking
let pcConnection = null;
const phoneConnections = new Set();

// Helper function to send JSON messages
function sendJSON(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(data));
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }
}

// Helper function to check if connection is alive
function isAlive(ws) {
  return ws && ws.readyState === WebSocket.OPEN;
}

// Broadcast message to all phone connections
function broadcastToPhones(message) {
  phoneConnections.forEach((phone) => {
    if (isAlive(phone)) {
      sendJSON(phone, message);
    }
  });
}

// Clean up dead connections
function cleanupConnections() {
  // Check PC connection
  if (pcConnection && !isAlive(pcConnection)) {
    console.log('PC connection appears to be dead, clearing');
    pcConnection = null;
  }

  // Check phone connections
  phoneConnections.forEach((phone, phoneSet) => {
    if (!isAlive(phone)) {
      console.log('Removing dead phone connection');
      phoneConnections.delete(phone);
    }
  });
}

// Handle new WebSocket connections
wss.on('connection', (ws) => {
  console.log('New client connected');

  // Set up ping/pong for keepalive
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  // Handle incoming messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received message:', data.type);

      // Handle different message types
      switch (data.type) {
        case 'pc':
          // PC client identifying itself
          console.log('PC client connected');
          pcConnection = ws;

          // Notify all phones that PC is online
          broadcastToPhones({
            type: 'pc-online',
            online: true
          });
          break;

        case 'phone':
          // Phone client identifying itself
          console.log('Phone client connected');
          phoneConnections.add(ws);

          // Send current PC status to newly connected phone
          if (pcConnection && isAlive(pcConnection)) {
            sendJSON(ws, {
              type: 'pc-online',
              online: true
            });
          } else {
            sendJSON(ws, {
              type: 'pc-online',
              online: false
            });
          }
          break;

        case 'frame':
          // Screen frame from PC - broadcast to all phones
          if (data.data) {
            broadcastToPhones({
              type: 'frame',
              data: data.data
            });
          }
          break;

        case 'command':
          // Command from phone - forward to PC
          if (pcConnection && isAlive(pcConnection)) {
            sendJSON(pcConnection, {
              type: 'command',
              shell: data.shell,
              command: data.command
            });
            console.log(`Forwarding command to PC: ${data.command}`);
          } else {
            // PC is not connected, notify the phone
            sendJSON(ws, {
              type: 'error',
              message: 'PC is not connected'
            });
          }
          break;

        case 'result':
          // Command result from PC - send to originating phone
          // In a more sophisticated implementation, we'd track which phone sent the command
          // For simplicity, we broadcast to all phones
          broadcastToPhones({
            type: 'result',
            output: data.output,
            error: data.error
          });
          break;

        case 'online':
          // PC online status notification
          console.log(`PC online: ${data.device}`);
          broadcastToPhones({
            type: 'pc-online',
            online: true,
            device: data.device
          });
          break;

        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
      sendJSON(ws, {
        type: 'error',
        message: 'Invalid message format'
      });
    }
  });

  // Handle connection close
  ws.on('close', () => {
    console.log('Client disconnected');

    // Check if this was the PC connection
    if (ws === pcConnection) {
      console.log('PC disconnected');
      pcConnection = null;

      // Notify all phones that PC is offline
      broadcastToPhones({
        type: 'pc-online',
        online: false
      });
    } else {
      // Remove from phone connections
      phoneConnections.delete(ws);
      console.log('Phone disconnected');
    }
  });

  // Handle connection errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Periodic cleanup of dead connections
setInterval(cleanupConnections, 10000); // Every 10 seconds

// WebSocket server heartbeat
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping(() => {});
  });
}, 30000); // Every 30 seconds

console.log(`WebSocket server running on port ${PORT}`);