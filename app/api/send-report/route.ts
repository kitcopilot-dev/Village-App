import { NextResponse } from 'next/server';

/**
 * Village Weekly Report Email Sender
 * 
 * Sends HTML report via Resend API (or configurable email provider)
 * 
 * Environment variables:
 * - RESEND_API_KEY: Your Resend API key
 * - REPORT_EMAIL_TO: Default recipient email (e.g., spouse/co-parent)
 * - REPORT_EMAIL_FROM: Sender email (must be verified with Resend)
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const REPORT_EMAIL_TO = process.env.REPORT_EMAIL_TO || '';
const REPORT_EMAIL_FROM = process.env.REPORT_EMAIL_FROM || 'noreply@village.homeschool';

export async function POST(req: Request) {
  try {
    const { subject, html, weekStart, weekEnd } = await req.json();

    if (!subject || !html) {
      return NextResponse.json({ error: 'Missing subject or html body' }, { status: 400 });
    }

    // If no API key configured, return a helpful message
    if (!RESEND_API_KEY) {
      console.log('📧 Email report would be sent:');
      console.log('Subject:', subject);
      console.log('To:', REPORT_EMAIL_TO || 'Not configured');
      console.log('HTML length:', html.length);
      
      return NextResponse.json({ 
        success: true, 
        message: 'Email API not configured. Use Print/PDF instead, or set RESEND_API_KEY in .env.local',
        simulated: true
      });
    }

    if (!REPORT_EMAIL_TO) {
      return NextResponse.json({ 
        error: 'REPORT_EMAIL_TO not configured in .env.local' 
      }, { status: 500 });
    }

    // Send via Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: REPORT_EMAIL_FROM,
        to: REPORT_EMAIL_TO,
        subject: subject,
        html: html
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend API error:', data);
      return NextResponse.json({ 
        error: data.message || 'Failed to send email' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      id: data.id,
      message: `Report sent to ${REPORT_EMAIL_TO}`
    });

  } catch (error: any) {
    console.error('Email API Error:', error);
    return NextResponse.json({ 
      error: 'Failed to send email: ' + error.message 
    }, { status: 500 });
  }
}
