import { NextResponse } from "next/server";
import { getDemoCase } from "@/lib/demo/cases";
import { jsonError } from "@/lib/server/http";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const demoCase = getDemoCase(params.id);

  if (!demoCase) {
    return jsonError("Demo case not found.", 404);
  }

  return NextResponse.json({
    ok: true,
    demo_case: {
      ...demoCase,
      image_url: `/demo/${demoCase.imageFileName}`
    }
  });
}
