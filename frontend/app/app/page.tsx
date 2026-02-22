"use client";

import { useEffect, useState } from "react";
import CountryRiskMap from "../../components/CountryRiskMap";

const API = process.env.NEXT_PUBLIC_API_URL!;

type Supplier = {
  id: string;
  name: string;
  country: string;
  industry: string;
  risk_level: "low" | "medium" | "high" | "unknown";
  risk_score: number;
  created_at: string;
  updated_at: string;
};

type Company = { id: string; name: string; slug: string; };

type Complaint = {
  id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  category: string;
  description: string;
  status: string;
  created_at: string;
};


function badgeClass(level: string) {
  if (level === "low") return "badge low";
  if (level === "medium") return "badge medium";
  if (level === "high") return "badge high";
  return "badge";
}

function countryToRegion(country: string) {
  const c = country.toLowerCase();
  if (["germany", "poland", "spain"].includes(c)) return "Europe";
  if (["usa", "mexico"].includes(c)) return "NorthAmerica";
  if (["brazil"].includes(c)) return "SouthAmerica";
  if (["china", "vietnam", "india", "indonesia", "pakistan"].includes(c)) return "Asia";
  if (["nigeria", "southafrica", "south africa"].includes(c)) return "Africa";
  if (["turkey"].includes(c)) return "Europe";
  return "Other";
}

export default function AppPage() {
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string>("");

  useEffect(() => {
    setMounted(true);
    const t = typeof window !== "undefined" ? (localStorage.getItem("token") || "") : "";
    setToken(t);
  }, []);

    const [tab, setTab] = useState<"dashboard"|"auto"|"suppliers"|"map"|"complaints"|"reports"|"monitoring"|"integrations">("dashboard");
  const [company, setCompany] = useState<Company | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [error, setError] = useState("");

  // Create supplier form
  const [sName, setSName] = useState("");
  const [sCountry, setSCountry] = useState("Germany");
  const [sIndustry, setSIndustry] = useState("services");

  // CSV import
  const [csv, setCsv] = useState("name,country,industry\nTechParts,China,electronics\nTextile Group,Bangladesh,textile");

  // Auto Compliance
  const [autoCsv, setAutoCsv] = useState("name,country,industry,annual_spend_eur,workers,has_audit,has_code_of_conduct\nTechParts,China,electronics,120000,500,false,false\nEcoBuild,Germany,construction,70000,120,true,true\nTextile Group,Bangladesh,textile,90000,1200,false,true");
  const [autoYear, setAutoYear] = useState(new Date().getFullYear());
  const [autoResult, setAutoResult] = useState<any>(null);


  // Complaint form
  const [cSupplierId, setCSupplierId] = useState<string>("");
  const [cCategory, setCCategory] = useState("human_rights");
  const [cDescription, setCDescription] = useState("");

  // Reports
  const [year, setYear] = useState(new Date().getFullYear());
  const [draft, setDraft] = useState<any>(null);
  const [draftSaved, setDraftSaved] = useState<string>("");

  // Monitoring + integrations
  const [events, setEvents] = useState<any[]>([]);
  const [screenings, setScreenings] = useState<any[]>([]);
  const [syncStatus, setSyncStatus] = useState<any[]>([]);

  useEffect(() => {
    if (!mounted) return;
    if (!token) window.location.href = "/login";
  }, [mounted, token]);

  async function api(path: string, init?: RequestInit) {
    const r = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
        Authorization: `Bearer ${getToken()}`,
      },
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) {
      // token expired/missing => hard redirect to login
      if (typeof window !== "undefined") localStorage.removeItem("token");
      if (typeof window !== "undefined") window.location.href = "/login";
      throw new Error("Unauthorized");
    }
    if (!r.ok) throw new Error(data?.error || "API error");
    return data;
  }

  async function loadAll() {
    setError("");
    try {
      const me = await api("/companies/me");
      setCompany(me);
      const s = await api("/suppliers");
      setSuppliers(s);
      const c = await api("/complaints");
      setComplaints(c);
      const ev = await api("/monitoring/events");
      setEvents(ev);
      const sc = await api("/monitoring/screenings");
      setScreenings(sc);
      const st = await api("/integrations/status");
      setSyncStatus(st);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === "reports") {
      loadDraft();
    }
    if (tab === "monitoring") {
      loadMonitoring();
    }
    if (tab === "integrations") {
      loadSyncStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, year]);

  async function loadMonitoring() {
    try {
      const e = await api("/monitoring/events");
      setEvents(e);
      const s = await api("/monitoring/screenings");
      setScreenings(s);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function loadSyncStatus() {
    try {
      const st = await api("/integrations/status");
      setSyncStatus(st);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function runMonitoring() {
    setError("");
    try {
      await api("/monitoring/run", { method: "POST", body: "{}" });
      await loadMonitoring();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function syncCountryRisks() {
    setError("");
    try {
      await api("/integrations/sync/country-risks", { method: "POST", body: "{}" });
      await loadSyncStatus();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function syncSanctionsEU() {
    setError("");
    try {
      await api("/integrations/sync/sanctions/eu", { method: "POST", body: "{}" });
      await loadSyncStatus();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function syncSanctionsOFAC() {
    setError("");
    try {
      await api("/integrations/sync/sanctions/ofac", { method: "POST", body: "{}" });
      await loadSyncStatus();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const kpis = useMemo(() => {
    const total = suppliers.length;
    const high = suppliers.filter(s => s.risk_level === "high").length;
    const medium = suppliers.filter(s => s.risk_level === "medium").length;
    const low = suppliers.filter(s => s.risk_level === "low").length;
    const score = Math.max(0, Math.round(100 - (high*9 + medium*4)));
    const countries = new Set(suppliers.map(s => s.country)).size;
    return { total, high, medium, low, score, countries };
  }, [suppliers]);

  const regionStats = useMemo(() => {
    const counts: Record<string, number> = {};
    suppliers.forEach(s => {
      const r = countryToRegion(s.country);
      counts[r] = (counts[r] || 0) + 1;
    });
    return counts;
  }, [suppliers]);

  async function createSupplier() {
    setError("");
    try {
      await api("/suppliers", {
        method: "POST",
        body: JSON.stringify({ name: sName, country: sCountry, industry: sIndustry }),
      });
      setSName("");
      await loadAll();
      setTab("suppliers");
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function deleteSupplier(id: string) {
    setError("");
    try {
      await api(`/suppliers/${id}`, { method: "DELETE" });
      await loadAll();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function recalc() {
    setError("");
    try {
      await api("/suppliers/recalculate", { method: "POST", body: "{}" });
      await loadAll();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function importCsv() {
    setError("");
    try {
      await api("/suppliers/import/csv", { method: "POST", body: JSON.stringify({ csv }) });
      await loadAll();
      setTab("suppliers");
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function createComplaint() {
    setError("");
    try {
      await api("/complaints", {
        method: "POST",
        body: JSON.stringify({
          supplierId: cSupplierId || null,
          category: cCategory,
          description: cDescription
        })
      });
      setCDescription("");
      await loadAll();
      setTab("complaints");
    } catch (e: any) {
      setError(e.message);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    window.location.href = "/";
  }

  function riskColor(level: string) {
    if (level === "high") return "#C0392B";
    if (level === "medium") return "#B45309";
    if (level === "low") return "#1B3D2B";
    return "#6b7280";
  }

  function downloadReport() {
    // Stream PDF in new tab
    const t = getToken();
    window.open(`${API}/reports/bafa/${year}?token=${encodeURIComponent(t)}`, "_blank");
  }

  async function loadDraft() {
    setError("");
    try {
      const data = await api(`/reports/bafa/${year}/draft`);
      setDraft(data?.draft || null);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function saveDraft() {
    setError("");
    try {
      await api(`/reports/bafa/${year}/draft`, {
        method: "PUT",
        body: JSON.stringify(draft || {})
      });
      setDraftSaved(new Date().toLocaleString());
    } catch (e: any) {
      setError(e.message);
    }
  }



async function runAuto() {
  setError("");
  setAutoResult(null);
  try {
    const r = await fetch(API + "/auto/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ csv: autoCsv, year: autoYear })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Auto compliance failed");
    setAutoResult(j);
    setTab("reports");
  } catch (e: any) {
    setError(e.message || "Auto compliance failed");
  }
}

  if (!mounted) {
    return (
      <div style={{ padding: 24, fontFamily: "Inter, system-ui, sans-serif" }}>
        <div style={{ fontSize: 14, color: "#666" }}>Loading…</div>
      </div>
    );
  }

  return (
    <>
      <div className="nav">
        <div className="inner">
          <div className="brand">LkSGCompass</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className={"btn ghost"} onClick={() => setTab("dashboard")}>Dashboard</button>
                        <button className={"btn ghost"} onClick={() => setTab("auto")}>Auto Compliance</button>
<button className={"btn ghost"} onClick={() => setTab("suppliers")}>Suppliers</button>
            <button className={"btn ghost"} onClick={() => setTab("map")}>Risk Map</button>
            <button className={"btn ghost"} onClick={() => setTab("complaints")}>Complaints</button>
            <button className={"btn ghost"} onClick={() => setTab("reports")}>Reports</button>
            <button className={"btn ghost"} onClick={() => setTab("monitoring")}>Monitoring</button>
            <button className={"btn ghost"} onClick={() => setTab("integrations")}>Integrations</button>
            <button className="btn secondary" onClick={logout}>Logout</button>
          </div>
        </div>
      </div>

      <div className="container">
        {error && <div className="card" style={{ borderColor: "rgba(192,57,43,.35)", background: "#fff5f4" }}>{error}</div>}

        {tab === "dashboard" && (
          <div className="grid">
            <div className="card">
              <h2 style={{ marginTop: 0 }}>Compliance Overview</h2>
              <div className="row">
                <div className="card" style={{ flex: 1 }}>
                  <div className="label">COMPLIANCE SCORE</div>
                  <div style={{ fontSize: 34, fontWeight: 900 }}>{kpis.score}/100</div>
                  <div style={{ color: "var(--muted)", fontSize: 13 }}>Derived from risk distribution</div>
                </div>
                <div className="card" style={{ flex: 1 }}>
                  <div className="label">SUPPLIERS</div>
                  <div style={{ fontSize: 34, fontWeight: 900 }}>{kpis.total}</div>
                  <div style={{ color: "var(--muted)", fontSize: 13 }}>{kpis.countries} countries</div>
                </div>
              </div>

              <div className="row" style={{ marginTop: 12 }}>
                <span className={"badge low"}>Low: {kpis.low}</span>
                <span className={"badge medium"}>Medium: {kpis.medium}</span>
                <span className={"badge high"}>High: {kpis.high}</span>
              </div>

              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn" onClick={recalc}>Recalculate Risks</button>
                <button className="btn ghost" onClick={loadAll}>Refresh</button>
              </div>

              <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "16px 0" }} />

              <h3 style={{ margin: 0 }}>Quick Add Supplier</h3>
              <div className="label">NAME</div>
              <input className="input" value={sName} onChange={(e) => setSName(e.target.value)} placeholder="Supplier GmbH" />
              <div className="row">
                <div style={{ flex: 1 }}>
                  <div className="label">COUNTRY</div>
                  <select className="input" value={sCountry} onChange={(e) => setSCountry(e.target.value)}>
                    {["Germany","USA","China","Vietnam","Bangladesh","India","Turkey","Mexico","Brazil","Indonesia","Pakistan","Nigeria","South Africa","Poland","Spain"].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="label">INDUSTRY</div>
                  <select className="input" value={sIndustry} onChange={(e) => setSIndustry(e.target.value)}>
                    {["services","logistics","electronics","textile","mining","agriculture","automotive","construction"].map(i => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button className="btn" style={{ marginTop: 12 }} onClick={createSupplier}>Create</button>
            </div>

            <div className="card">
              <h2 style={{ marginTop: 0 }}>Risk Alerts</h2>
              {kpis.high > 0 ? (
                <div className="card" style={{ borderColor: "rgba(192,57,43,.35)", background: "#fff5f4" }}>
                  <b>⚠ {kpis.high} high-risk suppliers</b>
                  <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>
                    Start with CAPs (Corrective Action Plans) and schedule audits.
                  </p>
                </div>
              ) : (
                <div className="card">
                  <b>✅ No critical risks detected</b>
                  <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>
                    Continue monitoring and periodic reassessment.
                  </p>
                </div>
              )}

              <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "16px 0" }} />

              <h3 style={{ margin: 0 }}>Regional footprint (suppliers)</h3>
              <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 8 }}>
                {Object.entries(regionStats).length ? Object.entries(regionStats).map(([k,v]) => (
                  <div key={k}>{k}: {v}</div>
                )) : "—"}
              </div>
            </div>
          </div>
        )}

        

{tab === "auto" && (
  <div className="card">
    <div className="cardHeader">
      <div>
        <div className="h2">Auto Compliance Mode</div>
        <div className="muted">Upload supplier list, run risk analysis, generate BAFA-ready report.</div>
      </div>
      <div style={{display:"flex", gap:8, alignItems:"center"}}>
        <input
          className="input"
          style={{width:120}}
          type="number"
          value={autoYear}
          onChange={(e) => setAutoYear(Number(e.target.value))}
        />
        <button className="btn" onClick={runAuto}>Run</button>
      </div>
    </div>
    <div className="cardBody">
      <label className="label">CSV</label>
      <textarea className="textarea" value={autoCsv} onChange={(e) => setAutoCsv(e.target.value)} rows={10} />
      {autoResult && (
        <div style={{marginTop:12}} className="notice">
          <div><b>Imported:</b> {autoResult.supplierCount} suppliers</div>
          <div><b>Distribution:</b> High {autoResult.distribution?.high ?? 0}, Medium {autoResult.distribution?.medium ?? 0}, Low {autoResult.distribution?.low ?? 0}</div>
        </div>
      )}
    </div>
  </div>
)}
{tab === "suppliers" && (
          <div className="card">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0 }}>Suppliers</h2>
              <div className="row">
                <button className="btn" onClick={recalc}>Recalculate</button>
                <button className="btn ghost" onClick={() => setTab("dashboard")}>Add supplier</button>
              </div>
            </div>

            <table style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Name</th><th>Country</th><th>Industry</th><th>Risk</th><th>Score</th><th></th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map(s => (
                  <tr key={s.id}>
                    <td><b>{s.name}</b></td>
                    <td>{s.country}</td>
                    <td>{s.industry}</td>
                    <td><span className={badgeClass(s.risk_level)}>{s.risk_level}</span></td>
                    <td style={{ fontWeight: 800, color: riskColor(s.risk_level) }}>{s.risk_score}</td>
                    <td><button className="btn ghost" onClick={() => deleteSupplier(s.id)}>Delete</button></td>
                  </tr>
                ))}
                {!suppliers.length && (
                  <tr><td colSpan={6} style={{ color: "var(--muted)" }}>No suppliers yet.</td></tr>
                )}
              </tbody>
            </table>

            <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "16px 0" }} />

            <h3 style={{ margin: 0 }}>CSV Import</h3>
            <p style={{ color: "var(--muted)", marginTop: 8 }}>Paste CSV content and import.</p>
            <textarea className="input" style={{ minHeight: 120, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }} value={csv} onChange={(e) => setCsv(e.target.value)} />
            <button className="btn" style={{ marginTop: 12 }} onClick={importCsv}>Import CSV</button>
          </div>
        )}

        {tab === "map" && (
          <CountryRiskMap />
        )}

        {tab === "complaints" && (
          <div className="grid">
            <div className="card">
              <h2 style={{ marginTop: 0 }}>Whistleblowing / Complaints</h2>
              <p style={{ color: "var(--muted)" }}>
                Complaints can be submitted internally (below) or via a public anonymous portal.
              </p>
              <div className="card" style={{ borderStyle: "dashed", marginTop: 10 }}>
                <div className="label">PUBLIC PORTAL URL</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <code style={{ padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 12, background: "#fafafa" }}>
                    {company ? `${window.location.origin}/complaints/${company.slug}` : "—"}
                  </code>
                  <button
                    className="btn ghost"
                    onClick={() => {
                      if (!company) return;
                      navigator.clipboard.writeText(`${window.location.origin}/complaints/${company.slug}`);
                    }}
                  >
                    Copy
                  </button>
                  <button
                    className="btn ghost"
                    onClick={() => {
                      if (!company) return;
                      window.open(`/complaints/${company.slug}`, "_blank");
                    }}
                  >
                    Open
                  </button>
                </div>
              </div>

              <div className="label">SUPPLIER (optional)</div>
              <select className="input" value={cSupplierId} onChange={(e) => setCSupplierId(e.target.value)}>
                <option value="">— none —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>

              <div className="label">CATEGORY</div>
              <select className="input" value={cCategory} onChange={(e) => setCCategory(e.target.value)}>
                <option value="human_rights">Menschenrechte</option>
                <option value="child_labor">Kinderarbeit</option>
                <option value="forced_labor">Zwangsarbeit</option>
                <option value="discrimination">Diskriminierung</option>
                <option value="environment">Umwelt</option>
                <option value="safety">Arbeitssicherheit</option>
                <option value="other">Sonstiges</option>
              </select>

              <div className="label">DESCRIPTION</div>
              <textarea className="input" style={{ minHeight: 110 }} value={cDescription} onChange={(e) => setCDescription(e.target.value)} />

              <button className="btn" style={{ marginTop: 12 }} onClick={createComplaint}>Submit</button>
            </div>

            <div className="card">
              <h2 style={{ marginTop: 0 }}>Recent complaints</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {complaints.map(c => (
                  <div key={c.id} className="card" style={{ padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <b>{c.category}</b>
                      <span className="badge">{c.status}</span>
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
                      Supplier: {c.supplier_name || "—"}
                    </div>
                    <div style={{ marginTop: 8 }}>{c.description}</div>
                    <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 8 }}>
                      {new Date(c.created_at).toLocaleString("de-DE")}
                    </div>
                  </div>
                ))}
                {!complaints.length && <div style={{ color: "var(--muted)" }}>No complaints yet.</div>}
              </div>
            </div>
          </div>
        )}

        {tab === "reports" && (
          <div className="card">
            <h2 style={{ marginTop: 0 }}>BAFA Annual Report (PDF)</h2>
            <p style={{ color: "var(--muted)" }}>
              Structured report aligned to BAFA questionnaire sections. Edit the draft text, then open the PDF.
            </p>

            <div className="row" style={{ alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <div className="label">YEAR</div>
                <input className="input" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn ghost" onClick={loadDraft}>Load Draft</button>
                <button className="btn" onClick={downloadReport}>Open PDF</button>
              </div>
            </div>

            {draft && (
              <>
                <div className="row" style={{ marginTop: 10, justifyContent: "space-between" }}>
                  <div style={{ color: "var(--muted)", fontSize: 12 }}>
                    {draftSaved ? `Saved: ${draftSaved}` : ""}
                  </div>
                  <button className="btn secondary" onClick={saveDraft}>Save Draft</button>
                </div>

                <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "16px 0" }} />

                <div className="label">1. Unternehmensstruktur</div>
                <textarea className="input" style={{ minHeight: 90 }} value={draft.organization_structure || ""}
                  onChange={(e)=>setDraft({ ...draft, organization_structure: e.target.value })} />

                <div className="label">Verantwortliche Personen/Funktionen</div>
                <textarea className="input" style={{ minHeight: 70 }} value={draft.responsible_persons || ""}
                  onChange={(e)=>setDraft({ ...draft, responsible_persons: e.target.value })} />

                <div className="label">2. Risikoanalyse — Methodik</div>
                <textarea className="input" style={{ minHeight: 90 }} value={draft.risk_methodology || ""}
                  onChange={(e)=>setDraft({ ...draft, risk_methodology: e.target.value })} />

                <div className="label">2. Priorisierte Risiken</div>
                <textarea className="input" style={{ minHeight: 80 }} value={draft.prioritized_risks || ""}
                  onChange={(e)=>setDraft({ ...draft, prioritized_risks: e.target.value })} />

                <div className="label">2. Präventionsmaßnahmen</div>
                <textarea className="input" style={{ minHeight: 110 }} value={draft.prevention_measures || ""}
                  onChange={(e)=>setDraft({ ...draft, prevention_measures: e.target.value })} />

                <div className="label">3. Abhilfemaßnahmen</div>
                <textarea className="input" style={{ minHeight: 100 }} value={draft.remediation_measures || ""}
                  onChange={(e)=>setDraft({ ...draft, remediation_measures: e.target.value })} />

                <div className="label">4. Beschwerdeverfahren — Beschreibung</div>
                <textarea className="input" style={{ minHeight: 90 }} value={draft.complaints_procedure || ""}
                  onChange={(e)=>setDraft({ ...draft, complaints_procedure: e.target.value })} />

                <div className="label">4. Beschwerdeverfahren — Zugangsgruppen</div>
                <textarea className="input" style={{ minHeight: 70 }} value={draft.complaints_access_groups || ""}
                  onChange={(e)=>setDraft({ ...draft, complaints_access_groups: e.target.value })} />

                <div className="label">5. Wirksamkeitskontrolle</div>
                <textarea className="input" style={{ minHeight: 90 }} value={draft.effectiveness_review || ""}
                  onChange={(e)=>setDraft({ ...draft, effectiveness_review: e.target.value })} />
              </>
            )}

            <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "16px 0" }} />

            <h3 style={{ margin: 0 }}>What’s inside</h3>
            <ul style={{ color: "var(--muted)", marginTop: 8 }}>
              <li>Table of contents</li>
              <li>1. Unternehmensstruktur</li>
              <li>2. Risikoanalyse und Präventionsmaßnahmen</li>
              <li>3. Feststellung von Verletzungen und Abhilfemaßnahmen</li>
              <li>4. Beschwerdeverfahren</li>
              <li>5. Überprüfung des Risikomanagements (Wirksamkeitskontrolle)</li>
              <li>Annex: Top-risk suppliers</li>
            </ul>
          </div>
        )}

        {tab === "monitoring" && (
          <div className="grid">
            <div className="card">
              <h2 style={{ marginTop: 0 }}>Supplier Monitoring</h2>
              <p style={{ color: "var(--muted)", marginTop: 6 }}>
                Runs sanctions screening and optional news monitoring.
              </p>
              <div className="row" style={{ gap: 10 }}>
                <button className="btn" onClick={runMonitoring}>Run Monitoring Now</button>
                <button className="btn ghost" onClick={loadMonitoring}>Refresh</button>
              </div>
              <div style={{ marginTop: 14, color: "var(--muted)", fontSize: 12 }}>
                Tip: configure EU_SANCTIONS_URL / OFAC_SDN_URL and (optional) GDELT_ENABLED in .env for real data.
              </div>
            </div>
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Recent Events</h3>
              <table className="table">
                <thead>
                  <tr><th>Type</th><th>Severity</th><th>Title</th><th>Time</th></tr>
                </thead>
                <tbody>
                  {events.map((e:any) => (
                    <tr key={e.id}>
                      <td>{e.event_type}</td>
                      <td><span className={"badge " + (e.severity === "high" ? "high" : e.severity === "medium" ? "medium" : "low")}>{e.severity}</span></td>
                      <td>{e.url ? <a href={e.url} target="_blank" rel="noreferrer">{e.title}</a> : e.title}</td>
                      <td style={{ color: "var(--muted)" }}>{new Date(e.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Recent Screenings</h3>
              <table className="table">
                <thead>
                  <tr><th>Type</th><th>Status</th><th>Score</th><th>Time</th></tr>
                </thead>
                <tbody>
                  {screenings.map((s:any) => (
                    <tr key={s.id}>
                      <td>{s.screening_type}</td>
                      <td>{s.status}</td>
                      <td>{s.score}</td>
                      <td style={{ color: "var(--muted)" }}>{new Date(s.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "integrations" && (
          <div className="grid">
            <div className="card">
              <h2 style={{ marginTop: 0 }}>Data Integrations</h2>
              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <button className="btn" onClick={syncCountryRisks}>Sync Country Risks</button>
                <button className="btn" onClick={syncSanctionsEU}>Sync EU Sanctions</button>
                <button className="btn" onClick={syncSanctionsOFAC}>Sync OFAC SDN</button>
                <button className="btn ghost" onClick={loadSyncStatus}>Refresh</button>
              </div>
              <p style={{ color: "var(--muted)", marginTop: 10 }}>
                Configure source URLs in .env. Without URLs, country risks use the built-in stable seed.
              </p>
            </div>
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Sync Log</h3>
              <table className="table">
                <thead>
                  <tr><th>Job</th><th>Status</th><th>Time</th></tr>
                </thead>
                <tbody>
                  {syncStatus.map((r:any, idx:number) => (
                    <tr key={idx}>
                      <td>{r.job}</td>
                      <td>{r.status}</td>
                      <td style={{ color: "var(--muted)" }}>{new Date(r.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
