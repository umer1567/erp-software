"use client";

import { useEffect, useState } from "react";
import { Palette } from "lucide-react";

const themes = [
  { value: "light", label: "Light Theme" },
  { value: "dark", label: "Dark Theme" },
  { value: "blue", label: "Blue Theme" },
  { value: "green", label: "Green Theme" },
];

function getSavedTheme() {
  if (typeof window === "undefined") {
    return "light";
  }

  const savedTheme = localStorage.getItem("erp-theme");

  return themes.some((item) => item.value === savedTheme)
    ? savedTheme
    : "light";
}

export default function Header() {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState(getSavedTheme);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      try {
        const response = await fetch("/api/auth/me");

        if (response.ok) {
          const data = await response.json();

          if (active) {
            setUser(data.user);
          }
        }
      } catch (error) {
        console.error("Failed to load user:", error);
      }
    }

    loadUser();

    return () => {
      active = false;
    };
  }, []);

  // Synchronize the selected theme with the document and localStorage.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("erp-theme", theme);
  }, [theme]);

  function handleThemeChange(event) {
    setTheme(event.target.value);
  }

  return (
    <header className="erp-header sticky top-0 z-20 flex min-h-16 flex-wrap items-center justify-between gap-4 border-b px-6 py-3">
      {/* Dashboard title */}
      <div>
        <h2 className="text-xl font-semibold">ERP Dashboard</h2>
        <p className="erp-muted hidden text-xs sm:block">
          Enterprise Resource Planning
        </p>
      </div>

      {/* Theme selector and user information */}
      <div className="ml-auto flex flex-wrap items-center justify-end gap-4">
        <div className="flex items-center gap-2">
          <Palette size={20} className="erp-muted shrink-0" />

          <label htmlFor="erp-theme" className="sr-only">
            Choose application theme
          </label>

          <select
            id="erp-theme"
            value={theme}
            onChange={handleThemeChange}
            className="erp-theme-select rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            {themes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        {user && (
          <div className="border-l pl-4 text-right erp-border">
            <p className="font-medium">{user.username}</p>
            <p className="erp-muted text-xs">{user.roleName}</p>
          </div>
        )}
      </div>
    </header>
  );
}
