const { pool } = require("./config/database");
const bcrypt = require("bcryptjs");
async function go() {
  const h = bcrypt.hashSync("KeenNeed2026!", 10);
  console.log("Setting hash:", h);
  await pool.query("UPDATE users SET password_hash = ? WHERE id = 65", [h]);
  const [r] = await pool.query("SELECT password_hash FROM users WHERE id = 65");
  console.log("DB now has:", r[0].password_hash);
  process.exit(0);
}
go().catch(e => { console.error(e); process.exit(1); });
