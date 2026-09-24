import { DesignLink } from "../../parts/design_navigation.js";

import type { FlowStepProps } from "./flow-step.js";

export function FlowStepView({
  children,
  description,
  number,
  screenId,
  title,
}: FlowStepProps) {
  return (
    <section className="flow-step">
      <div className="flow-step-head">
        <span className="flow-step-num">{number}</span>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
          <DesignLink to={screenId}>
            <span className="flow-step-link">
              This screen in the catalogue: #{screenId} →
            </span>
          </DesignLink>
        </div>
      </div>
      <div className="mbk-flow-screen">{children}</div>
    </section>
  );
}
