"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const serviceWorkerUrl = process.env.NODE_ENV === "development" ? "/sw.js?dev=1" : "/sw.js";
      void navigator.serviceWorker.register(serviceWorkerUrl).catch((error: unknown) => {
        console.error("Service worker registration failed", error);
      });
    }
  }, []);

  return null;
}
