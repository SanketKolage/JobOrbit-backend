const auth = require("./auth");

module.exports = function requireAdmin(req, res, next) {
  return auth.requireAdmin(req, res, next);
};
