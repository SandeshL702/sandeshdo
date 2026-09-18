import { useEffect } from "react";

const KEY = "sandeshdo-hi";

function hideNative() {
  try {
    window.SandeshDoHost?.hideSplash?.();
  } catch {
    /* web */
  }
}

export function Splash() {
  useEffect(() => {
    const boot = document.getElementById("sd-boot-splash");
    let skip = false;
    try {
      skip = sessionStorage.getItem(KEY) === "1";
    } catch {
      /* private */
    }
    if (skip) {
      hideNative();
      boot?.remove();
      return;
    }
    const hide = window.setTimeout(() => {
      boot?.classList.add("sd-splash-out");
      try {
        sessionStorage.setItem(KEY, "1");
      } catch {
        /* private */
      }
      window.setTimeout(() => {
        hideNative();
        boot?.remove();
      }, 280);
    }, 900);
    return () => window.clearTimeout(hide);
  }, []);
  return null;
}
