import { logoutAction } from "@/app/login/actions";

/** A real form POST, so logout never happens on a GET (D69.7). */
export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button type="submit" className="min-h-11 rounded border border-neutral-400 px-4 text-sm">
        Log out
      </button>
    </form>
  );
}
