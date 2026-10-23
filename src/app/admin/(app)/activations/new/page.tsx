import { redirect } from "next/navigation";

// Activations are created inside a campaign; start there.
export default function NewActivationPage() {
  redirect("/admin/campaigns/new");
}
