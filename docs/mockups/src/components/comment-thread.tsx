import { Body, Label } from "@firna/ui/typography";

import { Avatar } from "../entries/design/avatar.mockup";
import { Badge } from "../entries/design/badge.mockup";
import { componentInput, componentMetadata } from "./metadata";

export const commentThreadInput = componentInput({
  ...componentMetadata(
    "Comment thread",
    "A screen decision and the conversation behind it.",
  ),
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["author", "text", "resolved", "replies"],
    properties: {
      author: { type: "string" },
      text: { type: "string" },
      resolved: { type: "boolean" },
      replies: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["author", "text"],
          properties: {
            author: { type: "string" },
            text: { type: "string" },
          },
        },
      },
    },
  },
  props: {
    author: "Sam",
    text: "Could we make the next step clearer?",
    replies: [],
    resolved: false,
  },
  controls: {
    author: { kind: "text" },
    text: { kind: "text" },
    resolved: { kind: "boolean" },
  },
  render: ({ author, text, replies, resolved }) => (
    <article className="comment-thread" aria-label="Screen discussion">
      <div className="comment-heading">
        <Avatar label={author.slice(0, 1)} tone="soft" decorative />
        <Label>{author}</Label>
        <div className="thread-status-layout">
          <Badge
            moklyInstance="thread-status"
            dot
            label={resolved ? "Resolved" : "Open"}
            tone={resolved ? "success" : "neutral"}
          />
        </div>
      </div>
      <Body>{text}</Body>
      {replies.length > 0 && (
        <ul className="replies">
          {replies.map((reply, index) => (
            <li key={index}>
              <Label>{reply.author}</Label>
              <Body>{reply.text}</Body>
            </li>
          ))}
        </ul>
      )}
    </article>
  ),
  variants: [
    {
      slug: "open",
      title: "Open",
      props: {
        author: "Sam",
        text: "Could we make the next step clearer?",
        replies: [],
        resolved: false,
      },
    },
    {
      slug: "resolved",
      title: "Resolved",
      props: {
        author: "Sam",
        text: "The next step reads clearly.",
        replies: [{ author: "Alex", text: "Ready for review." }],
        resolved: true,
      },
    },
  ],
});
