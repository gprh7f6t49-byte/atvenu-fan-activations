import type { Activation } from "./activations";

// Marketing consents are optional and unticked by default (UK GDPR / EU GDPR + PECR):
// a fan gets their code whether or not they opt in to marketing.
// The data belongs to the artist / promoter: atVenu never markets to fans, so there is no atVenu consent.
// Have legal review this wording before going live.

export function consentCopy(a: Activation) {
  return {
    terms: `I agree to the offer terms and understand my details will be used to issue and track my ${a.artist_name} merch code, as described in the privacy notice.`,
    artist: `Yes, I'd like news and offers from ${a.artist_name} by email.`,
    promoter: a.promoter_name ? `Yes, I'd like to hear about future shows from ${a.promoter_name} by email.` : null,
  };
}
