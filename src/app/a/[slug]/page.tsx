import { LandingLayout } from "@/components/landing-layout";
import { CAMPAIGN_TYPES } from "@/lib/campaigns";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActivationBySlug, listShows } from "@/lib/activations";
import { canAccessOrg, getCurrentUser } from "@/lib/auth";
import { consentCopy } from "@/lib/consent";
import { formatShowDate, upcomingShows } from "@/lib/wallet/content";
import { submitOptIn } from "./actions";
import { OptInForm } from "./opt-in-form";

export async function generateMetadata({ params }: PageProps<"/a/[slug]">): Promise<Metadata> {
  const a = getActivationBySlug((await params).slug);
  if (!a || a.kind !== "fan") return {};
  return { title: `${a.artist_name} — ${a.offer_headline}`, description: a.tagline ?? a.description ?? undefined };
}

export default async function ActivationLanding({ params, searchParams }: PageProps<"/a/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const a = getActivationBySlug(slug);
  // Crew and comp passes are issued by the merch team; there is no public sign-up.
  if (!a || a.kind !== "fan") notFound();

  const viewer = a.status === "draft" ? await getCurrentUser() : null;
  const preview = Boolean(viewer && canAccessOrg(viewer, a.organisation_id));
  if (a.status === "draft" && !preview) notFound();

  const shows = listShows(a.id);
  const source = [sp.utm_source, sp.src].find((v): v is string => typeof v === "string") ?? null;

  return (
    <LandingLayout
      a={a}
      shows={shows}
      top={preview && (
        <div className="relative z-10 bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-black">
          Draft preview — only admins can see this page. Set the activation to Live to open sign-ups.
        </div>
      )}
      form={
        <>
          {a.status === "ended" ? (
            <div className="py-10 text-center">
              <p className="text-2xl font-bold">This offer has ended</p>
              <p className="mt-2 opacity-70">Thanks to everyone who took part.</p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-extrabold">Claim Fan Discount</h2>
              <p className="mb-6 mt-1 text-sm opacity-70">Your personal pass, delivered straight to your phone.</p>
              <OptInForm
                action={submitOptIn.bind(null, a.slug)}
                copy={consentCopy(a)}
                privacyUrl={a.privacy_url}
                source={source}
                noun={CAMPAIGN_TYPES[a.campaign_type].dateNoun}
                shows={upcomingShows(shows).map((s) => ({ id: s.id, date: formatShowDate(s.show_date), place: `${s.venue}, ${s.city}` }))}
              />
            </>
          )}
          {a.offer_terms && <p className="mt-6 text-xs opacity-50">{a.offer_terms}</p>}
        </>
      }
    />
  );
}
