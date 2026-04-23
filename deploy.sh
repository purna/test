#!/bin/bash

# Deployment script for pixelKanban to GitHub Pages
# Usage: ./deploy.sh [branch-name] [options]
#   branch-name: Target branch (default: gh-pages)
#   Options:
#     --no-push    : Stop before pushing (local only)
#     --help       : Show this help message

set -e

# Default values
TARGET_BRANCH="gh-pages"
PUSH=true
DEPLOY_MSG="Deploy pixelKanban to GitHub Pages"

# Files/dirs to exclude from deployment (relative to project root)
EXCLUDE_LIST="deploy.sh .github .gitignore README.md"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            echo "Usage: $0 [branch-name] [options]"
            echo ""
            echo "Deploy pixelKanban static site to a GitHub branch for Pages hosting."
            echo ""
            echo "Arguments:"
            echo "  branch-name    Target branch name (default: gh-pages)"
            echo ""
            echo "Options:"
            echo "  --no-push      Build locally but don't push to remote"
            echo "  --help, -h     Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                      # Deploy to gh-pages branch"
            echo "  $0 pages               # Deploy to 'pages' branch"
            echo "  $0 gh-pages --no-push  # Build locally only for testing"
            exit 0
            ;;
        --no-push)
            PUSH=false
            shift
            ;;
        *)
            if [[ -z "$TARGET_BRANCH" || "$TARGET_BRANCH" == "gh-pages" ]]; then
                TARGET_BRANCH="$1"
                shift
            else
                echo "Error: Unexpected argument '$1'"
                echo "Run '$0 --help' for usage"
                exit 1
            fi
            ;;
    esac
done

# Check if in git repo
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Error: Not in a git repository"
    exit 1
fi

# Check if remote exists
if ! git remote get-url origin >/dev/null 2>&1; then
    echo "Error: No 'origin' remote configured"
    exit 1
fi

# Capture current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Prevent self-deployment
if [ "$TARGET_BRANCH" = "$CURRENT_BRANCH" ]; then
    echo "Error: Target branch '$TARGET_BRANCH' is the same as current branch"
    echo "  Use a different branch for deployment (e.g., gh-pages)"
    exit 1
fi

# Detect if there were uncommitted changes
STASH_NEEDED=false
if ! git diff --quiet --cached || ! git diff --quiet || [ "$(git ls-files --others --exclude-standard)" ]; then
    STASH_NEEDED=true
fi

# Stash changes if needed
if [ "$STASH_NEEDED" = true ]; then
    echo "Stashing uncommitted changes..."
    git stash push -m "temp-deploy-stash" --include-untracked
    STASH_CREATED=true
else
    STASH_CREATED=false
fi

# Switch to target branch (create if needed)
echo "Preparing branch: $TARGET_BRANCH"
if git show-ref --verify --quiet "refs/heads/$TARGET_BRANCH"; then
    git checkout "$TARGET_BRANCH"
else
    git checkout -b "$TARGET_BRANCH"
fi

# Clean working tree completely (except .git)
echo "Cleaning working tree..."
# Remove tracked files
git rm -rf . 2>/dev/null || true
# Remove untracked files/directories
git clean -fdx

# Copy files from original branch (committed state only)
echo "Copying files from $CURRENT_BRANCH..."
git checkout "$CURRENT_BRANCH" -- .

# Remove excluded items
echo "Removing excluded files..."
for item in $EXCLUDE_LIST; do
    if [ -e "$item" ] || [ -L "$item" ]; then
        rm -rf "$item"
    fi
done

# Create .nojekyll to disable Jekyll processing on GitHub Pages
echo "Creating .nojekyll..."
touch .nojekyll

# Commit deployment
echo "Committing deployment..."
git add -A
git commit -m "$DEPLOY_MSG" --allow-empty

# Push if requested
if [ "$PUSH" = true ]; then
    echo "Pushing to origin/$TARGET_BRANCH..."
    git push origin "$TARGET_BRANCH"
    echo ""
    echo "✓ Deployment complete!"
    # Get repo name from remote URL
    REPO_NAME=$(basename "$(git config --get remote.origin.url)" .git)
    # Construct GitHub Pages URL (username.github.io/repo)
    URL_PATH=$(git config --get remote.origin.url | sed 's|.*github\.com[:/]\(.*\)\.git|\1|')
    SITE_URL="https://${URL_PATH/\//.github.io/}/"
    echo "  Site URL: $SITE_URL"
else
    echo ""
    echo "✓ Build complete (no push)"
    echo "  To push manually: git push origin $TARGET_BRANCH"
fi

# Return to original branch
echo "Returning to $CURRENT_BRANCH..."
git checkout "$CURRENT_BRANCH" 2>/dev/null || true

# Restore uncommitted changes
if [ "$STASH_CREATED" = true ]; then
    echo "Restoring uncommitted changes..."
    git stash pop || {
        echo "Warning: Failed to restore stash (may be empty or conflicts)"
    }
fi

echo "Done."
