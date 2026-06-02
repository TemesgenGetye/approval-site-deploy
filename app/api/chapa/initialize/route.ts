import { NextResponse } from "next/server";

const CHAPA_API = "https://api.chapa.co/v1/transaction/initialize";

export async function POST(request: Request) {
  try {
    const { amount, currency, email, first_name, last_name, title, description } = await request.json();

    if (!amount || !email) {
      return NextResponse.json({ success: false, message: "Missing amount or email" }, { status: 400 });
    }

    const secretKey = process.env.CHAPA_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ success: false, message: "Chapa not configured (missing CHAPA_SECRET_KEY)" }, { status: 500 });
    }

    const tx_ref = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const body = {
      amount: String(amount),
      currency: currency || "ETB",
      email,
      first_name: first_name || email.split("@")[0],
      last_name: last_name || "",
      tx_ref,
      callback_url: `${process.env.APP_URL || "https://donation.app"}/api/chapa/callback`,
      return_url: `${process.env.APP_URL || "https://donation.app"}/payment/success`,
      customization: {
        title: title || "Donation Support",
        description: description || "Payment via Chapa",
      },
    };

    const res = await fetch(CHAPA_API, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (data.status === "success" && data.data?.checkout_url) {
      return NextResponse.json({
        success: true,
        checkout_url: data.data.checkout_url,
        tx_ref,
      });
    }

    console.error("[chapa/initialize] Chapa error:", data);
    return NextResponse.json({
      success: false,
      message: data.message || data.detail || "Chapa initialization failed",
    }, { status: 500 });
  } catch (error) {
    console.error("[chapa/initialize] Exception:", error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to initialize Chapa payment",
    }, { status: 500 });
  }
}
