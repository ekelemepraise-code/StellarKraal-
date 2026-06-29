import crypto from "crypto";

export interface WebhookRegistration {
  id: string;
  url: string;
  encrypt: boolean;
  createdAt: number;
}

export interface DeliveryLog {
  webhookId: string;
  event: string;
  payload: object;
  attempts: number;
  lastStatus: number | null;
  lastError: string | null;
  deliveredAt: number | null;
}

// In-memory stores (replace with DB in production)
const webhooks = new Map<string, WebhookRegistration>();
const deliveryLogs: DeliveryLog[] = [];

/**
 * Reset in-memory webhook state for deterministic testing.
 */
export function __resetForTests(): void {
  webhooks.clear();
  deliveryLogs.length = 0;
}

// ── AES-256-GCM encryption helpers ───────────────────────────────────────────

/**
 * Derives a 32-byte AES key from the webhook secret using HKDF-SHA256.
 *
 * @param secret - Webhook secret (arbitrary-length string).
 * @returns 32-byte Buffer suitable for AES-256-GCM.
 */
export function deriveEncryptionKey(secret: string): Buffer {
  return crypto.hkdfSync(
    "sha256",
    Buffer.from(secret, "utf8"),
    Buffer.alloc(0), // empty salt
    Buffer.from("stellarkraal-webhook-encryption", "utf8"),
    32
  );
}

/**
 * Encrypts a plaintext string with AES-256-GCM.
 *
 * Receivers decrypt with:
 * ```
 * const key = hkdf("sha256", secret, "", "stellarkraal-webhook-encryption", 32);
 * const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"));
 * decipher.setAuthTag(Buffer.from(authTag, "hex"));
 * const plain = decipher.update(Buffer.from(encrypted_payload, "hex")) + decipher.final();
 * ```
 *
 * @param plaintext - UTF-8 string to encrypt.
 * @param key - 32-byte AES key (from {@link deriveEncryptionKey}).
 * @returns Object containing hex-encoded `iv`, `encrypted_payload`, and `auth_tag`.
 */
export function encryptPayload(
  plaintext: string,
  key: Buffer
): { iv: string; encrypted_payload: string; auth_tag: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    iv: iv.toString("hex"),
    encrypted_payload: encrypted.toString("hex"),
    auth_tag: cipher.getAuthTag().toString("hex"),
  };
}

/**
 * Decrypts an AES-256-GCM ciphertext produced by {@link encryptPayload}.
 *
 * @param iv - Hex-encoded 12-byte IV.
 * @param encryptedPayload - Hex-encoded ciphertext.
 * @param authTag - Hex-encoded 16-byte GCM auth tag.
 * @param key - 32-byte AES key.
 * @returns Decrypted UTF-8 string.
 */
export function decryptPayload(
  iv: string,
  encryptedPayload: string,
  authTag: string,
  key: Buffer
): string {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(authTag, "hex"));
  return decipher.update(Buffer.from(encryptedPayload, "hex")).toString("utf8") + decipher.final("utf8");
}

/**
 * Register a new webhook listener.
 *
 * @param url - Destination URL for webhook delivery.
 * @param encrypt - When true, payloads are AES-256-GCM encrypted before delivery.
 * @returns The registered webhook metadata record.
 * @throws Error if the URL is invalid or unsupported.
 */
export function registerWebhook(url: string, encrypt = false): WebhookRegistration {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid webhook URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Webhook URL must use http or https");
  }
  const id = crypto.randomUUID();
  const reg: WebhookRegistration = { id, url, encrypt, createdAt: Date.now() };
  webhooks.set(id, reg);
  return reg;
}

/**
 * List all registered webhooks.
 *
 * @returns An array of registered webhook metadata.
 */
export function getWebhooks(): WebhookRegistration[] {
  return Array.from(webhooks.values());
}

/**
 * Retrieve the current webhook delivery log entries.
 *
 * @returns An array of delivery log entries for recent webhook attempts.
 */
export function getDeliveryLogs(): DeliveryLog[] {
  return deliveryLogs;
}

function sign(payload: string): string {
  const secret = process.env.WEBHOOK_SECRET ?? "default-webhook-secret-change-me";
  return "sha256=" + crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Deliver an event payload to all registered webhooks.
 * For webhooks registered with `encrypt: true`, the body is AES-256-GCM
 * encrypted and the response includes `encrypted_payload`, `iv`, and
 * `auth_tag` fields instead of a plain `payload`.
 *
 * @param event - The webhook event name.
 * @param payload - Payload object to send in the webhook body.
 * @returns A promise that resolves once delivery attempts are scheduled.
 */
export async function fireWebhooks(event: string, payload: object): Promise<void> {
  const secret = process.env.WEBHOOK_SECRET ?? "default-webhook-secret-change-me";

  for (const wh of webhooks.values()) {
    let body: string;
    if (wh.encrypt) {
      const key = deriveEncryptionKey(secret);
      const plaintext = JSON.stringify({ event, payload, timestamp: Date.now() });
      const { iv, encrypted_payload, auth_tag } = encryptPayload(plaintext, key);
      body = JSON.stringify({ event, encrypted_payload, iv, auth_tag, timestamp: Date.now() });
    } else {
      body = JSON.stringify({ event, payload, timestamp: Date.now() });
    }
    const signature = sign(body);

    const log: DeliveryLog = {
      webhookId: wh.id,
      event,
      payload,
      attempts: 0,
      lastStatus: null,
      lastError: null,
      deliveredAt: null,
    };
    deliveryLogs.push(log);
    deliver(wh.url, body, signature, log);
  }
}

async function deliver(
  url: string,
  body: string,
  signature: string,
  log: DeliveryLog,
  attempt = 0
): Promise<void> {
  const MAX_ATTEMPTS = 5;
  log.attempts = attempt + 1;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
      },
      body,
    });
    log.lastStatus = res.status;
    if (res.ok) {
      log.deliveredAt = Date.now();
      return;
    }
    log.lastError = `HTTP ${res.status}`;
  } catch (err: any) {
    log.lastError = err.message;
    log.lastStatus = null;
  }

  if (attempt + 1 < MAX_ATTEMPTS) {
    const delay = Math.pow(2, attempt) * 1000; // exponential backoff
    setTimeout(() => deliver(url, body, signature, log, attempt + 1), delay);
  }
}
