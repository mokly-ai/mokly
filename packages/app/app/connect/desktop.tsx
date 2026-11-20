import { useLocalSearchParams } from "expo-router";

import { useAddressSearch } from "../../src/navigation/address";
import { connectChallenge } from "../../src/navigation/desktop-sign-in";
import {
  transportReturnTo,
  validateReturnTo,
} from "../../src/navigation/return-to";
import { ConnectDesktopScreen } from "../../src/screens/account/connect-desktop-screen";

/** The browser page that signs the desktop app in to the browser's account. */
export default function ConnectDesktop() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const search = useAddressSearch();
  const destination = transportReturnTo(returnTo, search);
  return (
    <ConnectDesktopScreen
      challenge={connectChallenge(search)}
      returnTo={destination ? validateReturnTo(destination) : undefined}
    />
  );
}
