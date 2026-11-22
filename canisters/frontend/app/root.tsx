import "@fontsource/nunito/400.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/900.css";
import "./app.css";
import "./i18n";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Links, Meta, Scripts, ScrollRestoration, useLocation, useOutlet } from "react-router";
import { AuthProvider } from "./lib/auth";
import { FamilyProvider } from "./lib/family";
import { KidProvider } from "./lib/kid";
import { useMotionLevel } from "./lib/motion";
import { PrefsProvider } from "./lib/prefs";
import { ToastProvider } from "./lib/toast";
import { registerServiceWorker } from "./lib/pwa";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#7c4dff" />
        <meta name="description" content="A playful family star chart." />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Star Quest" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/icons/icon-192.png" type="image/png" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <title>Star Quest</title>
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// Keeps the leaving page's content while it animates out.
function AnimatedOutlet() {
  const outlet = useOutlet();
  const [frozen] = useState(outlet);
  return frozen;
}

function Shell() {
  const location = useLocation();
  const level = useMotionLevel();
  return (
    <MotionConfig reducedMotion={level === "reduced" ? "always" : "never"}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          className="page"
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -60 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <AnimatedOutlet />
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  );
}

export default function App() {
  useEffect(registerServiceWorker, []);
  return (
    <AuthProvider>
      <PrefsProvider>
        <FamilyProvider>
          <KidProvider>
            <ToastProvider>
              <Shell />
            </ToastProvider>
          </KidProvider>
        </FamilyProvider>
      </PrefsProvider>
    </AuthProvider>
  );
}

export function HydrateFallback() {
  return <p style={{ position: "fixed", inset: 0, margin: 0, display: "grid", placeItems: "center" }}>⭐</p>;
}
