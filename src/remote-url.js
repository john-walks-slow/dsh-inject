// 远程预设地址的镜像换算：raw.githubusercontent.com 走 jsDelivr 兜底。

const RAW_GITHUB_RE = /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/;

/** raw.githubusercontent.com URL 对应的 jsDelivr 地址；其他地址返回空串。 */
export function mirrorUrl(url) {
  const match = RAW_GITHUB_RE.exec(url);
  if (!match) return "";
  const [, owner, repo, ref, path] = match;
  return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${ref}/${path}`;
}
