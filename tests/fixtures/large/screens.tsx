import { Badge } from "@firna/ui/badge";
import { Input } from "@firna/ui/input";

import { MockLink } from "@mokly/mokly";

import type { AreaComponents } from "./components.js";

interface ScreenProps {
  area: string;
  index: number;
  rows: number;
  next: string;
  components: AreaComponents;
}

const noop = () => {};

function RecordList({ rows, compact }: { rows: number; compact: boolean }) {
  return (
    <div role="table" aria-label="Activity" className="scale-records">
      {Array.from({ length: rows }, (_, index) => (
        <div role="row" key={index} className="scale-record">
          <span role="cell">Record {index + 1}</span>
          {!compact && <span role="cell">Workspace {(index % 4) + 1}</span>}
          <span role="cell">
            <Badge tone={index % 2 ? "primary" : "neutral"}>
              {index % 2 ? "Complete" : "In progress"}
            </Badge>
          </span>
          <span role="cell">{(index + 1) * 125}</span>
        </div>
      ))}
    </div>
  );
}

function Screen({
  compact,
  area,
  index,
  rows,
  next,
  components: { action, panel },
}: ScreenProps & { compact: boolean }) {
  return (
    <main className={`scale-screen ${compact ? "compact" : "wide"}`}>
      <header>
        <img src="../../assets/mark.svg" width="28" height="28" alt="" />
        <span>{area.replaceAll("-", " ")}</span>
        <MockLink to={`${area}-guide`}>Help</MockLink>
      </header>
      <h1>Activity {index + 1}</h1>
      <Input
        aria-label="Search activity"
        value=""
        onChangeText={noop}
        placeholder="Search activity"
      />
      <panel.Component title="Recent activity">
        <p>Review your records and choose your next step.</p>
        <action.Component label="New record" />
      </panel.Component>
      <RecordList compact={compact} rows={rows} />
      <footer>
        <action.Component moklyInstance="footer" label="Save changes" />
        <MockLink to={next} fragment="summary">
          Next activity
        </MockLink>
        <MockLink to={`${area}-action`}>Available actions</MockLink>
      </footer>
      <section id="summary">
        <h2>Summary</h2>
        <p>{rows} records in this view.</p>
      </section>
    </main>
  );
}

export function MobileScreen(props: ScreenProps) {
  return <Screen {...props} compact />;
}
export function DesktopScreen(props: ScreenProps) {
  return <Screen {...props} compact={false} />;
}
