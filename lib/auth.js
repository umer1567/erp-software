
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const secretValue = process.env.JWT_SECRET;

if (!secretValue) {
    throw new Error("JWT_SECRET is not configured.");
}

const secret = new TextEncoder().encode(secretValue);

/**
 * Create an authentication token.
 * Accepts camelCase properties and legacy snake_case properties.
 */
export async function createToken(user) {
    const userId = user.userId ?? user.user_id;
    const username = user.username;
    const roleId = user.roleId ?? user.role_id;
    const roleName = user.roleName ?? user.role_name;
    const companyId = user.companyId ?? user.company_id;

    if (
        userId === undefined ||
        userId === null ||
        !username ||
        roleId === undefined ||
        roleId === null ||
        companyId === undefined ||
        companyId === null
    ) {
        throw new Error(
            "Cannot create authentication token: required user information is missing."
        );
    }

    return await new SignJWT({
        userId,
        username,
        roleId,
        roleName: roleName ?? null,
        companyId,
    })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("1d")
        .sign(secret);
}

/**
 * Verify an authentication token.
 */
export async function verifyToken(token) {
    if (!token || typeof token !== "string") {
        return null;
    }

    try {
        const { payload } = await jwtVerify(token, secret, {
            algorithms: ["HS256"],
        });

        // Reject tokens missing essential authentication claims.
        if (
            payload.userId === undefined ||
            payload.userId === null ||
            !payload.username ||
            payload.roleId === undefined ||
            payload.roleId === null ||
            payload.companyId === undefined ||
            payload.companyId === null
        ) {
            return null;
        }

        return payload;
    } catch {
        return null;
    }
}

/**
 * Get the currently authenticated user from the HTTP-only cookie.
 */
export async function getCurrentUser() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("erp_token")?.value;

        if (!token) {
            return null;
        }

        return await verifyToken(token);
    } catch (error) {
        console.error("Failed to read authentication cookie:", error);
        return null;
    }
}
