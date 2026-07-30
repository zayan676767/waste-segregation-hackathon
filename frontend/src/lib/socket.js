import { io } from 'socket.io-client';

/**
 * One shared socket for the whole tab. Connecting with no URL targets the page's
 * own origin, which Vite proxies to the backend — so this works unchanged on
 * localhost, over the LAN, and through an https tunnel.
 */
let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io({
      // Fall back to long-polling if a tunnel or network blocks WebSockets,
      // so the dashboard still updates live.
      transports: ['websocket', 'polling'],
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000
    });
  }
  return socket;
}
