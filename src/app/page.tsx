import { redirect } from "next/navigation";

// The login page sends signed-in users on to their home.
export default function Home() {
  redirect("/login");
}
