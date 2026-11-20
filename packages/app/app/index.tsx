import { Redirect } from "expo-router";

/** The app workload root enters the signed-in dashboard resolver. */
export default function AppHome() {
  return <Redirect href="/dashboard" />;
}
