const mariadb = require("mariadb");

const pool = mariadb.createPool({
  host: "localhost",
  user: "root",
  password: "12345678",
  database: "chemi",
});

module.exports = pool;
