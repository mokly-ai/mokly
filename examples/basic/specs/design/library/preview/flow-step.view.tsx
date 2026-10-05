import { DesignLink } from "../../parts/design_navigation.js";
import { useDesignStyle } from "../style_context.js";

import type { FlowStepProps } from "./flow-step.js";

export function FlowStepView({
  children,
  description,
  number,
  screenPath,
  title,
}: FlowStepProps) {
  useDesignStyle("flow-step");
  return (
    <section className="flow-step">
      <div className="flow-step-head">
        <span className="flow-step-num">{number}</span>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
          <DesignLink to={screenPath}>
            <span className="flow-step-link">
              This screen in the catalogue: #{screenPath} →
            </span>
          </DesignLink>
        </div>
      </div>
      <div className="mbk-flow-screen">{children}</div>
    </section>
  );
}
