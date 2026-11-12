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
      const response = NextResponse.redirect(
        new URL("/login?reason=session_expired", request.url)
      );

      response.cookies.set("erp_token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        expires: new Date(0),
        maxAge: 0,
        path: "/",
      });

      return response;
    }

    return NextResponse.next();
  } catch (error) {
    console.error("Dashboard session validation error:", error);

    // Fail closed if the database cannot validate the session.
    const response = NextResponse.redirect(
      new URL("/login?reason=session_validation_failed", request.url)
    );

    response.cookies.set("erp_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: new Date(0),
      maxAge: 0,
      path: "/",
    });

    return response;
  }
}

export const config = {
  matcher: ["/dashboard/:path*"],
};