import { Pending, StateMessage } from "../screens/product/page-parts";
import { StatePlaceholder } from "../screens/product/placeholders";

const validStates = (
  <>
    <StateMessage title="No projects yet" />
    <StateMessage error title="Projects couldn’t load" />
    <StateMessage error>Try loading the projects again.</StateMessage>
    <StateMessage error announcement="Projects couldn’t load" />
    <Pending label="Signing you in" labelMode="screen-reader-only">
      <StatePlaceholder />
    </Pending>
    <Pending label="Opening your workspace">
      {(name) => <StatePlaceholder title={name} />}
    </Pending>
  </>
);

const unplacedName = (
  // @ts-expect-error A visible name needs the text place its layout gives it.
  <Pending label="Opening your workspace">
    <StatePlaceholder />
  </Pending>
);

const withoutLayout = (
  // @ts-expect-error A wait draws the layout that it waits for, never a block.
  <Pending label="Signing you in" labelMode="screen-reader-only" />
);

// @ts-expect-error An error state must carry visible or screen-reader-only copy.
const missingErrorCopy = <StateMessage error />;

// @ts-expect-error A hidden announcement belongs only to an error state.
const announcementWithoutError = <StateMessage announcement="Failed" />;

const repeatedErrorCopy = (
  // @ts-expect-error A hidden announcement cannot repeat visible state copy.
  <StateMessage error title="Failed" announcement="Failed" />
);

void [
  validStates,
  unplacedName,
  withoutLayout,
  missingErrorCopy,
  announcementWithoutError,
  repeatedErrorCopy,
];
