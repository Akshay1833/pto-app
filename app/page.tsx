import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getServerSession();

  if (session) {
    redirect("/pto");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#ffffff",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          padding: 24,
          boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
          background: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: "#111827",
              display: "grid",
              placeItems: "center",
              color: "white",
              fontWeight: 800,
              letterSpacing: -0.5,
            }}
          >
            BZ
          </div>

          <div>
            <h1 style={{ margin: 0, fontSize: 22, letterSpacing: -0.3 }}>
              Bullzeye PTO
            </h1>
            <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 14 }}>
              Internal time off requests
            </p>
          </div>
        </div>

        <div style={{ height: 18 }} />

        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            padding: 14,
            background: "#fafafa",
            color: "#374151",
            fontSize: 14,
            lineHeight: 1.4,
          }}
        >
          Sign in with your <b>@bullzeyeequipment.com</b> Microsoft account to
          submit PTO requests and track approvals.
        </div>

        <div style={{ height: 16 }} />

        <a
          href="/api/auth/signin"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            width: "100%",
            padding: "12px 14px",
            borderRadius: 14,
            border: "1px solid #111827",
            background: "#111827",
            color: "white",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              background: "white",
              display: "inline-block",
            }}
          />
          Continue with Microsoft
        </a>

        <div style={{ height: 14 }} />

        <div style={{ color: "#9ca3af", fontSize: 12 }}>
          If you have trouble signing in, contact HR.
        </div>
      </div>
    </div>
  );
}