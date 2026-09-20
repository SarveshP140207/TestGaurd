import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');
  const branch = searchParams.get('branch');

  if (!owner || !repo || !branch) {
    return NextResponse.json({ error: 'owner, repo, and branch are required' }, { status: 400 });
  }

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'TestGuard-App'
  };

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?sha=${branch}&per_page=20`, { headers });
    
    if (res.status === 403) {
      return NextResponse.json({ error: 'GitHub API rate limit exceeded. Try again later.' }, { status: 403 });
    }
    if (!res.ok) {
      return NextResponse.json({ error: `GitHub API error: ${res.statusText}` }, { status: res.status });
    }

    const data = await res.json();
    
    const commits = data.map((c: any) => ({
      sha: c.sha,
      message: c.commit.message,
      author: c.commit.author.name,
      date: c.commit.author.date
    }));

    return NextResponse.json(commits);

  } catch (error) {
    console.error('GitHub API error:', error);
    return NextResponse.json({ error: 'Failed to fetch commits' }, { status: 500 });
  }
}
