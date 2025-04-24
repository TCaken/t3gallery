import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    console.log('Proxying WhatsApp request:', body);

    const response = await fetch('https://api.capcfintech.com/api/bird/v2/wa/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'a9a47d79-3373-4f1f-abdb-9e818de576c8'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    console.log('WhatsApp API response:', data);

    return NextResponse.json(data, {
      status: response.status,
    });

  } catch (error) {
    console.error('Error in WhatsApp API:', error);
    return NextResponse.json(
      { error: 'Failed to send WhatsApp message' },
      { status: 500 }
    );
  }
} 