// src/lib/server/services/query.js
// ESM port of lib/query.js — Minecraft Query protocol client (UDP)
import dgram from 'node:dgram';
import crypto from 'node:crypto';
import dns from 'node:dns';

/**
 * Generate a 32-bit session ID masked to low 4 bits per byte.
 * @returns {number}
 */
function makeSessionId() {
  const id = crypto.randomBytes(4).readInt32BE(0);
  return (id & 0x0f0f0f0f) >> 0;
}

/**
 * Attempt SRV record resolution for the given host.
 * @param {string} host
 * @returns {Promise<{name: string, port: number} | null>}
 */
async function resolveSrv(host) {
  return new Promise((resolve) => {
    dns.resolveSrv(`_minecraft._udp.${host}`, (err, records) => {
      if (err || !records || records.length === 0) return resolve(null);
      resolve(records[0]);
    });
  });
}

export default class QueryClient {
  /**
   * @param {string} host   server hostname or IP
   * @param {number} port   query port (default 25565)
   * @param {number} timeout milliseconds
   */
  constructor(host, port = 25565, timeout = 5000) {
    this.host = host;
    this.port = port;
    this.timeout = timeout;
    this.session = makeSessionId();
    // UDP socket for both handshake and stat requests
    this.socket = dgram.createSocket('udp4');
  }

  // Send buffer and await a single UDP response on the same socket
  _sendAndReceive(buffer) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.socket.close();
        reject(new Error('Query timed out'));
      }, this.timeout);
      this.socket.once('message', (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      this.socket.send(buffer, 0, buffer.length, this.port, this.host, (err) => {
        if (err) {
          clearTimeout(timer);
          this.socket.close();
          reject(err);
        }
      });
    });
  }

  async _resolveSrv() {
    // Skip SRV lookup for direct IP addresses
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(this.host)) {
      return;
    }
    try {
      const rec = await resolveSrv(this.host);
      if (rec) {
        this.host = rec.name;
        this.port = rec.port;
      }
    } catch (_) {
      // SRV resolution is best-effort; failures are silently ignored
    }
  }

  async _handshake() {
    const buf = Buffer.alloc(7);
    buf.writeUInt16BE(0xFEFD, 0);
    buf.writeUInt8(0x09, 2);
    buf.writeInt32BE(this.session, 3);
    const msg = await this._sendAndReceive(buf);
    if (msg[0] !== 0x09) throw new Error(`Invalid handshake response, type ${msg[0]}`);
    const serverSession = msg.readInt32BE(1);
    if (serverSession !== this.session) throw new Error('Session ID mismatch');
    const token = parseInt(msg.toString('ascii', 5, msg.length - 1), 10);
    if (isNaN(token)) throw new Error('Invalid challenge token');
    return token;
  }

  /** Perform basic stat query */
  async queryBasic() {
    this.host = this.host.trim();
    await this._resolveSrv();
    const challenge = await this._handshake();
    const buf = Buffer.alloc(11);
    buf.writeUInt16BE(0xFEFD, 0);
    buf.writeUInt8(0x00, 2);
    buf.writeInt32BE(this.session, 3);
    buf.writeInt32BE(challenge, 7);
    const msg = await this._sendAndReceive(buf);
    if (msg[0] !== 0x00) throw new Error(`Invalid basic response, type ${msg[0]}`);
    const serverSession = msg.readInt32BE(1);
    if (serverSession !== this.session) throw new Error('Session ID mismatch in basic response');
    let offset = 5;
    function readString() {
      let end = offset;
      while (msg[end] !== 0x00) end++;
      const s = msg.toString('utf8', offset, end);
      offset = end + 1;
      return s;
    }
    const motd = readString();
    const gameType = readString();
    const map = readString();
    const online = parseInt(readString(), 10);
    const max = parseInt(readString(), 10);
    const hostPort = msg.readUInt16LE(offset); offset += 2;
    const hostIp = readString();
    this.socket.close();
    return { motd, gameType, map, players: { online, max }, hostPort, hostIp };
  }

  /** Perform full stat query */
  async queryFull() {
    this.host = this.host.trim();
    await this._resolveSrv();
    const challenge = await this._handshake();
    const buf = Buffer.alloc(15);
    buf.writeUInt16BE(0xFEFD, 0);
    buf.writeUInt8(0x00, 2);
    buf.writeInt32BE(this.session, 3);
    buf.writeInt32BE(challenge, 7);
    // remaining bytes are zero padding
    const msg = await this._sendAndReceive(buf);
    if (msg[0] !== 0x00) throw new Error(`Invalid full response, type ${msg[0]}`);
    const serverSession = msg.readInt32BE(1);
    if (serverSession !== this.session) throw new Error('Session ID mismatch in full response');
    let offset = 5 + 11;
    const data = {};
    while (true) {
      let start = offset;
      while (msg[offset] !== 0x00) offset++;
      if (offset === start) { offset++; break; }
      const key = msg.toString('utf8', start, offset);
      offset++;
      start = offset;
      while (msg[offset] !== 0x00) offset++;
      const val = msg.toString('utf8', start, offset);
      offset++;
      data[key] = val;
    }
    offset += 10;
    const players = [];
    while (true) {
      let start = offset;
      while (msg[offset] !== 0x00) offset++;
      if (offset === start) { offset++; break; }
      players.push(msg.toString('utf8', start, offset));
      offset++;
    }
    const plugins = data.plugins.split(/[:;]/g);
    this.socket.close();
    return {
      motd: data.hostname,
      version: data.version,
      software: plugins.shift() || '',
      plugins,
      map: data.map,
      players: { online: parseInt(data.numplayers, 10), max: parseInt(data.maxplayers, 10), list: players },
      hostIp: data.hostip,
      hostPort: parseInt(data.hostport, 10)
    };
  }

  /** alias to support "query-status" IPC (basic) */
  async getStatus() {
    return this.queryBasic();
  }

  close() {
    // no-op (sockets closed per-request)
  }
}
