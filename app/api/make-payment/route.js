import { createVoucherHandlers } from "@/lib/account-voucher-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const handlers = createVoucherHandlers("PAYMENT");

export const GET = handlers.GET;
export const POST = handlers.POST;