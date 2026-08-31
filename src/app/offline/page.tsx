import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="offline-page">
      <div className="offline-card">
        <p className="offline-eyebrow">BOOKNEST</p>
        <h1>You&apos;re offline</h1>
        <p>
          Check your internet connection, then try again. Your BookNest app will be ready when you reconnect.
        </p>
        <Link className="btn btn-primary" href="/">
          Try again
        </Link>
      </div>
    </main>
  );
}
