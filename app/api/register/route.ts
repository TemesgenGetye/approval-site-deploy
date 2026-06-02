import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function POST(request: Request) {
  try {
    const { email, password, full_name, role } = await request.json();

    if (!email || !password || !full_name) {
      return NextResponse.json(
        { success: false, message: "Missing required fields" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, message: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const validRole = role === "donor" || role === "recipient" ? role : "donor";

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

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: userId,
        email,
        full_name,
        role: validRole,
      });

    if (profileError) {
      console.error("[register] Profile error:", profileError);
      return NextResponse.json(
        { success: false, message: profileError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: { id: userId, email, full_name, role: validRole },
    });
  } catch (error) {
    console.error("[register] Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Registration failed",
      },
      { status: 500 }
    );
  }
}
