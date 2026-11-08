import "server-only";
import { createActionFactory } from "./action-core";
import { clearSessionCookie } from "./session-cookie";
import { getViewer } from "./viewer";

/** Every server action is built with this (D67). See action-core.ts. */
export const action = createActionFactory({
  resolveViewer: getViewer,
  onUnauthenticated: clearSessionCookie,
});
