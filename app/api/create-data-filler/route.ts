import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const APP_URL = process.env.APP_URL || "https://donation.app/login";

function emailHtml(name: string, email: string, password: string, orgLabel: string) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0;background:#f1f5f9}
.c{max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
.h{background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:32px;text-align:center}
.h h1{color:#fff;font-size:24px;margin:0}
.h p{color:#bfdbfe;font-size:14px;margin:8px 0 0}
.b{padding:32px}
.badge{display:inline-block;background:#dbeafe;color:#1d4ed8;font-size:12px;font-weight:600;padding:4px 12px;border-radius:20px;margin-bottom:16px}
.cred{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:20px 0}
.cred .r{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #e2e8f0}
.cred .r:last-child{border-bottom:none}
.cred .l{font-size:12px;color:#64748b}
.cred .v{font-size:14px;font-family:monospace;font-weight:600;color:#1e293b}
.btn{display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 32px;border-radius:10px;font-weight:600;font-size:14px;margin-top:20px}
.f{padding:24px 32px;text-align:center;border-top:1px solid #e2e8f0}
.f p{font-size:12px;color:#94a3b8;margin:4px 0}
</style></head><body>
<div class="c">
<div class="h"><h1>✅ Data Filler Account Created</h1><p>${orgLabel}</p></div>
<div class="b">
<p style="font-size:16px;color:#1e293b">Dear <strong>${name}</strong>,</p>
<p style="color:#64748b">A data filler account has been created for you. Log in with the credentials below.</p>
<div class="badge">${orgLabel}</div>
<div class="cred">
<div class="r"><span class="l">Email</span><span class="v">${email}</span></div>
<div class="r"><span class="l">Password</span><span class="v">${password}</span></div>
</div>
<p style="font-size:14px;color:#64748b">You can change your password after logging in.</p>
<a href="${APP_URL}" class="btn">Log In to Your Account</a>
</div>
<div class="f"><p>DonationVerify — Secure Donation Platform</p></div>
</div>
</body></html>`;
}

const ORG_LABELS: Record<string, string> = {
  government: "Government",
  university: "University",
  hospital: "Hospital",
  school: "School",
  ngo: "NGO",
  company: "Company",
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("[create-data-filler] Request body:", JSON.stringify(body, null, 2));
    const { email, password, full_name, org_type, organization_name } = body;

    if (!email || !password || !full_name || !org_type || !organization_name) {
      const msg = "Missing required fields";
      console.error("[create-data-filler] Validation error:", { email: !!email, password: !!password, full_name: !!full_name, org_type: !!org_type, organization_name: !!organization_name });
      return NextResponse.json({ success: false, message: msg }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ success: false, message: "Password must be at least 6 characters" }, { status: 400 });
    }

    console.log("[create-data-filler] Creating auth user for:", email);
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
    });

    if (error) {
      console.error("[create-data-filler] createUser error:", error);
      if (error.status === 409 || error.message?.toLowerCase().includes("already")) {
        return NextResponse.json({ success: false, message: "An account with this email already exists" }, { status: 409 });
      }
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    const userId = data.user?.id;
    console.log("[create-data-filler] User created with ID:", userId);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Failed to create user - no user ID returned" }, { status: 500 });
    }

    console.log("[create-data-filler] Inserting profile for user:", userId);
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: userId,
        email,
        full_name,
        role: "data_filler",
        org_type,
        organization_name,
      });

    if (profileError) {
      console.error("[create-data-filler] Profile error:", profileError);
      return NextResponse.json({ success: false, message: "Profile insert error: " + profileError.message }, { status: 500 });
    }

    // Send email via nodemailer (if SMTP configured)
    let emailSent = false;
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
        const orgLabel = ORG_LABELS[org_type] || org_type;
        await transporter.sendMail({
          from: `"${smtpFromName}" <${smtpFrom}>`,
          to: email,
          subject: `Your Data Filler Account – ${orgLabel}`,
          html: emailHtml(full_name, email, password, orgLabel),
        });
        emailSent = true;
        console.log("[create-data-filler] Email sent to", email);
      } catch (mailErr) {
        console.error("[create-data-filler] Email send error:", mailErr);
      }
    } else {
      console.log("[create-data-filler] SMTP not configured, skipping email");
    }

    console.log("[create-data-filler] Success! Returning credentials");
    return NextResponse.json({
      success: true,
      email_sent: emailSent,
      message: emailSent
        ? `Account created and credentials sent to ${email}`
        : "Account created. Configure SMTP in .env.local to send emails automatically.",
      credentials: { email, password },
    });
  } catch (error) {
    console.error("[create-data-filler] Unhandled exception:", error);
    console.error("[create-data-filler] Stack:", error instanceof Error ? error.stack : "N/A");
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to create data filler",
      },
      { status: 500 }
    );
  }
}
