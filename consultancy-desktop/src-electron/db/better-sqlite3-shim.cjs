// Shim to provide sqlite3-style callback API on top of better-sqlite3
const BetterSQLite3 = require('better-sqlite3');

class ShimDatabase {
  constructor(file, options = {}) {
    this.db = new BetterSQLite3(file, options);
  }

  serialize(cb) {
    try {
      cb && cb();
    } catch (e) {
      // ignore
    }
  }

  run(sql, params = [], cb) {
    try {
      if (typeof params === 'function') {
        cb = params;
        params = [];
      }
      const stmt = this.db.prepare(sql);
      const args = Array.isArray(params) ? params : [params];
      const res = stmt.run(...args);
      if (cb) cb(null, res);
      return res;
    } catch (err) {
      if (cb) return cb(err);
      throw err;
    }
  }

  prepare(sql) {
    const stmt = this.db.prepare(sql);
    return {
      run: (...args) => {
        let callback = null;
        if (args.length && typeof args[args.length - 1] === 'function') {
          callback = args.pop();
        }
        const paramsArr = args.length ? args : [];
        try {
          const res = stmt.run(...paramsArr);
          if (callback) {
            callback(null, res);
            return;
          }
          return res;
        } catch (err) {
          if (callback) return callback(err);
          throw err;
        }
      },
      get: (...args) => {
        let callback = null;
        if (args.length && typeof args[args.length - 1] === 'function') {
          callback = args.pop();
        }
        const paramsArr = args.length ? args : [];
        try {
          const row = stmt.get(...paramsArr);
          if (callback) {
            callback(null, row);
            return;
          }
          return row;
        } catch (err) {
          if (callback) return callback(err);
          throw err;
        }
      },
      all: (...args) => {
        let callback = null;
        if (args.length && typeof args[args.length - 1] === 'function') {
          callback = args.pop();
        }
        const paramsArr = args.length ? args : [];
        try {
          const rows = stmt.all(...paramsArr);
          if (callback) {
            callback(null, rows);
            return;
          }
          return rows;
        } catch (err) {
          if (callback) return callback(err);
          throw err;
        }
      },
      finalize: (cb) => {
        // better-sqlite3 statements don't need finalization; call cb immediately
        if (cb) cb(null);
      }
    };
  }

  get(sql, params = [], cb) {
    try {
      const stmt = this.db.prepare(sql);
      const args = Array.isArray(params) ? params : [params];
      const row = stmt.get(...args);
      if (cb) cb(null, row);
    } catch (err) {
      if (cb) cb(err);
    }
  }

  all(sql, params = [], cb) {
    try {
      const stmt = this.db.prepare(sql);
      const args = Array.isArray(params) ? params : [params];
      const rows = stmt.all(...args);
      if (cb) cb(null, rows);
    } catch (err) {
      if (cb) cb(err);
    }
  }

  close(cb) {
    try {
      this.db.close();
      if (cb) cb(null);
    } catch (err) {
      if (cb) cb(err);
    }
  }

  pragma(expr) {
    return this.db.pragma(expr);
  }
}

module.exports = ShimDatabase;
