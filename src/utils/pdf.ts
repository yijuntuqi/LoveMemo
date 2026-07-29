import { jsPDF } from "jspdf";
import type { MemoryEvent } from "../types";

export interface PdfOptions {
  coupleName?: string;
  startDate?: string;
  daysTogether?: number | null;
  events: MemoryEvent[];
}

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return [r, g, b] as const;
}

const ROSE = "#f43f5e";
const PINK = "#ec4899";
const SLATE = "#334155";
const GREY = "#64748b";

export async function generateMemoryBookPdf(options: PdfOptions) {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // 封面
  const rose = hexToRgb(ROSE);
  const pink = hexToRgb(PINK);

  // 渐变背景效果：用色块模拟
  doc.setFillColor(rose[0], rose[1], rose[2]);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  doc.setFillColor(pink[0], pink[1], pink[2]);
  doc.circle(pageWidth, 0, 120, "F");
  doc.setFillColor(255, 255, 255);
  doc.circle(0, pageHeight, 100, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(32);
  doc.setFont("helvetica", "bold");
  doc.text("LoveMemo", pageWidth / 2, pageHeight / 2 - 30, { align: "center" });

  doc.setFontSize(16);
  doc.setFont("helvetica", "normal");
  doc.text("恋爱纪念册", pageWidth / 2, pageHeight / 2 - 18, { align: "center" });

  if (options.coupleName) {
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text(options.coupleName, pageWidth / 2, pageHeight / 2 + 10, {
      align: "center",
    });
  }

  if (options.startDate && options.daysTogether !== null) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(
      `从 ${options.startDate} 至今，已相恋 ${options.daysTogether} 天`,
      pageWidth / 2,
      pageHeight / 2 + 22,
      { align: "center" },
    );
  }

  doc.setFontSize(10);
  doc.text(
    `共记录 ${options.events.length} 个故事`,
    pageWidth / 2,
    pageHeight / 2 + 32,
    { align: "center" },
    );

  // 故事页
  const slate = hexToRgb(SLATE);
  const grey = hexToRgb(GREY);

  for (let i = 0; i < options.events.length; i++) {
    const event = options.events[i];
    doc.addPage();

    // 页眉装饰线
    doc.setDrawColor(rose[0], rose[1], rose[2]);
    doc.setLineWidth(1);
    doc.line(margin, 18, pageWidth - margin, 18);

    // 日期
    doc.setTextColor(grey[0], grey[1], grey[2]);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(event.date, margin, 30);

    // 标题
    doc.setTextColor(slate[0], slate[1], slate[2]);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    const titleLines = doc.splitTextToSize(event.title, contentWidth);
    doc.text(titleLines, margin, 38);

    let y = 38 + titleLines.length * 7 + 6;

    // 地点
    if (event.location) {
      doc.setTextColor(grey[0], grey[1], grey[2]);
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.text(`地点：${event.location}`, margin, y);
      y += 8;
    }

    // 内容
    if (event.content) {
      doc.setTextColor(slate[0], slate[1], slate[2]);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      const contentLines = doc.splitTextToSize(event.content, contentWidth);
      doc.text(contentLines, margin, y);
      y += contentLines.length * 5 + 8;
    }

    // 标签
    if (event.tags) {
      doc.setTextColor(rose[0], rose[1], rose[2]);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const tagText = event.tags
        .split(/[,，]/)
        .map((t) => `#${t.trim()}`)
        .join("  ");
      const tagLines = doc.splitTextToSize(tagText, contentWidth);
      doc.text(tagLines, margin, y);
    }

    // 页脚
    doc.setTextColor(grey[0], grey[1], grey[2]);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(
      `LoveMemo · 第 ${i + 1} / ${options.events.length} 页`,
      pageWidth / 2,
      pageHeight - 12,
      { align: "center" },
    );
  }

  const fileName = options.coupleName
    ? `LoveMemo_${options.coupleName}.pdf`
    : "LoveMemo_纪念册.pdf";
  doc.save(fileName);
}
