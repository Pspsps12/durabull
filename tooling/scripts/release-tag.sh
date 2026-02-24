#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $(basename "$0") <version>"
  echo "Example: $(basename "$0") 1.2.3"
}

version="${1:-}"
if [[ -z "$version" ]]; then
  usage
  exit 1
fi

tag="$version"
if [[ "$tag" != v* ]]; then
  tag="v$tag"
fi

if git tag --list "$tag" | grep -q "^${tag}$"; then
  echo "Tag $tag already exists."
  exit 1
fi

# Ensure clean working tree
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree is not clean. Commit or stash changes before tagging."
  exit 1
fi

last_tag=""
if last_tag=$(git describe --tags --abbrev=0 2>/dev/null); then
  range="${last_tag}..HEAD"
  heading="Changes since ${last_tag}"
else
  range=""
  heading="Changes"
fi

if [[ -n "$range" ]]; then
  log=$(git log --oneline --no-decorate "$range")
else
  log=$(git log --oneline --no-decorate)
fi

if [[ -z "$log" ]]; then
  echo "No commits to include in the tag message."
  exit 1
fi

tag_message="Release ${tag}

${heading}
${log}"

git tag -a "$tag" -m "$tag_message"

echo "Created annotated tag ${tag}."
echo "Push it with: git push origin ${tag}"
