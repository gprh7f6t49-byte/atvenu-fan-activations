import { redirect } from "next/navigation";

// Tours are listed with standalone events on the Activations screen.
export default function ToursPage() {
  redirect("/admin");
}
