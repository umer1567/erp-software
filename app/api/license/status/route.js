import { verifyClientLicense } from "@/lib/license";

export async function GET() {
  const license = await verifyClientLicense();

  return Response.json(
    {
      valid: license.valid,
      message: license.message,
      ...(license.valid
        ? {
            expiresAt: license.expiresAt ?? null,
          }
        : {}),
    },
    {
      status: license.valid ? 200 : 403,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}