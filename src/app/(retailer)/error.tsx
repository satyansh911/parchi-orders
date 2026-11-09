"use client";

// Error state for every retailer page. Bilingual because the dictionary isn't
// available in a client error boundary. Never shows error details (no leaks).
export default function RetailerError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-col items-center gap-4 px-4 py-12 text-center">
      <p className="text-base font-medium">
        <span lang="hi">कुछ गड़बड़ हो गई।</span> <span lang="en">Something went wrong.</span>
      </p>
      <button type="button" onClick={reset} className="min-h-12 rounded-card bg-accent px-6 font-semibold text-white">
        <span lang="hi">फिर से कोशिश करें</span> · <span lang="en">Try again</span>
      </button>
    </main>
  );
}
