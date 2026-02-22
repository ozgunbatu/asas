"use client";

import { useEffect, useState } from "react";

export const dynamic = "force-dynamic";

export default function AppPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token") || "";
    if (!token) {
      window.location.href = "/login";
      return;
    }
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <div style={{ padding: 32, fontFamily: "Inter, system-ui, sans-serif" }}>
      <h1 style={{ margin: 0 }}>LkSGCompass</h1>
      <p style={{ marginTop: 10, color: "#666" }}>
        App is running. (Backend bağlanınca gerçek dashboard component’i buraya takacağız.)
      </p>
    </div>
  );
}
