import { NextResponse } from "next/server";
import crypto from "crypto";
import https from "https";

// ── Configuration ──────────────────────────────────────────────────────────
const BASE_URL =
  process.env.TELEBIRR_BASE_URL ||
  "https://developerportal.ethiotelebirr.et:38443/apiaccess/payment/gateway";
const WEB_BASE_URL =
  process.env.TELEBIRR_WEB_BASE_URL ||
  "https://developerportal.ethiotelebirr.et:38443/payment/web/paygate?";

// ── Raw HTTPS fetch (skips TLS for sandbox self-signed cert) ───────────────
function rawPost(url: string, body: string, extraHeaders?: Record<string, string>): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = Buffer.from(body, "utf8");
    const opts: https.RequestOptions = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": payload.length, ...extraHeaders },
      rejectUnauthorized: false,
    };
    const req = https.request(opts, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        try { resolve({ status: res.statusCode || 500, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode || 500, data: raw }); }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

let lastSignStr = "";

// ── RSA signing — tries PSS first, then PKCS1 ────────────────────────────
function signData(data: string, privateKey: string, padding: number, saltLength?: number): string {
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(data, "utf8");
  const opts: any = { key: privateKey, padding };
  if (saltLength !== undefined) opts.saltLength = saltLength;
  return signer.sign(opts, "base64");
}

// ── Generate signature per Telebirr spec (ASCII-sorted key=value pairs) ────
function generateSign(obj: Record<string, any>, privateKey: string): string {
  lastSignStr = "";
  const excluded = new Set(["sign", "sign_type", "header", "refund_info", "openType", "raw_request"]);
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (k === "biz_content" && typeof v === "object") {
      for (const [bk, bv] of Object.entries(v)) {
        if (excluded.has(bk) || bv === undefined || bv === null) continue;
        flat[bk] = typeof bv === "object" ? JSON.stringify(bv) : String(bv);
      }
    } else if (!excluded.has(k)) {
      flat[k] = typeof v === "object" ? JSON.stringify(v) : String(v);
    }
  }
  const sorted = Object.keys(flat).sort();
  const signStr = sorted.map((k) => `${k}=${flat[k]}`).join("&");
  lastSignStr = signStr;
  console.log(`[telebirr] signStr (${signStr.length} chars): ${signStr.substring(0, 500)}...`);

  // Strategy 1: RSA-PSS (matches jsrsasign SHA256withRSAandMGF1)
  try {
    return signData(signStr, privateKey, crypto.constants.RSA_PKCS1_PSS_PADDING, crypto.constants.RSA_PSS_SALTLEN_DIGEST);
  } catch (e: any) {
    console.log(`[telebirr] PSS failed, trying PKCS1: ${e.message}`);
  }
  // Strategy 2: RSA-PKCS1
  try {
    return signData(signStr, privateKey, crypto.constants.RSA_PKCS1_PADDING);
  } catch (e: any) {
    console.log(`[telebirr] PKCS1 also failed: ${e.message}`);
  }
  throw new Error("RSA signing failed (tried PSS then PKCS1)");
}

// ── Helpers ────────────────────────────────────────────────────────────────
const NONCE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function randomNonce(len = 32): string {
  const bytes = crypto.randomBytes(len);
  return Array.from(bytes).map((b) => NONCE_CHARS[b % NONCE_CHARS.length]).join("");
}

function loadPrivateKey(raw: string): string {
  if (raw.includes("-----BEGIN")) return raw;
  const body = raw.match(/.{1,64}/g)?.join("\n") || raw;
  return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`;
}

// ── POST handler ───────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const requestId = `tb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  console.log(`\n========== [telebirr:${requestId}] START ==========`);

  try {
    const bodyText = await request.text();
    console.log(`[telebirr:${requestId}] Body: ${bodyText}`);
    let amount: number, title: string;
    try {
      const p = JSON.parse(bodyText);
      amount = p.amount;
      title = p.title;
    } catch {
      return NextResponse.json({ success: false, message: "Invalid JSON", requestId }, { status: 400 });
    }
    if (!amount || !title) {
      return NextResponse.json({ success: false, message: "Missing amount or title", requestId }, { status: 400 });
    }

    // ── Load config ───────────────────────────────────────────────────────
    const fabricAppId = process.env.TELEBIRR_FABRIC_APP_ID || "";
    const appSecret = process.env.TELEBIRR_APP_SECRET || "";
    const merchantAppId = process.env.TELEBIRR_MERCHANT_APP_ID || process.env.TELEBIRR_MERCHANT_ID || "";
    const merchantCode = process.env.TELEBIRR_MERCHANT_CODE || process.env.TELEBIRR_SHORT_CODE || "";
    const privateKeyRaw = process.env.TELEBIRR_PRIVATE_KEY || "";
    const missing: string[] = [];
    if (!fabricAppId) missing.push("TELEBIRR_FABRIC_APP_ID");
    if (!appSecret) missing.push("TELEBIRR_APP_SECRET");
    if (!merchantAppId) missing.push("TELEBIRR_MERCHANT_APP_ID / MERCHANT_ID");
    if (!merchantCode) missing.push("TELEBIRR_MERCHANT_CODE / SHORT_CODE");
    if (!privateKeyRaw) missing.push("TELEBIRR_PRIVATE_KEY");
    if (missing.length) {
      return NextResponse.json({ success: false, message: `Missing env vars: ${missing.join(", ")}`, requestId }, { status: 500 });
    }
    const privateKey = loadPrivateKey(privateKeyRaw);

    // ── Step 1: Get Fabric Token ────────────────────────────────────────────
    const tokenUrl = `${BASE_URL}/payment/v1/token`;
    const tokenPayload = JSON.stringify({ appId: fabricAppId, appSecret });
    console.log(`[telebirr:${requestId}] Step 1 — POST ${tokenUrl}`);
    const tokenRes = await rawPost(tokenUrl, tokenPayload, { "X-APP-Key": fabricAppId });
    console.log(`[telebirr:${requestId}] Token status=${tokenRes.status} data=${JSON.stringify(tokenRes.data)}`);

    const tokenData = tokenRes.data;
    let fabricToken = "";
    if (typeof tokenData === "string") { fabricToken = tokenData; }
    else if (tokenData.data?.token) { fabricToken = tokenData.data.token; }
    else if (tokenData.outData?.token) { fabricToken = tokenData.outData.token; }
    else if (tokenData.token) { fabricToken = tokenData.token; }
    else if (tokenData.code === "200" && tokenData.data) {
      fabricToken = typeof tokenData.data === "string" ? tokenData.data : tokenData.data.token || "";
    } else if (tokenData.access_token) { fabricToken = tokenData.access_token; }
    else if (tokenData.accessToken) { fabricToken = tokenData.accessToken; }

    if (!fabricToken) {
      return NextResponse.json({ success: false, message: `No token in response: ${JSON.stringify(tokenData)}`, requestId }, { status: 500 });
    }
    console.log(`[telebirr:${requestId}] Token: ${fabricToken.substring(0, 20)}...`);

    // ── Step 2: Build preOrder request ──────────────────────────────────────
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = randomNonce();
    const merchOrderId = `ORDER${Date.now()}${randomNonce(6)}`;
    const notifyUrl = `${process.env.APP_URL || "https://donation.app"}/api/telebirr/callback`;
    const returnUrl = `${process.env.APP_URL || "https://donation.app"}/payment/success`;

    const preOrderReq: Record<string, any> = {
      method: "payment.preorder",
      version: "1.0",
      timestamp,
      nonce_str: nonceStr,
      biz_content: {
        appid: merchantAppId,
        merch_code: merchantCode,
        merch_order_id: merchOrderId,
        subject: title,
        title,
        total_amount: String(amount),
        trans_currency: "ETB",
        timeout_express: "120m",
        payee_identifier: merchantCode,
        payee_identifier_type: "04",
        payee_type: "5000",
        trade_type: "Checkout",
        notify_url: notifyUrl,
        redirect_url: returnUrl,
      },
    };

    console.log(`[telebirr:${requestId}] PreOrder request (pre-sign): ${JSON.stringify(preOrderReq, null, 2)}`);
    const sign = generateSign(preOrderReq, privateKey);
    preOrderReq.sign = sign;
    preOrderReq.sign_type = "SHA256WithRSA";

    // ── Step 3: Call preOrder API ───────────────────────────────────────────
    const preOrderUrl = `${BASE_URL}/payment/v1/merchant/preOrder`;
    const preOrderPayload = JSON.stringify(preOrderReq);
    console.log(`[telebirr:${requestId}] Step 2 — POST ${preOrderUrl}`);
    const preOrderRes = await rawPost(preOrderUrl, preOrderPayload, {
      "X-APP-Key": fabricAppId,
      Authorization: fabricToken,
    });
    console.log(`[telebirr:${requestId}] PreOrder status=${preOrderRes.status} data=${JSON.stringify(preOrderRes.data)}`);

    const poData = preOrderRes.data;
    if (poData.result === "SUCCESS" || poData.code === "0") {
      console.log(`[telebirr:${requestId}] PreOrder SUCCESS response`);
    }

    const prepayId =
      poData.biz_content?.prepay_id ||
      poData.preOrderId ||
      poData.data?.preOrderId ||
      poData.data?.prepay_id ||
      poData.prepay_id ||
      poData.outTradeNo ||
      poData.prePayId ||
      poData.outData?.prepay_id ||
      (poData.code === "200" && typeof poData.data === "string" ? poData.data : null);

    if (!prepayId) {
      return NextResponse.json({
        success: false,
        message: `No prepay_id in preOrder response: ${JSON.stringify(poData)}`,
        debug: { request_body: preOrderReq, request_body_json: preOrderPayload, sign_string: lastSignStr },
        requestId,
      }, { status: 500 });
    }
    console.log(`[telebirr:${requestId}] prepay_id=${prepayId}`);

    // ── Step 4: Build rawRequest (checkout URL params) ──────────────────────
    const rawNonce = randomNonce();
    const rawTimestamp = Math.floor(Date.now() / 1000).toString();
    const rawData: Record<string, string> = {
      appid: merchantAppId,
      merch_code: merchantCode,
      nonce_str: rawNonce,
      prepay_id: prepayId,
      timestamp: rawTimestamp,
    };
    const rawSign = generateSign(rawData, privateKey);
    const checkoutUrl =
      `${WEB_BASE_URL}` +
      `appid=${encodeURIComponent(merchantAppId)}` +
      `&merch_code=${encodeURIComponent(merchantCode)}` +
      `&nonce_str=${encodeURIComponent(rawNonce)}` +
      `&prepay_id=${encodeURIComponent(prepayId)}` +
      `&timestamp=${encodeURIComponent(rawTimestamp)}` +
      `&sign=${encodeURIComponent(rawSign)}` +
      `&sign_type=SHA256WithRSA`;

    console.log(`[telebirr:${requestId}] Checkout URL: ${checkoutUrl}`);
    console.log(`========== [telebirr:${requestId}] SUCCESS ==========\n`);

    return NextResponse.json({ success: true, checkout_url: checkoutUrl, merchOrderId, requestId });
  } catch (error: any) {
    console.error(`[telebirr:${requestId}] ERROR:`, error);
    return NextResponse.json({ success: false, message: error.message || "Unknown error", requestId }, { status: 500 });
  }
}
