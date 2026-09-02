import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || "",
  baseURL: "https://api.groq.com/openai/v1"
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as Blob | null;

    if (!audioFile) {
      return NextResponse.json({ error: "Please provide an audio file." }, { status: 400 });
    }

    if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Speech-to-text is not configured yet." }, { status: 503 });
    }

    const file = new File([audioFile], "recording.webm", { type: "audio/webm" });
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-large-v3",
    });

    const text = transcription.text?.trim();
    if (!text) {
      return NextResponse.json({ error: "I could not hear any speech. Please try again." }, { status: 422 });
    }

    return NextResponse.json({ text });
  } catch (error: any) {
    console.error("Transcription Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
