
"use client";

import DeliveryChallanForm from "@/components/delivery-challans/DeliveryChallanForm";

export default function NewDeliveryChallanPage() {
    return (
        <main className="min-h-screen bg-slate-50 p-4 text-slate-800 dark:bg-slate-950 dark:text-slate-100 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-[1500px]">
                <DeliveryChallanForm />
            </div>
        </main>
    );
}
