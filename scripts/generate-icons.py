import os
import struct
import zlib

def create_png(width, height, r, g, b):
    # PNG signature
    signature = b'\x89PNG\r\n\x1a\n'

    # IHDR chunk
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data)
    ihdr_chunk = struct.pack('>I', 13) + b'IHDR' + ihdr_data + struct.pack('>I', ihdr_crc)

    # IDAT chunk
    row_size = width * 3 + 1
    raw_data = bytearray(height * row_size)

    for y in range(height):
        row_offset = y * row_size
        raw_data[row_offset] = 0 # No filter
        for x in range(width):
            px_offset = row_offset + 1 + x * 3
            is_border = (x == 0 or x == width - 1 or y == 0 or y == height - 1)
            if is_border:
                raw_data[px_offset] = 180
                raw_data[px_offset + 1] = 0
                raw_data[px_offset + 2] = 0
            else:
                raw_data[px_offset] = r
                raw_data[px_offset + 1] = g
                raw_data[px_offset + 2] = b

    compressed_data = zlib.compress(bytes(raw_data))
    idat_crc = zlib.crc32(b'IDAT' + compressed_data)
    idat_chunk = struct.pack('>I', len(compressed_data)) + b'IDAT' + compressed_data + struct.pack('>I', idat_crc)

    # IEND chunk
    iend_crc = zlib.crc32(b'IEND')
    iend_chunk = struct.pack('>I', 0) + b'IEND' + struct.pack('>I', iend_crc)

    return signature + ihdr_chunk + idat_chunk + iend_chunk

icons_dir = os.path.join(os.path.dirname(__file__), '..', 'icons')
os.makedirs(icons_dir, exist_ok=True)

for size in (16, 48, 128):
    png_bytes = create_png(size, size, 255, 0, 51)
    file_path = os.path.join(icons_dir, f'icon-{size}.png')
    with open(file_path, 'wb') as f:
        f.write(png_bytes)
    print(f"Generated {file_path} ({size}x{size})")
