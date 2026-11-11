import AccountVoucherPage from "@/components/AccountVoucherPage";

export const dynamic = "force-dynamic";

export default function MakeReceiptPage() {
  return <AccountVoucherPage type="RECEIPT" />;
}