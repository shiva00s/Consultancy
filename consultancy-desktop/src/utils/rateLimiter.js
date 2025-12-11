class RateLimiter {
  constructor() {
    this.attempts = new Map();
    this.lockouts = new Map();
  }

  /**
   * Check if an identifier (username/IP) is rate limited
   * @param {string} identifier - Username or IP address
   * @param {number} maxAttempts - Maximum allowed attempts
   * @param {number} windowMs - Time window in milliseconds
   * @param {number} lockoutMs - Lockout duration in milliseconds
   * @returns {Object} - { allowed: boolean, remainingAttempts: number, retryAfter: number }
   */
  checkLimit(identifier, maxAttempts = 5, windowMs = 15 * 60 * 1000, lockoutMs = 30 * 60 * 1000) {
    const now = Date.now();
    
    // Check if currently locked out
    if (this.lockouts.has(identifier)) {
      const lockoutEnd = this.lockouts.get(identifier);
      if (now < lockoutEnd) {
        return {
          allowed: false,
          remainingAttempts: 0,
          retryAfter: Math.ceil((lockoutEnd - now) / 1000), // seconds
          message: `Too many failed attempts. Try again in ${Math.ceil((lockoutEnd - now) / 60000)} minutes.`
        };
      } else {
        // Lockout expired
        this.lockouts.delete(identifier);
        this.attempts.delete(identifier);
      }
    }

    // Get or initialize attempt record
    if (!this.attempts.has(identifier)) {
      this.attempts.set(identifier, []);
    }

    const attemptTimes = this.attempts.get(identifier);
    
    // Filter attempts within the time window
    const recentAttempts = attemptTimes.filter(time => now - time < windowMs);
    this.attempts.set(identifier, recentAttempts);

    if (recentAttempts.length >= maxAttempts) {
      // Lock out the user
      this.lockouts.set(identifier, now + lockoutMs);
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfter: Math.ceil(lockoutMs / 1000),
        message: `Too many failed attempts. Account locked for ${Math.ceil(lockoutMs / 60000)} minutes.`
      };
    }

    return {
      allowed: true,
      remainingAttempts: maxAttempts - recentAttempts.length,
      retryAfter: 0,
      message: ''
    };
  }

  /**
   * Record a failed attempt
   */
  recordAttempt(identifier) {
    if (!this.attempts.has(identifier)) {
      this.attempts.set(identifier, []);
    }
    this.attempts.get(identifier).push(Date.now());
  }

  /**
   * Clear attempts for an identifier (on successful login)
   */
  clearAttempts(identifier) {
    this.attempts.delete(identifier);
    this.lockouts.delete(identifier);
  }

  /**
   * Clean up old records (call periodically)
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    // Clean up attempts
    for (const [identifier, times] of this.attempts.entries()) {
      const recentTimes = times.filter(time => now - time < maxAge);
      if (recentTimes.length === 0) {
        this.attempts.delete(identifier);
      } else {
        this.attempts.set(identifier, recentTimes);
      }
    }

    // Clean up expired lockouts
    for (const [identifier, lockoutEnd] of this.lockouts.entries()) {
      if (now >= lockoutEnd) {
        this.lockouts.delete(identifier);
      }
    }
  }
}

export const rateLimiter = new RateLimiter();

// Clean up every 5 minutes
setInterval(() => rateLimiter.cleanup(), 5 * 60 * 1000);
export default rateLimiter;