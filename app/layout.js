import "./globals.css";

export const metadata = {
  title: "ERP System",
  description: "ERP Management System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}