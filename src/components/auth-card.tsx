/** Centred card used by the sign-in, invite and password-reset pages. */
export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="atv grid min-h-screen flex-1 place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/atvenu-wordmark-white.png" alt="atVenu" className="mx-auto mb-8 h-8 w-auto" />
        <div className="card">
          <h1 className="mb-6 text-xl font-bold">{title}</h1>
          {children}
        </div>
      </div>
    </main>
  );
}
