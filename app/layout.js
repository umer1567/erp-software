import "./globals.css";
import SessionActivityTracker from "@/components/SessionActivityTracker";

export const metadata = {
  title: "ERP System",
  description: "ERP Management System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <SessionActivityTracker />
        {children}
      </body>
    </html>
  );
}