function record(event: string) {
  const previous = process.env.MOKLY_TEST_STORY_SETUP_EVENTS;
  process.env.MOKLY_TEST_STORY_SETUP_EVENTS = previous
    ? `${previous},${event}`
    : event;
}

export async function setup(name: string) {
  await Promise.resolve();
  record(`${name}:setup`);
  process.env.MOKLY_TEST_STORY_SETUP_ACTIVE = name;
  return async () => {
    await Promise.resolve();
    record(`${name}:cleanup`);
    delete process.env.MOKLY_TEST_STORY_SETUP_ACTIVE;
  };
}

export async function loadSetup() {
  await Promise.resolve();
  return {
    setup: `${process.env.MOKLY_TEST_STORY_SETUP_ACTIVE ?? "unset"}|${process.env.MOKLY_TEST_STORY_SETUP_EVENTS ?? ""}`,
  };
}
