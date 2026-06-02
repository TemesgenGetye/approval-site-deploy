import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const APP_URL = process.env.APP_URL || "https://donation.app/login";

const ORG_LABELS: Record<string, string> = {
  government: "Government Citizen Support",
  university: "University Needy Student",
  hospital: "Hospital Medical Support",
  school: "School Scholarship",
  ngo: "NGO Community Support",
  company: "Company Employee Assistance",
};

function generatePassword(length = 12): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let result = "";
  for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

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
<div class="h"><h1>✅ Verification Approved</h1><p>${orgLabel}</p></div>
<div class="b">
<p style="font-size:16px;color:#1e293b">Dear <strong>${name}</strong>,</p>
<p style="color:#64748b">Your account has been created. Log in with the credentials below.</p>
<div class="badge">${orgLabel}</div>
<div class="cred">
<div class="r"><span class="l">Email</span><span class="v">${email}</span></div>
<div class="r"><span class="l">Password</span><span class="v">${password}</span></div>
</div>
<p style="font-size:14px;color:#64748b">You can change your password after logging in.</p>
</div>
<div class="f"><p>DonationVerify — Secure Donation Platform</p></div>
</div>
</body></html>`;
}

export async function POST(request: Request) {
  console.log("[send-credentials] POST received");
  try {
    const body = await request.json();
    const { submission_id, applicant_name, applicant_email, applicant_phone, org_type, score } = body;

    console.log("[send-credentials] body:", { submission_id, applicant_name, applicant_email, org_type });

    if (!applicant_email || !submission_id) {
      return NextResponse.json(
        { success: false, message: "Missing applicant_email or submission_id" },
        { status: 400 },
      );
    }

    const orgLabel = ORG_LABELS[org_type as string] || org_type || "Applicant";
    const password = generatePassword();

    // ── 1. Create auth user with known password ──
    let userId: string | null = null;

    try {
      const { data, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: applicant_email,
        password,
        email_confirm: true,
      });

      if (createErr) {
        console.log("[send-credentials] createUser error:", createErr.status, createErr.message);

        if (createErr.status === 409 || createErr.message?.toLowerCase().includes("already")) {
          // User exists — find their ID from the users list
          const { data: usersList } = await supabaseAdmin.auth.admin.listUsers();
          const found = usersList?.users?.find((u) => u.email === applicant_email);
          if (!found) throw new Error(`User ${applicant_email} not found but registration said exists`);
          userId = found.id;

          // Update their password
          const { error: passErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
          if (passErr) throw passErr;
        } else {
          throw createErr;
        }
      } else {
        userId = data.user?.id ?? null;
      }
    } catch (authErr) {
      console.error("[send-credentials] Auth error:", authErr);
      throw authErr;
    }

    if (!userId) throw new Error("Failed to get or create user ID");

    // ── 2. Create / update profile ──
    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: userId,
          email: applicant_email,
          full_name: applicant_name,
          phone: applicant_phone || null,
          role: "recipient",
          recipient_status: "approved",
        },
        { onConflict: "id" },
      );
    if (profileErr) console.error("[PROFILE ERR]", profileErr);

    // ── 3. Update campaigns ──
    const priorityLevel = score >= 80 ? "high" : score >= 50 ? "medium" : "low";
    const { error: campErr } = await supabaseAdmin
      .from("campaigns")
      .update({
        priority_score: score || 0,
        priority_level: priorityLevel,
        verification_submission_id: submission_id,
      })
      .eq("recipient_id", userId);
    if (campErr) console.error("[CAMPAIGN ERR]", campErr);

    // ── 4. Mark submission ──
    const { error: updateErr } = await supabaseAdmin
      .from("verification_submissions")
      .update({
        auto_account_created: true,
        auto_account_email: applicant_email,
        auto_account_password: password,
      })
      .eq("id", submission_id);
    if (updateErr) console.error("[SUBMISSION UPDATE ERR]", updateErr);

    // ── 5. Send email via nodemailer (if SMTP configured) ──
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
        await transporter.sendMail({
          from: `"${smtpFromName}" <${smtpFrom}>`,
          to: applicant_email,
          subject: `Your DonationVerify Account – ${orgLabel} Approved`,
          html: emailHtml(applicant_name, applicant_email, password, orgLabel),
        });
        emailSent = true;
        console.log("[send-credentials] Email sent to", applicant_email);
      } catch (mailErr) {
        console.error("[EMAIL SEND ERR]", mailErr);
      }
    } else {
      console.log("[send-credentials] SMTP not configured, skipping email");
    }

    return NextResponse.json({
      success: true,
      email_sent: emailSent,
      message: emailSent
        ? `Credentials sent to ${applicant_email}`
        : "Account created. Configure SMTP in .env.local to send emails automatically.",
      credentials: { email: applicant_email, password },
    });
  } catch (error) {
    console.error("[send-credentials] FATAL:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
        detail: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
