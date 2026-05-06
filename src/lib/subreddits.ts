export function normalizeSubredditName(value: string) {
  return value.replace(/^r\//i, "").trim().toLowerCase();
}

export function isValidSubredditName(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9_]{1,20}$/.test(value);
}

export function parseSubredditList(value: string) {
  const seen = new Set<string>();
  const subreddits: string[] = [];

  for (const item of value.split(/[\n,]+/)) {
    const subreddit = item.replace(/^r\//i, "").trim();
    const key = subreddit.toLowerCase();

    if (!subreddit || seen.has(key)) {
      continue;
    }

    seen.add(key);
    subreddits.push(subreddit);
  }

  return subreddits.slice(0, 25);
}
