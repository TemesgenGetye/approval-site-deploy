import { NextResponse } from "next/server";

const CHAPA_VERIFY_API = "https://api.chapa.co/v1/transaction/verify";

export async function POST(request: Request) {
  try {
    const { tx_ref } = await request.json();

    if (!tx_ref) {
      return NextResponse.json({ success: false, message: "Missing tx_ref" }, { status: 400 });
    }

    const secretKey = process.env.CHAPA_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ success: false, message: "Chapa not configured" }, { status: 500 });
    }

    const res = await fetch(`${CHAPA_VERIFY_API}/${tx_ref}`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${secretKey}` },
    });

    const data = await res.json();

    if (data.status === "success" && data.data?.status === "success") {
      return NextResponse.json({ success: true, verified: true, data: data.data });
    }

    return NextResponse.json({
      success: true,
      verified: false,
      message: data.message || "Payment not completed",
      data: data.data,
    });
  } catch (error) {
    console.error("[chapa/verify] Exception:", error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to verify payment",
    }, { status: 500 });
  }
}
