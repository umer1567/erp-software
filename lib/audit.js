import pool from "./db";

export async function createAuditLog({
  userId = null,
  username = null,
  action,
  module,
  recordId = null,
  description = null,
  oldData = null,
  newData = null,
  ipAddress = null,
  userAgent = null,
  client = null,
}) {
  const db = client || pool;

  await db.query(
    `
    INSERT INTO audit_logs
    (
      user_id,
      username,
      action,
      module,
      record_id,
      description,
      old_data,
      new_data,
      ip_address,
      user_agent
    )
    VALUES
    (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10
    )
    `,
    [
      userId,
      username,
      action,
      module,
      recordId,
      description,
      oldData ? JSON.stringify(oldData) : null,
      newData ? JSON.stringify(newData) : null,
      ipAddress,
      userAgent,
    ]
  );
}