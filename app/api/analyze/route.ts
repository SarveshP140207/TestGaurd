import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import util from 'util';
import { DependencyGraph } from '@/lib/engine/DependencyGraph';
import { calculateTestPriorities } from '@/lib/engine/Prioritization';
import { ProjectData, CodeNode, AnalysisResult } from '@/lib/engine/types';

const execPromise = util.promisify(exec);

async function downloadAndExtract(owner: string, repo: string, commit: string, destDir: string) {
  const url = `https://api.github.com/repos/${owner}/${repo}/tarball/${commit}`;
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'TestGuard-App'
  };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Failed to download repository archive: ${res.statusText}`);
  }

  const tarballPath = path.join(destDir, 'repo.tar.gz');
  const fileStream = fs.createWriteStream(tarballPath);
  
  if (!res.body) {
    throw new Error("Empty response body from GitHub");
  }
  
  // Note: in Node.js 18+ res.body is a ReadableStream which can be piped differently,
  // but using array buffers is simpler for small/medium repos.
  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(tarballPath, Buffer.from(arrayBuffer));

  // Extract using the system's tar command (available on Win10+, Mac, Linux)
  await execPromise(`tar -xf repo.tar.gz`, { cwd: destDir });
  fs.unlinkSync(tarballPath);
  
  // Find the extracted folder (GitHub tarballs extract to owner-repo-sha format)
  const files = fs.readdirSync(destDir);
  const extractedFolder = files.find(f => fs.statSync(path.join(destDir, f)).isDirectory());
  
  if (!extractedFolder) {
    throw new Error("Failed to locate extracted repository folder");
  }
  return path.join(destDir, extractedFolder);
}

export async function POST(request: Request) {
  let tempDir = '';
  try {
    const body = await request.json();
    const { projectId, modifiedNodeIds, githubState } = body;

    if (!projectId || !modifiedNodeIds || !Array.isArray(modifiedNodeIds)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    let projectData: ProjectData;

    if (projectId === 'github' || projectId.includes('/')) {
      if (!githubState || !githubState.repo || !githubState.selectedCommit) {
        return NextResponse.json({ error: 'Missing github state information' }, { status: 400 });
      }
      
      const { owner, repo } = githubState.repo;
      const commit = githubState.selectedCommit;
      
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testguard-'));
      const extractedPath = await downloadAndExtract(owner, repo, commit, tempDir);
      
      // Run the python parser
      const parserPath = path.join(process.cwd(), 'lib', 'engine', 'python_parser.py');
      // Use python, py, or python3 based on platform availability
      let pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      
      try {
        const { stdout } = await execPromise(`${pythonCmd} "${parserPath}" "${extractedPath}"`);
        projectData = JSON.parse(stdout);
      } catch (parseError: any) {
        console.error("Parser execution error with", pythonCmd, ":", parseError);
        // Fallback
        const fallbackCmd = process.platform === 'win32' ? 'py' : 'python';
        try {
          const { stdout } = await execPromise(`${fallbackCmd} "${parserPath}" "${extractedPath}"`);
          projectData = JSON.parse(stdout);
        } catch (fallbackError) {
          console.error("Fallback parser execution error:", fallbackError);
          throw new Error("Failed to execute Python AST parser. Please ensure Python is installed.");
        }
      }
    } else {
      const filePath = path.join(process.cwd(), 'data', `${projectId}.json`);
      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      projectData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }

    // 1. Build Graph
    const graph = new DependencyGraph(projectData.nodes, projectData.edges);
    
    // Normalize modifiedNodeIds for GitHub (GitHub paths use forward slash, Python parser returns forward slash)
    // The client sends full filenames from github diff, which match the rel_file_path from python_parser
    const normalizedModifiedIds = modifiedNodeIds.map(id => id.replace(/\\/g, '/'));
    
    // 2. Calculate impact distances
    const distances = graph.calculateImpactPaths(normalizedModifiedIds);
    
    // 3. Filter tests
    const allTests = projectData.nodes.filter(n => n.type === 'test');
    
    // 4. Prioritize tests
    const prioritizedTests = calculateTestPriorities(allTests, distances);

    const result: AnalysisResult = {
      modifiedNodeId: normalizedModifiedIds[0] || 'unknown',
      affectedTests: prioritizedTests,
      allNodes: projectData.nodes,
      relevantEdges: projectData.edges
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Analysis error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  } finally {
    // Cleanup temporary directory safely
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
        console.error("Failed to cleanup temp directory:", e);
      }
    }
  }
}
