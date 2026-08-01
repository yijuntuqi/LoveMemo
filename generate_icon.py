"""
LoveMemo 图标生成脚本
从 icon.svg 生成多分辨率 ICO 和 PNG 图标文件
"""
import os
import cairosvg
from PIL import Image
from io import BytesIO

SVG_PATH = os.path.join("src-tauri", "icons", "icon.svg")
ICONS_DIR = os.path.join("src-tauri", "icons")

# ICO 需要的尺寸
ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
# PNG 需要的尺寸
PNG_SIZES = {
    "32x32.png": 32,
    "64x64.png": 64,
    "128x128.png": 128,
    "128x128@2x.png": 256,
    "icon.png": 512,
}

def svg_to_png(svg_path, size):
    """将 SVG 转为指定尺寸的 PNG"""
    png_data = cairosvg.svg2png(url=svg_path, output_width=size, output_height=size)
    return Image.open(BytesIO(png_data)).convert("RGBA")

def main():
    print(f"从 {SVG_PATH} 生成图标...")

    # 生成 ICO
    images = []
    for size in ICO_SIZES:
        img = svg_to_png(SVG_PATH, size)
        images.append(img)
        print(f"  ICO 尺寸 {size}x{size} 已生成")

    ico_path = os.path.join(ICONS_DIR, "icon.ico")
    images[0].save(ico_path, format="ICO", sizes=[(s, s) for s in ICO_SIZES], append_images=images[1:])
    print(f"  已保存: {ico_path}")

    # 生成 PNG
    for filename, size in PNG_SIZES.items():
        img = svg_to_png(SVG_PATH, size)
        png_path = os.path.join(ICONS_DIR, filename)
        img.save(png_path, format="PNG")
        print(f"  已保存: {png_path} ({size}x{size})")

    print("图标生成完成!")

if __name__ == "__main__":
    main()
