# Node.js WebSocket Relay Server

A WebSocket server that acts as a relay between the Windows PC client and Android clients for the remote desktop monitoring system.

## Features

- **WebSocket Server**: Handles real-time bidirectional communication
- **Client Routing**: Routes messages between PC and multiple Android clients
- **Connection Management**: Tracks PC and Android client connections
- **Message Broadcasting**: Efficiently broadcasts screen frames to all connected Android devices
- **Keepalive Mechanism**: Uses ping/pong to detect and remove dead connections
- **Automatic Reconnection Handling**: Gracefully handles client disconnections and reconnections

## Architecture

```
[ Windows PC ] <--WebSocket--> [ Node.js Relay Server ] <--WebSocket--> [ Android Devices ]
```

### Message Flow

1. **PC → Server**: 
   - Identification: `{ "type": "pc" }`
   - Screen frames: `{ "type": "frame", "data": "base64_encoded_image" }`
   - Command results: `{ "type": "result", "output": "...", "error": "..." }`
   - Online status: `{ "type": "online", "device": "PC_NAME" }`

2. **Server → Android**:
   - Screen frames: `{ "type": "frame", "data": "base64_encoded_image" }`
   - Command results: `{ "type": "result", "output": "...", "error": "..." }`
   - PC status: `{ "type": "pc-online", "online": true/false }`

3. **Android → Server**:
   - Identification: `{ "type": "phone" }`
   - Commands: `{ "type": "command", "shell": "cmd|powershell", "command": "command_string" }`

4. **Server → PC**:
   - Commands: `{ "type": "command", "shell": "cmd|powershell", "command": "command_string" }`

## Setup

### Local Development

1. Install Node.js (v14+ recommended)
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the server:
   ```bash
   npm start
   ```
4. The server will run on port 3000 by default

### Environment Variables

- `PORT`: Port to listen on (default: 3000)

### Deployment to Railway

1. Push this repository to GitHub
2. Create a new Railway project
3. Connect your GitHub repository
4. Railway will automatically detect the Node.js project and deploy it
5. Set the PORT environment variable if needed (Railway sets this automatically)

## API

### WebSocket Endpoint

Connect to: `ws://your-server-domain:port` or `wss://your-server-domain:port`

### Message Types

#### From Clients (PC or Android)

| Type | Description | Data |
|------|-------------|------|
| `pc` | PC client identification | None |
| `phone` | Android client identification | None |
| `frame` | Screen frame from PC | `{ data: "base64_string" }` |
| `command` | Command from Android | `{ shell: "cmd|powershell", command: "string" }` |
| `result` | Command result from PC | `{ output: "string", error: "string" }` |
| `online` | PC online notification | `{ device: "computer_name" }` |

#### From Server to Clients

| Type | Description | Data |
|------|-------------|------|
| `frame` | Screen frame to Android | `{ data: "base64_string" }` |
| `command` | Command to PC | `{ shell: "cmd|powershell", command: "string" }` |
| `result` | Command result to Android | `{ output: "string", error: "string" }` |
| `pc-online` | PC status to Android | `{ online: boolean, device?: "string" }` |
| `error` | Error message | `{ message: "string" }` |

## Implementation Details

### Connection Management

- **PC Connection**: Single connection tracked in `pcConnection` variable
- **Android Connections**: Multiple connections tracked in `phoneConnections` Set
- **Automatic Cleanup**: Dead connections are removed every 10 seconds
- **Heartbeat Mechanism**: Ping/pong every 30 seconds to detect dead connections

### Message Routing Logic

1. **Screen Frames**: When PC sends a frame, broadcast to all connected Android devices
2. **Commands**: When Android sends a command, forward to PC if connected
3. **Results**: When PC sends a result, broadcast to all Android devices
4. **Status Updates**: When PC sends online status, broadcast to all Android devices

### Error Handling

- Invalid JSON messages are rejected with an error response
- Attempts to send commands when PC is disconnected result in error messages to the sender
- Network errors are logged and connections are cleaned up automatically

## Dependencies

- **ws**: WebSocket library for Node.js
- **nodemon**: Development dependency for automatic restart during development

## Usage Examples

### Connecting as PC Client

```javascript
const ws = new WebSocket('ws://your-server:port');
ws.on('open', () => {
  ws.send(JSON.stringify({ type: 'pc' }));
});
```

### Sending a Screen Frame

```javascript
ws.send(JSON.stringify({
  type: 'frame',
  data: base64EncodedImageData
}));
```

### Sending a Command (from Android)

```javascript
ws.send(JSON.stringify({
  type: 'command',
  shell: 'cmd',
  command: 'dir'
}));
```

## License

MIT License