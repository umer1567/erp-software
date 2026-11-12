// import { NextResponse } from "next/server";

// export async function POST() {
//   const response = NextResponse.json({
//     success: true,
//     message: "Logged out successfully.",
//   });

//   response.cookies.set(
//     "erp_token",
//     "",
//     {
//       httpOnly: true,
//       expires: new Date(0),
//       path: "/",
//     }
//   );

//   return response;
// }

import { NextResponse } from "next/server";
import {
  getTokenPayload,
  revokeSession,
} from "@/lib/auth";

export async function POST() {
  try {
    const user = await getTokenPayload();

    if (user?.sessionId) {
      await revokeSession(user.sessionId);
    }

    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully.",
    });

    response.cookies.set("erp_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: new Date(0),
      maxAge: 0,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Logout error:", error);

    const response = NextResponse.json({
      success: false,
      message: "Logout completed on this browser.",
    });

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