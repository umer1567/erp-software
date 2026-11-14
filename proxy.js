
import { NextResponse } from "next/server";
import { getActiveUserFromToken } from "@/lib/auth";

export async function proxy(request) {
  const token = request.cookies.get("erp_token")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const user = await getActiveUserFromToken(token);

    if (!user) {
      // Do not delete the cookie here.
      // An older request could otherwise delete a newly issued login cookie.
      const response = NextResponse.redirect(
        new URL("/login?reason=session_expired", request.url)
      );

      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      return response;
    }

    return NextResponse.next();
  } catch (error) {
    console.error("Dashboard session validation error:", error);

    // Fail closed, but do not clear the authentication cookie here.
    const response = NextResponse.redirect(
      new URL("/login?reason=session_validation_failed", request.url)
    );

    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return response;
  }
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
