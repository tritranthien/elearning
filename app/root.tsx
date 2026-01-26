import React from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { Toaster } from "sonner";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
  // PWA Manifest
  { rel: "manifest", href: "/manifest.json" },
  // Apple Touch Icons
  { rel: "apple-touch-icon", href: "/icons/icon-192x192.png" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />

        {/* PWA Meta Tags */}
        <meta name="theme-color" content="#8b5cf6" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="LinguaFast" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="LinguaFast" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="msapplication-TileColor" content="#8b5cf6" />
        <meta name="msapplication-tap-highlight" content="no" />

        {/* SEO */}
        <meta name="description" content="LinguaFast - Ứng dụng học tiếng Anh thông minh với AI. Học từ vựng, hội thoại và ôn tập mọi lúc mọi nơi." />
        <meta name="keywords" content="học tiếng anh, từ vựng, hội thoại, ôn tập, AI, học ngoại ngữ" />

        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />

        {/* Register Service Worker */}
        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js')
                  .then(function(registration) {
                    console.log('[PWA] Service Worker registered:', registration.scope);
                    
                    // Check for updates periodically
                    setInterval(() => {
                      registration.update();
                    }, 1000 * 60 * 60); // Check every hour
                    
                    // Check for updates when the app becomes visible again
                    document.addEventListener('visibilitychange', () => {
                      if (document.visibilityState === 'visible') {
                        registration.update();
                      }
                    });
                  })
                  .catch(function(error) {
                    console.log('[PWA] Service Worker registration failed:', error);
                  });
              });

              // Reload the page when a new service worker takes control
              let refreshing = false;
              navigator.serviceWorker.addEventListener('controllerchange', function() {
                if (refreshing) return;
                refreshing = true;
                window.location.reload();
              });
            }
          `
        }} />
      </body>
    </html>
  );
}

// Màn hình hiển thị khi không có internet
function OfflineOverlay() {
  const [isOffline, setIsOffline] = React.useState(false);

  React.useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    // Initial check
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
      <div className="w-24 h-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6 text-4xl">
        📡
      </div>
      <h2 className="text-2xl font-black text-slate-900 mb-2">Mất kết nối Internet</h2>
      <p className="text-slate-500 mb-8 max-w-xs">
        Vui lòng kiểm tra lại kết nối mạng của bạn để tiếp tục sử dụng LinguaFast.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all"
      >
        Tải lại trang
      </button>
    </div>
  );
}

// Client-only wrapper for Toaster to avoid hydration issues
function ClientToaster() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);

    // Clean up old caches on mount (ensure fresh data)
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (let name of names) {
          caches.delete(name);
        }
      });
    }
  }, []);
  if (!mounted) return null;
  return <Toaster position="top-center" richColors />;
}

export default function App() {
  return (
    <>
      <Outlet />
      <ClientToaster />
      <OfflineOverlay />
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
