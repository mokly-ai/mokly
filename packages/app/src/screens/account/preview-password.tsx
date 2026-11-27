import { useRouter } from "expo-router";
import { useCallback, useState } from "react";

import { Action } from "../../components/action";
import { Field } from "../../components/field";
import { formFailure } from "../../components/form-failure";
import { exchangePreviewPassword } from "../../data/auth";
import { replaceAddress } from "../../navigation/address";
import { validateReturnTo } from "../../navigation/return-to";
import { useSession } from "../../session/context";
import { nothingToDo, useWrite } from "../../settings/write";

/**
 * What sign in adds under the email form where the configuration answer names
 * a shared account: a second `or` rule, the Password field and one action
 * named for that account. Continue with email keeps the one `primary` action,
 * so this one is `secondary`.
 *
 * Its write is its own. A password the API refused is said on the field, and
 * the control keeps its label, because the same password would be refused
 * again; every other refusal is said beside the control, which reads the way
 * back. Nothing about it reaches the email form. Success adopts the session
 * and replaces the route with the answer's destination, as the email and
 * desktop landings do, so the control stays busy until the page has changed.
 */
export function PasswordSection({
  account,
  returnTo,
}: {
  account: string;
  returnTo: string;
}) {
  const router = useRouter();
  const { adopt } = useSession();
  const [password, setPassword] = useState("");
  // The API checks the password as sent, so the white space a paste carries
  // around it is taken off here, as it is from the email address.
  const typed = password.trim();
  const signIn = useWrite(nothingToDo, typed.length > 0);

  const submit = useCallback(
    () =>
      signIn.run(async () => {
        const issued = await exchangePreviewPassword({
          password: typed,
          returnTo,
        });
        adopt(issued.session);
        replaceAddress(router, validateReturnTo(issued.returnTo));
      }),
    [signIn, typed, returnTo, adopt, router],
  );

  const failure = formFailure(signIn, { "magic-link-invalid": "password" });
  return (
    <>
      <div className="or-divider">
        <span>or</span>
      </div>
      <Field
        label="Password"
        name="sign-in-password"
        type="password"
        value={password}
        onChange={setPassword}
        disabled={signIn.working}
        error={failure.on("password")}
      />
      {failure.around(
        <Action
          label={failure.label(
            "Continue as " + account,
            "Signing in…",
            "Try again",
          )}
          tone="secondary"
          block
          write={signIn}
          operation="Signing you in"
          onPress={() => void submit()}
          testID="password-entry"
        />,
      )}
    </>
  );
}
