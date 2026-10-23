import createCache from "@emotion/cache";
import { CacheProvider, css, jsx, keyframes } from "@emotion/react";
import { ServerStyleSheet, StyleSheetManager, styled } from "styled-components";

import { defineComponent, defineScreen } from "@mokly/mokly";

const frames = keyframes`from{opacity:0}to{opacity:1}`;
const shared = css`
  animation: ${frames} 1s;
`;
const propSchema = { type: "object", additionalProperties: false } as const;

export const alpha = defineComponent({
  title: "Alpha",
  description: "",
  relatedDocs: [],
  propSchema,
  props: {},
  render: () => jsx("div", { css: shared, children: "Alpha" }),
});
export const beta = defineComponent({
  title: "Beta",
  description: "",
  relatedDocs: [],
  propSchema,
  props: {},
  render: () => jsx("div", { css: shared, children: "Beta" }),
});
export default defineScreen({
  title: "Foreign cache",
  description: "",
  relatedDocs: [],
  props: { reverse: false },
  render: ({ reverse }) => (
    <CacheProvider value={createCache({ key: "product" })}>
      {reverse ? (
        <>
          <beta.Component />
          <alpha.Component />
        </>
      ) : (
        <>
          <alpha.Component />
          <beta.Component />
        </>
      )}
    </CacheProvider>
  ),
});

const Styled = styled.div`
  color: red;
`;
export const styledAlpha = defineComponent({
  title: "Styled Alpha",
  description: "",
  relatedDocs: [],
  propSchema,
  props: {},
  render: () => <Styled>Alpha</Styled>,
});
export const styledBeta = defineComponent({
  title: "Styled Beta",
  description: "",
  relatedDocs: [],
  propSchema,
  props: {},
  render: () => <Styled>Beta</Styled>,
});
export const styledScreen = defineScreen({
  title: "Foreign sheet",
  description: "",
  relatedDocs: [],
  props: { reverse: false },
  render: ({ reverse }) => {
    const sheet = new ServerStyleSheet();
    function Rules() {
      return <>{sheet.getStyleElement()}</>;
    }
    return (
      <StyleSheetManager sheet={sheet.instance}>
        {reverse ? (
          <>
            <styledBeta.Component />
            <styledAlpha.Component />
          </>
        ) : (
          <>
            <styledAlpha.Component />
            <styledBeta.Component />
          </>
        )}
        <Rules />
      </StyleSheetManager>
    );
  },
});
