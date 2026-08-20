import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createSupabaseServerClient();
    const { id } = await params;
    
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

    const body = await req.json();
    
    // Build update payload dynamically
    const updates: any = {};
    if (body.plan !== undefined) updates.plan = body.plan;
    if (body.is_banned !== undefined) updates.is_banned = body.is_banned;
    if (body.is_lifetime !== undefined) updates.is_lifetime = body.is_lifetime;
    
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { error } = await supabase
      .from("businesses")
      .update(updates)
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Admin Business Update error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
