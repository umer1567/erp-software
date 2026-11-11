
// "use client";

// import { Suspense, useState } from "react";
// import { useSearchParams } from "next/navigation";

// function ResetPasswordForm() {
//   const searchParams = useSearchParams();
//   const token = searchParams.get("token") || "";

//   const [password, setPassword] = useState("");
//   const [confirmPassword, setConfirmPassword] = useState("");
//   const [message, setMessage] = useState("");
//   const [error, setError] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [finished, setFinished] = useState(false);

//   async function handleSubmit(event) {
//     event.preventDefault();
//     setMessage("");
//     setError("");

//     if (!token) {
//       setError("The reset link is missing its token.");
//       return;
//     }

//     if (password.length < 12 || password.length > 128) {
//       setError("Use a password between 12 and 128 characters.");
//       return;
//     }

//     if (password !== confirmPassword) {
//       setError("The passwords do not match.");
//       return;
//     }

//     setLoading(true);

//     try {
//       const response = await fetch(
//         "/api/auth/password-reset/complete",
//         {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           cache: "no-store",
//           body: JSON.stringify({ token, password }),
//         }
//       );

//       const data = await response.json();

//       if (!response.ok || !data.success) {
//         setError(data.message || "Password reset failed.");
//         return;
//       }

//       setFinished(true);
//       setMessage(data.message);
//       setPassword("");
//       setConfirmPassword("");
//     } catch {
//       setError("Could not contact the server. Please try again.");
//     } finally {
//       setLoading(false);
//     }
//   }

//   return (
//     <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
//       <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
//         <h1 className="text-2xl font-bold text-slate-900">
//           Reset your password
//         </h1>

//         <p className="mt-2 text-sm text-slate-600">
//           Choose a new password for your ERP account.
//         </p>

//         {message && (
//           <p
//             role="status"
//             className="mt-5 rounded-lg bg-green-50 p-3 text-sm text-green-800"
//           >
//             {message}
//           </p>
//         )}

//         {error && (
//           <p
//             role="alert"
//             className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700"
//           >
//             {error}
//           </p>
//         )}

//         {!finished && (
//           <form onSubmit={handleSubmit} className="mt-6 space-y-4">
//             <div>
//               <label
//                 htmlFor="password"
//                 className="mb-1 block text-sm font-medium text-slate-700"
//               >
//                 New password
//               </label>

//               <input
//                 id="password"
//                 type="password"
//                 autoComplete="new-password"
//                 required
//                 minLength={12}
//                 maxLength={128}
//                 value={password}
//                 onChange={(event) => setPassword(event.target.value)}
//                 className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600"
//               />
//             </div>

//             <div>
//               <label
//                 htmlFor="confirmPassword"
//                 className="mb-1 block text-sm font-medium text-slate-700"
//               >
//                 Confirm new password
//               </label>

//               <input
//                 id="confirmPassword"
//                 type="password"
//                 autoComplete="new-password"
//                 required
//                 minLength={12}
//                 maxLength={128}
//                 value={confirmPassword}
//                 onChange={(event) =>
//                   setConfirmPassword(event.target.value)
//                 }
//                 className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600"
//               />
//             </div>

//             <button
//               type="submit"
//               disabled={loading || !token}
//               className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
//             >
//               {loading ? "Resetting..." : "Set new password"}
//             </button>
//           </form>
//         )}

//         {finished && (
//           <a
//             href="/login"
//             className="mt-6 block rounded-lg bg-blue-600 px-4 py-3 text-center font-semibold text-white hover:bg-blue-700"
//           >
//             Go to login
//           </a>
//         )}
//       </section>
//     </main>
//   );
// }

// export default function ResetPasswordPage() {
//   return (
//     <Suspense
//       fallback={
//         <main className="p-10 text-center">
//           Loading password reset...
//         </main>
//       }
//     >
//       <ResetPasswordForm />
//     </Suspense>
//   );
// }

"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { KeyRound } from "lucide-react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError("The reset link is missing its token.");
      return;
    }

    if (newPassword.length < 12 || newPassword.length > 128) {
      setError("Use a password between 12 and 128 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "/api/auth/password-reset/complete",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, newPassword }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.message || "Unable to reset your password.");
        return;
      }

      setSuccess(data.message || "Password changed successfully.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error("Reset password page failed:", err);
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <KeyRound size={27} />
          </div>

          <h1 className="text-2xl font-bold text-slate-900">
            Set a New Password
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Choose a new password for your company account.
          </p>
        </div>

        {error && (
          <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div role="status" className="mb-5 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {success}
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="newPassword" className="mb-2 block text-sm font-medium text-slate-700">
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-200"
                required
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-slate-700">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-200"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || !token}
              className="w-full rounded-lg bg-slate-900 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Updating Password..." : "Update Password"}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm font-medium text-blue-700 hover:underline">
            Back to Login
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-100">
          <p className="text-slate-600">Loading reset page...</p>
        </main>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}