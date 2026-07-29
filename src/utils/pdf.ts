import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export interface PdfOptions {
  coupleName?: string;
  startDate?: string;
  daysTogether?: number | null;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function exportElementToPdf(element: HTMLElement, options?: PdfOptions) {
  // 等待页面字体加载完成，避免截图时中文渲染为默认字体/乱码
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  // 深度克隆要导出的节点
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.margin = "0";
  clone.style.padding = "40px";
  clone.style.width = "794px"; // A4 96dpi
  clone.style.boxSizing = "border-box";
  clone.style.fontFamily =
    '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
  clone.style.color = "#1f2937";
  clone.style.backgroundColor = "#ffffff";

  // 临时容器：放在可视区域内但层级最低，确保 html2canvas 能正常渲染
  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.left = "0";
  wrapper.style.top = "0";
  wrapper.style.width = "794px";
  wrapper.style.zIndex = "-9999";
  wrapper.style.opacity = "0";
  wrapper.style.pointerEvents = "none";
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  // 强制重排并重绘
  wrapper.getBoundingClientRect();
  await wait(200);

  try {
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      width: 794,
      windowWidth: 794,
      logging: false,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = 210;
    const pageHeight = 297;
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * pageWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const fileName = options?.coupleName
      ? `LoveMemo_${options.coupleName}.pdf`
      : "LoveMemo_纪念册.pdf";
    pdf.save(fileName);
  } finally {
    document.body.removeChild(wrapper);
  }
}
