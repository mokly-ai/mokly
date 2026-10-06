import { expect, test } from "@playwright/test";

import { componentDesignUrl } from "./component_design_fixture.js";

for (const viewport of ["desktop", "mobile"] as const) {
  test(`${viewport}: controls keep the saved component canvas width`, async ({
    page,
  }) => {
    await page.setViewportSize(
      viewport === "desktop"
        ? { width: 1440, height: 1000 }
        : { width: 390, height: 844 },
    );
    await page.goto(componentDesignUrl("design/components/overview", viewport));
    const saved = await page.locator(".ce-canvas:visible").boundingBox();
    await page.goto(
      componentDesignUrl("design/components/controls/controls", viewport),
    );
    const editable = await page.locator(".ce-canvas:visible").boundingBox();
    expect(editable?.width).toBe(saved?.width);
  });

  test(`${viewport}: component controls show saved, edited, reset, and error states`, async ({
    page,
  }) => {
    await page.setViewportSize(
      viewport === "desktop"
        ? { width: 1440, height: 1000 }
        : { width: 390, height: 844 },
    );
    await page.goto(
      componentDesignUrl("design/components/pages/variants", viewport),
    );
    await page.getByRole("link", { name: "Edit props", exact: false }).click();
    await expect(page).toHaveURL(
      componentDesignUrl(
        "design/components/controls/editing/variant",
        viewport,
      ),
    );
    await expect(page.locator(".ce-canvas:visible")).toHaveCount(1);
    await expect(page.locator(".ce-canvas:visible .ce-action")).toBeDisabled();
    await page.goto(
      componentDesignUrl("design/components/controls/controls", viewport),
    );
    const controls = page.getByRole("region", {
      name: "Controls",
      exact: true,
    });
    await expect(
      controls.getByRole("textbox", { name: "label", exact: true }),
    ).toHaveValue("Continue");
    await expect(
      controls.getByRole("spinbutton", { name: "cornerRadius", exact: true }),
    ).toHaveValue("8");
    await expect(
      controls.getByRole("combobox", { name: "emphasis", exact: true }),
    ).toHaveValue("strong");
    await expect(
      controls.getByRole("checkbox", { name: "disabled", exact: true }),
    ).not.toBeChecked();
    await expect(
      controls.getByRole("checkbox", { name: "Set hint", exact: true }),
    ).toBeChecked();
    await controls
      .getByRole("textbox", { name: "label", exact: true })
      .fill("Next");
    await expect(
      controls.getByRole("textbox", { name: "label", exact: true }),
    ).toHaveValue("Next");
    await page.goto(
      componentDesignUrl("design/components/controls/editing/edited", viewport),
    );
    await expect(page.locator(".ce-canvas:visible .ce-action")).toHaveText(
      "Get started",
    );
    await expect(
      controls.getByRole("textbox", { name: "label", exact: true }),
    ).toHaveValue("Get started");
    await controls
      .getByRole("link", { name: "Reset to Default", exact: true })
      .click();
    await expect(page).toHaveURL(
      componentDesignUrl("design/components/controls/editing/reset", viewport),
    );
    await expect(page.locator(".ce-canvas:visible")).toHaveCount(1);
    await expect(page.locator(".ce-canvas:visible .ce-action")).toHaveText(
      "Continue",
    );
    await expect(
      controls.getByRole("textbox", { name: "label", exact: true }),
    ).toHaveValue("Continue");
    await page
      .getByRole("navigation", { name: "Saved variants" })
      .getByRole("link", { name: "Disabled", exact: true })
      .click();
    await expect(page.locator(".ce-canvas:visible")).toHaveCount(1);
    await expect(page.locator(".ce-canvas:visible .ce-action")).toBeDisabled();
    await expect(
      controls.getByRole("checkbox", { name: "disabled", exact: true }),
    ).toBeChecked();
    await page.goto(
      componentDesignUrl("design/components/controls/states/invalid", viewport),
    );
    const radius = controls.getByRole("spinbutton", {
      name: "cornerRadius",
      exact: true,
    });
    await expect(radius).toHaveAttribute("aria-invalid", "true");
    await expect(radius).toHaveAccessibleDescription(
      "Enter a number from 0 to 24.",
    );
    await expect(page.locator(".ce-canvas:visible .ce-action")).toHaveCSS(
      "border-radius",
      "8px",
    );
    await page.goto(
      componentDesignUrl("design/components/controls/states/error", viewport),
    );
    await expect(page.getByRole("alert")).toContainText(
      "Couldn’t update this component",
    );
    await page.getByRole("link", { name: "Try again", exact: true }).click();
    await expect(page).toHaveURL(
      componentDesignUrl("design/components/controls/states/pending", viewport),
    );
    await expect(
      page.locator(`[data-preview-viewport="${viewport}"]`).getByRole("status"),
    ).toContainText("Updating preview");
  });

  test(`${viewport}: unset, comparison, and published views preserve control boundaries`, async ({
    page,
  }) => {
    await page.setViewportSize(
      viewport === "desktop"
        ? { width: 1440, height: 1000 }
        : { width: 390, height: 844 },
    );
    await page.goto(
      componentDesignUrl("design/components/controls/editing/unset", viewport),
    );
    await expect(
      page.getByRole("checkbox", { name: "Set hint", exact: true }),
    ).not.toBeChecked();
    await expect(
      page.getByRole("textbox", { name: "hint", exact: true }),
    ).toBeHidden();
    await page.getByRole("checkbox", { name: "Set hint", exact: true }).check();
    await expect(
      page.getByRole("textbox", { name: "hint", exact: true }),
    ).toBeVisible();
    await page.goto(
      componentDesignUrl(
        "design/components/controls/states/comparison",
        viewport,
      ),
    );
    await expect(
      page.getByRole("region", { name: "Controls", exact: true }),
    ).toContainText("Switch to Current to edit props.");
    await expect(
      page
        .getByRole("region", { name: "Controls", exact: true })
        .locator("input, select"),
    ).toHaveCount(0);
    await page
      .getByRole("link", { name: "Switch to Current", exact: true })
      .click();
    await expect(page).toHaveURL(
      componentDesignUrl("design/components/controls/controls", viewport),
    );
    await page.goto(
      componentDesignUrl(
        "design/components/controls/published/readonly",
        viewport,
      ),
    );
    await expect(
      page.getByRole("region", { name: "Controls", exact: true }),
    ).toContainText("Open this catalogue locally to edit props.");
    await expect(
      page
        .getByRole("region", { name: "Controls", exact: true })
        .locator("input, select"),
    ).toHaveCount(0);
    await page
      .getByRole("navigation", { name: "Saved variants" })
      .getByRole("link", { name: "Disabled", exact: true })
      .click();
    await expect(page).toHaveURL(
      componentDesignUrl(
        "design/components/controls/published/readonly-variant",
        viewport,
      ),
    );
    await expect(page.locator(".ce-canvas:visible")).toHaveCount(1);
    await expect(
      page
        .getByRole("region", { name: "Controls", exact: true })
        .locator("input, select"),
    ).toHaveCount(0);
    await expect(page.locator(".ce-canvas:visible .ce-action")).toBeDisabled();
  });
}
