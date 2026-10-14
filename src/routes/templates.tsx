import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/templates")({
  head: () => ({
    meta: [
      { title: "Sophy Print — Campus Xerox" },
      { name: "description", content: "Fast automated campus print service." },
    ],
  }),
  component: TemplatesRedirectPage,
});

function TemplatesRedirectPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ to: "/" });
  }, [navigate]);

  return null;
}
