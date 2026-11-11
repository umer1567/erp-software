
// "use client";

// import { useState } from "react";
// import Sidebar from "@/components/Sidebar";
// import Header from "@/components/Header";
// import { Building2, ShieldCheck } from "lucide-react";

// export default function DashboardLayoutClient({
//   children,
//   initialMode = "vertical",
// }) {
//   const [mode, setMode] = useState(initialMode);

//   const isHorizontal = mode === "horizontal";

//   return (
//     <div
//       className="erp-page-gradient min-h-dvh"
//       style={{
//         backgroundColor: "var(--erp-page)",
//         color: "var(--erp-text)",
//       }}
//     >
//       <div
//         className={
//           isHorizontal
//             ? "flex min-h-dvh flex-col"
//             : "flex min-h-dvh flex-col md:flex-row"
//         }
//       >
//         {/* Sidebar */}
//         <Sidebar mode={mode} onModeChange={setMode} />

//         {/* Main workspace */}
//         <div
//           className={
//             isHorizontal
//               ? "flex min-h-0 min-w-0 flex-1 flex-col"
//               : "flex min-h-dvh min-w-0 flex-1 flex-col md:min-h-0"
//           }
//         >
//           {/* Top header */}
//           <div
//             className="sticky top-0 z-30 shrink-0 border-b backdrop-blur-xl"
//             style={{
//               backgroundColor: "var(--erp-surface)",
//               borderColor: "var(--erp-border)",
//             }}
//           >
//             <Header />
//           </div>

//           {/* Page content */}
//           <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-7 xl:px-9 xl:py-8">
//             <div className="mx-auto w-full max-w-[1800px]">
//               {children}
//             </div>
//           </main>

          
//           <footer
//             className="shrink-0 border-t px-4 py-4 sm:px-6"
//             style={{
//               backgroundColor: "var(--erp-surface)",
//               borderColor: "var(--erp-border)",
//             }}
//           >
//             <div className="mx-auto flex w-full max-w-[1800px] flex-col items-center justify-between gap-3 sm:flex-row">
//               {/* Brand */}
//               <div className="flex items-center gap-2.5">
//                 <div
//                   className="rounded-lg p-2"
//                   style={{
//                     backgroundColor: "var(--erp-blue-light)",
//                     color: "var(--erp-primary)",
//                   }}
//                 >
//                   <Building2 size={17} strokeWidth={1.8} />
//                 </div>

//                 <div>
//                   <p
//                     className="text-xs font-bold tracking-wide"
//                     style={{ color: "var(--erp-text)" }}
//                   >
//                     ERP Workspace
//                   </p>

//                   <p
//                     className="mt-0.5 text-[11px]"
//                     style={{ color: "var(--erp-muted)" }}
//                   >
//                     Business Management System
//                   </p>
//                 </div>
//               </div>

//               {/* Status */}
//               <div className="flex flex-wrap items-center justify-center gap-3">
//                 <span
//                   className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold"
//                   style={{
//                     backgroundColor: "var(--erp-green-light)",
//                     color: "var(--erp-green)",
//                   }}
//                 >
//                   <ShieldCheck size={13} />
//                   Workspace
//                 </span>

//                 <span
//                   className="text-[11px]"
//                   style={{ color: "var(--erp-muted)" }}
//                 >
//                   © {new Date().getFullYear()} ERP Workspace
//                 </span>
//               </div>
//             </div>
//           </footer>
//         </div>
//       </div>
//     </div>
//   );
// }

"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

export default function DashboardLayoutClient({
  children,
  initialMode = "vertical",
}) {
  const [mode, setMode] = useState(initialMode);

  const isHorizontal = mode === "horizontal";

  return (
    <div
      className="erp-page-gradient min-h-dvh"
      style={{
        backgroundColor: "var(--erp-page)",
        color: "var(--erp-text)",
      }}
    >
      <div
        className={
          isHorizontal
            ? "flex min-h-dvh flex-col"
            : "flex min-h-dvh flex-col md:flex-row"
        }
      >
        {/* Sidebar */}
        <Sidebar mode={mode} onModeChange={setMode} />

        {/* Main workspace */}
        <div
          className={
            isHorizontal
              ? "flex min-h-0 min-w-0 flex-1 flex-col"
              : "flex min-h-dvh min-w-0 flex-1 flex-col md:min-h-0"
          }
        >
          {/* Top header */}
          <div
            className="sticky top-0 z-30 shrink-0 border-b backdrop-blur-xl"
            style={{
              backgroundColor: "var(--erp-surface)",
              borderColor: "var(--erp-border)",
            }}
          >
            <Header />
          </div>

          {/* Page content */}
          <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-7 xl:px-9 xl:py-8">
            <div className="mx-auto w-full max-w-[1800px]">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
