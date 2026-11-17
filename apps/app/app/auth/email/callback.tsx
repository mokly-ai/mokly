import { CallbackScreen } from "../../../src/screens/account/callback-screen";

/** Exchange the one-use credential carried in an email-link fragment. */
export default function EmailCallback() {
  return <CallbackScreen landing="email" />;
}
