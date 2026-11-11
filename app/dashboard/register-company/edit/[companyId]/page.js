
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  CircleAlert,
  ImagePlus,
  LoaderCircle,
  MapPin,
  Save,
  Trash2,
  Upload,
  Mail,
  Phone,
  Hash,
  Globe2,
  Wallet,
  RefreshCw,
} from "lucide-react";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";

const labelClass = "mb-2 block text-sm font-semibold text-slate-700";

const MAX_LOGO_SIZE = 2 * 1024 * 1024;

const ACCEPTED_LOGO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
];

const EMPTY_FORM = {
  company_name: "",
  company_code: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  country: "Pakistan",
  currency: "PKR",
  registration_number: "",
};

function getCompanyLogo(company) {
  return (
    company?.logo_url ||
    company?.logoUrl ||
    company?.company_logo ||
    company?.companyLogo ||
    company?.logo ||
    company?.image_url ||
    company?.imageUrl ||
    ""
  );
}

function getCompanyId(company) {
  return String(
    company?.company_id ??
      company?.companyId ??
      company?.id ??
      ""
  );
}

function getCompanyForm(company) {
  return {
    company_name:
      company.company_name || company.companyName || "",
    company_code:
      company.company_code || company.companyCode || "",
    email: company.email || company.contact_email || "",
    phone: company.phone || company.contact_phone || "",
    address: company.address || "",
    city: company.city || "",
    country: company.country || "Pakistan",
    currency: company.currency || "PKR",
    registration_number:
      company.registration_number ||
      company.registrationNumber ||
      "",
  };
}

function SectionHeading({ icon: Icon, title, description }) {
  return (
    <div className="mb-6 flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
        <Icon size={20} />
      </div>

      <div>
        <h2 className="font-bold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm leading-5 text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  placeholder,
  icon: Icon,
  type = "text",
  required = false,
  autoComplete,
}) {
  return (
    <div>
      <label htmlFor={name} className={labelClass}>
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      <div className="relative">
        {Icon && (
          <Icon
            size={17}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
        )}

        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          maxLength={name === "company_name" ? 150 : undefined}
          className={`${inputClass} ${Icon ? "pl-10" : ""}`}
        />
      </div>
    </div>
  );
}

export default function EditCompanyPage() {
  const params = useParams();
  const router = useRouter();
  const fileInputRef = useRef(null);

  const companyId = Array.isArray(params?.companyId)
    ? params.companyId[0]
    : params?.companyId;

  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [originalLogo, setOriginalLogo] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [removeExistingLogo, setRemoveExistingLogo] =
    useState(false);
  const [logoError, setLogoError] = useState("");

  const loadCompany = useCallback(
    async (signal) => {
      const response = await fetch("/api/settings/list", {
        cache: "no-store",
        signal,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to load company information."
        );
      }

      const companies = Array.isArray(data)
        ? data
        : data.companies || data.data || [];

      const company = companies.find(
        (item) => getCompanyId(item) === String(companyId)
      );

      if (!company) {
        throw new Error(
          "Company not found. Return to the company list and try again."
        );
      }

      setForm(getCompanyForm(company));

      const logo = getCompanyLogo(company);

      setOriginalLogo(logo);
      setLogoPreview(logo);
      setLogoFile(null);
      setRemoveExistingLogo(false);
    },
    [companyId]
  );

  // No synchronous state updates in the effect body.
  // Missing IDs are handled in the render below.
  useEffect(() => {
    if (!companyId) return;

    const controller = new AbortController();

    async function initialize() {
      try {
        await loadCompany(controller.signal);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err.message || "Unable to load company information."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => controller.abort();
  }, [companyId, loadCompany]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  }

  function handleLogoChange(event) {
    const file = event.target.files?.[0];

    setLogoError("");

    if (!file) return;

    if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
      setLogoError("Choose a PNG, JPG, JPEG, or WebP image.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_LOGO_SIZE) {
      setLogoError("The logo must be 2 MB or smaller.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        setLogoFile(file);
        setLogoPreview(reader.result);
        setRemoveExistingLogo(false);
        setError("");
        setSuccess("");
      }
    };

    reader.onerror = () => {
      setLogoError("Unable to preview this image. Try another file.");
    };

    reader.readAsDataURL(file);
  }

  function handleRemoveLogo() {
    setLogoFile(null);
    setLogoPreview("");
    setRemoveExistingLogo(true);
    setLogoError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleRestoreLogo() {
    setLogoFile(null);
    setLogoPreview(originalLogo);
    setRemoveExistingLogo(false);
    setLogoError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setLogoError("");

    if (!form.company_name.trim()) {
      setError("Please enter the company name.");
      return;
    }

    if (!companyId) {
      setError("Company ID is missing.");
      return;
    }

    setSaving(true);

    try {
      const body = new FormData();

      body.append("company_name", form.company_name.trim());
      body.append("company_code", form.company_code.trim());
      body.append("email", form.email.trim());
      body.append("phone", form.phone.trim());
      body.append("address", form.address.trim());
      body.append("city", form.city.trim());
      body.append("country", form.country.trim());
      body.append("currency", form.currency);
      body.append(
        "registration_number",
        form.registration_number.trim()
      );

      if (logoFile) {
        body.append("companyLogo", logoFile);
      }

      body.append(
        "removeLogo",
        removeExistingLogo ? "true" : "false"
      );

      const response = await fetch(
        `/api/companies/${encodeURIComponent(companyId)}`,
        {
          method: "PATCH",
          body,
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Company update failed. Check that the PATCH API supports multipart form data."
        );
      }

      setSuccess("Company information updated successfully.");

      if (logoFile || removeExistingLogo) {
        const updatedLogo =
          data.company?.logo_url ||
          data.company?.logoUrl ||
          data.company?.company_logo ||
          data.company?.companyLogo ||
          data.company?.logo ||
          "";

        setOriginalLogo(updatedLogo);
        setLogoPreview(updatedLogo);
        setLogoFile(null);
        setRemoveExistingLogo(false);
      }

      window.setTimeout(() => {
        router.push("/dashboard/register-company");
        router.refresh();
      }, 900);
    } catch (err) {
      setError(
        err.message || "Unable to update company information."
      );
    } finally {
      setSaving(false);
    }
  }

  // Handle a missing ID before the loading screen.
  if (!companyId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <CircleAlert
            size={36}
            className="mx-auto mb-4 text-red-500"
          />
          <h1 className="text-xl font-bold text-slate-900">
            Company ID Missing
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            No company ID was provided. Return to the company list
            and select a company to edit.
          </p>
          <Link
            href="/dashboard/register-company"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <ArrowLeft size={17} />
            Back to Companies
          </Link>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white px-10 py-9 shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <LoaderCircle size={28} className="animate-spin" />
          </div>

          <div className="text-center">
            <p className="font-semibold text-slate-900">
              Loading company
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Please wait while we retrieve your information.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <Link
          href="/dashboard/register-company"
          className="mb-6 inline-flex items-center gap-2 rounded-lg py-2 text-sm font-semibold text-slate-600 transition hover:text-blue-700"
        >
          <ArrowLeft size={18} />
          Back to Companies
        </Link>

        <header className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-blue-800 px-6 py-8 text-white shadow-xl shadow-blue-950/10 sm:px-9 sm:py-10">
          <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border-[35px] border-white/5" />
          <div className="pointer-events-none absolute -bottom-32 right-28 h-64 w-64 rounded-full bg-blue-400/10 blur-3xl" />

          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-inner">
                <Building2 size={29} />
              </div>

              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Company management
                </div>

                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Edit Company
                </h1>

                <p className="mt-2 max-w-xl text-sm leading-6 text-blue-100/80 sm:text-base">
                  Manage your company profile, contact information,
                  registration details, and branding.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3 self-start rounded-xl border border-white/15 bg-white/10 px-4 py-3 sm:self-center">
              <Hash size={18} className="text-blue-200" />
              <div>
                <p className="text-xs text-blue-200">Company ID</p>
                <p className="font-semibold">{companyId}</p>
              </div>
            </div>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <CircleAlert
              size={20}
              className="mt-0.5 shrink-0 text-red-600"
            />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                Unable to complete the request
              </p>
              <p className="mt-1 break-words leading-5">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setError("")}
              className="rounded-lg p-1 text-red-600 hover:bg-red-100"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            <CheckCircle2
              size={20}
              className="mt-0.5 shrink-0"
            />
            <div>
              <p className="font-semibold">{success}</p>
              <p className="mt-1">
                Your changes have been submitted successfully.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
            <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm lg:col-span-2">
              <div className="border-b border-slate-100 px-6 py-5 sm:px-8">
                <SectionHeading
                  icon={Building2}
                  title="Company information"
                  description="Enter the official name and registration details for your business."
                />

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Field
                      label="Company name"
                      name="company_name"
                      value={form.company_name}
                      onChange={handleChange}
                      placeholder="Enter your company name"
                      icon={Building2}
                      required
                      autoComplete="organization"
                    />
                  </div>

                  <Field
                    label="Company code"
                    name="company_code"
                    value={form.company_code}
                    onChange={handleChange}
                    placeholder="e.g. GL-001"
                    icon={Hash}
                  />

                  <Field
                    label="Registration number"
                    name="registration_number"
                    value={form.registration_number}
                    onChange={handleChange}
                    placeholder="Enter registration number"
                  />
                </div>
              </div>

              <div className="px-6 py-6 sm:px-8">
                <SectionHeading
                  icon={Phone}
                  title="Contact information"
                  description="Keep your company's contact details accurate and up to date."
                />

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Field
                    label="Company email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="company@example.com"
                    icon={Mail}
                    autoComplete="email"
                  />

                  <Field
                    label="Phone number"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="Enter phone number"
                    icon={Phone}
                    autoComplete="tel"
                  />

                  <div className="sm:col-span-2">
                    <label htmlFor="address" className={labelClass}>
                      Business address
                    </label>
                    <textarea
                      id="address"
                      name="address"
                      value={form.address}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Street, building, area, or office address"
                      autoComplete="street-address"
                      className={`${inputClass} min-h-28 resize-y`}
                    />
                  </div>

                  <Field
                    label="City"
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    placeholder="Enter city"
                    icon={MapPin}
                    autoComplete="address-level2"
                  />

                  <Field
                    label="Country"
                    name="country"
                    value={form.country}
                    onChange={handleChange}
                    placeholder="Enter country"
                    icon={Globe2}
                    autoComplete="country-name"
                  />
                </div>
              </div>
            </section>

            <div className="space-y-6">
              <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <div className="px-5 py-5">
                  <SectionHeading
                    icon={ImagePlus}
                    title="Company logo"
                    description="Upload your logo for company branding."
                  />

                  <div className="relative flex min-h-56 w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                    {logoPreview ? (
                      <Image
                        key={logoPreview}
                        src={logoPreview}
                        alt="Company logo preview"
                        width={400}
                        height={240}
                        unoptimized
                        className="block h-48 w-full object-contain"
                      />
                    ) : (
                      <div className="flex flex-col items-center text-center">
                        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 shadow-sm">
                          <Building2 size={34} strokeWidth={1.5} />
                        </div>
                        <p className="text-sm font-semibold text-slate-700">
                          No company logo
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Your logo preview will appear here.
                        </p>
                      </div>
                    )}
                  </div>

                  {logoError && (
                    <p
                      role="alert"
                      className="mt-3 text-sm text-red-600"
                    >
                      {logoError}
                    </p>
                  )}

                  <div className="mt-4 grid grid-cols-1 gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleLogoChange}
                      className="hidden"
                      id="company-logo-upload"
                    />

                    <label
                      htmlFor="company-logo-upload"
                      className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                    >
                      <Upload size={17} />
                      Choose logo
                    </label>

                    {logoPreview && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                        Remove logo
                      </button>
                    )}

                    {removeExistingLogo && originalLogo && (
                      <button
                        type="button"
                        onClick={handleRestoreLogo}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <RefreshCw size={16} />
                        Restore current logo
                      </button>
                    )}
                  </div>

                  <p className="mt-3 text-center text-xs leading-5 text-slate-500">
                    PNG, JPG, JPEG, or WebP
                    <br />
                    Maximum file size: 2 MB
                  </p>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <SectionHeading
                  icon={Wallet}
                  title="Default currency"
                  description="Choose the currency used by your company."
                />

                <label htmlFor="currency" className={labelClass}>
                  Company currency
                </label>

                <select
                  id="currency"
                  name="currency"
                  value={form.currency}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="PKR">PKR — Pakistani Rupee</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="GBP">GBP — British Pound</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="AED">AED — UAE Dirham</option>
                  <option value="SAR">SAR — Saudi Riyal</option>
                </select>

                <div className="mt-4 rounded-xl bg-blue-50 p-3">
                  <p className="text-xs leading-5 text-blue-800">
                    Make sure the selected currency matches your company&apos;s
                    accounting requirements before saving.
                  </p>
                </div>
              </section>
            </div>
          </div>

          <div className="sticky bottom-0 z-10 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:rounded-2xl sm:border sm:px-6 sm:shadow-sm">
            <div className="mx-auto flex max-w-6xl flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="hidden text-sm text-slate-500 sm:block">
                Review your changes before saving.
              </p>

              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Link
                  href="/dashboard/register-company"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </Link>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <LoaderCircle
                      size={18}
                      className="animate-spin"
                    />
                  ) : (
                    <Save size={18} />
                  )}
                  {saving ? "Saving changes..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
