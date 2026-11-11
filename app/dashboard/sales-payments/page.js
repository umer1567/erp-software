"use client";

import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PERMISSION_KEY = "sales_payment";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-blue-400 dark:focus:ring-blue-400/10";

const labelClass =
  "mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300";

const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition duration-200 hover:-translate-y-0.5 hover:from-blue-700 hover:to-blue-800 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0";

const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800";

const cardClass =
  "rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/30 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/10";

const defaultPermissions = {
  can_view: false,
  can_create: false,
  can_update: false,
  can_delete: false,
};

function Icon({ name, className = "h-5 w-5" }) {
  const common = {
    className,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  };

  const paths = {
    wallet: (
      <>
        <rect x="3" y="5" width="18" height="15" rx="2" />
        <path d="M3 9h18" />
        <path d="M16 14h.01" />
        <path d="M7 5V3h10v2" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    receipt: (
      <>
        <path d="M4 3h16v18l-3-2-3 2-2-2-3 2-2-2-3 2V3Z" />
        <path d="M8 8h8M8 12h8M8 16h4" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    eye: (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    edit: (
      <>
        <path d="m15 5 4 4" />
        <path d="M4 20l4.5-1 11-11a2.12 2.12 0 0 0-3-3l-11 11L4 20Z" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5" />
        <path d="M5 17v4h14v-4" />
      </>
    ),
    printer: (
      <>
        <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <path d="M6 14h12v7H6z" />
        <path d="M18 12h.01" />
      </>
    ),
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    bank: (
      <>
        <path d="m3 9 9-6 9 6" />
        <path d="M4 10h16M5 10v9m5-9v9m4-9v9m5-9v9M3 21h18" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M5.5 9a7 7 0 0 1 12-2L20 12M4 12l2.5 5a7 7 0 0 0 12-2" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
      </>
    ),
    file: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6M8 13h8M8 17h8" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
      </>
    ),
  };

  return <svg {...common}>{paths[name] || paths.file}</svg>;
}

function PaymentMethodBadge({ method }) {
  const normalized = String(method || "OTHER").toUpperCase();

  const styles = {
    CASH: "bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20",
    BANK: "bg-blue-50 text-blue-700 ring-blue-600/15 dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-400/20",
    CHEQUE:
      "bg-violet-50 text-violet-700 ring-violet-600/15 dark:bg-violet-400/10 dark:text-violet-300 dark:ring-violet-400/20",
    CARD: "bg-cyan-50 text-cyan-700 ring-cyan-600/15 dark:bg-cyan-400/10 dark:text-cyan-300 dark:ring-cyan-400/20",
    OTHER:
      "bg-slate-100 text-slate-700 ring-slate-600/10 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset ${
        styles[normalized] || styles.OTHER
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {normalized}
    </span>
  );
}

function SummaryCard({ title, value, description, icon, accent }) {
  const accents = {
    blue: {
      icon: "bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300",
      line: "from-blue-500 to-cyan-400",
    },
    green: {
      icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
      line: "from-emerald-500 to-teal-400",
    },
    violet: {
      icon: "bg-violet-100 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300",
      line: "from-violet-500 to-fuchsia-400",
    },
  };

  const theme = accents[accent] || accents.blue;

  return (
    <div
      className={`${cardClass} group relative overflow-hidden p-5 transition duration-300 hover:-translate-y-1 hover:shadow-lg`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${theme.line}`}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <p className="mt-3 break-words text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            {value}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${theme.icon}`}
        >
          <Icon name={icon} className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

function AccessDenied({ onBack }) {
  return (
    <div className="flex min-h-[75vh] items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-lg rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-xl shadow-rose-950/5 dark:border-rose-900/60 dark:bg-slate-900">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-rose-100 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300">
          <Icon name="lock" className="h-9 w-9" />
        </div>

        <h1 className="mt-6 text-2xl font-extrabold text-slate-900 dark:text-white">
          Access Denied
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
          You do not have permission to view Sales Payments. Please contact
          your administrator to request access.
        </p>

        <div className="mt-5 inline-flex rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300">
          Required permission: sales_payments → View
        </div>

        <button
          type="button"
          onClick={onBack}
          className={`${secondaryButtonClass} mt-7`}
        >
          Back
        </button>
      </div>
    </div>
  );
}

function PermissionLoading() {
  return (
    <div className="flex min-h-[75vh] flex-col items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="h-11 w-11 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" />
      <p className="mt-5 font-semibold text-slate-800 dark:text-slate-200">
        Checking Sales Payment permissions...
      </p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Please wait while we verify your access.
      </p>
    </div>
  );
}

export default function SalesPaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const [invoiceId, setInvoiceId] = useState("");
  const [paymentNumber, setPaymentNumber] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // User rights
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [permissionError, setPermissionError] = useState("");
  const [permissions, setPermissions] = useState(defaultPermissions);
  const [permissionRetry, setPermissionRetry] = useState(0);

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [methodFilter, setMethodFilter] = useState("ALL");

  const canView = permissions.can_view;
  const canCreate = permissions.can_create;
  const canEdit = permissions.can_update;
  const canDelete = permissions.can_delete;

  // Load current user's permissions.
  // Load current user's permissions.
useEffect(() => {
  let cancelled = false;

  async function loadPermissions() {
    setPermissionLoading(true);
    setPermissionError("");

    try {
      const response = await fetch(
        `/api/permissions/current?permissionKey=${encodeURIComponent(
          PERMISSION_KEY
        )}`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to load Sales Payment permissions."
        );
      }

      // Support both API response formats:
      // { permission: {...} }
      // { permissions: [...] }
      let permission = data.permission || null;

      if (!permission && Array.isArray(data.permissions)) {
        permission = data.permissions.find(
          (item) =>
            String(item.permission_key || "").trim().toLowerCase() ===
            PERMISSION_KEY
        );
      }

      // Also support a direct permission object response.
      if (!permission && data.permission_key === PERMISSION_KEY) {
        permission = data;
      }

      const isEnabled = (value) =>
        value === true ||
        value === 1 ||
        value === "1" ||
        String(value).toLowerCase() === "true";

      if (!permission) {
        throw new Error(
          `Permission "${PERMISSION_KEY}" was not found in the API response.`
        );
      }

      if (!cancelled) {
        setPermissions({
          can_view: isEnabled(permission.can_view),
          can_create: isEnabled(permission.can_create),
          can_update: isEnabled(permission.can_update),
          can_delete: isEnabled(permission.can_delete),
        });
      }
    } catch (err) {
      console.error("Sales Payment permission error:", err);

      if (!cancelled) {
        setPermissions(defaultPermissions);
        setPermissionError(
          err.message || "Unable to verify your permissions."
        );
      }
    } finally {
      if (!cancelled) {
        setPermissionLoading(false);
      }
    }
  }

  loadPermissions();

  return () => {
    cancelled = true;
  };
}, [permissionRetry]);

  // Load payment data only after View permission is confirmed.
  useEffect(() => {
    if (permissionLoading || !canView) return;

    let cancelled = false;

    async function loadData() {
      setLoading(true);

      try {
        const [paymentResponse, invoiceResponse] = await Promise.all([
          fetch("/api/sales-payments", { cache: "no-store" }),
          fetch("/api/sales-invoices", { cache: "no-store" }),
        ]);

        const paymentData = await paymentResponse.json();
        const invoiceData = await invoiceResponse.json();

        if (!paymentResponse.ok) {
          throw new Error(paymentData.message || "Failed to load payments.");
        }

        if (!invoiceResponse.ok) {
          throw new Error(invoiceData.message || "Failed to load invoices.");
        }

        if (!cancelled) {
          setPayments(paymentData.payments || []);
          setInvoices(invoiceData.invoices || []);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError(err.message || "Failed to load data.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [permissionLoading, canView]);

  const selectedInvoice = invoices.find(
    (invoice) => String(invoice.invoice_id) === String(invoiceId)
  );

  const totalCollected = useMemo(
    () =>
      payments.reduce(
        (total, payment) => total + Number(payment.amount || 0),
        0
      ),
    [payments]
  );

  const paymentMethodsUsed = useMemo(
    () => new Set(payments.map((payment) => payment.payment_method)).size,
    [payments]
  );

  const filteredPayments = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return payments.filter((payment) => {
      const matchesMethod =
        methodFilter === "ALL" ||
        String(payment.payment_method || "OTHER").toUpperCase() ===
          methodFilter;

      const searchableText = [
        payment.payment_number,
        payment.invoice_number,
        payment.customer_name,
        payment.reference_number,
        payment.payment_method,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesMethod && (!query || searchableText.includes(query));
    });
  }, [payments, searchTerm, methodFilter]);

  function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString("en-GB");
  }

  function formatMoney(value) {
    return Number(value || 0).toLocaleString("en-PK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function resetForm() {
    setEditingPaymentId(null);
    setInvoiceId("");
    setPaymentNumber("");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setAmount("");
    setPaymentMethod("CASH");
    setReferenceNumber("");
    setNotes("");
    setShowPaymentForm(false);
  }

  function addPayment() {
    if (!canCreate) {
      setError("You do not have permission to create Sales Payments.");
      return;
    }

    setError("");
    setSelectedPayment(null);
    setEditingPaymentId(null);
    setInvoiceId("");
    setPaymentNumber("");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setAmount("");
    setPaymentMethod("CASH");
    setReferenceNumber("");
    setNotes("");
    setShowPaymentForm(true);
  }

  async function refreshData() {
    const [paymentResponse, invoiceResponse] = await Promise.all([
      fetch("/api/sales-payments", { cache: "no-store" }),
      fetch("/api/sales-invoices", { cache: "no-store" }),
    ]);

    const paymentData = await paymentResponse.json();
    const invoiceData = await invoiceResponse.json();

    if (!paymentResponse.ok) {
      throw new Error(paymentData.message || "Failed to refresh payments.");
    }

    if (!invoiceResponse.ok) {
      throw new Error(invoiceData.message || "Failed to refresh invoices.");
    }

    setPayments(paymentData.payments || []);
    setInvoices(invoiceData.invoices || []);
  }

  async function savePayment(e) {
    e.preventDefault();
    setError("");

    if (editingPaymentId && !canEdit) {
      setError("You do not have permission to edit Sales Payments.");
      return;
    }

    if (!editingPaymentId && !canCreate) {
      setError("You do not have permission to create Sales Payments.");
      return;
    }

    if (!invoiceId) {
      setError("Please select an invoice.");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setError("Payment amount must be greater than zero.");
      return;
    }

    if (
      !editingPaymentId &&
      selectedInvoice &&
      Number(amount) > Number(selectedInvoice.balance_amount)
    ) {
      setError("Payment cannot be greater than invoice balance.");
      return;
    }

    setSaving(true);

    try {
      const method = editingPaymentId ? "PUT" : "POST";

      const response = await fetch("/api/sales-payments", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingPaymentId ? { paymentId: editingPaymentId } : {}),
          paymentNumber,
          invoiceId: Number(invoiceId),
          paymentDate,
          amount: Number(amount),
          paymentMethod,
          referenceNumber,
          notes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            (editingPaymentId
              ? "Failed to update payment."
              : "Failed to save payment.")
        );
      }

      await refreshData();
      resetForm();
      setError("");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save payment.");
    } finally {
      setSaving(false);
    }
  }

  async function viewPayment(paymentId) {
    if (!canView) {
      setError("You do not have permission to view Sales Payments.");
      return;
    }

    try {
      setPaymentLoading(true);
      setError("");

      const response = await fetch(
        `/api/sales-payments?paymentId=${encodeURIComponent(paymentId)}`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load payment.");
      }

      if (!data.payment) throw new Error("Payment not found.");

      setSelectedPayment(data.payment);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load payment.");
    } finally {
      setPaymentLoading(false);
    }
  }

  async function editPayment(paymentId) {
    if (!canEdit) {
      setError("You do not have permission to edit Sales Payments.");
      return;
    }

    try {
      setPaymentLoading(true);
      setError("");

      const response = await fetch(
        `/api/sales-payments?paymentId=${encodeURIComponent(paymentId)}`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load payment.");
      }

      if (!data.payment) throw new Error("Payment not found.");

      const payment = data.payment;

      setEditingPaymentId(payment.payment_id);
      setPaymentNumber(payment.payment_number || "");
      setInvoiceId(
        payment.invoice_id ? String(payment.invoice_id) : ""
      );
      setPaymentDate(
        payment.payment_date
          ? String(payment.payment_date).slice(0, 10)
          : new Date().toISOString().split("T")[0]
      );
      setAmount(
        payment.amount !== null && payment.amount !== undefined
          ? String(payment.amount)
          : ""
      );
      setPaymentMethod(payment.payment_method || "CASH");
      setReferenceNumber(payment.reference_number || "");
      setNotes(payment.notes || "");

      setSelectedPayment(null);
      setShowPaymentForm(true);

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load payment.");
    } finally {
      setPaymentLoading(false);
    }
  }

  function printPayment() {
    if (!canView || !selectedPayment) return;
    window.print();
  }

  function downloadPaymentPDF() {
    if (!canView || !selectedPayment) return;

    const payment = selectedPayment;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 42, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("GOLDENLAKE", 14, 19);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Customer Payment Receipt", 14, 28);

    doc.setFontSize(9);
    doc.text(`Payment #: ${payment.payment_number || "-"}`, pageWidth - 80, 16);
    doc.text(`Date: ${formatDate(payment.payment_date)}`, pageWidth - 80, 23);
    doc.text(`Method: ${payment.payment_method || "-"}`, pageWidth - 80, 30);

    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.text("RECEIVED FROM", 14, 56);
    doc.setFont("helvetica", "normal");
    doc.text(payment.customer_name || "-", 14, 64);

    if (payment.customer_code) {
      doc.text(`Customer Code: ${payment.customer_code}`, 14, 71);
    }

    doc.setFont("helvetica", "bold");
    doc.text("AGAINST INVOICE", pageWidth / 2, 56);
    doc.setFont("helvetica", "normal");
    doc.text(payment.invoice_number || "-", pageWidth / 2, 64);

    autoTable(doc, {
      startY: 84,
      head: [["Payment Number", "Invoice", "Method", "Reference", "Amount"]],
      body: [
        [
          payment.payment_number || "-",
          payment.invoice_number || "-",
          payment.payment_method || "-",
          payment.reference_number || "-",
          Number(payment.amount || 0).toFixed(2),
        ],
      ],
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 4,
        textColor: [51, 65, 85],
        lineColor: [226, 232, 240],
      },
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      columnStyles: { 4: { halign: "right" } },
    });

    let finalY = doc.lastAutoTable.finalY + 16;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Payment Amount:", pageWidth - 80, finalY);

    doc.text(
      Number(payment.amount || 0).toLocaleString("en-PK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      pageWidth - 14,
      finalY,
      { align: "right" }
    );

    if (payment.notes) {
      finalY += 20;

      doc.setFontSize(10);
      doc.text("Notes:", 14, finalY);

      finalY += 7;
      doc.setFont("helvetica", "normal");

      const noteLines = doc.splitTextToSize(payment.notes, pageWidth - 28);
      doc.text(noteLines, 14, finalY);
    }

    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 29, pageWidth - 14, pageHeight - 29);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(
      "Thank you for your payment.",
      pageWidth / 2,
      pageHeight - 19,
      { align: "center" }
    );

    const filename = String(payment.payment_number || "Receipt").replace(
      /[^a-zA-Z0-9_-]/g,
      "_"
    );

    doc.save(`Payment-${filename}.pdf`);
  }

  // Keep all hooks above this point. View permission controls the entire page.
  if (permissionLoading) {
    return <PermissionLoading />;
  }

  if (!canView) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        {permissionError && (
          <div className="mx-auto max-w-lg px-4 pt-6">
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              {permissionError}
              <button
                type="button"
                onClick={() => setPermissionRetry((value) => value + 1)}
                className="ml-2 font-bold underline"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        <AccessDenied onBack={() => window.history.back()} />
      </div>
    );
  }

  return (
    <div className="sales-payments-page min-h-screen space-y-7 bg-slate-50/70 p-4 text-slate-800 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100 sm:p-6 xl:p-8">
      {/* Page header */}
      <section className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-emerald-600 p-6 text-white shadow-xl shadow-blue-900/10 sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-24 -z-10 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 -z-10 h-64 w-64 rounded-full bg-emerald-300/20 blur-3xl" />

        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-white/90 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.8)]" />
              ACCOUNTS RECEIVABLE
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Sales Payments
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-blue-50 sm:text-base">
              Record customer receipts, track invoice balances, and keep your
              payment history organized in one place.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-blue-50">
              <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
                <Icon name="shield" className="h-4 w-4" />
                Payment management
              </span>
              <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
                <Icon name="receipt" className="h-4 w-4" />
                Printable receipts
              </span>
            </div>
          </div>

          {!showPaymentForm && canCreate && (
            <button
              type="button"
              onClick={addPayment}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-blue-700 shadow-lg transition duration-200 hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-white/30"
            >
              <Icon name="plus" className="h-5 w-5" />
              Record Payment
              <Icon name="arrow" className="h-4 w-4" />
            </button>
          )}
        </div>
      </section>

      {/* Error message */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 shadow-sm dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200"
        >
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/50">
            <Icon name="info" className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-semibold">Something needs your attention</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>

          <button
            type="button"
            onClick={() => setError("")}
            className="rounded-lg p-1 text-red-700 transition hover:bg-red-100 dark:text-red-200 dark:hover:bg-red-900/60"
            aria-label="Dismiss error"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Summary cards */}
      {!showPaymentForm && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SummaryCard
            title="Total Payments Recorded"
            value={payments.length.toLocaleString("en-PK")}
            description="All receipts in payment history"
            icon="receipt"
            accent="blue"
          />
          <SummaryCard
            title="Total Amount Collected"
            value={`₨ ${formatMoney(totalCollected)}`}
            description="Combined value of recorded receipts"
            icon="wallet"
            accent="green"
          />
          <SummaryCard
            title="Payment Methods Used"
            value={paymentMethodsUsed.toLocaleString("en-PK")}
            description="Distinct methods in your records"
            icon="bank"
            accent="violet"
          />
        </section>
      )}

      {/* Payment form */}
      {showPaymentForm && (
        <form
          onSubmit={savePayment}
          className={`${cardClass} overflow-hidden`}
        >
          <div className="flex flex-col gap-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 via-white to-emerald-50 p-5 dark:border-slate-800 dark:from-blue-950/40 dark:via-slate-900 dark:to-emerald-950/30 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-emerald-500 text-white shadow-lg shadow-blue-600/20">
                <Icon
                  name={editingPaymentId ? "edit" : "wallet"}
                  className="h-6 w-6"
                />
              </div>

              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {editingPaymentId ? "Edit Payment" : "Record a Payment"}
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {editingPaymentId
                    ? "Update the information for this customer receipt."
                    : "Enter the receipt details and link it to a sales invoice."}
                </p>
              </div>
            </div>

            {editingPaymentId && (
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
                <Icon name="edit" className="h-3.5 w-3.5" />
                EDITING PAYMENT
              </span>
            )}
          </div>

          <div className="space-y-7 p-5 sm:p-7">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">
                  1
                </span>
                <h3 className="font-bold text-slate-800 dark:text-slate-100">
                  Payment details
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                <div>
                  <label className={labelClass}>Payment Number</label>
                  <input
                    value={paymentNumber}
                    onChange={(e) => setPaymentNumber(e.target.value)}
                    placeholder="e.g. PAY-001"
                    className={inputClass}
                  />
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    Leave blank if your API generates this number.
                  </p>
                </div>

                <div>
                  <label className={labelClass}>
                    Sales Invoice <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={invoiceId}
                    onChange={(e) => setInvoiceId(e.target.value)}
                    required
                    className={inputClass}
                  >
                    <option value="">Select an invoice</option>
                    {invoices
                      .filter(
                        (invoice) =>
                          Number(invoice.balance_amount) > 0 ||
                          String(invoice.invoice_id) === String(invoiceId)
                      )
                      .map((invoice) => (
                        <option
                          key={invoice.invoice_id}
                          value={invoice.invoice_id}
                        >
                          {invoice.invoice_number} — {invoice.customer_name} —
                          Balance: {formatMoney(invoice.balance_amount)}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>
                    Payment Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    Amount <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sm font-bold text-slate-400 dark:text-slate-500">
                      ₨
                    </span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      placeholder="0.00"
                      className={`${inputClass} pl-9 font-semibold tabular-nums`}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    Enter a positive amount in PKR.
                  </p>
                </div>

                <div>
                  <label className={labelClass}>
                    Payment Method <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    required
                    className={inputClass}
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bank</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="CARD">Card</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Reference Number</label>
                  <input
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="Optional transaction reference"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {selectedInvoice && (
              <div className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-emerald-50 dark:border-slate-700 dark:from-blue-950/30 dark:to-emerald-950/20">
                <div className="flex items-center gap-2 border-b border-blue-100 px-5 py-3 dark:border-slate-700">
                  <Icon
                    name="receipt"
                    className="h-4 w-4 text-blue-600 dark:text-blue-400"
                  />
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Selected invoice summary
                  </h3>
                  <span className="ml-auto rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {selectedInvoice.invoice_number || "Invoice"}
                  </span>
                </div>

                <div className="grid grid-cols-1 divide-y divide-blue-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-slate-700">
                  <div className="p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Invoice Total
                    </p>
                    <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                      ₨ {formatMoney(selectedInvoice.total_amount)}
                    </p>
                  </div>
                  <div className="p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Already Paid
                    </p>
                    <p className="mt-2 text-xl font-bold text-emerald-700 dark:text-emerald-300">
                      ₨ {formatMoney(selectedInvoice.paid_amount)}
                    </p>
                  </div>
                  <div className="p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Remaining Balance
                    </p>
                    <p className="mt-2 text-xl font-bold text-rose-600 dark:text-rose-300">
                      ₨ {formatMoney(selectedInvoice.balance_amount)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                  2
                </span>
                <h3 className="font-bold text-slate-800 dark:text-slate-100">
                  Additional information
                </h3>
              </div>

              <label className={labelClass}>Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Add any relevant notes about this payment..."
                className={`${inputClass} min-h-[100px] resize-y`}
              />
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Icon
                  name="shield"
                  className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
                />
                Please verify the invoice and amount before saving.
              </p>

              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    resetForm();
                    setError("");
                  }}
                  className={secondaryButtonClass}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving || (editingPaymentId ? !canEdit : !canCreate)}
                  className={primaryButtonClass}
                >
                  {saving ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      {editingPaymentId ? "Updating..." : "Saving..."}
                    </>
                  ) : (
                    <>
                      <Icon name="check" className="h-4 w-4" />
                      {editingPaymentId ? "Update Payment" : "Save Payment"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Payment history */}
      {!showPaymentForm && (
        <section className={`${cardClass} overflow-hidden`}>
          <div className="border-b border-slate-200 p-5 dark:border-slate-800 sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">
                  <Icon name="receipt" className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Payment History
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Search, review, and edit recorded customer payments.
                  </p>
                </div>
              </div>

              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {payments.length}{" "}
                {payments.length === 1 ? "payment" : "payments"}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <div className="relative">
                <Icon
                  name="search"
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search payment, invoice, customer, or reference..."
                  className={`${inputClass} pl-10`}
                  aria-label="Search payments"
                />
              </div>

              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className={inputClass}
                aria-label="Filter by payment method"
              >
                <option value="ALL">All payment methods</option>
                <option value="CASH">Cash</option>
                <option value="BANK">Bank</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CARD">Card</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center px-6 py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" />
              <p className="mt-4 font-semibold text-slate-700 dark:text-slate-200">
                Loading payment history
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Retrieving your latest payment records...
              </p>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                <Icon name="receipt" className="h-8 w-8" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-slate-900 dark:text-white">
                {payments.length === 0
                  ? "No payments recorded yet"
                  : "No matching payments"}
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                {payments.length === 0
                  ? "Record your first customer payment to start building your payment history."
                  : "Try changing your search term or selecting another payment method."}
              </p>

              {payments.length === 0 && canCreate ? (
                <button
                  type="button"
                  onClick={addPayment}
                  className={`${primaryButtonClass} mt-5`}
                >
                  <Icon name="plus" className="h-4 w-4" />
                  Record First Payment
                </button>
              ) : payments.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setMethodFilter("ALL");
                  }}
                  className={`${secondaryButtonClass} mt-5`}
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] border-collapse text-left">
                  <thead className="bg-slate-50 dark:bg-slate-950/70">
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      {[
                        ["Payment", "left"],
                        ["Invoice", "left"],
                        ["Customer", "left"],
                        ["Date", "left"],
                        ["Amount", "right"],
                        ["Method", "left"],
                        ["Reference", "left"],
                        ["Actions", "center"],
                      ].map(([heading, align]) => (
                        <th
                          key={heading}
                          className={`px-5 py-4 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 ${
                            align === "right"
                              ? "text-right"
                              : align === "center"
                              ? "text-center"
                              : "text-left"
                          }`}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredPayments.map((payment) => (
                      <tr
                        key={payment.payment_id}
                        className="group transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-400/[0.04]"
                      >
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => viewPayment(payment.payment_id)}
                            className="font-bold text-blue-700 transition hover:text-blue-900 hover:underline dark:text-blue-300 dark:hover:text-blue-200"
                          >
                            {payment.payment_number || "-"}
                          </button>
                          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                            ID: {payment.payment_id}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {payment.invoice_number || "-"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                              <Icon name="user" className="h-4 w-4" />
                            </div>
                            <span className="max-w-[180px] truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                              {payment.customer_name || "-"}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                          <span className="inline-flex items-center gap-2 whitespace-nowrap">
                            <Icon
                              name="calendar"
                              className="h-4 w-4 text-slate-400"
                            />
                            {formatDate(payment.payment_date)}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <span className="whitespace-nowrap text-sm font-extrabold tabular-nums text-slate-900 dark:text-white">
                            ₨ {formatMoney(payment.amount)}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <PaymentMethodBadge
                            method={payment.payment_method}
                          />
                        </td>

                        <td className="max-w-[170px] truncate px-5 py-4 text-sm text-slate-500 dark:text-slate-400">
                          {payment.reference_number || "—"}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => viewPayment(payment.payment_id)}
                              title="View receipt"
                              aria-label={`View payment ${
                                payment.payment_number || payment.payment_id
                              }`}
                              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300 dark:hover:bg-blue-400/20"
                            >
                              <Icon name="eye" className="h-4 w-4" />
                              View
                            </button>

                            {canEdit && (
                              <button
                                type="button"
                                onClick={() =>
                                  editPayment(payment.payment_id)
                                }
                                title="Edit payment"
                                aria-label={`Edit payment ${
                                  payment.payment_number || payment.payment_id
                                }`}
                                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-700 transition hover:border-amber-300 hover:bg-amber-100 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300 dark:hover:bg-amber-400/20"
                              >
                                <Icon name="edit" className="h-3.5 w-3.5" />
                                Edit
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Showing{" "}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {filteredPayments.length}
                  </strong>{" "}
                  of{" "}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {payments.length}
                  </strong>{" "}
                  payment records
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Icon
                    name="shield"
                    className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
                  />
                  Customer payment records
                </span>
              </div>
            </>
          )}
        </section>
      )}

      {/* Receipt modal */}
      {selectedPayment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedPayment(null);
          }}
        >
          <div
            className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-receipt-title"
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-emerald-50 p-5 dark:border-slate-800 dark:from-blue-950/40 dark:to-emerald-950/30 sm:px-7">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-emerald-500 text-white shadow-md">
                  <Icon name="receipt" className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2
                    id="payment-receipt-title"
                    className="text-lg font-bold text-slate-900 dark:text-white"
                  >
                    Payment Receipt
                  </h2>
                  <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">
                    {selectedPayment.payment_number || "Receipt"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                aria-label="Close receipt"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <div
              id="payment-receipt"
              className="receipt-print-area overflow-y-auto p-5 text-slate-800 dark:text-slate-100 sm:p-8"
            >
              <div className="flex flex-col justify-between gap-6 border-b border-slate-200 pb-6 dark:border-slate-700 sm:flex-row">
                <div>
                  <div className="inline-flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-emerald-500 text-white">
                      <Icon name="receipt" className="h-5 w-5" />
                    </div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                      GOLDENLAKE
                    </h1>
                  </div>
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                    Customer Payment Receipt
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-800/60 sm:min-w-[230px] sm:text-right">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Payment Reference
                  </p>
                  <p className="mt-1 break-all font-bold text-slate-900 dark:text-white">
                    {selectedPayment.payment_number || "-"}
                  </p>
                  <p className="mt-3 text-slate-600 dark:text-slate-300">
                    <strong>Date:</strong>{" "}
                    {formatDate(selectedPayment.payment_date)}
                  </p>
                  <p className="mt-1 text-slate-600 dark:text-slate-300">
                    <strong>Method:</strong>{" "}
                    {selectedPayment.payment_method || "-"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 py-6 sm:grid-cols-2 sm:gap-8">
                <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Received From
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                      <Icon name="user" className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {selectedPayment.customer_name || "-"}
                      </p>
                      {selectedPayment.customer_code && (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Customer code: {selectedPayment.customer_code}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Against Invoice
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">
                      <Icon name="file" className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {selectedPayment.invoice_number || "-"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Linked sales invoice
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                <table className="w-full min-w-[600px] border-collapse text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr>
                      {[
                        "Payment Number",
                        "Invoice",
                        "Method",
                        "Reference",
                        "Amount",
                      ].map((heading) => (
                        <th
                          key={heading}
                          className="border-b border-slate-200 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-white dark:bg-slate-900">
                      <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-200">
                        {selectedPayment.payment_number || "-"}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-200">
                        {selectedPayment.invoice_number || "-"}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-200">
                        {selectedPayment.payment_method || "-"}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-200">
                        {selectedPayment.reference_number || "-"}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-4 text-right text-sm font-bold text-slate-900 dark:border-slate-800 dark:text-white">
                        ₨ {formatMoney(selectedPayment.amount)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end">
                <div className="w-full max-w-sm rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-400/20 dark:bg-emerald-400/[0.06]">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    Total Payment Received
                  </p>
                  <p className="mt-2 text-2xl font-extrabold tabular-nums text-emerald-800 dark:text-emerald-200 sm:text-3xl">
                    ₨ {formatMoney(selectedPayment.amount)}
                  </p>
                </div>
              </div>

              {selectedPayment.notes && (
                <div className="mt-7 rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
                  <p className="font-bold text-slate-900 dark:text-white">
                    Notes
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {selectedPayment.notes}
                  </p>
                </div>
              )}

              <div className="mt-10 border-t border-slate-200 pt-5 text-center text-sm text-slate-400 dark:border-slate-700">
                Thank you for your payment.
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50 sm:px-6">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => editPayment(selectedPayment.payment_id)}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-amber-600"
                >
                  <Icon name="edit" className="h-4 w-4" />
                  Edit
                </button>
              )}

              <button
                type="button"
                onClick={printPayment}
                className={secondaryButtonClass}
              >
                <Icon name="printer" className="h-4 w-4" />
                Print
              </button>

              <button
                type="button"
                onClick={downloadPaymentPDF}
                className={primaryButtonClass}
              >
                <Icon name="download" className="h-4 w-4" />
                Download PDF
              </button>

              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="inline-flex items-center justify-center rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {paymentLoading && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" />
            <div>
              <p className="font-bold text-slate-900 dark:text-white">
                Loading payment
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Please wait...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Theme-aware styling and print receipt */}
      <style jsx global>{`
        .sales-payments-page {
          color-scheme: light;
        }

        html[data-theme="dark"] .sales-payments-page {
          color-scheme: dark;
        }

        .sales-payments-page input,
        .sales-payments-page select,
        .sales-payments-page textarea {
          color: inherit;
        }

        .sales-payments-page input::placeholder,
        .sales-payments-page textarea::placeholder {
          opacity: 1;
        }

        .sales-payments-page select option {
          background: white;
          color: #0f172a;
        }

        html[data-theme="dark"] .sales-payments-page select option {
          background: #0f172a;
          color: #f1f5f9;
        }

        @media print {
          @page {
            size: auto;
            margin: 12mm;
          }

          body * {
            visibility: hidden !important;
          }

          #payment-receipt,
          #payment-receipt * {
            visibility: visible !important;
          }

          #payment-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-height: none !important;
            overflow: visible !important;
            padding: 0 !important;
            color: #0f172a !important;
            background: #ffffff !important;
          }

          #payment-receipt,
          #payment-receipt * {
            color: #0f172a !important;
            border-color: #e2e8f0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          #payment-receipt .bg-slate-50,
          #payment-receipt .bg-white,
          #payment-receipt .dark\\:bg-slate-900 {
            background: #ffffff !important;
          }

          #payment-receipt .bg-emerald-50 {
            background: #ecfdf5 !important;
          }

          #payment-receipt .text-emerald-800 {
            color: #065f46 !important;
          }

          #payment-receipt .text-emerald-700 {
            color: #047857 !important;
          }

          #payment-receipt .text-slate-500,
          #payment-receipt .text-slate-400 {
            color: #64748b !important;
          }

          #payment-receipt .text-slate-900 {
            color: #0f172a !important;
          }

          #payment-receipt .text-slate-700 {
            color: #334155 !important;
          }

          .sales-payments-page {
            background: #ffffff !important;
          }
        }
      `}</style>
    </div>
  );
}