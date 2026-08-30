/**
 * Quantum Chat OS - Shared realtime registry.
 * The WebSocket server (server.js) registers/unregisters sockets here; any REST route
 * (e.g. sending a chat message with an image attachment) can then push a live update
 * to a user's open tabs without needing direct access to the WebSocketServer instance.
 */
const clientsByUser = new Map(); // userId -> Set<ws>

function register(userId, ws) {
  if (!clientsByUser.has(userId)) clientsByUser.set(userId, new Set());
  clientsByUser.get(userId).add(ws);
}

function unregister(userId, ws) {
  const set = clientsByUser.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) clientsByUser.delete(userId);
}

function isOnline(userId) {
  return clientsByUser.has(userId) && clientsByUser.get(userId).size > 0;
}

function getOnlineIds() {
  return [...clientsByUser.keys()];
}

function sendToUser(userId, payload) {
  const set = clientsByUser.get(userId);
  if (!set || set.size === 0) return;
  const data = JSON.stringify(payload);
  set.forEach(ws => { if (ws.readyState === 1) ws.send(data); });
}

module.exports = { register, unregister, isOnline, getOnlineIds, sendToUser };
