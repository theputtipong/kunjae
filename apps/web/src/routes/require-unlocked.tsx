import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";

import { useSession } from "../session/use-session.ts";
import { useT } from "../i18n/index.ts";
import { Callout } from "../ui/primitives.tsx";

export const RequireUnlocked = ({ children }: { readonly children: ReactNode }) => {
  const session = useSession();
  const navigate = useNavigate();
  const t = useT();

  useEffect(() => {
    if (session.status === "locked") void navigate({ to: "/" });
  }, [session.status, navigate]);

  if (session.status === "locked") {
    return (
      <div className="mx-auto max-w-md p-6">
        <Callout tone="info">{t.locked.redirecting}</Callout>
      </div>
    );
  }

  return <>{children}</>;
};
