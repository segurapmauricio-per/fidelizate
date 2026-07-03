import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { requireManager, requireSession, isSessionUser } from "@/lib/api-auth";
import { getSupabaseAdmin, getStorageBucket } from "@/lib/supabase";

export async function POST(request: Request) {
  const session = await requireSession();
  if (!isSessionUser(session)) return session;

  const denied = requireManager(session);
  if (denied) return denied;

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Solo se permiten imágenes" }, { status: 400 });
  }

  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "Máximo 2 MB" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const allowed = ["png", "jpg", "jpeg", "webp", "svg"];
  if (!allowed.includes(ext)) {
    return NextResponse.json({ error: "Formato no permitido" }, { status: 400 });
  }

  const filename = `${session.businessId}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  // Supabase Storage (preferido). Si no está configurado, cae a guardado local.
  const supabase = getSupabaseAdmin();
  if (supabase) {
    const bucket = getStorageBucket();
    const { error } = await supabase.storage.from(bucket).upload(filename, buffer, {
      contentType: file.type,
      upsert: true,
    });

    if (error) {
      return NextResponse.json(
        { error: "No se pudo subir el logo a Storage" },
        { status: 502 }
      );
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(filename);
    return NextResponse.json({ url: data.publicUrl });
  }

  // Fallback local (solo desarrollo, mientras no haya Storage configurado).
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  await writeFile(path.join(uploadsDir, filename), buffer);

  return NextResponse.json({ url: `/uploads/${filename}` });
}
