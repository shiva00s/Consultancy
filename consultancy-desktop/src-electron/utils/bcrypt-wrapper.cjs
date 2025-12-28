// Promise-friendly bcrypt wrapper using bcryptjs
const bcrypt = require('bcryptjs');

module.exports = {
  hash: (data, saltRounds) => {
    return new Promise((resolve, reject) => {
      bcrypt.hash(data, saltRounds, (err, hash) => {
        if (err) return reject(err);
        resolve(hash);
      });
    });
  },

  compare: (data, hash) => {
    return new Promise((resolve, reject) => {
      bcrypt.compare(data, hash, (err, same) => {
        if (err) return reject(err);
        resolve(same);
      });
    });
  },

  genSalt: (rounds) => {
    return new Promise((resolve, reject) => {
      bcrypt.genSalt(rounds, (err, salt) => {
        if (err) return reject(err);
        resolve(salt);
      });
    });
  },

  // expose sync helpers
  hashSync: bcrypt.hashSync,
  compareSync: bcrypt.compareSync,
};
