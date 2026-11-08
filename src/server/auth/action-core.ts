// The one way to build a server action (D67). Order of checks:
//   1. resolve the viewer from the database-backed session (never from input);
//   2. enforce the role: not signed in → UNAUTHENTICATED, wrong role → NOT_FOUND (D62);
//   3. validate input with a STRICT schema: unknown keys such as `retailerId`
//      or `role` are rejected (D69.4). `.strict()` is forced on every schema.
// Authentication comes before validation, so anonymous callers learn nothing
// about inputs. Only AccessError is caught; everything else (including Next's
// redirect()) propagates.
//
// Framework-free so it can be unit-tested; action.ts binds it to Next.js.

import { z } from "zod";
import type { Viewer } from "./session-store";
import { AccessError, type AccessErrorCode } from "./access-error";

export const ACTION_MARK = Symbol.for("parchi.guardedAction");

export type ActionRole = "PUBLIC" | "SIGNED_IN" | "RETAILER" | "DESK";

export type RetailerViewer = Viewer & { role: "RETAILER"; retailerId: string };
export type DeskViewer = Viewer & { role: "DESK" };

type ViewerFor<R extends ActionRole> = R extends "PUBLIC"
  ? Viewer | null
  : R extends "RETAILER"
    ? RetailerViewer
    : R extends "DESK"
      ? DeskViewer
      : Viewer;

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AccessErrorCode | "INVALID_INPUT" };

export type GuardedAction<T> = ((raw?: unknown) => Promise<ActionResult<T>>) & { [ACTION_MARK]: ActionRole };

export type ActionDeps = {
  resolveViewer: () => Promise<Viewer | null>;
  /** Called when a protected action sees no valid session (e.g. clear the cookie). */
  onUnauthenticated?: () => Promise<void>;
};

export function createActionFactory(deps: ActionDeps) {
  return function action<R extends ActionRole, S extends z.ZodObject, T>(config: {
    role: R;
    input: S;
    handler: (input: z.infer<S>, ctx: { viewer: ViewerFor<R> }) => Promise<T>;
  }): GuardedAction<T> {
    const schema = config.input.strict();

    const guarded = async (raw?: unknown): Promise<ActionResult<T>> => {
      const viewer = await deps.resolveViewer();
      if (config.role !== "PUBLIC") {
        if (!viewer) {
          await deps.onUnauthenticated?.();
          return { ok: false, error: "UNAUTHENTICATED" };
        }
        if (!roleAllows(config.role, viewer)) return { ok: false, error: "NOT_FOUND" };
      }

      const parsed = schema.safeParse(toPlainInput(raw));
      if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

      try {
        const data = await config.handler(parsed.data as z.infer<S>, { viewer: viewer as ViewerFor<R> });
        return { ok: true, data };
      } catch (error) {
        if (error instanceof AccessError) return { ok: false, error: error.code };
        throw error;
      }
    };

    return Object.assign(guarded, { [ACTION_MARK]: config.role });
  };
}

function roleAllows(role: ActionRole, viewer: Viewer): boolean {
  if (role === "SIGNED_IN") return true;
  if (role === "RETAILER") return viewer.role === "RETAILER" && viewer.retailerId !== null;
  if (role === "DESK") return viewer.role === "DESK";
  return true;
}

/** Form posts arrive as FormData; Next's own `$ACTION…` fields are dropped. */
function toPlainInput(raw: unknown): unknown {
  if (raw === undefined) return {};
  if (typeof FormData !== "undefined" && raw instanceof FormData) {
    const input: Record<string, FormDataEntryValue> = {};
    for (const [key, value] of raw.entries()) if (!key.startsWith("$ACTION")) input[key] = value;
    return input;
  }
  return raw;
}

export function isGuardedAction(value: unknown): value is GuardedAction<unknown> {
  return typeof value === "function" && ACTION_MARK in value;
}
