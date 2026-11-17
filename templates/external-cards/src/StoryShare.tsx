import { useState } from "react";
import { Button, Input, MenuColumn } from "@mfg/ui";
import type { createPlatform } from "@mfg/sdk/client";

const story = {
  kind: "stories",
  title: "My Pocket Cards story",
  blocks: [{ type: "text" as const, text: "I found the highest card in Pocket Cards." }],
};
const editedStory = {
  title: story.title,
  blocks: [{ type: "text" as const, text: "I found the highest card in Pocket Cards. Ready for another round!" }],
};

/** An explicit sharing flow; retries keep their operation IDs and never publish merely because a round ended. */
export function StoryShare({ platform, paused }: { platform: ReturnType<typeof createPlatform>; paused: boolean }) {
  const [review, setReview] = useState(false),
    [busy, setBusy] = useState(false);
  const [post, setPost] = useState<{ id: string; edited: boolean } | null>(null);
  const [message, setMessage] = useState("");
  const [operations, setOperations] = useState(() => ({
    create: platform.posts.operationId(),
    edit: platform.posts.operationId(),
    remove: platform.posts.operationId(),
  }));
  async function change(action: "create" | "edit" | "remove") {
    setBusy(true);
    try {
      if (action === "create") {
        const saved = await platform.posts.create(story, operations.create);
        await platform.posts.get(saved.id);
        setPost({ id: saved.id, edited: false });
        setReview(false);
        setMessage("Story shared and read back from this game's board.");
      } else if (action === "edit" && post) {
        await platform.posts.edit(post.id, editedStory, operations.edit);
        setPost({ ...post, edited: true });
        setMessage("Story updated.");
      } else if (action === "remove" && post) {
        await platform.posts.remove(post.id, operations.remove);
        setPost(null);
        setOperations({
          create: platform.posts.operationId(),
          edit: platform.posts.operationId(),
          remove: platform.posts.operationId(),
        });
        setMessage("Story deleted.");
      }
    } catch (error) {
      const status = error && typeof error === "object" && "status" in error ? error.status : null;
      setMessage(
        status === 429
          ? "The sharing limit was reached. You can keep playing."
          : status === 403
            ? "Sign in through MFG to share a story."
            : status === 422
              ? "This story does not fit the game's post rules."
              : error instanceof Error
                ? error.message
                : "Sharing failed. You can retry the same action or keep playing.",
      );
    } finally {
      setBusy(false);
    }
  }
  const shellOrigin = import.meta.env.VITE_MFG_SHELL_ORIGIN ?? "https://staging.memefreegames.com";
  return (
    <section aria-label="Share a card story">
      <h2>Share a card story</h2>
      <p>Stories stay in this game's current environment. Private preview stories have no public page.</p>
      <MenuColumn>
        {!post && !review && (
          <Button
            disabled={paused || busy}
            onClick={() => {
              setReview(true);
              setMessage("");
            }}
          >
            Review card story
          </Button>
        )}
        {review && (
          <>
            <strong>{story.title}</strong>
            <p>{story.blocks[0]!.text}</p>
            <Button disabled={paused || busy} onClick={() => void change("create")}>
              Confirm share story
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setReview(false)}>
              Keep story private
            </Button>
          </>
        )}
        {post && (
          <>
            <p>{post.edited ? editedStory.blocks[0]!.text : story.blocks[0]!.text}</p>
            {!post.edited && (
              <>
                <p>Update adds: Ready for another round!</p>
                <Button disabled={paused || busy} onClick={() => void change("edit")}>
                  Update shared story
                </Button>
              </>
            )}
            <Button variant="secondary" disabled={paused || busy} onClick={() => void change("remove")}>
              Delete shared story
            </Button>
            <label htmlFor="story-link">Production post link</label>
            <Input id="story-link" readOnly value={new URL(platform.posts.url(post.id), shellOrigin).href} />
            <p>For a production post, copy this link and open it on MFG. Preview posts remain private.</p>
          </>
        )}
      </MenuColumn>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
