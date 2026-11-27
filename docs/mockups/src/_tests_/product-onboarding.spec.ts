import { expect, test } from "@playwright/test";

import { addresses, workspace, sample } from "../fixtures/product";
import { billing, onboarding } from "../fixtures/product-states";

import { productRun, productSchemes, productViewports } from "./product-runs";

/**
 * Onboarding from the emailed sign-in link: the page that waits for the link,
 * the workspace, install and repository steps, and the address suggestion
 * that keeps each form filled.
 */

for (const viewport of productViewports)
  for (const scheme of productSchemes) {
    const { url, label, size } = productRun(viewport, scheme);

    test(
      "onboarding keeps email entry unauthenticated: " + label,
      async ({ page }) => {
        await page.setViewportSize(size);
        await page.goto(url("product/account/magic-link"));
        await expect(
          page.getByRole("heading", { name: "Check your email" }),
        ).toBeVisible();
        await expect(
          page.locator(
            ".review-account, .fo-stage, [aria-label='Settings sections']",
          ),
        ).toHaveCount(0);
        await expect(
          page.getByText("Open the sign-in link sent to cal@example.com."),
        ).toBeVisible();
        await page.goto(url("product/account/create-workspace/empty"));
        await expect(
          page.getByRole("textbox", { name: "Workspace name" }),
        ).toHaveValue("");
        await expect(
          page.getByRole("button", {
            name: "Create workspace",
            exact: true,
          }),
        ).toBeDisabled();
        await page.goto(url("product/account/choose-repository/loading"));
        await expect(
          page.getByText("mokly-ai/mokly-cloud", { exact: true }),
        ).toHaveCount(0);
        await expect(page.locator("[aria-busy=true]").first()).toBeVisible();
      },
    );

    test(
      "the install step offers one way on and names only a suspension: " +
        label,
      async ({ page }) => {
        await page.setViewportSize(size);
        for (const state of [undefined, "empty", "error"] as const) {
          const where = "install-app/" + (state ?? "default");
          await page.goto(
            url("product/account/install-app" + (state ? "/" + state : "")),
          );
          // A control that navigates is an anchor, so the way on is found by
          // its test id exactly as the refusal fragment's own read does.
          const install = page.getByTestId("firna-button-primary");
          await expect(install, where).toHaveCount(1);
          await expect(install, where).toHaveText("Install on GitHub");
          await expect(
            page.getByTestId("firna-button-secondary"),
            where,
          ).toHaveCount(0);
          // The workspace's GitHub account is what the step exists to bind,
          // so no row may name the absence the one action removes.
          for (const absent of ["Not connected", "GitHub account"])
            await expect(
              page.getByText(absent),
              where + " " + absent,
            ).toHaveCount(0);
          // The only fact the step draws is the one state it cannot clear.
          const suspended = state === "error";
          const facts = page.locator(".fo-facts");
          await expect(facts, where).toHaveCount(suspended ? 1 : 0);
          const resume = page.getByRole("link", { name: "Resume on GitHub" });
          await expect(resume, where).toHaveCount(suspended ? 1 : 0);
          if (!suspended) continue;
          await expect(facts.locator("dt"), where).toHaveText("App");
          await expect(facts.locator("dd"), where).toContainText(
            workspace.installationSuspended,
          );
          await expect(resume, where).toHaveAttribute(
            "href",
            workspace.manageUrl,
          );
          await expect(resume, where).toHaveAttribute("target", "_blank");
        }
      },
    );

    test(
      "the repository step is one field over one link: " + label,
      async ({ page }) => {
        await page.setViewportSize(size);
        await page.goto(url("product/account/choose-repository"));
        const field = page.getByTestId("firna-selector");
        await expect(field).toHaveCount(1);
        await expect(field).toContainText("Repository");
        await expect(field).toContainText(sample.repository);
        // The closed field is what the reader opens; nothing is drawn open.
        await expect(page.getByTestId("firna-options-list")).toHaveCount(0);
        // The line opens the pane that adds an account and holds each
        // account's page on GitHub, rather than leaving for one of them.
        const manage = page.getByRole("link", {
          name: "Manage repository access",
        });
        await expect(manage).toHaveAttribute(
          "data-mokly-link",
          "product/settings/github",
        );
        await expect(manage).not.toHaveAttribute("target", "_blank");
        await expect(
          page.getByRole("textbox", { name: "Config path" }),
        ).toHaveValue(onboarding.config);
        // The project's address follows the repository: the slug suggested
        // for it, the address that slug gives, and what a project created on
        // the free plan will be.
        await expect(
          page.getByRole("textbox", { name: "Project slug" }),
        ).toHaveValue(onboarding.projectSlug);
        await expect(page.locator(".fo-address-preview code")).toHaveText(
          addresses.project,
        );
        await expect(page.getByText(billing.publicProjects)).toBeVisible();
        const create = page.getByTestId("firna-button-primary");
        await expect(create).toHaveCount(1);
        await expect(create).toHaveText("Create project");
        await expect(page.getByTestId("firna-button-secondary")).toHaveCount(0);

        await page.goto(url("product/account/choose-repository/empty"));
        await expect(page.getByTestId("firna-selector")).toContainText(
          "No repositories yet",
        );
        await expect(
          page.getByTestId("firna-selector").getByRole("button"),
        ).toHaveCount(0);
        await expect(
          page.getByRole("link", { name: "Manage repository access" }),
        ).toHaveAttribute("data-mokly-link", "product/settings/github");
        // With nothing to choose there is nothing to suggest an address from.
        await expect(
          page.getByRole("textbox", { name: "Project slug" }),
        ).toHaveValue("");
        await expect(
          page.getByRole("button", { name: "Create project", exact: true }),
        ).toBeDisabled();

        await page.goto(url("product/account/choose-repository/error"));
        await expect(
          page.getByRole("heading", { name: "Repositories couldn’t load" }),
        ).toBeVisible();
        await expect(page.getByTestId("firna-selector")).toHaveCount(0);
        const retry = page.getByTestId("firna-button-primary");
        await expect(retry).toHaveCount(1);
        await expect(retry).toHaveText("Try again");
        await expect(page.getByTestId("firna-button-secondary")).toHaveCount(0);
      },
    );

    test(
      "address suggestion progress keeps each populated form: " + label,
      async ({ page }) => {
        await page.setViewportSize(size);
        await page.goto(
          url("product/account/create-workspace/suggestion-loading"),
        );
        await expect(
          page.getByRole("textbox", { name: "Workspace name" }),
        ).toHaveValue(onboarding.workspace);
        await expect(
          page.getByRole("textbox", { name: "Workspace slug" }),
        ).toHaveValue(onboarding.workspaceSlug);
        await expect(
          page.getByText("Finding an available address…"),
        ).toBeVisible();

        await page.goto(
          url("product/account/choose-repository/suggestion-loading"),
        );
        await expect(
          page.getByText("mokly-ai/mokly-cloud", { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("textbox", { name: "Project slug" }),
        ).toHaveValue(onboarding.projectSlug);
        await expect(
          page.getByText("Finding an available address…"),
        ).toBeVisible();
      },
    );
  }
