import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "";

  // If Supabase keys are not set yet (initial setup state), allow pass-through
  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: ALWAYS use getUser() per security guidelines, never getSession()
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthRoute =
    pathname.startsWith("/login") || pathname.startsWith("/auth");
  const isWaitingRoute = pathname === "/waiting-approval";

  // If not logged in and requesting a protected page
  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // If logged in and visiting login page
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // If logged in, check profile approval status for UX routing
  if (user && !isAuthRoute) {
    // Check if user is an admin or approved
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_approved")
      .eq("id", user.id)
      .maybeSingle();

    // All registered students can access immediately unless explicitly revoked (is_approved === false)
    const isApproved = profile ? profile.is_approved : true;

    // Primary admin check fallback + Supabase RPC check
    const isPrimaryEmail = user.email?.toLowerCase() === "psreyas09@gmail.com";
    const { data: isAdmin } = await supabase.rpc("is_admin");

    const hasAccess = isApproved || !!isAdmin || isPrimaryEmail;

    if (!hasAccess && !isWaitingRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/waiting-approval";
      return NextResponse.redirect(url);
    }

    if (hasAccess && isWaitingRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    // Protect /admin: require admin role or primary admin email
    if (pathname.startsWith("/admin") && !isAdmin && !isPrimaryEmail) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
