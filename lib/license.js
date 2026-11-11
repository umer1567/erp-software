const SUPER_ADMIN_API_URL = process.env.SUPER_ADMIN_API_URL;
const LICENSE_VERIFICATION_SECRET =
  process.env.LICENSE_VERIFICATION_SECRET;

const LICENSE_CLIENT_ID = process.env.LICENSE_CLIENT_ID;
const LICENSE_KEY = process.env.LICENSE_KEY;

export async function verifyClientLicense() {
  if (
    !SUPER_ADMIN_API_URL ||
    !LICENSE_VERIFICATION_SECRET ||
    !LICENSE_CLIENT_ID ||
    !LICENSE_KEY
  ) {
    return {
      valid: false,
      message: "License configuration is incomplete.",
    };
  }

  try {
    const response = await fetch(
      `${SUPER_ADMIN_API_URL.replace(/\/$/, "")}/api/licenses/verify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-license-verification-secret":
            LICENSE_VERIFICATION_SECRET,
        },
        body: JSON.stringify({
          clientId: LICENSE_CLIENT_ID,
          licenseKey: LICENSE_KEY,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      }
    );

    const result = await response.json();

    if (!response.ok || result.valid !== true) {
      return {
        valid: false,
        message: "The company license is invalid, expired, or inactive.",
      };
    }

    return {
      valid: true,
      clientId: result.clientId,
      licenseId: result.licenseId,
      expiresAt: result.expiresAt,
      message: "License verified successfully.",
    };
  } catch (error) {
    console.error("License verification failed:", error.message);

    return {
      valid: false,
      message:
        "The license server could not be reached. Please try again.",
    };
  }
}