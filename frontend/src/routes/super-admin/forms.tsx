import { createFileRoute } from "@tanstack/react-router";
import { MyFormsPage } from "@/routes/admin/my-forms";

export const Route = createFileRoute("/super-admin/forms")({
  component: MyFormsPage,
});
