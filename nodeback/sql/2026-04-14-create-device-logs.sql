CREATE TABLE IF NOT EXISTS device_logs (
  id BIGSERIAL PRIMARY KEY,
  "deviceId" INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  "inventoryNumber" TEXT NOT NULL,
  version INTEGER NOT NULL,
  section TEXT NOT NULL,
  changes JSONB NOT NULL,
  "changedBy" INTEGER REFERENCES users(id) ON DELETE SET NULL,
  "changedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS device_logs_device_version_idx
  ON device_logs ("deviceId", version);

CREATE INDEX IF NOT EXISTS device_logs_inventory_number_idx
  ON device_logs ("inventoryNumber");

CREATE INDEX IF NOT EXISTS device_logs_changed_at_idx
  ON device_logs ("changedAt" DESC);
