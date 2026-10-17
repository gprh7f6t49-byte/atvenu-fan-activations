import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActivation, listShows } from "@/lib/activations";
import { brandStyle } from "@/lib/brand";
import { passBadge } from "@/lib/discount";
import { getPassByToken } from "@/lib/fans";
import { appleWalletEnabled } from "@/lib/wallet/apple";
import { googleWalletEnabled } from "@/lib/wallet/google";
import { formatShowDate, nextShow, redemptionInstructions } from "@/lib/wallet/content";

export const metadata: Metadata = { title: "Your pass", robots: { index: false } };

export default async function PassPage({ params, searchParams }: PageProps<"/p/[token]">) {
  const { token } = await params;
  const { returning } = await searchParams;
  const pass = getPassByToken(token);
  if (!pass) notFound();
  const a = getActivation(pass.activation_id)!;

  if (pass.revoked_at) {
    return (
      <main style={brandStyle(a)} className="grid min-h-screen flex-1 place-items-center bg-zinc-950 px-5 text-center text-white">
        <div>
          <p className="text-2xl font-bold">This pass is no longer valid</p>
          <p className="mt-2 text-sm opacity-70">It was revoked by the {a.artist_name} merch team. Contact them if you think this is a mistake.</p>
        </div>
      </main>
    );
  }

  const shows = listShows(a.id);
  const upcoming = nextShow(shows);
  const apple = appleWalletEnabled();
  const google = googleWalletEnabled();
  const redeemed = Boolean(a.single_use) && pass.code_status === "redeemed";
  const badge = passBadge(a.kind, pass.recipient_group);
  const holder = [pass.first_name, pass.last_name].filter(Boolean).join(" ") || pass.email;
  const holderDetail = [pass.role, pass.organisation].filter(Boolean).join(" · ");
  const emailed = pass.email_sent_at ? " We've emailed you a copy too." : "";
  const intro =
    a.kind === "fan"
      ? returning
        ? "Welcome back — here's the code you already claimed."
        : `You're in${pass.first_name ? `, ${pass.first_name}` : ""}!${emailed}`
      : `${pass.first_name ? `${pass.first_name}, here's` : "Here's"} your ${a.kind === "crew" ? "crew" : "comp"} pass.${emailed}`;

  return (
    <main style={brandStyle(a)} className="min-h-screen flex-1 bg-zinc-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-sm">
        <p className="text-center text-sm opacity-70">{intro}</p>

        {/* Wallet-style pass preview */}
        <div className="mt-6 overflow-hidden rounded-2xl bg-brand text-ink shadow-2xl ring-1 ring-white/10">
          <div className="flex items-start justify-between px-5 pt-5">
            <span className="text-xl font-black uppercase tracking-tight">{a.artist_name}</span>
            {badge ? (
              <span className="rounded-full bg-accent px-3 py-1 text-[11px] font-black uppercase tracking-widest text-brand">{badge}</span>
            ) : (
              <span className="text-right text-[10px] uppercase tracking-widest text-accent">
                Tour
                <span className="block text-xs normal-case tracking-normal text-ink">{a.tour_name}</span>
              </span>
            )}
          </div>
          <div
            className="mt-4 px-5 py-6"
            style={{ background: `linear-gradient(135deg, ${a.primary_color}, ${a.accent_color}8c)` }}
          >
            <p className="text-[10px] uppercase tracking-widest text-accent">{badge ? a.tour_name : a.artist_name}</p>
            <p className="text-3xl font-extrabold leading-tight">{a.offer_headline}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 px-5 py-4 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-accent">{a.kind === "fan" ? "Fan" : "Name"}</p>
              <p>{holder}</p>
              {holderDetail && <p className="text-xs opacity-70">{holderDetail}</p>}
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-accent">Next show</p>
              <p>{upcoming ? `${upcoming.city} · ${formatShowDate(upcoming.show_date)}` : "—"}</p>
            </div>
          </div>
          <div className="flex flex-col items-center pb-6">
            <div className="rounded-xl bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/pass/${token}/qr`} width={180} height={180} alt={`QR code for ${pass.code}`} />
            </div>
            <p className="mt-2 font-mono text-lg tracking-[0.25em]">{pass.code}</p>
            {redeemed && (
              <p className="mt-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest">Redeemed</p>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          {apple ? (
            <a href={`/api/pass/${token}/apple`} className="rounded-full bg-black px-5 py-3.5 text-center font-semibold ring-1 ring-white/30 hover:bg-zinc-900">
              Add to Apple Wallet
            </a>
          ) : (
            <WalletPending label="Apple Wallet" />
          )}
          {google ? (
            <a href={`/api/pass/${token}/google`} className="rounded-full bg-white px-5 py-3.5 text-center font-semibold text-black hover:bg-zinc-200">
              Add to Google Wallet
            </a>
          ) : (
            <WalletPending label="Google Wallet" />
          )}
        </div>

        <div className="mt-8 space-y-2 text-sm opacity-70">
          <p className="font-semibold uppercase tracking-widest opacity-80">How to redeem</p>
          <p>{redemptionInstructions(a)}</p>
          {a.offer_terms && <p className="text-xs opacity-70">{a.offer_terms}</p>}
        </div>
      </div>
    </main>
  );
}

function WalletPending({ label }: { label: string }) {
  return (
    <div className="rounded-full border border-dashed border-white/25 px-5 py-3 text-center text-sm opacity-60">
      {label} coming soon — screenshot this pass or use your email for now
    </div>
  );
}
