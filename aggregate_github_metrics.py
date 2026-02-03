import requests
import csv
import datetime
#import matplotlib.pyplot as plt

# -----------------------------
# Helper functions
# -----------------------------

def fetch_json(url):
    r = requests.get(url)
    if r.status_code == 200:
        return r.json()
    return None

def count_last_30_days(events):
    """Count events that happened in the last 30 days."""
    now = datetime.datetime.now(datetime.UTC)
    cutoff = now - datetime.timedelta(days=30)
    count = 0
    for e in events:
        if "created_at" in e:
            t = datetime.datetime.fromisoformat(e["created_at"].replace("Z", "+00:00"))
            if t > cutoff:
                count += 1
    return count


# -----------------------------
# Load repository list
# -----------------------------
with open("repos.txt") as f:
    repos = [line.strip() for line in f.readlines() if line.strip()]

results = []

# -----------------------------
# Process each repository
# -----------------------------
for repo in repos:
    print(f"\nFetching metrics for {repo}...")
    base = f"https://api.github.com/repos/{repo}"

    data = fetch_json(base)
    if data is None:
        print(f"❌ Failed: {repo}")
        continue

    # Basic metadata
    description = data.get("description", "")
    topics = ",".join(data.get("topics", []))
    default_branch = data.get("default_branch", "")
    license_spdx = data.get("license", {}).get("spdx_id") if data.get("license") else ""

    # Popularity
    stars = data.get("stargazers_count", 0)
    forks = data.get("forks_count", 0)
    watchers = data.get("subscribers_count", 0)

    # Issues
    open_issues = data.get("open_issues_count", 0)

    # Repo size
    size_kb = data.get("size", 0)

    # Last update (repo metadata)
    last_updated = data.get("updated_at", "")

    # Last commit timestamp
    commits_url = f"{base}/commits"
    commits = fetch_json(commits_url)
    last_commit = commits[0]["commit"]["author"]["date"] if commits else ""

    # Contributors
    contributors = fetch_json(f"{base}/contributors?per_page=200")
    total_contributors = len(contributors) if contributors else 0
    active_last_30 = 0
    if contributors:
        # fetch events to check activity
        events = fetch_json(f"{base}/events")
        if events:
            active_last_30 = count_last_30_days(events)

    # Pull requests stats
    pulls = fetch_json(f"{base}/pulls?state=open")
    open_prs = len(pulls) if pulls else 0

    closed_prs = fetch_json(f"{base}/pulls?state=closed&per_page=100")
    merged_last_30 = 0
    closed_last_30 = 0

    if closed_prs:
        for pr in closed_prs:
            if pr.get("merged_at"):
                t = datetime.datetime.fromisoformat(pr["merged_at"].replace("Z", "+00:00"))
                if t > datetime.datetime.now(datetime.UTC) - datetime.timedelta(days=30):
                    merged_last_30 += 1
            if pr.get("closed_at"):
                t = datetime.datetime.fromisoformat(pr["closed_at"].replace("Z", "+00:00"))
                if t > datetime.datetime.now(datetime.UTC) - datetime.timedelta(days=30):
                    closed_last_30 += 1

    # Releases
    releases = fetch_json(f"{base}/releases")
    latest_release = ""
    download_count = 0
    if releases:
        latest_release = releases[0].get("tag_name", "")
        for rel in releases:
            for asset in rel.get("assets", []):
                download_count += asset.get("download_count", 0)

    # Build final record
    results.append({
        "repository": repo,
        "description": description,
        "topics": topics,
        "default_branch": default_branch,
        "license": license_spdx,
        "stars": stars,
        "forks": forks,
        "watchers": watchers,
        "open_issues": open_issues,
        "open_prs": open_prs,
        "closed_prs_last_30": closed_last_30,
        "merged_prs_last_30": merged_last_30,
        "contributors_total": total_contributors,
        "contributors_active_30_days": active_last_30,
        "last_commit": last_commit,
        "last_update": last_updated,
        "latest_release": latest_release,
        "release_downloads": download_count,
        "repo_size_kb": size_kb,
    })

# -----------------------------
# Save CSV
# -----------------------------
csv_filename = "github_metrics.csv"

with open(csv_filename, "w", newline="", encoding="utf-8") as csvfile:
    fieldnames = list(results[0].keys())
    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(results)

print(f"\n✅ Saved: {csv_filename}")

# -----------------------------
# Print Markdown Table
# -----------------------------
print("\n# GitHub Metrics\n")
print("| Repository | ⭐ Stars | 🍴 Forks | 👀 Watchers | 🐞 Issues | PRs Open | Contributors | Last Commit |")
print("|------------|---------|----------|--------------|-----------|----------|--------------|-------------|")

for r in results:
    print(
        f"| {r['repository']} | {r['stars']} | {r['forks']} | "
        f"{r['watchers']} | {r['open_issues']} | {r['open_prs']} | "
        f"{r['contributors_total']} | {r['last_commit']} |"
    )

# -----------------------------
# Visualization
# -----------------------------
# repos_list = [r["repository"] for r in results]
# stars_list = [r["stars"] for r in results]
# forks_list = [r["forks"] for r in results]

# plt.figure(figsize=(12, 6))
# plt.bar(repos_list, stars_list, color="#1f77b4", alpha=0.8, label="Stars")
# plt.bar(repos_list, forks_list, color="#ff7f0e", alpha=0.8, label="Forks")
# plt.xlabel("Repository")
# plt.ylabel("Count")
# plt.title("GitHub Metrics (Stars & Forks)")
# plt.xticks(rotation=45, ha="right")
# plt.legend()
# plt.tight_layout()
# plt.savefig("metrics_chart.png", dpi=200)
# plt.close()

# print("📊 Generated metrics_chart.png")