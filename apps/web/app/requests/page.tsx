import { redirect } from "next/navigation";

// Old request list; trips replaced requests in the brokerage workflow.
export default function RequestsRedirect() {
  redirect("/trips");
}
