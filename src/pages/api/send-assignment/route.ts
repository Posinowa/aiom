// src/app/api/send-assignment/route.ts
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { adminDb } from '../../../app/lib/firebaseAdmin';
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";         // Nodemailer edge'de çalışmaz
export const dynamic = "force-dynamic";  // (ops.) her istekte çalıştır

type Body = {
    to: string;
    atanan: string;
    yer?: string;
    tarihMs?: number;
    taskId: string;
    companyID: string;
    listId?: "temizlikGorevListesi" | "yemekGorevListesi";
};

function htmlTemplate(p: { atanan: string; yer?: string; tarih: string; taskId: string; companyID: string }) {
    return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial">
    <h2>Merhaba ${p.atanan},</h2>
    <p><b>${p.yer || "Görev"}</b> sana atandı ve <b>onaylandı</b>.</p>
    <ul>
      <li><b>Şirket:</b> ${p.companyID}</li>
      <li><b>Görev:</b> ${p.yer || "-"}</li>
      <li><b>Tarih:</b> ${p.tarih}</li>
      <li><b>Görev ID:</b> ${p.taskId}</li>
    </ul>
    <p>Kolay gelsin!<br/>AIOM</p>
  </div>`;
}

async function findTaskRef(companyID: string, taskId: string, explicitListId?: string) {
    const lists = explicitListId ? [explicitListId] : ["temizlikGorevListesi", "yemekGorevListesi"];
    for (const listId of lists) {
        const ref = adminDb.doc(`tasks/${companyID}/${listId}/${taskId}`);
        const snap = await ref.get();
        if (snap.exists) return { ref, listId, snap };
    }
    return null;
}

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as Body;

        if (!body?.to || !body?.atanan || !body?.taskId || !body?.companyID) {
            return NextResponse.json({ ok: false, error: "missing fields" }, { status: 400 });
        }

        // 1) Firestore: görevi bul + idempotency
        const found = await findTaskRef(body.companyID, body.taskId, body.listId);
        if (!found) return NextResponse.json({ ok: false, error: "task not found" }, { status: 404 });

        const { ref, listId, snap } = found;
        const data = snap.data() as any;

        if (data?.notified === true) {
            return NextResponse.json({ ok: true, skipped: true, listId }, { status: 200 });
        }

        // 2) Nodemailer transporter
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 465),
            secure: String(process.env.SMTP_SECURE || "true") === "true",
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        // 3) Mail gönder
        const tarih = new Date(body.tarihMs ?? Date.now()).toLocaleString("tr-TR");
        await transporter.sendMail({
            from: process.env.FROM_EMAIL,
            to: body.to,
            subject: "AIOM — Yeni Görev Atandı (Onaylandı)",
            html: htmlTemplate({
                atanan: body.atanan,
                yer: body.yer,
                tarih,
                taskId: body.taskId,
                companyID: body.companyID,
            }),
        });

        // 4) Firestore'a notified işaretini bas (idempotent)
        await ref.update({ notified: true, notifiedAt: FieldValue.serverTimestamp(), emailTo: body.to });

        return NextResponse.json({ ok: true, listId }, { status: 200 });
    } catch (err: any) {
        // Teşhis için server log
        console.error("SEND-ASSIGNMENT ERROR:", err?.message || err);
        return NextResponse.json({ ok: false, error: "mail failed" }, { status: 500 });
    }
}
