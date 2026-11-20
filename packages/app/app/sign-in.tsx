import { useLocalSearchParams } from "expo-router";

import { useAddressSearch } from "../src/navigation/address";
import {
  transportReturnTo,
  validateReturnTo,
} from "../src/navigation/return-to";
import { EntryScreen } from "../src/screens/account/entry-screen";

/** Account entry for a returning reader, linked from the public site. */
export default function SignIn() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const search = useAddressSearch();
  return (
    <EntryScreen
      mode="sign-in"
      returnTo={validateReturnTo(transportReturnTo(returnTo, search))}
    />
  );
}
