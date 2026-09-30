import type { TripStatus } from "@jlaero/shared";

// What the client should do (or expect) next, per status.
export const CLIENT_NEXT: Partial<Record<TripStatus, string>> = {
  new_request: "Your broker is reviewing your request.",
  searching: "We are contacting operators near your route.",
  quotes_received: "Quotes are coming in. Your broker is verifying them.",
  broker_review: "Your broker is preparing your options.",
  options_sent: "Review your options and choose an aircraft.",
  client_selected: "Your broker is confirming availability and price.",
  contract_sent: "Review and sign your charter agreement.",
  contract_signed: "Payment is now open.",
  payment_pending: "Complete your payment to secure the aircraft.",
  payment_received: "Payment verified. We are confirming with the operator.",
  operator_confirmation_pending: "We are confirming the aircraft with the operator.",
  confirmed: "Your trip is confirmed. Your itinerary is on its way.",
  itinerary_pending: "Your itinerary is being prepared.",
  itinerary_ready: "Your itinerary is ready.",
  within_72_hours: "You depart soon. Review your itinerary.",
  active: "Your trip is in progress.",
  operational_issue: "We are arranging a replacement aircraft for you.",
  replacement_search: "We are arranging a replacement aircraft for you.",
  replacement_pending_client: "Choose your replacement aircraft.",
  completed: "Thank you for flying with us.",
  feedback_requested: "Tell us how your trip went.",
};

// Statuses where the client has something to do.
export const CLIENT_ACTION: TripStatus[] = ["options_sent", "replacement_pending_client", "contract_sent", "payment_pending", "feedback_requested"];
