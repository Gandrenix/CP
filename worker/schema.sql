-- CP Club - esquema de la base (Cloudflare D1 / SQLite).
-- Se puede correr varias veces: todo es IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS customers (
  phone TEXT PRIMARY KEY,                 -- 10 dígitos, sin +57
  first_name TEXT NOT NULL DEFAULT '',
  points INTEGER NOT NULL DEFAULT 0,      -- saldo actual (incluye lo reservado en códigos activos)
  lifetime INTEGER NOT NULL DEFAULT 0,    -- puntos históricos: definen el nivel y nunca bajan por canjes
  expires_at INTEGER,                     -- ms epoch: cuándo vencen los puntos actuales
  birthday TEXT,                          -- 'MM-DD' (opcional, lo da el cliente; se guarda una sola vez)
  birthday_set_at INTEGER,                -- cuándo se guardó: el premio exige que sea ANTES de que empiece la semana del cumple
  welcome_given INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Libro de puntos: cada movimiento queda registrado (auditable).
CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  kind TEXT NOT NULL,                     -- earn | welcome | reverse | redeem | expire | birthday (0 pts: premio de cumple, ref = celular:año)
  points INTEGER NOT NULL,                -- + suma, - resta
  ref TEXT,                               -- paymentId de Toteat, código de canje, etc.
  note TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ledger_phone ON ledger(phone, created_at);
-- Idempotencia: el mismo pago de Toteat (o el mismo canje) no se registra dos veces.
CREATE UNIQUE INDEX IF NOT EXISTS ledger_kind_ref ON ledger(kind, ref) WHERE ref IS NOT NULL;

-- Pagos de Toteat ya revisados (con o sin cliente), para no reprocesarlos.
CREATE TABLE IF NOT EXISTS sales_seen (
  payment_id TEXT PRIMARY KEY,
  phone TEXT,
  amount INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  claim TEXT                              -- quién procesó el pago (evita contarlo dos veces si hay dos lecturas a la vez)
);

-- Pagos de Toteat con un cliente cuyo celular no se pudo usar (corto, fijo, mal escrito...). Es la lista de
-- revisión: se guarda solo el MOTIVO y la cantidad de dígitos (nunca el número) y el primer nombre.
-- Se borra sola cuando el pago por fin se procesa (p. ej. porque corrigieron el celular en Toteat).
CREATE TABLE IF NOT EXISTS phone_issues (
  payment_id TEXT PRIMARY KEY,
  order_id TEXT,
  first_name TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL,                   -- corto | largo | fijo | no_empieza_en_3 | sin_digitos | vacio
  digits INTEGER NOT NULL DEFAULT 0,
  closed_at INTEGER,
  seen_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS codes (
  code TEXT PRIMARY KEY,                  -- CP-XXXX
  phone TEXT NOT NULL,
  reward_id TEXT NOT NULL,
  cost INTEGER NOT NULL,
  status TEXT NOT NULL,                   -- active | used | expired | cancelled
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_by TEXT,
  used_at INTEGER
);
CREATE INDEX IF NOT EXISTS codes_phone ON codes(phone, status);

CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  salt TEXT NOT NULL,
  pin_hash TEXT NOT NULL,                 -- HMAC(pimienta del servidor, sal + PIN); el PIN nunca se guarda
  active INTEGER NOT NULL DEFAULT 1
);

-- Dispositivos de caja autorizados (tablets/celulares). Solo ellos pueden siquiera intentar un PIN.
-- Se autorizan una vez con un enlace secreto; del enlace solo se guarda una huella.
CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  last_seen INTEGER
);

CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);       -- cursor/estado de la sincronización
CREATE TABLE IF NOT EXISTS hits (k TEXT NOT NULL, w INTEGER NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (k, w));  -- límite de intentos
