import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');
  const ref = searchParams.get('ref');

  if (!owner || !repo || !ref) {
    return NextResponse.json({ error: 'owner, repo, and ref are required' }, { status: 400 });
  }

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'TestGuard-App'
  };

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${ref}`, { headers });
    
    if (res.status === 403) {
      return NextResponse.json({ error: 'GitHub API rate limit exceeded. Try again later.' }, { status: 403 });
    }
    if (!res.ok) {
      return NextResponse.json({ error: `GitHub API error: ${res.statusText}` }, { status: res.status });
    }

    const data = await res.json();
    
    const files = data.files?.map((f: any) => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      changes: f.changes,
      patch: f.patch
    })) || [];

    return NextResponse.json({
      sha: data.sha,
      files
    });

  } catch (error) {
    console.error('GitHub API error:', error);
    return NextResponse.json({ error: 'Failed to fetch commit diff' }, { status: 500 });
  }
}
