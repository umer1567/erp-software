
import Link from "next/link";
import { notFound } from "next/navigation";
import { erpModules } from "@/lib/erp-modules";
import {
  ArrowUpRight,
  ChevronRight,
  LayoutGrid,
  Layers3,
  FolderOpen,
} from "lucide-react";

export default async function ModulePage({ params }) {
  const { module: moduleId } = await params;

  const moduleConfig = erpModules.find(
    (item) => item.id === moduleId
  );

  if (!moduleConfig) {
    notFound();
  }

  const sections = Array.isArray(moduleConfig.sections)
    ? moduleConfig.sections
    : [];

  return (
    <div
      className="mx-auto w-full max-w-7xl space-y-6 pb-10"
      style={{ color: "var(--erp-text)" }}
    >
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-sm"
        style={{ color: "var(--erp-muted)" }}
      >
        <Link
          href="/dashboard"
          className="transition-opacity hover:opacity-75"
        >
          Dashboard
        </Link>

        <ChevronRight size={15} />

        <span
          className="font-semibold"
          style={{ color: "var(--erp-text)" }}
        >
          {moduleConfig.name}
        </span>
      </nav>

      {/* Module sections */}
      <section>
        {sections.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {sections.map((section, index) => {
              const pageCount = Array.isArray(section.items)
                ? section.items.length
                : 0;

              return (
                <Link
                  key={section.id}
                  href={`/dashboard/modules/${moduleConfig.id}/${section.id}`}
                  className="relative flex min-h-[225px] flex-col overflow-hidden rounded-2xl border p-5 shadow-sm sm:p-6"
                  style={{
                    backgroundColor: "var(--erp-surface)",
                    borderColor: "var(--erp-border)",
                    animationDelay: `${index * 60}ms`,
                  }}
                >
                  {/* Card hover glow */}
                  {/* <div
                    className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full opacity-[0.05] transition-all duration-500 group-hover:scale-150 group-hover:opacity-15"
                    style={{
                      backgroundColor: "var(--erp-primary)",
                    }}
                  /> */}

                  {/* Card header */}
                  <div className="relative flex items-start justify-between gap-3">
                    <div
                      className="flex h-14 w-14 items-center justify-center rounded-2xl"
                      style={{
                        backgroundColor: "var(--erp-blue-light)",
                        color: "var(--erp-primary)",
                      }}
                    >
                      <LayoutGrid
                        size={25}
                        strokeWidth={1.8}
                      />
                    </div>

                    <span
                      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold"
                      style={{
                        backgroundColor: "var(--erp-page)",
                        borderColor: "var(--erp-border)",
                        color: "var(--erp-muted)",
                      }}
                    >
                      <Layers3 size={12} />
                      {pageCount} {pageCount === 1 ? "page" : "pages"}
                    </span>
                  </div>

                  {/* Card content */}
                  <div className="relative mt-5 flex-1">
                    <h3
                      className="text-lg font-bold tracking-tight transition-colors"
                      style={{ color: "var(--erp-text)" }}
                    >
                      {section.name}
                    </h3>

                    <p
                      className="mt-2 text-sm leading-6"
                      style={{ color: "var(--erp-muted)" }}
                    >
                      Access the pages and tools available in this
                      section.
                    </p>
                  </div>

                  {/* Card footer */}
                  <div
                    className="relative mt-5 flex items-center justify-between border-t pt-4"
                    style={{ borderColor: "var(--erp-border)" }}
                  >
                    <span
                      className="inline-flex items-center gap-2 text-sm font-semibold"
                      style={{ color: "var(--erp-primary)" }}
                    >
                      Open section

                      <ChevronRight size={17} />
                    </span>

                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: "var(--erp-blue-light)",
                        color: "var(--erp-primary)",
                      }}
                    >
                      <ArrowUpRight size={18} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div
            className="rounded-2xl border border-dashed p-10 text-center"
            // style={{
            //   backgroundColor: "var(--erp-surface)",
            //   borderColor: "var(--erp-border)",
            // }}
          >
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{
                backgroundColor: "var(--erp-blue-light)",
                color: "var(--erp-primary)",
              }}
            >
              <FolderOpen size={26} />
            </div>

            <h3
              className="mt-4 text-lg font-bold"
              style={{ color: "var(--erp-text)" }}
            >
              No sections available
            </h3>

            <p
              className="mt-2 text-sm"
              style={{ color: "var(--erp-muted)" }}
            >
              No sections have been configured for this module yet.
            </p>

            <Link
              href="/dashboard"
              className="mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--erp-primary)" }}
            >
              Back to Dashboard
              <ArrowUpRight size={16} />
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
