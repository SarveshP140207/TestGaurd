import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const p = await params;
  const id = p.id;
  const filePath = path.join(process.cwd(), 'data', `${id}.json`);
  
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return NextResponse.json(JSON.parse(content));
}
