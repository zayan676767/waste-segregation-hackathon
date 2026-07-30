/**
 * Prints the URLs to open on each device.
 *
 * Run this after `npm run dev:https` — the laptop's address on a hotspot changes
 * every time it reconnects, so guessing it at the venue is how demos get lost.
 */
import { networkInterfaces } from 'node:os';

const PORT = process.env.PORT || 5173;

const addresses = Object.entries(networkInterfaces())
  .flatMap(([name, list]) =>
    (list ?? [])
      .filter((net) => net.family === 'IPv4' && !net.internal)
      .map((net) => ({ name, address: net.address }))
  );

// A phone hotspot hands out 192.168.x.x addresses, so surface those first.
const ranked = addresses.sort((a, b) => {
  const score = (ip) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('172.') ? 1 : 2);
  return score(a.address) - score(b.address);
});

const line = '─'.repeat(58);
console.log(`\n${line}`);
console.log('  OPEN THESE');
console.log(line);

console.log('\n  💻  ON THIS LAPTOP (dashboard for the big screen)');
console.log(`      https://localhost:${PORT}/dashboard`);
console.log('\n  💻  Admin panel');
console.log(`      https://localhost:${PORT}/admin`);

if (ranked.length === 0) {
  console.log('\n  📱  ON THE PHONE');
  console.log('      No network address found — connect to the hotspot first.');
} else {
  console.log('\n  📱  ON THE PHONE (camera) — type this exactly, including https');
  for (const { name, address } of ranked) {
    console.log(`      https://${address}:${PORT}      (${name})`);
  }
  if (ranked.length > 1) {
    console.log('\n      Several networks found. Try the 192.168.x.x one first;');
    console.log('      it is normally the hotspot.');
  }
}

console.log(`\n${line}`);
console.log('  The phone will warn that the connection is not private.');
console.log('  That is expected — the certificate is self-signed.');
console.log('  Tap "Advanced" then "Proceed". The camera then works.');
console.log(`${line}\n`);
