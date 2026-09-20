import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const dataDir = path.join(process.cwd(), 'data');
  const files = fs.readdirSync(dataDir);
  
  const projects = files.map(file => {
    const content = fs.readFileSync(path.join(dataDir, file), 'utf-8');
    const json = JSON.parse(content);
    return {
      id: file.replace('.json', ''),
      name: json.projectName,
      languages: json.languages,
      nodeCount: json.nodes.length,
      testCount: json.nodes.filter((n: any) => n.type === 'test').length
    };
  });

  return NextResponse.json(projects);
}
