"use client";

const STORAGE_KEY = "civicsim-theme";

export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const nextDark = !root.classList.contains("dark");
    root.classList.toggle("dark", nextDark);
    localStorage.setItem(STORAGE_KEY, nextDark ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle light or dark theme"
      title="Theme"
      className="fixed bottom-6 right-6 z-[100] flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--color-border-hi)] bg-[color:var(--color-surface)] text-[color:var(--color-text-dim)] shadow-lg backdrop-blur transition hover:bg-[color:var(--color-hover)] hover:text-[color:var(--color-text)]"
    >
      <SunIcon className="hidden h-5 w-5 dark:block" aria-hidden />
      <MoonIcon className="h-5 w-5 dark:hidden" aria-hidden />
    </button>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
      />
    </svg>
  );
}
