const ARCHIVE_TIMEOUT_MS = 15000;

function getArchiveConfig() {
    const baseUrl = process.env.ARCHIVE_RECEIVER_URL?.trim()?.replace(/\/+$/, "");
    const token = process.env.ARCHIVE_TOKEN?.trim();

    if (!baseUrl || !token) {
        throw new Error(
            "Archive receiver is not configured. Check ARCHIVE_RECEIVER_URL and ARCHIVE_TOKEN."
        );
    }

    let parsedUrl;

    try {
        parsedUrl = new URL(baseUrl);
    } catch {
        throw new Error("ARCHIVE_RECEIVER_URL is invalid.");
    }

    if (
        parsedUrl.protocol !== "https:" &&
        !["localhost", "127.0.0.1"].includes(parsedUrl.hostname)
    ) {
        throw new Error("Archive receiver must use HTTPS.");
    }

    return { baseUrl, token };
}

async function archiveRequest(endpoint, payload) {
    const { baseUrl, token } = getArchiveConfig();

    let response;

    try {
        response = await fetch(`${baseUrl}/api/archive/${endpoint}`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(ARCHIVE_TIMEOUT_MS),
            cache: "no-store",
        });
    } catch (error) {
        throw new Error(
            `Archive receiver connection failed: ${error.message}`,
            { cause: error }
        );
    }

    let result;

    try {
        result = await response.json();
    } catch {
        throw new Error(
            `Archive receiver returned an invalid response (HTTP ${response.status}).`
        );
    }

    if (!response.ok || result.success !== true) {
        const error = new Error(
            result.message ||
            result.error ||
            `Archive receiver request failed (HTTP ${response.status}).`
        );

        error.status = response.status;
        error.archiveResponse = result;

        throw error;
    }

    return result;
}

export async function stageArchive(archive) {
    if (!archive || typeof archive !== "object" || Array.isArray(archive)) {
        throw new Error("A valid archive object is required.");
    }

    return archiveRequest("stage", archive);
}

export async function commitArchive(archiveId) {
    if (!archiveId) {
        throw new Error("Archive ID is required.");
    }

    return archiveRequest("commit", { archiveId });
}

export async function cancelArchive(archiveId) {
    if (!archiveId) {
        throw new Error("Archive ID is required.");
    }

    return archiveRequest("cancel", { archiveId });
}

export async function getArchiveStatus(archiveId) {
    if (!archiveId) {
        throw new Error("Archive ID is required.");
    }

    return archiveRequest("status", { archiveId });
}
