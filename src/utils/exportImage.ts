import { toPng } from "html-to-image";

type ToPngOptions = Parameters<typeof toPng>[1];

const colorCache = new Map<string, string>();

function oklchToRgb(value: string): string {
  if (colorCache.has(value)) return colorCache.get(value)!;

  const el = document.createElement("div");
  el.style.color = value;
  document.body.appendChild(el);
  const computed = getComputedStyle(el).color;
  document.body.removeChild(el);

  const result = computed && computed !== "rgba(0, 0, 0, 0)" ? computed : value;
  colorCache.set(value, result);
  return result;
}

function sanitizeCssValue(value: string): string {
  if (!value.includes("oklch")) return value;
  return value.replace(/oklch\([^)]+\)/g, (match) => oklchToRgb(match));
}

interface StyleOverride {
  element: HTMLElement;
  property: string;
  originalValue: string | null;
  originalPriority: string | null;
}

/**
 * 将 DOM 节点中的 oklch 颜色临时转换为浏览器 SVG 序列化支持的 rgb，
 * 然后调用 html-to-image 生成 PNG，最后恢复原始样式。
 */
export async function exportToPng(
  node: HTMLElement,
  options?: ToPngOptions,
): Promise<string> {
  const overrides: StyleOverride[] = [];

  try {
    const elements = [node, ...Array.from(node.querySelectorAll("*"))].filter(
      (el): el is HTMLElement => el instanceof HTMLElement,
    );

    for (const el of elements) {
      const computed = getComputedStyle(el);
      const props = new Set<string>();

      for (let i = 0; i < computed.length; i++) {
        const prop = computed[i];
        if (computed.getPropertyValue(prop).includes("oklch")) {
          props.add(prop);
        }
      }

      for (const prop of Array.from(computed)) {
        if (
          prop.startsWith("--") &&
          computed.getPropertyValue(prop).includes("oklch")
        ) {
          props.add(prop);
        }
      }

      for (const prop of props) {
        const value = computed.getPropertyValue(prop);
        const originalValue = el.style.getPropertyValue(prop);
        const originalPriority = el.style.getPropertyPriority(prop);
        el.style.setProperty(prop, sanitizeCssValue(value), "important");
        overrides.push({ element: el, property: prop, originalValue, originalPriority });
      }
    }

    return await toPng(node, options);
  } finally {
    for (const override of overrides) {
      if (!override.originalValue) {
        override.element.style.removeProperty(override.property);
      } else {
        override.element.style.setProperty(
          override.property,
          override.originalValue,
          override.originalPriority || "",
        );
      }
    }
  }
}
