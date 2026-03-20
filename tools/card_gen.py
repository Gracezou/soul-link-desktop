#!/usr/bin/env python3
"""
SillyTavern Character Card Tool
================================
将角色卡 JSON 嵌入 PNG 图片的 tEXt/chara chunk，
或从已有的角色卡 PNG 中提取 JSON。

兼容 SillyTavern V1 / V2 和 openclaw-rp-plugin 的 import-card 命令。

用法:
  # 嵌入: 将 JSON 写入 PNG
  python card_tool.py embed --json baiyuan_card.json --image avatar.png --output baiyuan_card_final.png

  # 提取: 从 PNG 中读取 JSON
  python card_tool.py extract --image some_card.png --output extracted.json

  # 创建占位图 + 嵌入 (没有现成图片时)
  python card_tool.py embed --json baiyuan_card.json --output baiyuan_card_final.png --placeholder

依赖: 仅 Python 标准库 (无需 pip install)
"""

import argparse
import base64
import json
import struct
import sys
import zlib
import os
from typing import Optional


# ── PNG 基础操作 ──

def read_png_chunks(data: bytes) -> list[tuple[bytes, bytes]]:
    """读取 PNG 文件的所有 chunk"""
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError("不是有效的 PNG 文件")

    chunks = []
    offset = 8
    while offset < len(data):
        length = struct.unpack('>I', data[offset:offset+4])[0]
        chunk_type = data[offset+4:offset+8]
        chunk_data = data[offset+8:offset+8+length]
        # crc = data[offset+8+length:offset+12+length]
        chunks.append((chunk_type, chunk_data))
        offset += 12 + length
    return chunks


def write_png_chunks(chunks: list[tuple[bytes, bytes]]) -> bytes:
    """将 chunk 列表写回 PNG 字节"""
    result = b'\x89PNG\r\n\x1a\n'
    for chunk_type, chunk_data in chunks:
        result += struct.pack('>I', len(chunk_data))
        result += chunk_type
        result += chunk_data
        crc = zlib.crc32(chunk_type + chunk_data) & 0xffffffff
        result += struct.pack('>I', crc)
    return result


def create_placeholder_png(width=400, height=600) -> bytes:
    """
    创建一个纯色占位 PNG (深蓝灰色背景)。
    不依赖任何第三方库,纯手工构建 PNG。
    """
    # 每行: filter byte (0) + RGB * width
    raw_rows = b''
    r, g, b = 45, 52, 70  # 深蓝灰色
    row_data = b'\x00' + bytes([r, g, b] * width)
    for _ in range(height):
        raw_rows += row_data

    # IHDR
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)

    # IDAT
    compressed = zlib.compress(raw_rows)

    # 构建 chunks
    chunks = [
        (b'IHDR', ihdr_data),
        (b'IDAT', compressed),
        (b'IEND', b''),
    ]
    return write_png_chunks(chunks)


# ── 角色卡嵌入 / 提取 ──

def embed_card_into_png(png_data: bytes, card_json: dict) -> bytes:
    """将角色卡 JSON 以 base64 编码写入 PNG 的 tEXt chunk (keyword: chara)"""
    json_str = json.dumps(card_json, ensure_ascii=False, separators=(',', ':'))
    b64_encoded = base64.b64encode(json_str.encode('utf-8'))

    # tEXt chunk 格式: keyword + null byte + text
    text_data = b'chara\x00' + b64_encoded

    chunks = read_png_chunks(png_data)

    # 移除已有的 chara tEXt chunk (如果存在)
    chunks = [
        (ct, cd) for ct, cd in chunks
        if not (ct == b'tEXt' and cd.startswith(b'chara\x00'))
    ]

    # 在 IEND 之前插入新的 tEXt chunk
    new_chunks = []
    for ct, cd in chunks:
        if ct == b'IEND':
            new_chunks.append((b'tEXt', text_data))
        new_chunks.append((ct, cd))

    return write_png_chunks(new_chunks)


def extract_card_from_png(png_data: bytes) -> Optional[dict]:
    """从 PNG 的 tEXt/chara chunk 中提取角色卡 JSON"""
    chunks = read_png_chunks(png_data)
    for chunk_type, chunk_data in chunks:
        if chunk_type == b'tEXt' and chunk_data.startswith(b'chara\x00'):
            b64_data = chunk_data[6:]  # skip "chara\0"
            json_str = base64.b64decode(b64_data).decode('utf-8')
            return json.loads(json_str)
    return None


# ── CLI ──

def cmd_embed(args):
    # 读取 JSON
    with open(args.json, 'r', encoding='utf-8') as f:
        card_json = json.load(f)

    # 验证基本结构
    if 'spec' in card_json and card_json.get('spec') == 'chara_card_v2':
        card_name = card_json.get('data', {}).get('name', '未知')
        print(f"✓ 检测到 V2 角色卡: {card_name}")
    elif 'name' in card_json:
        card_name = card_json.get('name', '未知')
        print(f"✓ 检测到 V1 角色卡: {card_name}")
    else:
        print("⚠ 警告: JSON 结构不符合标准角色卡格式，仍将继续嵌入")

    # 读取或创建 PNG
    if args.placeholder or not args.image:
        print("→ 使用占位图 (400x600 深蓝灰)")
        png_data = create_placeholder_png()
    else:
        with open(args.image, 'rb') as f:
            png_data = f.read()
        print(f"✓ 读取图片: {args.image}")

        # 如果是 JPG/JPEG，自动转换为 PNG
        if png_data[:2] == b'\xff\xd8':
            print("→ 检测到 JPEG 格式，自动转换为 PNG...")
            try:
                from PIL import Image
                import io
                img = Image.open(io.BytesIO(png_data)).convert('RGB')
                buf = io.BytesIO()
                img.save(buf, format='PNG')
                png_data = buf.getvalue()
                print(f"✓ 转换完成 ({img.size[0]}x{img.size[1]})")
            except ImportError:
                print("✗ 需要 Pillow 库来转换 JPG → PNG")
                print("  安装: pip install Pillow")
                print("  或者先手动转换图片为 PNG 格式后再使用")
                sys.exit(1)

    # 嵌入
    result = embed_card_into_png(png_data, card_json)

    # 写出
    output = args.output or f"{card_name}_card.png"
    with open(output, 'wb') as f:
        f.write(result)

    size_kb = len(result) / 1024
    print(f"✓ 角色卡已生成: {output} ({size_kb:.1f} KB)")
    print(f"\n导入命令:")
    print(f"  方式1 (JSON直接导入):  /rp import-card  然后附上 {args.json}")
    print(f"  方式2 (PNG图片导入):   /rp import-card  然后附上 {output}")


def cmd_extract(args):
    with open(args.image, 'rb') as f:
        png_data = f.read()

    card = extract_card_from_png(png_data)
    if card is None:
        print("✗ 未在该 PNG 中找到角色卡数据 (tEXt/chara)")
        sys.exit(1)

    card_name = card.get('data', {}).get('name', card.get('name', '未知'))
    print(f"✓ 提取到角色卡: {card_name}")

    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(card, f, ensure_ascii=False, indent=2)
        print(f"✓ 已保存到: {args.output}")
    else:
        print(json.dumps(card, ensure_ascii=False, indent=2))


def main():
    parser = argparse.ArgumentParser(
        description='SillyTavern 角色卡工具 - 嵌入/提取 PNG 角色卡',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s embed --json baiyuan_card.json --placeholder --output baiyuan.png
  %(prog)s embed --json baiyuan_card.json --image avatar.png --output baiyuan.png
  %(prog)s extract --image downloaded_card.png --output card.json
        """
    )
    sub = parser.add_subparsers(dest='command', required=True)

    # embed 子命令
    p_embed = sub.add_parser('embed', help='将 JSON 角色卡嵌入 PNG')
    p_embed.add_argument('--json', required=True, help='角色卡 JSON 文件路径')
    p_embed.add_argument('--image', help='底图 PNG 路径 (可选)')
    p_embed.add_argument('--output', '-o', help='输出文件路径')
    p_embed.add_argument('--placeholder', action='store_true',
                         help='没有底图时生成占位图')

    # extract 子命令
    p_extract = sub.add_parser('extract', help='从 PNG 角色卡中提取 JSON')
    p_extract.add_argument('--image', required=True, help='角色卡 PNG 文件路径')
    p_extract.add_argument('--output', '-o', help='输出 JSON 路径 (不指定则打印到终端)')

    args = parser.parse_args()
    if args.command == 'embed':
        cmd_embed(args)
    elif args.command == 'extract':
        cmd_extract(args)


if __name__ == '__main__':
    main()