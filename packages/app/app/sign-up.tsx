import { useLocalSearchParams } from "expo-router";

import { useAddressSearch } from "../src/navigation/address";
import {
  transportReturnTo,
  validateReturnTo,
} from "../src/navigation/return-to";
import { EntryScreen } from "../src/screens/account/entry-screen";

/** Account entry for a new reader, linked from the public site. */
export default function SignUp() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const search = useAddressSearch();
  return (
    <EntryScreen
      mode="sign-up"
      returnTo={validateReturnTo(transportReturnTo(returnTo, search))}
    />
  );
}
