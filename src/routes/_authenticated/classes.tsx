import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/classes")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
