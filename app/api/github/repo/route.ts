import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const urlParam = searchParams.get('url');

  if (!urlParam) {
    return NextResponse.json({ error: 'Repository URL is required' }, { status: 400 });
  }

  // Parse GitHub URL
  let owner = '';
  let repoName = '';
  try {
    const url = new URL(urlParam);
    if (url.hostname !== 'github.com') {
      return NextResponse.json({ error: 'Only github.com URLs are supported' }, { status: 400 });
    }
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) {
      return NextResponse.json({ error: 'Invalid GitHub repository URL format' }, { status: 400 });
    }
    owner = parts[0];
    repoName = parts[1].replace('.git', '');
  } catch (e) {
    return NextResponse.json({ error: 'Invalid URL string' }, { status: 400 });
  }

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'TestGuard-App'
  };

  try {
    // 1. Fetch Repository Metadata
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, { headers });
    
    if (repoRes.status === 404) {
      return NextResponse.json({ error: 'Repository not found or is private' }, { status: 404 });
    }
    if (repoRes.status === 403) {
      return NextResponse.json({ error: 'GitHub API rate limit exceeded. Try again later.' }, { status: 403 });
    }
    if (!repoRes.ok) {
      return NextResponse.json({ error: `GitHub API error: ${repoRes.statusText}` }, { status: repoRes.status });
    }

    const repoData = await repoRes.json();

    // 2. Fetch Branches
    const branchesRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/branches?per_page=100`, { headers });
    if (!branchesRes.ok) {
      return NextResponse.json({ error: `Failed to fetch branches: ${branchesRes.statusText}` }, { status: branchesRes.status });
    }
    
    const branchesData = await branchesRes.json();
    const branches = branchesData.map((b: any) => b.name);

    return NextResponse.json({
      owner,
      repo: repoName,
      name: repoData.full_name,
      defaultBranch: repoData.default_branch,
      description: repoData.description,
      branches
    });

  } catch (error) {
    console.error('GitHub API error:', error);
    return NextResponse.json({ error: 'Failed to connect to GitHub' }, { status: 500 });
  }
}
