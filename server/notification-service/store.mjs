import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { DEFAULT_PREFERENCES, reportSnapshotSchema } from "../../shared/notifications.ts";

const category = type => type === "weekly_report" ? "weeklySummary" : "functionReports";
export class NotificationStore {
  constructor(path = ":memory:") {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS preferences (
        account_id TEXT NOT NULL, user_id TEXT NOT NULL, timezone TEXT NOT NULL,
        function_reports INTEGER NOT NULL DEFAULT 0, weekly_summary INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY(account_id,user_id));
      CREATE TABLE IF NOT EXISTS devices (
        token TEXT PRIMARY KEY, account_id TEXT NOT NULL, user_id TEXT NOT NULL,
        session_id TEXT NOT NULL, registration_id TEXT NOT NULL, expires_at INTEGER NOT NULL,
        metadata TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY, dedupe_key TEXT UNIQUE NOT NULL, account_id TEXT NOT NULL,
        user_id TEXT NOT NULL, type TEXT NOT NULL, period_start TEXT NOT NULL, period_end TEXT NOT NULL,
        timezone TEXT NOT NULL, function_id TEXT, event_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
        next_at INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL DEFAULT 0,
        claim_id TEXT, error_code TEXT, snapshot TEXT);
      CREATE TABLE IF NOT EXISTS deliveries (
        id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id), token TEXT NOT NULL,
        registration_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
        next_at INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL DEFAULT 0, claim_id TEXT,
        ticket_id TEXT, ticket_at INTEGER, receipt_attempts INTEGER NOT NULL DEFAULT 0, error_code TEXT,
        UNIQUE(job_id,token));
      CREATE INDEX IF NOT EXISTS jobs_due ON jobs(status,next_at);
      CREATE INDEX IF NOT EXISTS deliveries_due ON deliveries(status,next_at);`);
  }
  close() { this.db.close(); }
  transaction(action) {
    this.db.exec("BEGIN IMMEDIATE");
    try { const result = action(); this.db.exec("COMMIT"); return result; }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  preferences(identity) {
    const row = this.db.prepare("SELECT * FROM preferences WHERE account_id=? AND user_id=?").get(identity.accountId, identity.userId);
    return row ? { functionReports: Boolean(row.function_reports), weeklySummary: Boolean(row.weekly_summary) } : { ...DEFAULT_PREFERENCES };
  }
  setPreferences(identity, value) {
    this.db.prepare(`INSERT INTO preferences VALUES(?,?,?,?,?) ON CONFLICT(account_id,user_id) DO UPDATE SET
      timezone=excluded.timezone,function_reports=excluded.function_reports,weekly_summary=excluded.weekly_summary`)
      .run(identity.accountId, identity.userId, identity.timezone, +value.functionReports, +value.weeklySummary);
  }
  register(identity, registration, now = Date.now()) {
    const old = this.db.prepare("SELECT * FROM devices WHERE token=?").get(registration.expoPushToken);
    const sameOwner = old?.account_id === identity.accountId && old?.user_id === identity.userId;
    this.db.prepare(`INSERT INTO devices VALUES(?,?,?,?,?,?,?) ON CONFLICT(token) DO UPDATE SET
      account_id=excluded.account_id,user_id=excluded.user_id,session_id=excluded.session_id,
      registration_id=excluded.registration_id,expires_at=excluded.expires_at,metadata=excluded.metadata`)
      .run(registration.expoPushToken, identity.accountId, identity.userId, identity.sessionId,
        sameOwner ? old.registration_id : randomUUID(), Math.min(Date.parse(identity.expiresAt), now + 86_400_000), JSON.stringify(registration));
  }
  unregister(identity, token) {
    // Un logout tardío de A no borra el alta de B ni una sesión nueva de A.
    this.db.prepare("DELETE FROM devices WHERE token=? AND account_id=? AND user_id=? AND session_id=?")
      .run(token, identity.accountId, identity.userId, identity.sessionId);
  }
  subscribers(now) {
    return this.db.prepare(`SELECT p.* FROM preferences p WHERE p.weekly_summary=1 AND EXISTS
      (SELECT 1 FROM devices d WHERE d.account_id=p.account_id AND d.user_id=p.user_id AND d.expires_at>?)`).all(now);
  }
  enqueue({ accountId, userId, type, periodStart, periodEnd, timezone, functionId = null, eventId = null }) {
    const key = createHash("sha256").update(JSON.stringify([accountId, userId, type, periodStart, periodEnd, functionId, eventId])).digest("hex");
    this.db.prepare(`INSERT OR IGNORE INTO jobs(id,dedupe_key,account_id,user_id,type,period_start,period_end,timezone,function_id,event_id)
      VALUES(?,?,?,?,?,?,?,?,?,?)`).run(randomUUID(), key, accountId, userId, type, periodStart, periodEnd, timezone, functionId, eventId);
    return this.db.prepare("SELECT id FROM jobs WHERE dedupe_key=?").get(key).id;
  }
  claimJob(now) {
    return this.db.prepare(`UPDATE jobs SET status='generating',attempts=attempts+1,lease_until=?,claim_id=?
      WHERE id=(SELECT id FROM jobs WHERE ((status='pending' AND next_at<=?) OR (status='generating' AND lease_until<=?)) AND attempts<5 ORDER BY next_at LIMIT 1)
      RETURNING *`).get(now + 60_000, randomUUID(), now, now);
  }
  completeJob(job, snapshot, now) {
    const validated = reportSnapshotSchema.parse(snapshot);
    return this.transaction(() => {
      const changed = this.db.prepare("UPDATE jobs SET status='ready',snapshot=?,lease_until=0,error_code=NULL WHERE id=? AND claim_id=? AND status='generating'")
        .run(JSON.stringify(validated), job.id, job.claim_id).changes;
      if (!changed) return;
      const prefs = this.preferences({ accountId: job.account_id, userId: job.user_id });
      if (!prefs[category(job.type)]) return;
      const devices = this.db.prepare("SELECT * FROM devices WHERE account_id=? AND user_id=? AND expires_at>?").all(job.account_id, job.user_id, now);
      for (const device of devices) this.db.prepare("INSERT OR IGNORE INTO deliveries(id,job_id,token,registration_id) VALUES(?,?,?,?)")
        .run(randomUUID(), job.id, device.token, device.registration_id);
    });
  }
  failJob(job, now, code = "SOURCE_ERROR") {
    this.db.prepare("UPDATE jobs SET status=?,next_at=?,lease_until=0,error_code=? WHERE id=? AND claim_id=?")
      .run(job.attempts >= 5 ? "failed" : "pending", now + Math.min(3_600_000, 30_000 * 2 ** job.attempts), code, job.id, job.claim_id);
  }
  report(identity, id) {
    const job = this.db.prepare("SELECT * FROM jobs WHERE id=? AND account_id=? AND user_id=?").get(id, identity.accountId, identity.userId);
    if (!job) return null;
    if (job.snapshot) return JSON.parse(job.snapshot);
    return { schemaVersion: 1, reportId: job.id, type: job.type, status: job.status === "failed" ? "failed" : "generating",
      periodStart: job.period_start, periodEnd: job.period_end, timezone: job.timezone,
      ...(job.function_id ? { functionId: job.function_id } : {}), ...(job.event_id ? { eventId: job.event_id } : {}) };
  }
  claimDelivery(now) {
    // Una caída después de enviar pero antes de guardar el ticket es ambigua:
    // no reenvíes automáticamente y produzcas avisos duplicados.
    this.db.prepare("UPDATE deliveries SET status='unknown',error_code='SEND_INTERRUPTED' WHERE status='sending' AND lease_until<=?").run(now);
    this.db.prepare("UPDATE jobs SET status='failed',error_code='WORKER_INTERRUPTED' WHERE status='generating' AND attempts>=5 AND lease_until<=?").run(now);
    return this.db.prepare(`UPDATE deliveries SET status='sending',attempts=attempts+1,lease_until=?,claim_id=? WHERE id=
      (SELECT id FROM deliveries WHERE status='pending' AND next_at<=? ORDER BY next_at LIMIT 1) RETURNING *`)
      .get(now + 60_000, randomUUID(), now);
  }
  deliveryContext(delivery, now) {
    const job = this.db.prepare("SELECT * FROM jobs WHERE id=?").get(delivery.job_id);
    const device = this.db.prepare("SELECT * FROM devices WHERE token=? AND registration_id=? AND expires_at>?").get(delivery.token, delivery.registration_id, now);
    if (!device || device.account_id !== job.account_id || device.user_id !== job.user_id ||
      !this.preferences({ accountId: job.account_id, userId: job.user_id })[category(job.type)]) return null;
    return { job, snapshot: JSON.parse(job.snapshot) };
  }
  markDelivery(delivery, status, code = null, nextAt = 0) {
    this.db.prepare("UPDATE deliveries SET status=?,error_code=?,next_at=?,lease_until=0 WHERE id=? AND claim_id=?")
      .run(status, code, nextAt, delivery.id, delivery.claim_id);
  }
  ticket(delivery, ticketId, now) {
    this.db.prepare("UPDATE deliveries SET status='ticket',ticket_id=?,ticket_at=?,next_at=?,lease_until=0 WHERE id=? AND claim_id=?")
      .run(ticketId, now, now + 15 * 60_000, delivery.id, delivery.claim_id);
  }
  receipts(now) { return this.db.prepare("SELECT * FROM deliveries WHERE status='ticket' AND next_at<=? LIMIT 100").all(now); }
  receipt(delivery, status, code = null, nextAt = 0) {
    this.db.prepare("UPDATE deliveries SET status=?,error_code=?,next_at=?,receipt_attempts=receipt_attempts+1 WHERE id=? AND status='ticket'")
      .run(status, code, nextAt, delivery.id);
  }
  invalidateDevice(delivery) {
    this.db.prepare("DELETE FROM devices WHERE token=? AND registration_id=?").run(delivery.token, delivery.registration_id);
  }
  stats() {
    return {
      jobs: this.db.prepare("SELECT status,COUNT(*) AS count FROM jobs GROUP BY status").all(),
      deliveries: this.db.prepare("SELECT status,COUNT(*) AS count FROM deliveries GROUP BY status").all(),
    };
  }
}
