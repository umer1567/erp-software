import AccountVoucherPage from "@/components/AccountVoucherPage";

export const dynamic = "force-dynamic";

export default function MakePaymentPage() {
  return <AccountVoucherPage type="PAYMENT" />;
}