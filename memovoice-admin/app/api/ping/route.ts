import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch(
      `${process.env.RAILWAY_API_URL}/ping`,
      { method: 'GET' }
    );
    
    const data = await response.json();
    
    return NextResponse.json({ 
      success: true, 
      backend: data 
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: 'Backend unreachable' 
    }, { status: 500 });
  }
}
