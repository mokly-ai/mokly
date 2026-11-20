import { useLocalSearchParams } from "expo-router";

import { useAddressSearch } from "../../src/navigation/address";
import {
  transportReturnTo,
  validateReturnTo,
} from "../../src/navigation/return-to";
import { MagicLinkScreen } from "../../src/screens/account/magic-link-screen";

/** The link has been sent; resend it or correct the address. */
export default function AuthEmail() {
  const { email, returnTo } = useLocalSearchParams<{
    email?: string;
    returnTo?: string;
  }>();
  const search = useAddressSearch();
  return (
    <MagicLinkScreen
      email={typeof email === "string" ? email : ""}
      returnTo={validateReturnTo(transportReturnTo(returnTo, search))}
    />
  );
}
