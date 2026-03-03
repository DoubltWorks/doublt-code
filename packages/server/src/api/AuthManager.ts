/**
 * AuthManager — Token-based authentication for client connections.
 *
 * Uses a simple shared-secret pairing model:
 * 1. CLI generates a pairing code (displayed as QR code)
 * 2. Mobile scans QR code to obtain the token
 * 3. Both sides use the token for WebSocket authentication
 *
 * This avoids the need for a central auth server while keeping
 * the connection secure between a user's own devices.
 */

import { randomBytes, createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';

interface PairingSession {
  code: string;
  token: string;
  createdAt: number;
  expiresAt: number;
  claimed: boolean;
}

export class AuthManager extends EventEmitter {
  private tokens = new Set<string>();
  private pairingSessions = new Map<string, PairingSession>();
  private readonly PAIRING_EXPIRY = 5 * 60 * 1000; // 5 minutes

  /**
   * Generate a server token for CLI authentication.
   */
  generateServerToken(): string {
    const token = randomBytes(32).toString('hex');
    this.tokens.add(token);
    return token;
  }

  /**
   * Create a pairing session for mobile connection.
   * Returns a short code that can be displayed as QR code.
   */
  createPairingSession(): { code: string; token: string } {
    const code = randomBytes(3).toString('hex').toUpperCase(); // 6-char code
    const token = randomBytes(32).toString('hex');
    const now = Date.now();

    this.pairingSessions.set(code, {
      code,
      token,
      createdAt: now,
      expiresAt: now + this.PAIRING_EXPIRY,
      claimed: false,
    });

    return { code, token };
  }

  /**
   * Claim a pairing code from mobile. Returns the auth token if valid.
   */
  claimPairingCode(code: string): string | null {
    const session = this.pairingSessions.get(code.toUpperCase());
    if (!session) return null;
    if (session.claimed) return null;
    if (Date.now() > session.expiresAt) {
      this.pairingSessions.delete(code);
      return null;
    }

    session.claimed = true;
    this.tokens.add(session.token);
    this.emit('pairing:claimed', { code });
    return session.token;
  }

  /**
   * Validate a token.
   */
  validateToken(token: string): boolean {
    return this.tokens.has(token);
  }

  /**
   * Revoke a token.
   */
  revokeToken(token: string): void {
    this.tokens.delete(token);
  }

  /**
   * Clean up expired pairing sessions.
   */
  cleanup(): void {
    const now = Date.now();
    for (const [code, session] of this.pairingSessions) {
      if (now > session.expiresAt) {
        this.pairingSessions.delete(code);
      }
    }
  }

  /**
   * Generate a connection URL for mobile pairing.
   * This URL contains the server address and pairing code.
   */
  generatePairingUrl(serverHost: string, serverPort: number): { url: string; code: string; token: string } {
    const { code, token } = this.createPairingSession();
    const url = `doublt://pair?host=${serverHost}&port=${serverPort}&code=${code}`;
    return { url, code, token };
  }
}
