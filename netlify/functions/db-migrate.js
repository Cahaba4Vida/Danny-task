const fs = require("fs");
const path = require("path");
const { jsonResponse, requireAdmin } = require("./lib/auth");
const { withTransaction } = require("./lib/db");

const migrationPath = path.resolve(
  __dirname,
  "..",
  "..",
  "migrations",
  "001_init.sql"
);

exports.handler = async (event) => {
  const authError = requireAdmin(event);
  if (authError) return authError;

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  try {
    const sql = fs.readFileSync(migrationPath, "utf8");
    await withTransaction(async (client) => {
      await client.query(sql);
    });

    return jsonResponse(200, { ok: true, migrated: true });
  } catch (error) {
    return jsonResponse(500, { ok: false, error: error.message });
  }
};
