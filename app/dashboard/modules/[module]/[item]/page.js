import Link from "next/link";
import { notFound } from "next/navigation";
import { erpModules } from "@/lib/erp-modules";

function Icon({ name, size = 20, className = "", style = {} }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    xmlns: "http://www.w3.org/2000/svg",
    className,
    style,
    "aria-hidden": true,
  };

  const paths = {
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="10" cy="7" r="4" />
        <path d="M20 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    key: (
      <>
        <circle cx="8" cy="15" r="5" />
        <path d="m21 2-9.6 9.6" />
        <path d="m15.5 7.5 3 3" />
        <path d="m18.5 4.5 3 3" />
      </>
    ),
    file: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8M8 17h8" />
      </>
    ),
    building: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 21V9h6v12M7 7h2m6 0h2M7 12h2m6 0h2M7 16h2m6 0h2" />
      </>
    ),
  };

  return <svg {...common}>{paths[name] || paths.file}</svg>;
}

function slugFromHref(href) {
  return href.split("/").filter(Boolean).pop();
}

function getPageIcon(name) {
  const value = name.toLowerCase();

  if (value.includes("user")) return "users";
  if (value.includes("role")) return "shield";

  if (value.includes("right") || value.includes("permission")) {
    return "key";
  }

  if (value.includes("company") || value.includes("subsidiary")) {
    return "building";
  }

  return "file";
}

const surfaceStyle = {
  background: "var(--erp-surface)",
  borderColor: "var(--erp-border)",
  color: "var(--erp-text)",
};

const mutedStyle = {
  color: "var(--erp-muted)",
};

const primaryStyle = {
  background: "var(--erp-primary)",
  color: "#ffffff",
};

export default async function ModuleSectionPage({ params }) {
  const { module: moduleId, item: itemId } = await params;

  const moduleConfig = erpModules.find(
    (entry) => entry.id === moduleId
  );

  if (!moduleConfig) notFound();

  const section = moduleConfig.sections.find(
    (entry) => entry.id === itemId
  );

  const allItems = moduleConfig.sections.flatMap(
    (group) => group.items
  );

  const pageEntry = section
    ? null
    : allItems.find(
        (candidate) => slugFromHref(candidate.href) === itemId
      );

  if (!section && !pageEntry) notFound();

  const pageCount = section?.items?.length ?? 0;

  return (
    <div
      className="mx-auto w-full max-w-7xl space-y-6 pb-10"
      style={{ color: "var(--erp-text)" }}
    >
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-2 text-sm"
        style={mutedStyle}
      >
        <Link href="/dashboard" className="transition hover:opacity-70">
          Dashboard
        </Link>

        <Icon name="chevron" size={15} />

        <Link
          href={`/dashboard/modules/${moduleConfig.id}`}
          className="transition hover:opacity-70"
        >
          {moduleConfig.name}
        </Link>

        <Icon name="chevron" size={15} />

        <span style={{ color: "var(--erp-text)" }}>
          {section ? section.name : pageEntry.name}
        </span>
      </nav>

      {section ? (
        <section>
          {pageCount > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {section.items.map((entry, index) => {
                const iconName = getPageIcon(entry.name);

                return (
                  <Link
                    key={`${entry.name}:${entry.href}`}
                    href={entry.href}
                    className="relative flex min-h-56 flex-col overflow-hidden rounded-2xl border p-5 shadow-sm sm:p-6"
                    style={surfaceStyle}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className="flex h-14 w-14 items-center justify-center rounded-2xl"
                        style={{
                          background: "var(--erp-page)",
                          color: "var(--erp-primary)",
                        }}
                      >
                        <Icon name={iconName} size={29} />
                      </div>

                      <span
                        className="rounded-lg border px-2.5 py-1 text-xs font-semibold"
                        style={{
                          background: "var(--erp-page)",
                          borderColor: "var(--erp-border)",
                          color: "var(--erp-muted)",
                        }}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>

                    <div className="mt-6 flex-1">
                      <h3 className="text-lg font-bold">
                        {entry.name}
                      </h3>

                      <p
                        className="mt-2 text-sm leading-6"
                        style={mutedStyle}
                      >
                        Open {entry.name.toLowerCase()} to access
                        the available tools and operations.
                      </p>
                    </div>

                    <div
                      className="mt-6 flex items-center justify-between border-t pt-4"
                      style={{ borderColor: "var(--erp-border)" }}
                    >
                      <span
                        className="text-sm font-semibold"
                        style={{ color: "var(--erp-primary)" }}
                      >
                        Open page
                      </span>

                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-xl"
                        style={{
                          background: "var(--erp-page)",
                          color: "var(--erp-primary)",
                        }}
                      >
                        <Icon name="arrow" size={18} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div
              className="rounded-2xl border p-10 text-center"
              style={surfaceStyle}
            >
              <Icon
                name="file"
                size={36}
                className="mx-auto"
                style={mutedStyle}
              />

              <h3 className="mt-4 font-semibold">
                No pages available
              </h3>

              <p className="mt-2 text-sm" style={mutedStyle}>
                No pages have been configured for this section yet.
              </p>
            </div>
          )}
        </section>
      ) : (
        <section
          className="overflow-hidden rounded-3xl border shadow-sm"
          style={surfaceStyle}
        >
          <div className="h-1.5" style={primaryStyle} />

          <div className="p-6 sm:p-10">
            <Link
              href={`/dashboard/modules/${moduleConfig.id}`}
              className="inline-flex items-center gap-2 text-sm font-medium transition hover:opacity-70"
              style={{ color: "var(--erp-primary)" }}
            >
              <Icon
                name="chevron"
                size={17}
                className="rotate-180"
              />
              Back to {moduleConfig.name}
            </Link>

            <div
              className="mt-8 flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{
                background: "var(--erp-page)",
                color: "var(--erp-primary)",
              }}
            >
              <Icon name="file" size={32} />
            </div>

            <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
              {pageEntry.name}
            </h1>

            <p
              className="mt-4 max-w-2xl text-sm leading-7 sm:text-base"
              style={mutedStyle}
            >
              This page is registered in your ERP navigation. Its
              forms, tables, reports, and database operations must be
              implemented before it can perform its business function.
            </p>

            <div
              className="mt-8 rounded-2xl border p-5"
              style={{
                background: "var(--erp-page)",
                borderColor: "var(--erp-border)",
              }}
            >
              <div className="flex items-start gap-3">
                <Icon
                  name="file"
                  size={22}
                  className="mt-0.5 shrink-0"
                  style={{ color: "var(--erp-primary)" }}
                />

                <div>
                  <h2 className="font-semibold">
                    Navigation configured
                  </h2>

                  <p
                    className="mt-1 text-sm leading-6"
                    style={mutedStyle}
                  >
                    The route exists, but this placeholder does not
                    implement the page&apos;s business logic.
                  </p>
                </div>
              </div>
            </div>

            <Link
              href={`/dashboard/modules/${moduleConfig.id}`}
              className="mt-7 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition hover:opacity-90"
              style={primaryStyle}
            >
              Back to module
              <Icon name="arrow" size={16} />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}