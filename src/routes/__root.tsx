import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AppShell } from "@/components/app-shell";
import appCss from "../styles.css?url";

const APP_NAME = "SandeshDo";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: APP_NAME },
      { name: "theme-color", content: "#0B6B58" },
      {
        name: "description",
        content:
          "SandeshDo — Remember it. Do it. Finish it. Private tasks, KhataBook money, heads-up reminders.",
      },
      { name: "application-name", content: APP_NAME },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap",
      },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=location.pathname;if(p==="/index.html"||p==="/index.htm"||/\\/index\\.html$/.test(p)){history.replaceState(null,"","/"+location.search+location.hash);}}catch(e){}try{var raw=localStorage.getItem("sandeshdo-v2")||localStorage.getItem("sandeshdo-v1");var t=raw?JSON.parse(raw).state.settings.theme:null;var dark=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(dark)document.documentElement.classList.add("dark");}catch(e){}try{if(sessionStorage.getItem("sandeshdo-hi")==="1")document.documentElement.classList.add("sd-no-splash");}catch(e){}})();`,
          }}
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `html.sd-no-splash #sd-boot-splash,html.sd-splash-done #sd-boot-splash{display:none!important;pointer-events:none!important;animation:none!important}#sd-boot-splash{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0B6B58;color:#F6F3EC;pointer-events:auto;animation:sd-boot-screen .95s cubic-bezier(.4,0,1,1) forwards}#sd-boot-splash .sd-splash-mark{opacity:0;animation:sd-boot-in .4s cubic-bezier(.2,0,0,1) .18s both}#sd-boot-splash .sd-splash-tag{opacity:0;animation:sd-boot-in .4s cubic-bezier(.2,0,0,1) .28s both}.sd-tick{width:64px;height:64px;margin-bottom:16px}.sd-tick-ring{fill:none;stroke:currentColor;stroke-width:2.4;opacity:.32;stroke-dasharray:190;animation:sd-tick-ring .62s cubic-bezier(.2,0,0,1) both}.sd-tick-mark{fill:none;stroke:currentColor;stroke-width:4.2;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:52;stroke-dashoffset:52;animation:sd-tick-draw .36s cubic-bezier(.2,0,0,1) .22s both}@keyframes sd-tick-ring{from{stroke-dashoffset:190;opacity:0}to{stroke-dashoffset:0;opacity:.32}}@keyframes sd-tick-draw{to{stroke-dashoffset:0}}@keyframes sd-boot-in{from{opacity:0;transform:translateY(8px);filter:blur(4px)}to{opacity:1;transform:none;filter:none}}@keyframes sd-boot-screen{0%,74%{opacity:1}100%{opacity:0;visibility:hidden}}`,
          }}
        />
      </head>
      <body className="bg-bg text-fg antialiased">
        <div
          id="sd-boot-splash"
          className="sd-splash"
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#0B6B58",
            color: "#F6F3EC",
          }}
        >
          <svg className="sd-tick" viewBox="0 0 72 72" aria-hidden="true">
            <circle className="sd-tick-ring" cx="36" cy="36" r="30" />
            <path className="sd-tick-mark" d="M22 38 L32 48 L52 26" />
          </svg>
          <p
            className="sd-splash-mark font-display text-4xl font-medium tracking-tight"
            style={{
              margin: 0,
              fontSize: "2.25rem",
              fontWeight: 500,
              letterSpacing: "-0.03em",
              whiteSpace: "nowrap",
            }}
          >
            SandeshDo
          </p>
          <p
            className="sd-splash-tag"
            style={{
              margin: "0.6rem 0 0",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            Remember · Do · Finish
          </p>
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var s=document.getElementById("sd-boot-splash");function done(){try{sessionStorage.setItem("sandeshdo-hi","1")}catch(e){}document.documentElement.classList.add("sd-splash-done");if(s){s.style.display="none";s.style.pointerEvents="none"}try{window.SandeshDoHost&&window.SandeshDoHost.hideSplash&&window.SandeshDoHost.hideSplash()}catch(e){}}if(!s||document.documentElement.classList.contains("sd-no-splash")){done();return}s.addEventListener("animationend",function(e){if(e.animationName==="sd-boot-screen")done()});setTimeout(done,1100)})();`,
          }}
        />
        <PreviewHostBridge />
        <AuthProvider>
          <AppShell>
            <Outlet />
          </AppShell>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
