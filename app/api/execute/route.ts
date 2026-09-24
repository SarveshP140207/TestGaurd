import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import util from 'util';

const execFilePromise = util.promisify(execFile);
import { exec } from 'child_process';
const execPromise = util.promisify(exec);

const RUNNER_SCRIPT = `
import sys
import pytest
import json

class JSONReportPlugin:
    def __init__(self):
        self.results = []
    def pytest_runtest_logreport(self, report):
        if report.when == 'call':
            self.results.append({
                'nodeid': report.nodeid,
                'outcome': report.outcome,
                'duration': report.duration,
                'longrepr': str(report.longrepr) if report.longrepr else None
            })

if __name__ == "__main__":
    plugin = JSONReportPlugin()
    exit_code = pytest.main(sys.argv[1:], plugins=[plugin])
    print("\\n---TESTGUARD_JSON_START---")
    print(json.dumps({'exit_code': int(exit_code), 'tests': plugin.results}))
    print("---TESTGUARD_JSON_END---")
`;

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
  
  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(tarballPath, Buffer.from(arrayBuffer));

  await execPromise(`tar -xf repo.tar.gz`, { cwd: destDir });
  fs.unlinkSync(tarballPath);
  
  const files = fs.readdirSync(destDir);
  const extractedFolder = files.find(f => fs.statSync(path.join(destDir, f)).isDirectory());
  
  if (!extractedFolder) {
    throw new Error("Failed to locate extracted repository folder");
  }
  return path.join(destDir, extractedFolder);
}

function mapToPytestNodeId(testguardId: string): string {
  const parts = testguardId.split(':');
  if (parts.length < 2) return testguardId;
  const filePath = parts[0];
  const functionPart = parts.slice(1).join(':').replace(/\./g, '::');
  return `${filePath}::${functionPart}`;
}

export async function POST(request: Request) {
  let tempDir = '';
  try {
    const body = await request.json();
    const { githubState, selectedTests, mode } = body;

    if (!githubState || !githubState.repo || !githubState.selectedCommit) {
      return NextResponse.json({ error: 'Missing github state information' }, { status: 400 });
    }

    if (mode !== 'full' && (!selectedTests || !Array.isArray(selectedTests) || selectedTests.length === 0)) {
      return NextResponse.json({ error: 'No tests selected for execution' }, { status: 400 });
    }

    const { owner, repo } = githubState.repo;
    const commit = githubState.selectedCommit;
    
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testguard-exec-'));
    const extractedPath = await downloadAndExtract(owner, repo, commit, tempDir);
    
    const runnerPath = path.join(extractedPath, 'testguard_runner.py');
    fs.writeFileSync(runnerPath, RUNNER_SCRIPT);

    const pytestArgs = mode === 'full' ? [] : selectedTests.map(mapToPytestNodeId);

    let pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    
    try {
      await execFilePromise(pythonCmd, ['-c', 'import pytest']);
    } catch (err: any) {
      pythonCmd = process.platform === 'win32' ? 'py' : 'python';
      try {
        await execFilePromise(pythonCmd, ['-c', 'import pytest']);
      } catch (fallbackErr) {
        return NextResponse.json({ 
          error: "pytest is not installed in the target Python environment. Please ensure pytest is installed." 
        }, { status: 500 });
      }
    }

    let stdout = '';
    let stderr = '';
    
    const startTime = Date.now();
    try {
      const result = await execFilePromise(pythonCmd, ['testguard_runner.py', ...pytestArgs], {
        cwd: extractedPath,
        timeout: 60000, 
        maxBuffer: 1024 * 1024 * 5
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (err: any) {
      stdout = err.stdout || '';
      stderr = err.stderr || '';
      
      if (err.killed && err.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
        return NextResponse.json({ error: 'Execution failed: Output exceeded limit' }, { status: 500 });
      }
      if (err.killed) {
        return NextResponse.json({ error: 'Execution timed out after 60 seconds' }, { status: 504 });
      }
    }
    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

    const startMarker = "---TESTGUARD_JSON_START---";
    const endMarker = "---TESTGUARD_JSON_END---";
    
    const startIndex = stdout.indexOf(startMarker);
    const endIndex = stdout.indexOf(endMarker);
    
    let parsedResults = null;
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      const jsonStr = stdout.substring(startIndex + startMarker.length, endIndex).trim();
      try {
        parsedResults = JSON.parse(jsonStr);
      } catch (e) {
        console.error("Failed to parse pytest output JSON", e);
      }
    }

    if (!parsedResults) {
      return NextResponse.json({ 
        error: 'Execution failed or produced malformed output.', 
        rawOutput: stdout + '\\n' + stderr 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      duration: durationSec,
      results: parsedResults.tests,
      exitCode: parsedResults.exit_code,
      rawOutput: stdout
    });

  } catch (error: any) {
    console.error("Execution error:", error);
    return NextResponse.json({ error: error.message || 'Internal execution error' }, { status: 500 });
  } finally {
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
        console.error("Failed to clean up temporary execution directory:", tempDir, e);
      }
    }
  }
}
