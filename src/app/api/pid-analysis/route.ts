/**
 * AI PID analysis endpoint.
 *
 * Accepts flight log analysis metrics and current PID parameters,
 * sends them to Groq for tuning recommendations, and returns
 * structured suggestions.
 *
 * @license GPL-3.0-only
 */

import { NextRequest, NextResponse } from "next/server";
import type {
  AiAnalysisRequest,
  AiAnalysisResponse,
  AiRecommendation,
} from "@/lib/analysis/types";

const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-20b";

const SYSTEM_PROMPT = `You are an expert ArduPilot PID tuning advisor. Given flight log analysis metrics and current PID parameters, provide tuning recommendations.

Rules:
- Only suggest parameters that need changing
- Keep suggestions conservative (small increments)
- Prioritize stability over responsiveness
- If noise is high, suggest lowering D-term and adjusting filters first
- If tracking error is high, suggest increasing P-term carefully
- If overshoot is high, reduce P, increase D slightly
- Include confidence score 0-100 for each recommendation
- Group by priority: critical (safety/stability), important (performance), optional (polish)

Respond with valid JSON only. Format:
{
  "recommendations": [
    {
      "id": "rec-1",
      "title": "Short title",
      "explanation": "2-3 sentence explanation of why this change helps",
      "priority": "critical|important|optional",
      "confidence": 85,
      "parameters": [
        { "param": "ATC_RAT_RLL_P", "currentValue": 0.135, "suggestedValue": 0.12, "delta": -0.015 }
      ]
    }
  ],
  "summary": "One paragraph overall assessment"
}`;

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isValidPriority(v: unknown): v is "critical" | "important" | "optional" {
  return v === "critical" || v === "important" || v === "optional";
}

function isValidRecommendation(r: unknown): r is AiRecommendation {
  if (!r || typeof r !== "object") return false;
  const obj = r as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.title === "string" &&
    typeof obj.explanation === "string" &&
    isValidPriority(obj.priority) &&
    typeof obj.confidence === "number" &&
    Array.isArray(obj.parameters) &&
    obj.parameters.every(
      (p: unknown) =>
        p &&
        typeof p === "object" &&
        typeof (p as Record<string, unknown>).param === "string" &&
        typeof (p as Record<string, unknown>).currentValue === "number" &&
        typeof (p as Record<string, unknown>).suggestedValue === "number" &&
        typeof (p as Record<string, unknown>).delta === "number",
    )
  );
}

function parseGroqResponse(text: string): AiAnalysisResponse {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }

  const parsed = JSON.parse(cleaned);

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray(parsed.recommendations)
  ) {
    return {
      recommendations: [],
      summary: "",
      error: "AI returned unexpected response shape",
    };
  }

  const validRecs = parsed.recommendations.filter(isValidRecommendation);
  const summary = typeof parsed.summary === "string" ? parsed.summary : "";

  return { recommendations: validRecs, summary };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    const response: AiAnalysisResponse = {
      recommendations: [],
      summary: "",
      error:
        "AI analysis requires GROQ_API_KEY. Set it as an environment variable.",
    };
    return NextResponse.json(response);
  }

  let body: AiAnalysisRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { recommendations: [], summary: "", error: "Invalid request body" },
      { status: 400 },
    );
  }

  try {
    const groqRes = await fetch(GROQ_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(body) },
        ],
        temperature: 0.3,
        max_tokens: 2048,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      const response: AiAnalysisResponse = {
        recommendations: [],
        summary: "",
        error: `AI analysis failed: ${groqRes.status} ${errText.slice(0, 200)}`,
      };
      return NextResponse.json(response);
    }

    const groqData = await groqRes.json();
    const content = groqData?.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
      const response: AiAnalysisResponse = {
        recommendations: [],
        summary: "",
        error: "AI returned empty response",
      };
      return NextResponse.json(response);
    }

    const result = parseGroqResponse(content);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const response: AiAnalysisResponse = {
      recommendations: [],
      summary: "",
      error: `AI analysis failed: ${message}`,
    };
    return NextResponse.json(response);
  }
}
