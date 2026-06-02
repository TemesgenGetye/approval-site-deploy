import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function otpEmailHtml(otp: string, name: string) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0;background:#f1f5f9}
.c{max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
.h{background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:32px;text-align:center}
.h h1{color:#fff;font-size:22px;margin:0}
.b{padding:32px;text-align:center}
.otp{font-size:42px;font-weight:700;color:#1d4ed8;letter-spacing:8px;margin:24px 0;padding:16px;background:#eff6ff;border-radius:12px}
.p{font-size:14px;color:#64748b;line-height:1.6;margin:0}
.footer{padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8}
</style></head><body>
<div class="c">
<div class="h"><h1>🔐 Verify Your Email</h1></div>
<div class="b">
<p style="font-size:16px;color:#1e293b">Hi <strong>${name}</strong>,</p>
<p class="p">Use the OTP below to complete your registration.</p>
<div class="otp">${otp}</div>
<p class="p">This code expires in 10 minutes.</p>
<p class="p">If you didn't request this, please ignore this email.</p>
</div>
<div class="footer"><p>DonationVerify — Secure Donation Platform</p></div>
</div>
</body></html>`;
}

export async function POST(request: Request) {
  try {
    const { email, password, full_name, role } = await request.json();

    if (!email || !password || !full_name) {
      return NextResponse.json(
        { success: false, message: "Missing required fields" },
        { status: 400 }
      );
    }

    const validRole = role === "donor" || role === "recipient" ? role : "donor";

    // Create the user via Admin API (bypasses email confirmation)
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role: validRole },
    });

    if (error) {
      if (error.status === 409 || error.message?.toLowerCase().includes("already")) {
        return NextResponse.json(
          { success: false, message: "An account with this email already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    const userId = data.user?.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Failed to create user" },
        { status: 500 }
      );
    }

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({ id: userId, email, full_name, role: validRole });

    if (profileError) {
      console.error("[send-otp] Profile error:", profileError);
      return NextResponse.json(
        { success: false, message: profileError.message },
        { status: 500 }
      );
    }

    // Generate and store OTP
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: otpError } = await supabaseAdmin
      .from("otp_codes")
      .insert({
        email,
        otp,
        purpose: "registration",
        expires_at: expiresAt,
      });

    if (otpError) {
      console.error("[send-otp] OTP store error:", otpError);
      return NextResponse.json(
        { success: false, message: "Failed to generate verification code" },
        { status: 500 }
      );
    }

    // Send OTP via nodemailer
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || "noreply@donationverify.app";
    const smtpFromName = process.env.SMTP_FROM_NAME || "DonationVerify";

    if (smtpHost && smtpUser && smtpPass) {
      try {
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.default.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
        });
        await transporter.sendMail({
          from: `"${smtpFromName}" <${smtpFrom}>`,
          to: email,
          subject: "Your DonationVerify OTP Code",
          html: otpEmailHtml(otp, full_name),
        });
        console.log("[send-otp] OTP email sent to", email);
      } catch (mailErr) {
        console.error("[send-otp] Email error:", mailErr);
        return NextResponse.json(
          { success: false, message: "Failed to send verification email" },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { success: false, message: "SMTP not configured" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user_id: userId,
      message: "Verification code sent to your email",
    });
  } catch (error) {
    console.error("[send-otp] Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Registration failed",
      },
      { status: 500 }
    );
  }
}
