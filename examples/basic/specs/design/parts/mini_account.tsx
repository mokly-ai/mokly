/** One labelled value on a miniature settings screen. */
type SettingLine = readonly [label: string, value: string];

const PROFILE_LINES: readonly SettingLine[] = [
  ["Name", "Alex Morgan"],
  ["Email", "alex@example.test"],
  ["Photo", "Uploaded"],
];

const SECURITY_LINES: readonly SettingLine[] = [
  ["Password", "Changed 3 months ago"],
  ["Two-step sign-in", "On"],
  ["Signed-in devices", "2"],
];

function SettingsShot({
  action,
  compact,
  heading,
  lines,
  place,
}: {
  action: string;
  compact: boolean | undefined;
  heading: string;
  lines: readonly SettingLine[];
  place: string;
}) {
  return (
    <div className="mbk-shot">
      <div className="mbk-shot-pad">
        <div className="mbk-shot-nav">{compact ? "Menu" : place}</div>
        <h2>{heading}</h2>
        <dl className="mbk-shot-lines">
          {lines.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <span className="mbk-shot-action">{action}</span>
      </div>
    </div>
  );
}

/** Miniature depiction of the Profile screen, its folder's own page. */
export function MiniProfile({ compact }: { compact?: boolean | undefined }) {
  return (
    <SettingsShot
      action="Edit profile"
      compact={compact}
      heading="Your profile"
      lines={PROFILE_LINES}
      place="Account · Profile"
    />
  );
}

/** Miniature depiction of the Security screen in the Profile folder. */
export function MiniSecurity({ compact }: { compact?: boolean | undefined }) {
  return (
    <SettingsShot
      action="Change password"
      compact={compact}
      heading="Security"
      lines={SECURITY_LINES}
      place="Account · Profile · Security"
    />
  );
}
