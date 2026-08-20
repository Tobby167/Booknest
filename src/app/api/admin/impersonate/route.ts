import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    
    // 1. Verify caller is logged in
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Verify caller is an admin
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden. Admins only." }, { status: 403 });
    }

    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required to impersonate" }, { status: 400 });
    }

    // 3. Generate magic link using Admin API
    const adminClient = createSupabaseAdminClient();
    
    // The generateLink method creates a login link without sending an email.
    // When the admin clicks it, they instantly log in as that user!
    const { data, error } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://booknest-ashy.vercel.app'}/impersonate`
      }
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const actionLink = data.properties?.action_link;
    if (!actionLink) {
      return NextResponse.json({ error: "Could not generate impersonation link" }, { status: 500 });
    }

    return NextResponse.json({ url: actionLink });
  } catch (err: any) {
    console.error("Impersonation error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
