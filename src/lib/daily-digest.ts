import { appConfig } from "@/lib/config";
import type { ActionCard, TrackedPostCard } from "@/lib/types";

type DigestProject = {
  name: string;
  websiteUrl: string;
  actions: ActionCard[];
  trackedPosts: TrackedPostCard[];
};

export type DailyDigestEmail = {
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildActionHtml(action: ActionCard) {
  return `<li style="margin:0 0 14px;padding:0;">
    <div style="font-weight:700;color:#14110f;">${escapeHtml(action.title)}</div>
    <div style="margin-top:4px;color:#5b524a;">${escapeHtml(action.summary)}</div>
    <div style="margin-top:4px;font-size:13px;color:#6c7d7f;">${escapeHtml(action.type)} · ${escapeHtml(action.priority)} · r/${escapeHtml(action.subreddit)}</div>
  </li>`;
}

function buildTrackedPostHtml(post: TrackedPostCard) {
  return `<li style="margin:0 0 14px;padding:0;">
    <div style="font-weight:700;color:#14110f;">${escapeHtml(post.title)}</div>
    <div style="margin-top:4px;color:#5b524a;">r/${escapeHtml(post.subreddit)} · Score ${post.score} · ${post.commentsCount} comments</div>
    <div style="margin-top:4px;"><a href="${escapeHtml(post.permalink)}" style="color:#155e63;text-decoration:none;">Open on Reddit</a></div>
  </li>`;
}

export function buildDailyDigestEmail(input: {
  recipientName: string;
  projects: DigestProject[];
}): DailyDigestEmail {
  const subject = `${appConfig.name} daily Reddit digest`;
  const greetingName = input.recipientName.trim() || "there";

  const projectSections = input.projects
    .map((project) => {
      const actionsHtml = project.actions.length
        ? `<ol style="margin:16px 0 0;padding-left:20px;">${project.actions
            .map(buildActionHtml)
            .join("")}</ol>`
        : `<p style="margin:16px 0 0;color:#5b524a;">No live actions available right now.</p>`;

      const trackedPostsHtml = project.trackedPosts.length
        ? `<ol style="margin:16px 0 0;padding-left:20px;">${project.trackedPosts
            .map(buildTrackedPostHtml)
            .join("")}</ol>`
        : `<p style="margin:16px 0 0;color:#5b524a;">No tracked posts yet.</p>`;

      const websiteLine = project.websiteUrl
        ? `<div style="margin-top:6px;font-size:13px;"><a href="${escapeHtml(project.websiteUrl)}" style="color:#155e63;text-decoration:none;">Visit project website</a></div>`
        : "";

      return `<section style="margin:0 0 28px;padding:24px;border:1px solid #e7dfd5;border-radius:20px;background:#fffaf0;">
        <h2 style="margin:0;color:#14110f;font-size:22px;">${escapeHtml(project.name)}</h2>
        ${websiteLine}
        <div style="margin-top:18px;">
          <div style="font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:#8b8278;">Today's 3 actions</div>
          ${actionsHtml}
        </div>
        <div style="margin-top:18px;">
          <div style="font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:#8b8278;">Top tracked posts</div>
          ${trackedPostsHtml}
        </div>
      </section>`;
    })
    .join("");

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f6efe3;padding:32px 18px;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:760px;margin:0 auto;background:#ffffff;border-radius:28px;padding:32px;box-shadow:0 20px 60px rgba(20,17,15,0.08);">
      <h1 style="margin:0;color:#14110f;font-size:32px;">Daily Reddit digest</h1>
      <p style="margin:12px 0 0;color:#5b524a;font-size:16px;line-height:1.6;">Hi ${escapeHtml(greetingName)}, here are today's actions and your top tracked Reddit posts across active projects.</p>
      <div style="margin-top:28px;">${projectSections}</div>
    </div>
  </body>
</html>`;

  const text = [
    `Hi ${greetingName},`,
    "",
    "Here is your daily Reddit digest.",
    "",
    ...input.projects.flatMap((project) => [
      `${project.name}`,
      project.websiteUrl ? `Website: ${project.websiteUrl}` : "",
      "Today's 3 actions:",
      ...(project.actions.length
        ? project.actions.map(
            (action, index) =>
              `${index + 1}. ${action.title} — ${action.summary} (r/${action.subreddit})`,
          )
        : ["- No live actions available right now."]),
      "Top tracked posts:",
      ...(project.trackedPosts.length
        ? project.trackedPosts.map(
            (post, index) =>
              `${index + 1}. ${post.title} — r/${post.subreddit}, score ${post.score}, ${post.commentsCount} comments, ${post.permalink}`,
          )
        : ["- No tracked posts yet."]),
      "",
    ]),
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}
