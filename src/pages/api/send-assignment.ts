import { url } from "inspector";
import type { NextApiRequest, NextApiResponse } from "next";
import nodemailer from "nodemailer";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Only POST requests allowed" });
    }

    const { to, atanan, yer, tarihMs, taskId, companyID } = req.body;

    // 📌 Tarih stringe çevriliyor
    const tarihStr = tarihMs ? new Date(tarihMs).toLocaleString("tr-TR") : "";

    try {
        // Transporter oluştur
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT),
            secure: process.env.SMTP_SECURE === "true", // true -> 465, false -> 587
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        // Mail gönder
        await transporter.sendMail({
            from: process.env.FROM_EMAIL,
            to,
            subject: "AIOM - Yeni Görev Ataması",
            html: `
        <div style="font-family:Arial, sans-serif; color:#333">
          <h2>Merhaba ${atanan},</h2>
          <p>Size yeni bir görev atandı:</p>
          <ul>
            <li><strong>Görev:</strong> ${yer}</li>
            <li><strong>Tarih:</strong> ${tarihStr}</li>
            <li><strong>Şirket:</strong> ${companyID}</li>
            <li><strong>Görevi görmek için http://192.168.1.145:3000:</strong> ${url}</li>
          </ul>
          <p>Lütfen görevi zamanında tamamlayınız.</p>
          <hr />
          <small>AIOM Görev Yönetim Sistemi</small>
        </div>
      `,
        });

        return res.status(200).json({ success: true, message: "Mail sent successfully" });
    } catch (err) {
        console.error("Mail error:", err);
        // ❌ Kullanıcıya hata yansıtmıyoruz, sadece logluyoruz
        return res.status(200).json({ success: false, message: "Mail not sent (ignored)" });
    }
}
