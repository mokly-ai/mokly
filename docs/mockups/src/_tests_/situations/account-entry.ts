import type { ProductSituation } from "../product-situation";

export const accountEntrySituations = [
  // Continue with GitHub's write on each entry screen, a screen beside it
  // like the other GitHub situations.
  {
    path: "product/account/sign-in/github-connecting",
    family: "account",
    screen: "sign-in",
    name: "github-connecting",
    sibling: true,
    states: ["default"],
    pending: true,
  },
  {
    path: "product/account/sign-up/github-connecting",
    family: "account",
    screen: "sign-up",
    name: "github-connecting",
    sibling: true,
    states: ["default"],
    pending: true,
  },
  {
    path: "product/account/sign-in/github-refused",
    family: "account",
    screen: "sign-in",
    name: "github-refused",
    states: ["default"],
  },
  {
    path: "product/account/sign-up/github-refused",
    family: "account",
    screen: "sign-up",
    name: "github-refused",
    states: ["default"],
  },
  {
    path: "product/account/sign-in/github-opens-soon",
    family: "account",
    screen: "sign-in",
    name: "github-opens-soon",
    states: ["default"],
  },
  {
    path: "product/account/sign-up/github-opens-soon",
    family: "account",
    screen: "sign-up",
    name: "github-opens-soon",
    states: ["default"],
  },
  {
    path: "product/account/sign-in/address-refused",
    family: "account",
    screen: "sign-in",
    name: "address-refused",
    states: ["default"],
  },
  {
    path: "product/account/sign-up/address-refused",
    family: "account",
    screen: "sign-up",
    name: "address-refused",
    states: ["default"],
  },
] as const satisfies readonly ProductSituation[];
